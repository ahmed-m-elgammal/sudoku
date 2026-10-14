// ASSIZE authoritative duel server (spec §6, §7): Fastify REST + socket.io (over WebSocket)
// matchmaking with Shade fallback at 4s, server-validated duels, disconnect grace, anticheat.
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as IoServer, type Socket } from 'socket.io';
import { createServer } from 'node:http';
import {
  createDuel, place, useAbility, tick, resign, serializeDuel,
  type DuelState,
} from '../../shared/engine';
import { generatePuzzle, generateDaily, dailySeed } from '../../shared/sudoku';
import { profileForStanding, shadeAct } from '../../shared/shade';
import { Rng, todayUtcKey } from '../../shared/rng';
import { sanitizeInkEntries, settleInkEntries, parseLedgerColumn, type InkEntry } from '../../shared/inkLedger';
import type { AbilityId, Digit, OrderId, PlayerId, Tier } from '../../shared/config';
import { q, hash, adjustRating, todayKey } from './db';

const PORT = Number(process.env.PORT ?? 3030); // sandbox contract kept as the default; hosts override via env
const SHADE_FALLBACK_MS = 4000; // spec §7 (configurable, spec M2)
const GRACE_MS = 20_000;
const app = Fastify({ logger: false, trustProxy: true }); // trustProxy: behind Caddy every socket reads 127.0.0.1 — without it per-IP throttles collapse to one global bucket
await app.register(cors, { origin: true });

const http = createServer();
const io = new IoServer(http, { cors: { origin: '*', methods: ['GET', 'POST'] }, pingTimeout: 60_000, pingInterval: 25_000 });

// ------------------------------------------------------------------ helpers
const auth = (id: string, secret: string) => {
  const acc = q.getAccount.get(id) as { id: string; secret_hash: string; name: string; standing: number; shadow: number } | null;
  if (!acc || acc.secret_hash !== hash(secret)) return null;
  return acc;
};

interface Room {
  id: string;
  mode: 'ranked' | 'friend';
  state: DuelState;
  solution: Uint8Array;
  seats: Map<string, PlayerId>;       // socketId -> seat
  accounts: [string | null, string | null];
  names: [string, string];
  lastPlaceAt: [number, number];
  intervals: [number[], number[]]; // SEC-09: per-seat rings (never interleaved, never the epoch gap)
  disconnectAt: [number | null, number | null];
  lastGraceEmitAt: [number, number];  // reconnect_grace is re-emitted at 1s cadence
  shadeSeat?: PlayerId;
  shadeNextAtMs?: number; // SEC-05 pacing gate (performance.now basis, cp. shadeAct untilMs)
  shadeRng?: Rng | null; // SEC-05 persistent bot stream (never re-seeded per tick)
  tier: Tier;
  startedAt: number;
  settled: boolean; // finishRoom runs exactly once; natural (tick) ends settle here too
}

const rooms = new Map<string, Room>();
const queue: Array<{ socketId: string; accountId: string; name: string; standing: number; order: OrderId; joinedAt: number; friendCode?: string }> = [];

const GRACE_S = GRACE_MS / 1000;

// SEC-05: the Shade profile is fixed (standing 1000) — build once, not per tick per room.
const SHADE_PROFILE = profileForStanding(1000);

// S08 (TODO T2): tell the remaining seat that its peer dropped, and re-emit the
// remaining grace every second while the room is live.
function emitGrace(r: Room, goneSeat: PlayerId, now: number) {
  const left = Math.max(0, Math.ceil((GRACE_MS - (now - (r.disconnectAt[goneSeat] ?? now))) / 1000));
  for (const [sid, seat] of r.seats) {
    if (seat === goneSeat) continue;
    if (now - r.lastGraceEmitAt[goneSeat] >= 1000) {
      io.to(sid).emit('reconnect_grace', { s: left, seat: goneSeat });
    }
  }
  if (now - r.lastGraceEmitAt[goneSeat] >= 1000) r.lastGraceEmitAt[goneSeat] = now;
}

// SEC-10: ability secrets are per-seat. Augur's digit and Fair Copy's candidates
// solve cells neither board has filled (same puzzle both sides) — the foe's client
// gets the cast (cell/box, for fx) but never the solution-derived payload.
function scrubEventFor<T>(e: T, seat: PlayerId): T {
  const ev = e as unknown as { kind?: unknown; player?: unknown; ability?: unknown };
  if (ev.kind !== 'ability' || ev.player === seat) return e;
  if (ev.ability !== 'augur' && ev.ability !== 'fairCopy') return e;
  const rest = { ...(e as Record<string, unknown>) };
  delete rest.digit;
  delete rest.candidates;
  return rest as T;
}

