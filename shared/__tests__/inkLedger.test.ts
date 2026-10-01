// T13 — the Ink ledger law. Hostile shapes never throw; proofs decide verdicts; caps
// bound what cannot be proven; replays of a settled duel id are dropped; the balance
// only ever moves by what the verdicts applied. RED-first: written against the law
// before the server route existed.
import { describe, it, expect } from 'vitest';
import {
  INK_CAPS, INK_LEDGER_MAX, INK_BATCH_MAX,
  sanitizeInkEntries, settleInkEntries, parseLedgerColumn, parseDailyDateKey, pvpOutcome,
  type InkEntry, type InkProof,
} from '../inkLedger';

const ACC = 'acc-1';
const noProof = (): InkProof => ({ duelRow: null, dailyRowExists: false });
const proofOf = (p: Partial<InkProof>): InkProof => ({ duelRow: null, dailyRowExists: false, ...p });
const duelWin = (p0 = ACC): InkProof => proofOf({ duelRow: { p0, p1: 'acc-2', winner: '0' } });
const duelLoss = (p0 = ACC): InkProof => proofOf({ duelRow: { p0, p1: 'acc-2', winner: '1' } });
const duelDraw = (p0 = ACC): InkProof => proofOf({ duelRow: { p0, p1: 'acc-2', winner: 'draw' } });
const dailyProved = (): InkProof => proofOf({ dailyRowExists: true });
const settle = (entries: InkEntry[], lookup: (e: InkEntry) => InkProof = noProof, ledger: unknown = [], balance: unknown = 0, now = 0) =>
  settleInkEntries(entries, ACC, lookup, ledger, balance, now);

describe('sanitizeInkEntries — hostile matrix', () => {
  it('non-array garbage yields nothing and never throws', () => {
    for (const raw of [null, undefined, 42, 'entries', {}, () => 1]) {
      expect(sanitizeInkEntries(raw)).toEqual([]);
    }
  });

  it('per-entry shape law: junk fields, wrong types, zero and absurd deltas dropped', () => {
    const out = sanitizeInkEntries([
      null, 42, 'x', [],
      { duelId: 'd1', mode: 'ranked', delta: 30 },                 // keep
      { duelId: '', mode: 'ranked', delta: 30 },                   // empty id
      { duelId: 'd'.repeat(121), mode: 'ranked', delta: 30 },      // overlong id
      { duelId: 'd2', mode: 'galaxy', delta: 30 },                 // unknown mode
      { duelId: 'd3', mode: 7, delta: 30 },                        // non-string mode
      { duelId: 'd4', mode: 'ranked', delta: 0 },                  // zero
      { duelId: 'd5', mode: 'ranked', delta: 1.5 },                // fractional
      { duelId: 'd6', mode: 'ranked', delta: NaN },                // NaN
      { duelId: 'd7', mode: 'ranked', delta: Infinity },           // Infinity
      { duelId: 'd8', mode: 'ranked', delta: 1e9 },                // absurd
      { duelId: 'd9', mode: 'ranked' },                            // missing delta
      { duelId: 'd10', delta: 30 },                                // missing mode
      { mode: 'ranked', delta: 30 },                               // missing id
    ]);
    expect(out).toEqual([{ duelId: 'd1', mode: 'ranked', delta: 30 }]);
  });

  it('batch is capped at INK_BATCH_MAX (a flood cannot thrash the settle loop)', () => {
    const flood = Array.from({ length: INK_BATCH_MAX + 30 }, (_, i) => ({ duelId: `f${i}`, mode: 'practice', delta: 1 }));
    expect(sanitizeInkEntries(flood)).toHaveLength(INK_BATCH_MAX);
  });
});

