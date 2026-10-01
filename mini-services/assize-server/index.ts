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
import type { AbilityId, Digit, OrderId, PlayerId, Tier } from '../../shared/config';
import { q, hash, adjustRating, todayKey } from './db';

const PORT = 3030; // fixed port per sandbox gateway contract (XTransformPort)
const SHADE_FALLBACK_MS = 4000; // spec §7 (configurable, spec M2)
const GRACE_MS = 20_000;
const app = Fastify({ logger: false });
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
  intervals: number[];
  disconnectAt: [number | null, number | null];
  lastGraceEmitAt: [number, number];  // reconnect_grace is re-emitted at 1s cadence
  shadeSeat?: PlayerId;
  tier: Tier;
  startedAt: number;
  lastBroadcastSeq: number;
}

const rooms = new Map<string, Room>();
const queue: Array<{ socketId: string; accountId: string; name: string; standing: number; order: OrderId; joinedAt: number; friendCode?: string }> = [];

const GRACE_S = GRACE_MS / 1000;

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
    events: s.events.slice(-30),
    eventSeq: s.eventSeq,
  };
};

const broadcast = (r: Room, event: string, payload: unknown) => {
  for (const [sid, seat] of r.seats) io.to(sid).emit(event, payload);
};

function finishRoom(r: Room, winner: PlayerId | 'draw', reason: string) {
  if ((r.state as { phase: string }).phase === 'ended') return;
  resign(r.state, winner === 0 ? 1 : winner === 1 ? 0 : (winner as unknown as PlayerId));
  if (winner === 'draw') {
    // sudden judgment draw already handled by tick; force draw end
    (r.state as { phase: string; winner: unknown; winReason: string }).phase = 'ended';
    (r.state as { winner: unknown }).winner = 'draw';
    (r.state as { winReason: string }).winReason = 'suddenJudgment';
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
      duelId: r.id, winner: seat === 0 ? winner : winner === 0 ? 1 : winner === 1 ? 0 : 'draw',
      reason, you: publicState(r, seat), ratingDelta: ratings[seat as 0 | 1],
    });
  }
  setTimeout(() => rooms.delete(r.id), 60_000);
}