const publicState = (r: Room, seat: PlayerId) => {
  // spec: solution never sent to the client in PvP; boards are per-seat
  const s = r.state;
  return {
    duelId: r.id, clockMs: s.clockMs, phase: s.phase, winner: s.winner, winReason: s.winReason,
    givens: Array.from(s.givens),
    you: {
      seat, seals: s.players[seat].seals, board: Array.from(s.players[seat].board),
      progress: s.players[seat].progress, mistakes: s.players[seat].mistakes,
      abilities: s.players[seat].abilities, statuses: s.players[seat].statuses,
      immuneUntil: s.players[seat].immuneUntil, claimed: s.players[seat].claimed,
      reckoningUntilMs: s.players[seat].reckoningUntilMs, wardUntilMs: s.players[seat].wardUntilMs, mirrorUntilMs: s.players[seat].mirrorUntilMs,
    },
    foe: {
      name: r.names[seat === 0 ? 1 : 0],
      seals: s.players[seat === 0 ? 1 : 0].seals, progress: s.players[seat === 0 ? 1 : 0].progress,
      board: Array.from(s.players[seat === 0 ? 1 : 0].board),
      claimed: s.players[seat === 0 ? 1 : 0].claimed,
      statuses: s.players[seat === 0 ? 1 : 0].statuses,
    },
    unitOwner: s.unitOwner,
    events: s.events.slice(-30).map((e) => scrubEventFor(e, seat)),
    eventSeq: s.eventSeq,
  };
};

function finishRoom(r: Room, winner: PlayerId | 'draw', reason: string) {
  if (r.settled) return;
  r.settled = true;
  if (winner === 'draw') {
    // sudden judgment draw already handled by tick; force draw end
    (r.state as { phase: string; winner: unknown; winReason: string }).phase = 'ended';
    (r.state as { winner: unknown }).winner = 'draw';
    (r.state as { winReason: string }).winReason = 'suddenJudgment';
  } else {
    // resign() takes the RESIGNER and no-ops unless live: on tick-resolved ends
    // the engine verdict stands untouched; on concede/forfeit it records the loss.
    resign(r.state, winner === 0 ? 1 : 0);
  }
  const ratings: [number | null, number | null] = [null, null];
  if (r.mode === 'ranked' && r.accounts[0] && r.accounts[1]) {
    const a0 = q.getAccount.get(r.accounts[0]!) as { standing: number };
    const a1 = q.getAccount.get(r.accounts[1]!) as { standing: number };
    const score = winner === 0 ? 1 : winner === 'draw' ? 0.5 : 0;
    const { a, b, da } = adjustRating(a0.standing, a1.standing, score);
    q.updateStanding.run(a, r.accounts[0]!);
    q.updateStanding.run(b, r.accounts[1]!);
    ratings[0] = da; ratings[1] = -da;
  }
  q.insertDuel.run(r.id, r.mode, r.accounts[0], r.accounts[1], r.state.seed, r.tier, String(winner), reason, ratings[0], ratings[1], Date.now());
  for (const [sid, seat] of r.seats) {
    io.to(sid).emit('end', {
      // winner is the ABSOLUTE seat (0/1/'draw'): each client maps to relative once.
      duelId: r.id, winner,
      reason, you: publicState(r, seat), ratingDelta: ratings[seat as 0 | 1],
    });
  }
  setTimeout(() => rooms.delete(r.id), 60_000);
}