describe('pvpOutcome + daily id parsing', () => {
  it('seat and winner decide win/loss/draw; foreign and hostile rows prove nothing', () => {
    expect(pvpOutcome({ p0: ACC, p1: 'b', winner: '0' }, ACC)).toBe('win');
    expect(pvpOutcome({ p0: ACC, p1: 'b', winner: '1' }, ACC)).toBe('loss');
    expect(pvpOutcome({ p0: ACC, p1: 'b', winner: 'draw' }, ACC)).toBe('draw');
    // seat 1 wins when winner is '1'
    expect(pvpOutcome({ p0: 'a', p1: ACC, winner: '1' }, ACC)).toBe('win');
    // foreign account
    expect(pvpOutcome({ p0: 'a', p1: 'b', winner: '0' }, ACC)).toBeNull();
    // hostile winner fields
    expect(pvpOutcome({ p0: ACC, p1: 'b', winner: null }, ACC)).toBeNull();
    expect(pvpOutcome({ p0: ACC, p1: 'b', winner: '7' }, ACC)).toBeNull();
    expect(pvpOutcome({ p0: ACC, p1: 'b', winner: 'drawn' }, ACC)).toBeNull();
    // shade-fallback row: p1 is null but the account is p0
    expect(pvpOutcome({ p0: ACC, p1: null, winner: '0' }, ACC)).toBe('win');
    expect(pvpOutcome({ p0: ACC, p1: null, winner: '1' }, ACC)).toBe('loss');
  });

  it('daily date keys parse only from well-formed duel ids', () => {
    expect(parseDailyDateKey('daily-2026-10-01')).toBe('2026-10-01');
    expect(parseDailyDateKey('daily-2026-10-01-abc123')).toBe('2026-10-01');
    expect(parseDailyDateKey('daily-not-a-date')).toBeNull();
    expect(parseDailyDateKey('daily-2026-13-99')).toBeNull(); // month/day shape gate
    expect(parseDailyDateKey('weekly-123')).toBeNull();
    expect(parseDailyDateKey('')).toBeNull();
  });
});

describe('settleInkEntries — PvP proof matrix', () => {
  it('a proven win verifies within cap and bounds above it', () => {
    const r = settle([{ duelId: 'd1', mode: 'ranked', delta: 111 }], () => duelWin());
    expect(r.results[0]).toEqual({ duelId: 'd1', verdict: 'verified', applied: 111 });
    expect(r.balance).toBe(111);
    const big = settle([{ duelId: 'd2', mode: 'ranked', delta: 999 }], () => duelWin());
    expect(big.results[0]).toEqual({ duelId: 'd2', verdict: 'bounded', applied: INK_CAPS.pvpWin });
  });

  it('loss and draw use their own caps; the account on either seat is proved', () => {
    expect(settle([{ duelId: 'd', mode: 'ranked', delta: 91 }], () => duelLoss()).results[0].verdict).toBe('verified');
    expect(settle([{ duelId: 'd', mode: 'ranked', delta: 92 }], () => duelLoss()).results[0]).toMatchObject({ verdict: 'bounded', applied: 91 });
    expect(settle([{ duelId: 'd', mode: 'friend', delta: 96 }], () => duelDraw()).results[0].verdict).toBe('verified');
    // the seat-1 account wins the row whose winner is '1' (duelWin's row makes him lose)
    const seat1 = settleInkEntries([{ duelId: 'd', mode: 'ranked', delta: 111 }], 'acc-2',
      () => proofOf({ duelRow: { p0: 'acc-1', p1: 'acc-2', winner: '1' } }), [], 0, 0);
    expect(seat1.results[0].verdict).toBe('verified');
  });

  it('a missing or foreign duel row drops the entry — a fabricated pvp id earns nothing', () => {
    expect(settle([{ duelId: 'nope', mode: 'ranked', delta: 30 }], noProof).results[0]).toEqual({ duelId: 'nope', verdict: 'dropped', applied: 0 });
    const foreign = settle([{ duelId: 'd', mode: 'ranked', delta: 30 }], () => duelWin('someone-else'));
    expect(foreign.results[0].verdict).toBe('dropped');
    expect(foreign.balance).toBe(0);
  });

  it('negative and zero pvp deltas are dropped (awards are positive; spend is not a pvp mode)', () => {
    expect(settle([{ duelId: 'd', mode: 'ranked', delta: -30 }], () => duelWin()).results[0].verdict).toBe('dropped');
  });

  it('shade-fallback ranked duels (p1 null) verify against the row', () => {
    const shadeRow = proofOf({ duelRow: { p0: ACC, p1: null, winner: '0' } });
    expect(settle([{ duelId: 's1', mode: 'ranked', delta: 111 }], () => shadeRow).results[0].verdict).toBe('verified');
  });
});