// ------------------------------------------------------------------ tick loop
setInterval(() => {
  try {
  for (const r of rooms.values()) {
    if ((r.state as { phase: string }).phase !== 'live') continue;
    tick(r.state, 250);
    // Shade action for bot seats
    if (r.shadeSeat !== undefined) {
      const st = r.state;
      const me = r.shadeSeat;
      const rng = new Rng(`${r.id}-${st.eventSeq}`);
      const act = shadeAct(st, me, profileForStanding(1000), () => rng.next(), performance.now());
      if (act.kind === 'place') place(st, me, act.cell, act.digit);
      else if (act.kind === 'ability') useAbility(st, me, act.id, { cell: act.cell, unit: act.unit });
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
    broadcast(r, 'state_delta', { seq: r.state.eventSeq, state: null });
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
      if (p.friendCode && o.friendCode && p.friendCode === o.friendCode && o.socketId !== p.socketId) { opponentIdx = j; break; }
      if (!p.friendCode && !o.friendCode && Math.abs(o.standing - p.standing) <= window) { opponentIdx = j; break; }
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
    names: [a.name, b.name],
    orders: [a.order, b.order],
  });
  const room: Room = {
    id, mode: a.friendCode ? 'friend' : 'ranked', state, solution: Uint8Array.from(puz.solution),
    seats: new Map(), accounts: [a.accountId, b.accountId], names: [a.name, b.name],
    lastPlaceAt: [0, 0], intervals: [], disconnectAt: [null, null], lastGraceEmitAt: [0, 0], tier, startedAt: Date.now(), lastBroadcastSeq: 0,
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
    names: [p.name, `Shade of ${p.name.split(' ').slice(-1)[0]}`],
    orders: [p.order, 'executioner'],
  });
  const room: Room = {
    id, mode: 'ranked', state, solution: Uint8Array.from(puz.solution),
    seats: new Map(), accounts: [p.accountId, null], names: [p.name, `Shade of ${p.name.split(' ').slice(-1)[0]}`],
    lastPlaceAt: [0, 0], intervals: [], disconnectAt: [null, null], lastGraceEmitAt: [0, 0], shadeSeat: 1, tier, startedAt: Date.now(), lastBroadcastSeq: 0,
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
    queue.push({ socketId: socket.id, accountId: acc.id, name: acc.name, standing: acc.standing, order: p.order, joinedAt: Date.now(), friendCode: p.friendCode });
  });

  socket.on('join_duel', (p: { duelId: string; accountId: string; secret: string }) => {
    const acc = auth(p.accountId, p.secret);
    const r = rooms.get(p.duelId);
    if (!acc || !r) { socket.emit('error', { code: 'duel' }); return; }
    const seat: PlayerId = r.accounts[0] === acc.id ? 0 : r.accounts[1] === acc.id ? 1 : 0;
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

  // the client left matchmaking (Shade fallback / withdraw): drop its queue entry
  socket.on('leave_queue', () => {
    const qi = queue.findIndex((e) => e.socketId === socket.id);
    if (qi >= 0) queue.splice(qi, 1);
  });

  socket.on('place', (p: { duelId: string; cell: number; digit: number }) => {
    const r = rooms.get(p.duelId);
    const seat = r?.seats.get(socket.id);
    if (!r || seat === undefined || (r.state as { phase: string }).phase !== 'live') return;
    // anticheat: impossible placement interval (spec §6)
    const now = Date.now();
    const gap = now - r.lastPlaceAt[seat];
    if (r.lastPlaceAt[seat] && gap < 120) { q.telemetry.run(`anticheat:fast-place:${r.id}`, now); return; }
    r.intervals.push(gap);
    if (r.intervals.length > 24) {
      const mean = r.intervals.reduce((a, b) => a + b, 0) / r.intervals.length;
      const cv = Math.sqrt(r.intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / r.intervals.length) / mean;
      const acc0 = r.accounts[seat];
      if (cv < 0.02 && mean > 0 && r.intervals.length >= 20) {
        if (acc0) q.shadow.run(acc0);
        q.telemetry.run(`anticheat:uniform-timing:${r.id}:${seat}`, now);
        r.intervals.length = 0;
      }
    }
    r.lastPlaceAt[seat] = now;
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
    if (!acc || !r) return;
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
    const qi = queue.findIndex((e) => e.socketId === socket.id);
    if (qi >= 0) queue.splice(qi, 1);
  });
});

// ------------------------------------------------------------------ REST
await app.post('/api/auth', async (req, reply) => {
  const { id, secret, name, recoveryHash } = req.body as { id: string; secret: string; name?: string; recoveryHash?: string | null };
  if (!id || !secret) return reply.code(400).send({ ok: false });
  const existing = q.getAccount.get(id) as { secret_hash: string; name: string; standing: number } | null;
  if (existing) {
    if (existing.secret_hash !== hash(secret)) return reply.code(401).send({ ok: false });
    if (name && name !== existing.name) q.updateName.run(name.slice(0, 24), id);
    const acc = q.getAccount.get(id) as { name: string; standing: number };
    return { ok: true, name: acc.name, standing: acc.standing };
  }
  q.insertAccount.run(id, hash(secret), (name ?? 'Unnamed Clerk').slice(0, 24), 1000, recoveryHash ?? null, '[]', Date.now());
  return { ok: true, name: name ?? 'Unnamed Clerk', standing: 1000 };
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

await app.get('/api/daily', async (req, reply) => {
  const dateKey = String((req.query as { date?: string }).date ?? todayUtcKey());
  const puz = generateDaily(dateKey);
  const board = (q.dailyBoard.all(dateKey) as Array<{ name: string; account_id: string; time_ms: number; mistakes: number }>).map((r2, i) => ({
    rank: i + 1, name: r2.name, timeMs: r2.time_ms, mistakes: r2.mistakes, accountId: r2.account_id,
  }));
  return { ok: true, dateKey, seed: dailySeed(dateKey), tier: puz.tier, givensCount: puz.givensCount, leaderboard: board };
});

await app.post('/api/daily/result', async (req, reply) => {
  const { id, secret, dateKey, timeMs, mistakes, name } = req.body as { id: string; secret: string; dateKey: string; timeMs: number; mistakes: number; name?: string };
  const acc = auth(id, secret);
  if (!acc) return reply.code(401).send({ ok: false });
  if (dateKey !== todayKey()) return reply.code(400).send({ ok: false, error: 'stale' });
  // sanity: a 9x9 cannot be honestly solved in under 25s
  if (timeMs < 25_000 || mistakes < 0) { q.telemetry.run(`anticheat:daily:${id}`, Date.now()); return reply.code(400).send({ ok: false }); }
  q.dailyUpsert.run(dateKey, acc.id, name ?? acc.name, Math.round(timeMs), mistakes, Date.now());
  // streaks (server-tracked, UTC days)
  const st = (q.streakGet.get(acc.id) as { last_date: string | null; streak: number; best: number } | null) ?? { last_date: null, streak: 0, best: 0 };
  const today = todayKey();
  const y = new Date(Date.parse(`${today}T00:00:00Z`) - 86400_000);
  const yester = todayKey(y);
  const streak = st.last_date === today ? st.streak : st.last_date === yester ? st.streak + 1 : 1;
  q.streakUpsert.run(acc.id, today, streak, Math.max(st.best, streak));
  const rank = (q.dailyRankOf.get(dateKey, acc.id) as { rank: number }).rank;
  const best = q.dailyBest.get(dateKey, acc.id) as { time_ms: number; mistakes: number } | null;
  return { ok: true, rank, streak, best: best ? { timeMs: best.time_ms, mistakes: best.mistakes } : null };
});

await app.post('/api/recovery', async (req, reply) => {
  const { code, id, secret } = req.body as { code: string; id: string; secret: string };
  const acc = q.getAccount.get(id) as { recovery_hash: string | null; secret_hash: string } | null;
  if (!acc || acc.secret_hash !== hash(secret)) return reply.code(401).send({ ok: false });
  const h = hash(code.trim().toLowerCase());
  const donor = q.byRecovery.get(h) as { id: string; standing: number; purchases: string } | null;
  if (!donor || donor.id === id) return { ok: false };
  q.updateStanding.run(donor.standing, id);
  q.updatePurchases.run(donor.purchases, id);
  // the donor slot is consumed: a code restores once
  q.updateRecovery.run(null, donor.id);
  return { ok: true, standing: donor.standing, purchases: JSON.parse(donor.purchases) };
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

// REST on Fastify; socket.io shares the port on its default engine path (/socket.io),
// which the sandbox gateway forwards via the XTransformPort query param.
io.attach(app.server, { cors: { origin: '*' } });

app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  console.log(`[assize-server] listening on :${PORT} (REST + socket.io default path)`);
}).catch((e) => { console.error('listen failed', e); process.exit(1); });