// ------------------------------------------------------------------ tick loop
setInterval(() => {
  try {
  for (const r of rooms.values()) {
    // SEC-01: settle async-ended rooms FIRST — place()/ability() flip phase outside
    // the tick, and the live-skip below would otherwise starve finishRoom forever.
    if ((r.state as { phase: string }).phase === 'ended') {
      if (!r.settled) finishRoom(r, (r.state as { winner: unknown }).winner as PlayerId | 'draw', (r.state as { winReason: string }).winReason ?? 'suddenJudgment');
      continue;
    }
    if ((r.state as { phase: string }).phase !== 'live') continue;
    tick(r.state, 250);
    // Shade action for bot seats (SEC-05): paced, never per-tick. A `wait` gates
    // the next act on its own untilMs; placements/abilities respect the profile's
    // placeDelayMs band. The RNG stream persists across ticks — the old code
    // re-seeded from a static eventSeq, freezing on `wait` until the human moved.
    if (r.shadeSeat !== undefined && r.shadeRng) {
      const rng: Rng = r.shadeRng;
      const st = r.state;
      const now = performance.now();
      if (now >= (r.shadeNextAtMs ?? 0)) {
        const me = r.shadeSeat;
        const act = shadeAct(st, me, SHADE_PROFILE, () => rng.next(), now);
        if (act.kind === 'place') {
          place(st, me, act.cell, act.digit);
          r.shadeNextAtMs = now + rng.range(SHADE_PROFILE.placeDelayMs[0], SHADE_PROFILE.placeDelayMs[1]);
        } else if (act.kind === 'ability') {
          useAbility(st, me, act.id, { cell: act.cell, unit: act.unit });
          r.shadeNextAtMs = now + rng.range(SHADE_PROFILE.placeDelayMs[0], SHADE_PROFILE.placeDelayMs[1]);
        } else {
          r.shadeNextAtMs = act.untilMs;
        }
      }
    }
    // disconnect grace (S08): forfeit at 20s, ticking countdown to the seat that stayed
    const now = Date.now();
    for (const seat of [0, 1] as PlayerId[]) {
      const dAt = r.disconnectAt[seat];
      if (dAt && now - dAt > GRACE_MS) { finishRoom(r, seat === 0 ? 1 : 0, 'forfeit'); break; }
      if (dAt) emitGrace(r, seat, now);
    }
    if ((r.state as { phase: string }).phase === 'ended') {
      finishRoom(r, (r.state as { winner: unknown }).winner as PlayerId, (r.state as { winReason: string }).winReason ?? 'suddenJudgment');
      continue;
    }
    // state_delta removed: no client subscribes (was 4Hz dead traffic per room).
    // Per-seat snapshots below are the live channel.
    for (const [sid, seat] of r.seats) io.to(sid).emit('you', publicState(r, seat));
  }
  } catch (e) { console.error('[assize-server] tick error', e); }
}, 250);

// ------------------------------------------------------------------ matchmaking
setInterval(() => {
  try {
  const now = Date.now();
  for (let i = queue.length - 1; i >= 0; i--) {
    const p = queue[i];
    if (!p) continue; // stale index after a double splice below
    const waited = now - p.joinedAt;
    // widen window every 2s (spec §7)
    const window = 50 + Math.floor(waited / 2000) * 75;
    let opponentIdx = -1;
    for (let j = 0; j < queue.length; j++) {
      if (j === i) continue;
      const o = queue[j];
      if (!o) continue;
      if (p.friendCode && o.friendCode && p.friendCode === o.friendCode && o.socketId !== p.socketId && o.accountId !== p.accountId) { opponentIdx = j; break; }
      if (!p.friendCode && !o.friendCode && o.accountId !== p.accountId && Math.abs(o.standing - p.standing) <= window) { opponentIdx = j; break; }
    }
    if (opponentIdx >= 0) {
      const o = queue[opponentIdx];
      // never pair a socket that has already gone away (ghost entries)
      const alive = (e: typeof queue[number]) => io.sockets.sockets.has(e.socketId);
      if (!alive(p) || !alive(o)) {
        if (!alive(p)) queue.splice(i, 1);
        if (!alive(o)) queue.splice(Math.max(0, queue.indexOf(o)), 1);
        continue;
      }
      // remove both entries — higher index first so the lower one stays valid
      queue.splice(Math.max(i, opponentIdx), 1);
      queue.splice(Math.min(i, opponentIdx), 1);
      startHumanDuel(p, o);
      continue;
    }
    // Friend codes wait for a HUMAN (specs/17 4.6 — "two parties pair on the code").
    // A Shade fallback here dragged the host into a RATED duel while their friend was
    // still typing the code, so the pairing only worked if the guest arrived inside
    // 4 s. Friend entries linger until their partner joins, the client's leave_queue
    // (screen unmount), or the dead-socket reap below; ranked entries keep the 4 s
    // fallback (spec §7) untouched.
    if (p.friendCode) {
      if (!io.sockets.sockets.has(p.socketId)) queue.splice(i, 1);
      continue;
    }
    if (waited >= SHADE_FALLBACK_MS) {
      queue.splice(i, 1);
      startShadeDuel(p);
    }
  }
  } catch (e) { console.error('[assize-server] matchmaking error', e); }
}, 500);