describe('settleInkEntries — daily law', () => {
  it('a proven daily completion verifies within cap; over-cap is bounded', () => {
    expect(settle([{ duelId: 'daily-2026-10-01-x', mode: 'daily', delta: 111 }], () => dailyProved()).results[0].verdict).toBe('verified');
    expect(settle([{ duelId: 'daily-2026-10-01-x', mode: 'daily', delta: 500 }], () => dailyProved()).results[0])
      .toMatchObject({ verdict: 'bounded', applied: 111 });
  });

  it('an unproven (offline-lag) daily stays bounded, never verified; malformed ids drop', () => {
    expect(settle([{ duelId: 'daily-2026-10-01-x', mode: 'daily', delta: 50 }], noProof).results[0])
      .toMatchObject({ verdict: 'bounded', applied: 50 });
    expect(settle([{ duelId: 'daily-garbage', mode: 'daily', delta: 50 }], () => dailyProved()).results[0].verdict).toBe('dropped');
  });
});

describe('settleInkEntries — bounded modes and spend', () => {
  it('every bounded mode clamps to its cap and wears bounded, never verified', () => {
    const cases: Array<[InkEntry, number]> = [
      [{ duelId: 'p', mode: 'practice', delta: 999 }, INK_CAPS.practice],
      [{ duelId: 's', mode: 'shade', delta: 999 }, INK_CAPS.shade],
      [{ duelId: 'c', mode: 'campaign', delta: 999 }, INK_CAPS.campaign],
      [{ duelId: 'r', mode: 'replay', delta: 999 }, INK_CAPS.replay],
      [{ duelId: 'e', mode: 'endless', delta: 99999 }, INK_CAPS.endless],
      [{ duelId: 'w', mode: 'weekly', delta: 99999 }, INK_CAPS.weekly],
      [{ duelId: 't', mode: 'tutorial', delta: 99999 }, INK_CAPS.tutorial],
      [{ duelId: 'q', mode: 'reliquary', delta: 999 }, INK_CAPS.reliquary],
      [{ duelId: 'z', mode: 'season', delta: 99999 }, INK_CAPS.season],
    ];
    for (const [e, cap] of cases) {
      const r = settle([e]);
      expect(r.results[0], e.mode).toEqual({ duelId: e.duelId, verdict: 'bounded', applied: cap });
    }
  });

  it('within-cap bounded deltas apply as reported (the honest mirror)', () => {
    expect(settle([{ duelId: 'p', mode: 'practice', delta: 45 }]).results[0])
      .toEqual({ duelId: 'p', verdict: 'bounded', applied: 45 });
  });

  it('spend: only negative deltas, magnitude capped; a positive "spend" is dropped', () => {
    expect(settle([{ duelId: 'b1', mode: 'spend', delta: -700 }]).results[0])
      .toEqual({ duelId: 'b1', verdict: 'bounded', applied: -700 });
    expect(settle([{ duelId: 'b2', mode: 'spend', delta: -99999 }]).results[0])
      .toMatchObject({ verdict: 'bounded', applied: -INK_CAPS.spend });
    expect(settle([{ duelId: 'b3', mode: 'spend', delta: 700 }]).results[0].verdict).toBe('dropped');
  });

  it('negative deltas on non-spend modes are dropped', () => {
    for (const mode of ['ranked', 'daily', 'practice', 'endless', 'reliquary'] as const) {
      expect(settle([{ duelId: 'n', mode, delta: -10 }]).results[0].verdict).toBe('dropped');
    }
  });
});

