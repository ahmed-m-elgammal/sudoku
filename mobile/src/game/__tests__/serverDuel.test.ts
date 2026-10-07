// ServerDuel — the authoritative-duel mirror (specs/17 phase 4.4), pinned by the gate.
//
// The socket layer is doubled at the transport boundary: the fake socket records every
// client emission (the exact wire payloads the server authenticates) and lets the test
// emit server events into the net client's onAny pipe — the same path production takes.
// The storage seam is the real one (MMKV double) seeded with a guest identity, so the
// authorization law is pinned END TO END: identity row -> Keychain law -> join payload.
//
// What these tests pin, and why:
//   AUTH    — join_duel must carry accountId + secret (the web build sent only the
//             secret; the server auth failed and the S08 reconnect path was dead).
//   LENS    — the local mirror is ALWAYS seat-0-perspective (players[0] = me): the web
//             build wrote `you` into players[mySeat] while every component renders
//             players[0] as "me", so a seat-1 player saw the foe's board as theirs.
//   END     — the absolute-seat winner is mapped through the seat lens before the
//             verdict fires, and the rating delta rides along.
//   SIGNAL  — the notifiedVersion snapshot law (the "duel ignores taps" guard from
//             localDuelSnapshot.test.ts) holds for the server runtime too.
//   WIRE    — every player action lands on the wire and NOWHERE else (no optimistic
//             engine writes: the solution never reaches the client in PvP).
//   SFX     — the seal/status transition sounds fire off the mirrored deltas.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerDuel } from '@/game/serverDuel';
import { net } from '@/game/net/client';
import { storage, __resetStorageBackends } from '@/platform/storage';
import { generatePuzzle } from '@shared/sudoku';

// ---- the transport double --------------------------------------------------------
// (vi.mock calls are hoisted above the imports by vitest's transform; the factories
// only CLOSE OVER the module-level doubles below — they run later, from beforeEach.)
type SocketHandler = (p: unknown, ...rest: unknown[]) => void;

const socketOn = new Map<string, Set<SocketHandler>>();
const socketOnAny = new Set<SocketHandler>();
let wire: { event: string; payload: unknown }[] = [];

const fireFromServer = (event: string, payload: unknown) => {
  for (const fn of socketOnAny) fn(event, payload);
};
const fireSocketEvent = (event: string, payload: unknown) => {
  for (const fn of socketOn.get(event) ?? []) fn(payload);
};
const emissions = (event: string) => wire.filter((w) => w.event === event).map((w) => w.payload as Record<string, unknown>);

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: (event: string, fn: SocketHandler) => {
      if (!socketOn.has(event)) socketOn.set(event, new Set());
      socketOn.get(event)!.add(fn);
      // the transport is already open: resolve the client's connect() on registration
      if (event === 'connect') queueMicrotask(() => fn({ pid: 'sock-test' }));
    },
    onAny: (fn: SocketHandler) => { socketOnAny.add(fn); },
    emit: (event: string, payload: unknown) => { wire.push({ event, payload }); },
    connected: true,
    id: 'sock-test',
  })),
}));

// the audio seam is a recording double: the sfx transition law is asserted off it
const audioCalls: string[] = [];
vi.mock('@/platform/audio', () => ({
  audio: new Proxy({}, {
    get: (_t, prop: string) => {
      if (prop === 'setVolumes' || prop === 'setMuted' || prop === 'muted' || prop === 'setHeat' || prop === 'tickMusic' || prop === 'unlock') {
        return () => undefined;
      }
      return (...args: unknown[]) => { audioCalls.push([prop, ...args].join(':')); };
    },
  }),
}));

const GIVENS = generatePuzzle('serverduel-seed', 'Easy').givens;
const BOARD = Array.from(GIVENS);

const youPayload = (over: {
  you?: Partial<Record<string, unknown>>;
  foe?: Partial<Record<string, unknown>>;
  unitOwner?: Record<string, number>;
  events?: unknown[];
  phase?: string;
  clockMs?: number;
} = {}) => ({
  duelId: 'duel-9',
  clockMs: over.clockMs ?? 1200,
  phase: over.phase ?? 'live',
  you: {
    seat: 0, seals: 7, board: BOARD, progress: 3, mistakes: 0,
    abilities: {}, statuses: [], immuneUntil: {}, claimed: [],
    reckoningUntilMs: 0, wardUntilMs: 0, mirrorUntilMs: 0,
    ...(over.you ?? {}),
  },
  foe: {
    name: 'Foe Clerk', seals: 7, progress: 1, board: BOARD, claimed: [], statuses: [],
    ...(over.foe ?? {}),
  },
  unitOwner: over.unitOwner ?? { r0: 0 },
  events: over.events ?? [],
  eventSeq: 2,
});