function startHumanDuel(a: typeof queue[number], b: typeof queue[number]) {
  const id = crypto.randomUUID();
  const seed = `pvp-${id}`;
  const tier: Tier = 'Medium';
  const puz = generatePuzzle(seed, tier);
  const state = createDuel({
    seed, givens: Uint8Array.from(puz.givens),
    solution: Uint8Array.from(puz.solution), // server-private: place() rejects everything without it
    names: [a.name, b.name],
    orders: [a.order, b.order],
  });
  const room: Room = {
    id, mode: a.friendCode ? 'friend' : 'ranked', state, solution: Uint8Array.from(puz.solution),
    seats: new Map(), accounts: [a.accountId, b.accountId], names: [a.name, b.name],
    lastPlaceAt: [0, 0], intervals: [[], []], disconnectAt: [null, null], lastGraceEmitAt: [0, 0], tier, startedAt: Date.now(), settled: false,
  };
  rooms.set(id, room);
  const sa = io.sockets.sockets.get(a.socketId);
  const sb = io.sockets.sockets.get(b.socketId);
  if (sa) { room.seats.set(sa.id, 0); sa.join(id); sa.emit('matched', matchedPayload(room, 0, b, tier)); }
  if (sb) { room.seats.set(sb.id, 1); sb.join(id); sb.emit('matched', matchedPayload(room, 1, a, tier)); }
}

function matchedPayload(r: Room, seat: PlayerId, foe: typeof queue[number], tier: Tier) {
  return {
    duelId: r.id, seat, seed: r.state.seed, givens: Array.from(r.state.givens), tier,
    foe: { name: foe.name, order: foe.order, shade: false, standing: foe.standing },
    stakes: { tier, range: [Math.round(0.9 * foe.standing), Math.round(1.1 * foe.standing)] },
  };
}

function startShadeDuel(p: typeof queue[number]) {
  const id = crypto.randomUUID();
  const seed = `shade-${id}`;
  const tier: Tier = 'Medium';
  const puz = generatePuzzle(seed, tier);
  const state = createDuel({
    seed, givens: Uint8Array.from(puz.givens),
    solution: Uint8Array.from(puz.solution), // server-private: place() rejects everything without it
    names: [p.name, `Shade of ${p.name.split(' ').slice(-1)[0]}`],
    orders: [p.order, 'executioner'],
  });
  const room: Room = {
    id, mode: 'ranked', state, solution: Uint8Array.from(puz.solution),
    seats: new Map(), accounts: [p.accountId, null], names: [p.name, `Shade of ${p.name.split(' ').slice(-1)[0]}`],
    lastPlaceAt: [0, 0], intervals: [[], []], disconnectAt: [null, null], lastGraceEmitAt: [0, 0], shadeSeat: 1, shadeNextAtMs: performance.now() + 1500, shadeRng: new Rng(`shade-${id}`), tier, startedAt: Date.now(), settled: false,
  };
  rooms.set(id, room);
  const s = io.sockets.sockets.get(p.socketId);
  if (s) {
    room.seats.set(s.id, 0);
    s.join(id);
    s.emit('matched', {
      duelId: id, seat: 0, seed, givens: Array.from(puz.givens), tier,
      foe: { name: room.names[1], order: 'executioner', shade: true, standing: p.standing },
      stakes: { tier, range: [0, 0] },
    });
  }
}