describe('settleInkEntries — replay, ledger and balance law', () => {
  it('a settled duel id is dropped on re-post (idempotence over the wire)', () => {
    const first = settle([{ duelId: 'd1', mode: 'ranked', delta: 30 }], () => duelWin());
    expect(first.balance).toBe(30);
    const repost = settle([{ duelId: 'd1', mode: 'ranked', delta: 30 }], () => duelWin(), first.ledger, first.balance);
    expect(repost.results[0]).toEqual({ duelId: 'd1', verdict: 'dropped', applied: 0 });
    expect(repost.balance).toBe(30);
  });

  it('a duplicate id inside ONE batch also drops the second occurrence', () => {
    const r = settle([
      { duelId: 'd1', mode: 'ranked', delta: 30 },
      { duelId: 'd1', mode: 'ranked', delta: 30 },
    ], () => duelWin());
    expect(r.results.map((x) => x.verdict)).toEqual(['verified', 'dropped']);
    expect(r.balance).toBe(30);
  });

  it('dropped entries are not recorded in the ledger; verified/bounded are', () => {
    const r = settle([
      { duelId: 'ok', mode: 'practice', delta: 10 },
      { duelId: 'bad', mode: 'ranked', delta: 10 }, // no proof
    ]);
    expect(r.ledger.map((l) => l.duelId)).toEqual(['ok']);
  });

  it('the ledger keeps only the newest INK_LEDGER_MAX rows (oldest evicted)', () => {
    const history = Array.from({ length: INK_LEDGER_MAX }, (_, i) => ({ duelId: `old-${i}`, mode: 'practice' as const, d: 1, v: 'bounded' as const, at: i }));
    const r = settle([{ duelId: 'new', mode: 'practice', delta: 5 }], noProof, history, 0);
    expect(r.ledger).toHaveLength(INK_LEDGER_MAX);
    expect(r.ledger[0].duelId).toBe('old-1'); // old-0 evicted
    expect(r.ledger[INK_LEDGER_MAX - 1].duelId).toBe('new');
  });

  it('balance floors at 0 and ignores a hostile starting balance', () => {
    expect(settle([{ duelId: 'b1', mode: 'spend', delta: -700 }], noProof, [], 100).balance).toBe(0);
    expect(settle([{ duelId: 'b2', mode: 'spend', delta: -100 }], noProof, [], NaN).balance).toBe(0);
    expect(settle([{ duelId: 'b3', mode: 'spend', delta: -100 }], noProof, [], -500).balance).toBe(0);
    expect(settle([{ duelId: 'b4', mode: 'spend', delta: -100 }], noProof, [], Infinity).balance).toBe(0);
    expect(settle([{ duelId: 'b5', mode: 'practice', delta: 30 }], noProof, [], '1000').balance).toBe(30);
  });

  it('a hostile ledger column reads as empty history (fail-closed) and can never crash settle', () => {
    for (const ledger of [null, undefined, 'not json', '{"a":1}', 42, [{ junk: true }], '["not","rows"]']) {
      const r = settle([{ duelId: 'd1', mode: 'practice', delta: 5 }], noProof, ledger, 0);
      expect(r.balance).toBe(5);
    }
    // a corrupted column that still JSON-parses but holds junk rows: junk is filtered,
    // so its duel ids prove nothing — the fresh entry still settles
    const corrupt = JSON.stringify([{ junk: true }, { duelId: 42, d: 1 }, 'row', { duelId: 'd1', mode: 'ranked', d: 'x', v: 'y', at: 1 }]);
    expect(settle([{ duelId: 'd1', mode: 'practice', delta: 5 }], noProof, corrupt, 0).balance).toBe(5);
  });

  it('parseLedgerColumn keeps well-formed rows from a valid column', () => {
    const rows = [{ duelId: 'a', mode: 'ranked', d: 30, v: 'verified', at: 1 }];
    expect(parseLedgerColumn(JSON.stringify(rows))).toEqual(rows);
    expect(parseLedgerColumn(rows)).toEqual(rows);
    expect(parseLedgerColumn('{"truncate')).toEqual([]);
  });

  it('never throws on any garbage input combination (fuzz)', () => {
    const garb: unknown[] = [null, undefined, NaN, 'x', 1e9, { a: 1 }, [1, 2, 3]];
    for (const entries of garb) {
      for (const ledger of garb) {
        for (const balance of garb) {
          expect(() => settleInkEntries(entries as never, ACC, noProof, ledger, balance, 0)).not.toThrow();
        }
      }
    }
  });
});