async function seedIdentity() {
  __resetStorageBackends();
  await storage.set('identity', 'me', { id: 'acc-1', secret: 'sec-1', name: 'Clerk One', recoveryHash: null });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeDuel(seat: 0 | 1 = 0) {
  return new ServerDuel({
    duelId: 'duel-9', seat, givens: GIVENS,
    foeName: 'Foe Clerk', myName: 'Clerk One',
    myOrder: 'scholar', foeOrder: 'executioner',
  });
}

beforeEach(async () => {
  wire = [];
  audioCalls.length = 0;
  // open the transport bridge: the fake socket resolves connect() and the net client
  // wires its onAny pipe, which is the path server events take into the mirror.
  // The socket-level registrations persist across tests — the net client is a
  // singleton with one socket for the whole file, and ServerDuel's own handlers
  // live (and unsubscribe) in the net client's map, not here.
  await net.connect();
});

afterEach(() => {
  __resetStorageBackends();
});

describe('ServerDuel · authorization', () => {
  it('AUTH-1 join_duel carries the account id AND the secret from the identity store', async () => {
    await seedIdentity();
    const duel = makeDuel();
    await flush();
    const joins = emissions('join_duel');
    expect(joins).toEqual([{ duelId: 'duel-9', secret: 'sec-1', accountId: 'acc-1' }]);
    duel.destroy();
  });

  it('AUTH-2 a net:online re-join re-reads the identity and re-registers the room', async () => {
    await seedIdentity();
    const duel = makeDuel();
    await flush();
    expect(emissions('join_duel')).toHaveLength(1);
    fireSocketEvent('disconnect', {});
    expect(duel.selfOffline).toBe(true);
    fireSocketEvent('connect', {});
    await flush();
    expect(duel.selfOffline).toBe(false);
    const joins = emissions('join_duel');
    expect(joins).toHaveLength(2);
    expect(joins[1]).toEqual({ duelId: 'duel-9', secret: 'sec-1', accountId: 'acc-1' });
    duel.destroy();
  });
});

describe('ServerDuel · the seat lens (players[0] is ALWAYS me)', () => {
  it('LENS-1 seat 0: the mirror takes the payload at face value', async () => {
    await seedIdentity();
    const duel = makeDuel(0);
    fireFromServer('you', youPayload({ unitOwner: { r0: 0, c1: 1 } }));
    expect(duel.state.players[0].name).toBe('Clerk One');
    expect(duel.state.players[0].seals).toBe(7);
    expect(duel.state.players[0].board.length).toBe(81);
    expect(duel.state.players[1].name).toBe('Foe Clerk');
    expect(duel.state.unitOwner).toEqual({ r0: 0, c1: 1 });
    expect(duel.state.clockMs).toBe(1200);
    expect(duel.state.phase).toBe('live');
    duel.destroy();
  });

  it('LENS-2 seat 1: you-data lands in players[0], absolute seats flip', async () => {
    await seedIdentity();
    const duel = makeDuel(1);
    fireFromServer('you', youPayload({
      unitOwner: { r0: 0, c1: 1 },
      events: [
        { seq: 1, atMs: 100, kind: 'claim', player: 0 },
        { seq: 2, atMs: 200, kind: 'claim', player: 1 },
        { seq: 3, atMs: 300, kind: 'statusEnded' }, // no player field: untouched
      ],
    }));
    // players[0] = ME even though the server seat is 1
    expect(duel.state.players[0].name).toBe('Clerk One');
    expect(duel.state.players[0].seals).toBe(7);
    expect(duel.state.players[1].name).toBe('Foe Clerk');
    // absolute owner 0 (the foe) reads as 1; absolute 1 (me) reads as 0
    expect(duel.state.unitOwner).toEqual({ r0: 1, c1: 0 });
    // event players flip with the same lens
    expect(duel.state.events[0].player).toBe(1);
    expect(duel.state.events[1].player).toBe(0);
    expect(duel.state.events[2].player).toBeUndefined();
    duel.destroy();
  });

  it('LENS-3 a hostile unitOwner value never masquerades as a seat', async () => {
    await seedIdentity();
    const duel = makeDuel(1);
    fireFromServer('you', youPayload({ unitOwner: { r0: 0, c1: 1, b2: 7 } }));
    expect(duel.state.unitOwner.r0).toBe(1);
    expect(duel.state.unitOwner.c1).toBe(0);
    expect(duel.state.unitOwner.b2).toBeUndefined();
    duel.destroy();
  });
});

describe('ServerDuel · the verdict', () => {
  it('END-1 the absolute winner maps through the seat (seat 1 + server winner 1 = victory)', async () => {
    await seedIdentity();
    const duel = makeDuel(1);
    const ended: { winner: unknown; reason: string }[] = [];
    duel.setOnEnd((r) => ended.push(r));
    fireFromServer('end', { winner: 1, reason: 'seals', ratingDelta: 24 });
    expect(ended).toEqual([{ winner: 0, reason: 'seals' }]);
    expect(duel.state.winner).toBe(0);
    expect(duel.state.winReason).toBe('seals');
    expect(duel.ended).toBe(true);
    expect(duel.lastRatingDelta).toBe(24);
    duel.destroy();
  });

  it('END-2 seat 0 sees the same server end as a defeat, and it fires once', async () => {
    await seedIdentity();
    const duel = makeDuel(0);
    const ended: unknown[] = [];
    duel.setOnEnd((r) => ended.push(r));
    fireFromServer('end', { winner: 1, reason: 'seals', ratingDelta: -24 });
    fireFromServer('end', { winner: 1, reason: 'seals', ratingDelta: -24 });
    expect(ended).toHaveLength(1);
    expect(duel.state.winner).toBe(1);
    expect(duel.lastRatingDelta).toBe(-24);
    duel.destroy();
  });

  it('END-3 a draw maps through any seat', async () => {
    await seedIdentity();
    const duel = makeDuel(1);
    const ended: unknown[] = [];
    duel.setOnEnd((r) => ended.push(r));
    fireFromServer('end', { winner: 'draw', reason: 'suddenJudgment' });
    expect(ended).toEqual([{ winner: 'draw', reason: 'suddenJudgment' }]);
    expect(duel.state.winner).toBe('draw');
    duel.destroy();
  });
});

describe('ServerDuel · the render signal', () => {
  it('SIGNAL-1 bursts of server pushes notify at the 66 ms cadence, not per packet', async () => {
    await seedIdentity();
    const duel = makeDuel();
    const seen: number[] = [];
    const unsub = duel.subscribe(() => seen.push(duel.getSnapshot()));
    fireFromServer('you', youPayload());
    expect(seen.length).toBe(1); // the first push always notifies
    const at = duel.getSnapshot();
    for (let i = 0; i < 5; i++) fireFromServer('you', youPayload({ clockMs: 1200 + i }));
    expect(seen.length).toBe(1);          // coalesced inside the window…
    expect(duel.getSnapshot()).toBe(at);  // …and React saw nothing move
    await new Promise((r) => setTimeout(r, 70));
    fireFromServer('you', youPayload({ clockMs: 1300 }));
    expect(seen.length).toBe(2);
    expect(duel.getSnapshot()).not.toBe(at);
    unsub();
    duel.destroy();
  });

  it('SIGNAL-2 terminal pushes notify immediately (the last packet must reach React)', async () => {
    await seedIdentity();
    const duel = makeDuel();
    const seen: number[] = [];
    const unsub = duel.subscribe(() => seen.push(duel.getSnapshot()));
    fireFromServer('you', youPayload());
    const afterFirst = seen.length;
    fireFromServer('peer_disconnected', { graceS: 20, name: 'Foe Clerk' });
    expect(seen.length).toBe(afterFirst + 1); // not swallowed by the throttle
    unsub();
    duel.destroy();
  });
});

describe('ServerDuel · actions ride the wire, nothing else', () => {
  it('WIRE-1 place sends the placement and never touches the board (no solution client-side)', async () => {
    await seedIdentity();
    const duel = makeDuel();
    duel.select(4);
    const res = duel.place(4, 5);
    expect(res).toEqual({ ok: true, correct: undefined });
    expect(emissions('place')).toEqual([{ duelId: 'duel-9', cell: 4, digit: 5 }]);
    expect(duel.state.players[0].board).toEqual(Uint8Array.from(GIVENS));
    expect(duel.state.solution).toBeNull();
    duel.destroy();
  });

  it('WIRE-2 a hushed pad refuses the placement before the wire', async () => {
    await seedIdentity();
    const duel = makeDuel();
    fireFromServer('you', youPayload({ you: { statuses: [{ type: 'hush', uid: 1, untilMs: 9999 }] } }));
    duel.select(4);
    expect(duel.place(4, 5)).toEqual({ ok: false, reason: 'hushed' });
    expect(emissions('place')).toHaveLength(0);
    duel.destroy();
  });

  it('WIRE-3 notes, abilities and concede land on the wire with the selected cell', async () => {
    await seedIdentity();
    const duel = makeDuel();
    duel.setNotes(10, [2, 7]);
    duel.toggleNote(10, 3);
    expect(emissions('pencil')).toEqual([
      { duelId: 'duel-9', cell: 10, digits: [2, 7] },
      { duelId: 'duel-9', cell: 10, digits: [2, 7, 3] },
    ]);
    expect(duel.notes.get(10)).toEqual(new Set([2, 7, 3]));
    duel.select(12);
    duel.ability('augur');
    expect(emissions('ability')).toEqual([{ duelId: 'duel-9', ability: 'augur', cell: 12 }]);
    duel.concede();
    expect(emissions('concede')).toEqual([{ duelId: 'duel-9' }]);
    duel.destroy();
  });

  it('WIRE-4 place is refused after the duel ends; concede still rides the wire (server no-ops it)', async () => {
    await seedIdentity();
    const duel = makeDuel();
    fireFromServer('end', { winner: 0, reason: 'seals' });
    expect(duel.place(1, 1)).toEqual({ ok: false, reason: 'ended' });
    duel.concede();
    expect(emissions('place')).toHaveLength(0);
    expect(emissions('concede')).toEqual([{ duelId: 'duel-9' }]); // web parity: server-side no-op
    duel.destroy();
  });
});

describe('ServerDuel · sfx off the mirrored deltas', () => {
  it('SFX-1 my seal loss sounds wrong; a foe seal loss sounds stamp+claimWon', async () => {
    await seedIdentity();
    const duel = makeDuel();
    fireFromServer('you', youPayload()); // baseline
    audioCalls.length = 0;
    fireFromServer('you', youPayload({ you: { seals: 6 }, foe: { seals: 6 } }));
    expect(audioCalls).toContain('wrong');
    expect(audioCalls).toContain('stamp');
    expect(audioCalls).toContain('claimWon');
    duel.destroy();
  });

  it('SFX-2 a status landing on me sounds statusApplied once per new status', async () => {
    await seedIdentity();
    const duel = makeDuel();
    fireFromServer('you', youPayload());
    audioCalls.length = 0;
    fireFromServer('you', youPayload({ you: { statuses: [{ type: 'chain', uid: 1, cell: 3, untilMs: 9999 }] } }));
    expect(audioCalls).toContain('statusApplied');
    audioCalls.length = 0;
    fireFromServer('you', youPayload({ you: { statuses: [{ type: 'chain', uid: 1, cell: 3, untilMs: 9999 }] } }));
    expect(audioCalls).not.toContain('statusApplied'); // same count: no new status
    duel.destroy();
  });
});

describe('ServerDuel · S08 disconnect grace', () => {
  it('S08-1 peer drop -> countdown, grace ticks update it, reconnection clears it', async () => {
    await seedIdentity();
    const duel = makeDuel(0);
    fireFromServer('peer_disconnected', { graceS: 20, name: 'Foe Clerk' });
    expect(duel.disconnect).toEqual({ secondsLeft: 20, graceS: 20, who: 'Foe Clerk' });
    fireFromServer('reconnect_grace', { s: 13 });
    expect(duel.disconnect?.secondsLeft).toBe(13);
    fireFromServer('peer_reconnected', {});
    expect(duel.disconnect).toBeNull();
    duel.destroy();
  });

  it('S08-2 the grace modal falls back to the mirror\'s foe name', async () => {
    await seedIdentity();
    const duel = makeDuel(0);
    fireFromServer('peer_disconnected', { graceS: 20 }); // no name in the payload
    expect(duel.disconnect?.who).toBe('Foe Clerk');
    duel.destroy();
  });
});

describe('ServerDuel · lifecycle', () => {
  it('LIFE-1 destroy is idempotent and mutes the mirror', async () => {
    await seedIdentity();
    const duel = makeDuel();
    await flush();
    duel.destroy();
    expect(() => duel.destroy()).not.toThrow();
    const version = duel.version;
    fireFromServer('you', youPayload()); // after destroy: no throws, no state writes
    expect(duel.version).toBe(version);
  });

  it('LIFE-2 start is inert (the server drives the clock) and pause is a local flag', async () => {
    await seedIdentity();
    const duel = makeDuel();
    expect(() => duel.start()).not.toThrow();
    duel.setPaused(true);
    expect(duel.paused).toBe(true);
    duel.togglePencil();
    expect(duel.pencil).toBe(true);
    expect(duel.tutorialNote()).toBeNull();
    expect(duel.swapBanner()).toBeNull();
    duel.destroy();
  });
});