// ------------------------------------------------------------------ sockets
io.on('connection', (socket: Socket) => {
  socket.on('join_queue', (p: { accountId: string; secret: string; name: string; order: OrderId; friendCode?: string }) => {
    const acc = auth(p.accountId, p.secret);
    if (!acc) { socket.emit('error', { code: 'auth' }); return; }
    // anticheat: shadow-queued accounts only meet Shades (spec §6)
    if (acc.shadow) { startShadeDuel({ socketId: socket.id, accountId: acc.id, name: acc.name, standing: acc.standing, order: p.order, joinedAt: Date.now() }); return; }
    // SEC-06: one queue slot per socket AND per account. Same-socket resubscribe
    // (remount/retry) refreshes intent in place but keeps its fairness timestamp;
    // a second socket for an already-queued account is rejected, never appended.
    const sameSocket = queue.find((e) => e.socketId === socket.id);
    if (sameSocket) {
      sameSocket.order = p.order;
      sameSocket.friendCode = p.friendCode;
      return;
    }
    if (queue.some((e) => e.accountId === acc.id)) { socket.emit('error', { code: 'already_queued' }); return; }
    queue.push({ socketId: socket.id, accountId: acc.id, name: acc.name, standing: acc.standing, order: p.order, joinedAt: Date.now(), friendCode: p.friendCode });
  });

  socket.on('join_duel', (p: { duelId: string; accountId: string; secret: string }) => {
    const acc = auth(p.accountId, p.secret);
    const r = rooms.get(p.duelId);
    // hijack guard: only a seated account may join its duel (never default a seat)
    if (!acc || !r || (r.accounts[0] !== acc.id && r.accounts[1] !== acc.id)) { socket.emit('error', { code: 'duel' }); return; }
    const seat: PlayerId = r.accounts[0] === acc.id ? 0 : 1;
    const resumed = r.disconnectAt[seat] !== null;
    r.seats.set(socket.id, seat);
    r.disconnectAt[seat] = null;
    socket.join(p.duelId);
    socket.emit('matched', { duelId: r.id, seat, seed: r.state.seed, givens: Array.from(r.state.givens), tier: r.tier, foe: { name: r.names[seat === 0 ? 1 : 0], order: 'scholar', shade: r.shadeSeat === (seat === 0 ? 1 : 0), standing: 1000 }, stakes: { tier: r.tier, range: [0, 0] } });
    // S08 resume: instant snapshot + tell the seat that stayed that its peer is back
    socket.emit('reconnect_ok', { you: publicState(r, seat) });
    if (resumed) {
      for (const [sid, s] of r.seats) if (s !== seat) io.to(sid).emit('peer_reconnected', { seat });
    }
  });

  // the client left matchmaking (Shade fallback / withdraw): drop ALL of its
  // queue entries (SEC-06: duplicates must never survive a leave)
  socket.on('leave_queue', () => {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i]?.socketId === socket.id) queue.splice(i, 1);
    }
  });

  socket.on('place', (p: { duelId: string; cell: number; digit: number }) => {
    const r = rooms.get(p.duelId);
    const seat = r?.seats.get(socket.id);
    if (!r || seat === undefined || (r.state as { phase: string }).phase !== 'live') return;
    // anticheat: impossible placement interval (spec §6)
    const now = Date.now();
    const prev = r.lastPlaceAt[seat];
    const gap = now - prev;
    if (prev && gap < 120) { q.telemetry.run(`anticheat:fast-place:${r.id}`, now); return; }
    r.lastPlaceAt[seat] = now;
    // SEC-09: per-seat timing ring. The epoch gap (first placement, prev === 0)
    // is skipped — it poisoned the mean forever; rings are bounded at 24.
    if (prev > 0) {
      const iv = r.intervals[seat];
      iv.push(gap);
      if (iv.length > 24) iv.splice(0, iv.length - 24);
      if (iv.length >= 20) {
        const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
        const variance = iv.reduce((a, b) => a + (b - mean) ** 2, 0) / iv.length;
        const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
        if (cv < 0.02) {
          const acc0 = r.accounts[seat];
          if (acc0) q.shadow.run(acc0);
          q.telemetry.run(`anticheat:uniform-timing:${r.id}:${seat}`, now);
          iv.length = 0;
        }
      }
    }
    place(r.state, seat, p.cell, p.digit as Digit);
  });

  socket.on('ability', (p: { duelId: string; ability: AbilityId; cell?: number; unit?: string }) => {
    const r = rooms.get(p.duelId);
    const seat = r?.seats.get(socket.id);
    if (!r || seat === undefined) return;
    useAbility(r.state, seat, p.ability, { cell: p.cell, unit: p.unit });
  });

  socket.on('pencil', () => { /* notes are client-local; server tracks nothing (spec: statuses erase them via events) */ });

  socket.on('concede', (p: { duelId: string }) => {
    const r = rooms.get(p.duelId);
    const seat = r?.seats.get(socket.id);
    if (!r || seat === undefined) return;
    finishRoom(r, seat === 0 ? 1 : 0, 'forfeit');
  });

  socket.on('reconnect', (p: { duelId: string; accountId: string; secret: string }) => {
    const acc = auth(p.accountId, p.secret);
    const r = rooms.get(p.duelId);
    // hijack guard: same as join_duel — strangers get nothing, not seat 1
    if (!acc || !r || (r.accounts[0] !== acc.id && r.accounts[1] !== acc.id)) return;
    const seat: PlayerId = r.accounts[0] === acc.id ? 0 : 1;
    const resumed = r.disconnectAt[seat] !== null;
    r.seats.set(socket.id, seat);
    r.disconnectAt[seat] = null;
    socket.join(p.duelId);
    socket.emit('reconnect_ok', { you: publicState(r, seat) });
    if (resumed) {
      for (const [sid, s] of r.seats) if (s !== seat) io.to(sid).emit('peer_reconnected', { seat });
    }
  });

  socket.on('disconnect', () => {
    for (const r of rooms.values()) {
      const seat = r.seats.get(socket.id);
      if (seat === undefined) continue;
      r.seats.delete(socket.id); // stale socket id: reconnects register a fresh one
      if ((r.state as { phase: string }).phase !== 'live') continue;
      r.disconnectAt[seat] = Date.now();
      r.lastGraceEmitAt[seat] = 0;
      // S08: the seat that stayed learns immediately, then gets 1s grace ticks
      for (const [sid, s] of r.seats) {
        if (s !== seat) io.to(sid).emit('peer_disconnected', { seat, graceS: GRACE_S, name: r.names[seat] });
      }
    }
    // SEC-06: reap ALL entries for the socket, not just the first
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i]?.socketId === socket.id) queue.splice(i, 1);
    }
  });
});

// ------------------------------------------------------------------ REST
await app.post('/api/auth', async (req, reply) => {
  const { id, secret, name, recoveryHash } = req.body as { id: string; secret: string; name?: string; recoveryHash?: string | null };
  if (!id || !secret) return reply.code(400).send({ ok: false });
  const existing = q.getAccount.get(id) as { secret_hash: string; name: string; standing: number; ink: number; recovery_hash: string | null } | null;
  if (existing) {
    if (existing.secret_hash !== hash(secret)) return reply.code(401).send({ ok: false });
    if (name && name !== existing.name) q.updateName.run(name.slice(0, 24), id);
    // SEC-02: existing accounts register recovery codes AFTER creation — persist the
    // hash here too, or recovery stays NULL forever and /api/recovery can never match.
    if (typeof recoveryHash === 'string' && recoveryHash.length > 0 && recoveryHash !== existing.recovery_hash) {
      q.updateRecovery.run(recoveryHash, id);
    }
    const acc = q.getAccount.get(id) as { name: string; standing: number; ink: number };
    return { ok: true, name: acc.name, standing: acc.standing, ink: acc.ink };
  }
  q.insertAccount.run(id, hash(secret), (name ?? 'Unnamed Clerk').slice(0, 24), 1000, recoveryHash ?? null, '[]', Date.now());
  return { ok: true, name: name ?? 'Unnamed Clerk', standing: 1000, ink: 0 };
});

await app.post('/api/queue', async (req, reply) => {
  // REST join is unsupported; matchmaking runs over the socket (join_queue). Kept for the
  // client fallback contract: returns waitMs so the client waits for the socket 'matched'.
  void req; void reply;
  return { waitMs: SHADE_FALLBACK_MS };
});

await app.post('/api/friend/create', async (req, reply) => {
  const { id, secret } = req.body as { id: string; secret: string };
  const acc = auth(id, secret);
  if (!acc) return reply.code(401).send({ ok: false });
  // the code is only a label; BOTH host and guest join the socket queue with it
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  return { ok: true, code };
});

// SEC-11: bounded daily-puzzle cache. The old single-slot cache was evicted by
// alternating ?date= params (each miss blocks the loop 3-12ms in generation),
// so two alternating dates = 100% miss rate. 8 FIFO slots cover real use
// (today + a few neighbours) while junk keys can never pollute it (validated
// below) and history scans can't grow it.
const DAILY_CACHE_MAX = 8;
const DAILY_DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
function sanitizeDailyDateKey(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || !DAILY_DATE_RE.test(raw)) return fallback;
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return fallback;
  // reject rollover dates like 2024-02-31 (Date normalizes them to March)
  if (d.toISOString().slice(0, 10) !== raw) return fallback;
  return raw;
}
const dailyCache = new Map<string, { tier: Tier; givensCount: number }>();

await app.get('/api/daily', async (req, reply) => {
  void reply;
  const rawDate = (req.query as { date?: string }).date;
  const dateKey = sanitizeDailyDateKey(rawDate, todayUtcKey());
  // the daily puzzle is identical all day: generate once per date key instead of
  // re-running backtracking generation on every request (DoS amplifier)
  let cached = dailyCache.get(dateKey);
  if (!cached) {
    const puz = generateDaily(dateKey);
    cached = { tier: puz.tier, givensCount: puz.givensCount };
    if (dailyCache.size >= DAILY_CACHE_MAX) {
      const oldest = dailyCache.keys().next().value;
      if (oldest !== undefined) dailyCache.delete(oldest);
    }
    dailyCache.set(dateKey, cached);
  }
  const board = (q.dailyBoard.all(dateKey) as Array<{ name: string; account_id: string; time_ms: number; mistakes: number }>).map((r2, i) => ({
    rank: i + 1, name: r2.name, timeMs: r2.time_ms, mistakes: r2.mistakes, accountId: r2.account_id,
  }));
  return { ok: true, dateKey, seed: dailySeed(dateKey), tier: cached.tier, givensCount: cached.givensCount, leaderboard: board };
});

await app.post('/api/daily/result', async (req, reply) => {
  const { id, secret, dateKey, timeMs, mistakes, name } = req.body as { id: string; secret: string; dateKey: string; timeMs: number; mistakes: number; name?: string };
  const acc = auth(id, secret);
  if (!acc) return reply.code(401).send({ ok: false });
  if (dateKey !== todayKey()) return reply.code(400).send({ ok: false, error: 'stale' });
  // sanity: a 9x9 cannot be honestly solved in under 25s — plus type armor: NaN
  // or string inputs sailed past the old comparison straight into SQLite (500s)
  if (typeof timeMs !== 'number' || typeof mistakes !== 'number' || !Number.isFinite(timeMs) || !Number.isInteger(mistakes) || timeMs < 25_000 || mistakes < 0) { q.telemetry.run(`anticheat:daily:${id}`, Date.now()); return reply.code(400).send({ ok: false }); }
  q.dailyUpsert.run(dateKey, acc.id, name ?? acc.name, Math.round(timeMs), mistakes, Date.now());
  // streaks (server-tracked, UTC days)
  const st = (q.streakGet.get(acc.id) as { last_date: string | null; streak: number; best: number } | null) ?? { last_date: null, streak: 0, best: 0 };
  const today = todayKey();
  const y = new Date(Date.parse(`${today}T00:00:00Z`) - 86400_000);
  const yester = todayKey(y);
  const streak = st.last_date === today ? st.streak : st.last_date === yester ? st.streak + 1 : 1;
  q.streakUpsert.run(acc.id, today, streak, Math.max(st.best, streak));
  const rank = (q.dailyRankOf.get(dateKey, dateKey, acc.id) as { rank: number }).rank;
  const best = q.dailyBest.get(dateKey, acc.id) as { time_ms: number; mistakes: number } | null;
  return { ok: true, rank, streak, best: best ? { timeMs: best.time_ms, mistakes: best.mistakes } : null };
});

// SEC-03: brute-force throttle for /api/recovery (18-bit code space). Hourly
// buckets per source IP and per requester; survivors still need the donor id.
const recoveryHits = new Map<string, { n: number; resetAt: number }>();
function recoveryAllowed(key: string, limit: number): boolean {
  const now = Date.now();
  if (recoveryHits.size > 5000) {
    for (const [k, v] of recoveryHits) if (now > v.resetAt) recoveryHits.delete(k);
  }
  const e = recoveryHits.get(key);
  if (!e || now > e.resetAt) { recoveryHits.set(key, { n: 1, resetAt: now + 3600_000 }); return true; }
  e.n += 1;
  return e.n <= limit;
}

await app.post('/api/recovery', async (req, reply) => {
  const { code, id, secret, donorId } = req.body as { code: string; id: string; secret: string; donorId?: string };
  const acc = q.getAccount.get(id) as { recovery_hash: string | null; secret_hash: string; ink: number; ink_ledger: string } | null;
  if (!acc || acc.secret_hash !== hash(secret)) return reply.code(401).send({ ok: false });
  // SEC-03: the donor must be NAMED — the old global hash search let anyone sweep
  // all issued codes and drain every account. No identifier, no lookup.
  if (typeof donorId !== 'string' || donorId.length === 0 || donorId.length > 120) {
    return reply.code(400).send({ ok: false, error: 'donor' });
  }
  if (!recoveryAllowed(`ip:${req.ip}`, 20) || !recoveryAllowed(`acc:${id}`, 10) || !recoveryAllowed(`donor:${donorId}`, 10)) {
    return reply.code(429).send({ ok: false, error: 'throttled' });
  }
  const donor = q.getAccount.get(donorId) as { id: string; standing: number; purchases: string; ink: number; recovery_hash: string | null } | null;
  if (!donor || donor.id === id) return { ok: false };
  if (typeof code !== 'string' || donor.recovery_hash !== hash(code.trim().toLowerCase())) return { ok: false };
  q.updateStanding.run(donor.standing, id);
  q.updatePurchases.run(donor.purchases, id);
  // T13 — Ink is now a server-known part: the donor's balance is restored to the
  // recipient, and the recipient's ledger keeps the audit row.
  const donorInk = typeof donor.ink === 'number' && Number.isFinite(donor.ink) && donor.ink > 0 ? donor.ink : 0;
  const ledger = parseLedgerColumn(acc.ink_ledger);
  ledger.push({ duelId: `recovery-${Date.now()}`, mode: 'recovery', d: donorInk - (typeof acc.ink === 'number' ? acc.ink : 0), v: 'verified', at: Date.now() });
  q.updateInkLedger.run(JSON.stringify(ledger.slice(-200)), id);
  q.updateInk.run(donorInk, id);
  // the donor slot is consumed: a code restores once
  q.updateRecovery.run(null, donor.id);
  return { ok: true, standing: donor.standing, purchases: JSON.parse(donor.purchases), ink: donorInk };
});

// T13 — the Ink ledger: the client posts its award deltas with duel ids; the server
// verifies against its own duel log, bounds what it cannot prove, drops replays, and
// keeps the newest-200 audit trail plus the authoritative balance (floored at 0).
await app.post('/api/ink', async (req, reply) => {
  const { id, secret, entries } = (req.body ?? {}) as { id?: string; secret?: string; entries?: unknown };
  const acc = auth(id ?? '', secret ?? '');
  if (!acc) return reply.code(401).send({ ok: false });
  const clean = sanitizeInkEntries(entries);
  const cur = q.getAccount.get(acc.id) as { ink: number; ink_ledger: string };
  // SEC-12: replay gate. The ledger column slides (200 rows) so its own history
  // can't dedupe forever — this table can. The whole handler is synchronous (no
  // awaits), so check→settle→record is atomic on the event loop: no double-pay race.
  const fresh: InkEntry[] = [];
  const replayed: string[] = [];
  for (const e of clean) {
    const duelId = (e as { duelId?: unknown }).duelId;
    if (typeof duelId === 'string' && q.claimGet.get(acc.id, duelId)) replayed.push(duelId);
    else fresh.push(e);
  }
  const lookup = (e: InkEntry) => ({
    duelRow: (e.mode === 'ranked' || e.mode === 'friend')
      ? ((q.getDuel.get(e.duelId) as { p0: string | null; p1: string | null; winner: string | null } | null) ?? null)
      : null,
    dailyRowExists: e.mode === 'daily'
      // the date key rides inside the duel id (parse is calendar-shaped; the settle law
      // drops ids that do not carry one)
      ? !!(e.duelId.match(/^daily-(\d{4}-\d{2}-\d{2})/)?.[1] && q.dailyBest.get(e.duelId.match(/^daily-(\d{4}-\d{2}-\d{2})/)![1]!, acc.id))
      : false,
  });
  const out = settleInkEntries(fresh, acc.id, lookup, cur.ink_ledger, cur.ink);
  // record every accepted claim BEFORE persisting balances, then re-assemble
  // results IN REQUEST ORDER (settle's positional contract holds; replays are drops)
  const claimedAt = Date.now();
  for (const res of out.results) {
    if (res.verdict !== 'dropped') q.claimAdd.run(acc.id, res.duelId, claimedAt);
  }
  const replayedSet = new Set(replayed);
  const queues = new Map<string, typeof out.results>();
  for (const res of out.results) {
    const list = queues.get(res.duelId) ?? [];
    list.push(res);
    queues.set(res.duelId, list);
  }
  out.results = clean.map((e) => {
    const id = String((e as { duelId?: unknown }).duelId ?? '');
    if (replayedSet.has(id)) return { duelId: id, verdict: 'dropped' as const, applied: 0 };
    return queues.get(id)!.shift()!;
  });
  if (out.results.length) {
    q.updateInkLedger.run(JSON.stringify(out.ledger), acc.id);
    q.updateInk.run(out.balance, acc.id);
  }
  return { ok: true, ink: out.balance, results: out.results };
});

await app.post('/api/purchases', async (req, reply) => {
  const { id, secret, purchases } = req.body as { id: string; secret: string; purchases: string[] };
  const acc = auth(id, secret);
  if (!acc) return reply.code(401).send({ ok: false });
  q.updatePurchases.run(JSON.stringify(purchases.slice(0, 200)), id);
  return { ok: true };
});

await app.post('/api/telemetry', async (req, reply) => {
  const { event } = req.body as { event?: string };
  if (event && event.length < 80) q.telemetry.run(event, Date.now());
  return { ok: true };
});

await app.get('/api/health', async () => ({ ok: true, rooms: rooms.size, queue: queue.length, t: Date.now() }));

// telemetry is client-writable and append-only: prune by age + cap rows every
// 5 min so a flood (or years of uptime) can't fill the volume under the ledger
setInterval(() => {
  try {
    q.telemetryPrune.run(Date.now() - 7 * 86400_000, 20000);
  } catch (e) { console.error('[assize-server] telemetry prune error', e); }
}, 5 * 60_000);

// REST on Fastify; socket.io shares the port on its default engine path (/socket.io),
// which the sandbox gateway forwards via the XTransformPort query param.
io.attach(app.server, { cors: { origin: '*' } });

app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  console.log(`[assize-server] listening on :${PORT} (REST + socket.io default path)`);
}).catch((e) => { console.error('listen failed', e); process.exit(1); });
