// ASSIZE T13 — the server-side Ink ledger, as pure law (the engine is untouched; replays stay byte-true).
// Ink is cosmetic (spec §8) and client-owned per spec §6, but the server keeps an honest,
// bounded MIRROR of it: every delta the client reports is VERIFIED against the server's own
// duel log when a proof exists (PvP duels table, daily results), BOUNDED to a per-mode cap
// when no proof is possible (solo modes), and DROPPED when the id was already settled (a
// replayed post) or the shape is hostile. The ledger is an audit trail, not a second
// authority — the client keeps playing offline exactly as shipped, and nothing here can
// take Ink away from a Clerk.

export const INK_MODES = [
  'ranked', 'friend', 'daily', 'practice', 'shade', 'campaign', 'replay',
  'endless', 'weekly', 'tutorial', 'reliquary', 'season', 'spend',
] as const;
export type InkMode = (typeof INK_MODES)[number];

export interface InkEntry { duelId: string; mode: InkMode; delta: number }

// 'recovery' rows are minted by the server only — never accepted from a client post.
export type InkLedgerMode = InkMode | 'recovery';
export interface InkLedgerRow { duelId: string; mode: InkLedgerMode; d: number; v: InkVerdict; at: number }
export type InkVerdict = 'verified' | 'bounded' | 'dropped';
export interface InkResult { duelId: string; verdict: InkVerdict; applied: number }

// What the server can prove per entry. Duel-shape caps = result (win 30 / draw 15 / loss 10)
// + all 27 units claimed × 3 — the most any honest duel can award.
export const INK_CAPS = {
  pvpWin: 111, pvpDraw: 96, pvpLoss: 91,
  daily: 111, practice: 111, shade: 111, campaign: 111, replay: 111,
  endless: 316, // 111 + endlessInkBonus at the hard rung cap (5 + 2 × 100)
  weekly: 231,  // 111 + the 120 weekly writ bonus
  tutorial: 250, // 111 + the 100 graduation grant (skips post their own ≤100)
  reliquary: 40, season: 300, // season tier 30 × 10
  spend: 2000, // the dearest item in the Cabinet is 700 — generous, but bounded
} as const;

export const INK_LEDGER_MAX = 200;
export const INK_BATCH_MAX = 50;

const isStr = (v: unknown, min: number, max: number): v is string =>
  typeof v === 'string' && v.length >= min && v.length <= max;

// Hostile-proof the batch: array gate, batch cap, per-entry shape law. Never throws.
export function sanitizeInkEntries(raw: unknown, maxBatch = INK_BATCH_MAX): InkEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: InkEntry[] = [];
  for (const r of raw.slice(0, maxBatch)) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const e = r as Record<string, unknown>;
    if (!isStr(e.duelId, 1, 120)) continue;
    if (!isStr(e.mode, 1, 20) || !(INK_MODES as readonly string[]).includes(e.mode)) continue;
    const d = e.delta;
    if (typeof d !== 'number' || !Number.isInteger(d) || d === 0 || Math.abs(d) > INK_CAPS.spend) continue;
    out.push({ duelId: e.duelId, mode: e.mode as InkMode, delta: d });
  }
  return out;
}

// What the caller (the server route) knows about one entry. Pure — the route does the I/O.
export interface InkProof {
  duelRow: { p0: string | null; p1: string | null; winner: string | null } | null;
  dailyRowExists: boolean;
}

const DAILY_ID = /^daily-(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))/;

export const parseDailyDateKey = (duelId: string): string | null => DAILY_ID.exec(duelId)?.[1] ?? null;

export function pvpOutcome(
  row: { p0: string | null; p1: string | null; winner: string | null },
  accountId: string,
): 'win' | 'loss' | 'draw' | null {
  const seat = row.p0 === accountId ? 0 : row.p1 === accountId ? 1 : -1;
  if (seat < 0) return null; // the duel log does not involve this account
  if (row.winner === 'draw') return 'draw';
  if (row.winner === '0' || row.winner === '1') return Number(row.winner) === seat ? 'win' : 'loss';
  return null; // unfinished/hostile winner field proves nothing
}

interface Cap { cap: number; verifiable: boolean }

// verifiable = a REAL server proof exists for THIS entry (a duel-log row, a daily row);
// solo modes are never verifiable — the cap is the honesty bound, not a proof.
function capFor(e: InkEntry, proof: InkProof, accountId: string): Cap {
  switch (e.mode) {
    case 'ranked':
    case 'friend': {
      if (!proof.duelRow) return { cap: 0, verifiable: false };
      const outcome = pvpOutcome(proof.duelRow, accountId);
      if (!outcome) return { cap: 0, verifiable: false };
      return { cap: outcome === 'win' ? INK_CAPS.pvpWin : outcome === 'draw' ? INK_CAPS.pvpDraw : INK_CAPS.pvpLoss, verifiable: true };
    }
    case 'daily': {
      if (!parseDailyDateKey(e.duelId)) return { cap: 0, verifiable: false }; // malformed daily id
      // a missing daily row is NOT damning — the result POST is a separate fire-and-forget
      // call that may lag or fail offline — so the entry stays bounded, never verified.
      return { cap: INK_CAPS.daily, verifiable: proof.dailyRowExists };
    }
    case 'practice': case 'shade': case 'campaign': case 'replay':
      return { cap: INK_CAPS.practice, verifiable: false };
    case 'endless': return { cap: INK_CAPS.endless, verifiable: false };
    case 'weekly': return { cap: INK_CAPS.weekly, verifiable: false };
    case 'tutorial': return { cap: INK_CAPS.tutorial, verifiable: false };
    case 'reliquary': return { cap: INK_CAPS.reliquary, verifiable: false };
    case 'season': return { cap: INK_CAPS.season, verifiable: false };
    case 'spend': return { cap: INK_CAPS.spend, verifiable: false };
    default: return { cap: 0, verifiable: false }; // unreachable post-sanitize; hostile-proof anyway
  }
}

// fail-closed parse of the ledger column — a corrupt/hostile column reads as empty history
export function parseLedgerColumn(raw: unknown): InkLedgerRow[] {
  let arr: unknown;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { return []; } }
  else arr = raw;
  if (!Array.isArray(arr)) return [];
  return arr.filter((r): r is InkLedgerRow =>
    !!r && typeof r === 'object' && !Array.isArray(r)
    && isStr((r as Record<string, unknown>).duelId, 1, 120)
    && typeof (r as Record<string, unknown>).d === 'number'
    && Number.isFinite((r as Record<string, unknown>).d as number));
}

export function settleInkEntries(
  entries: InkEntry[],
  accountId: string,
  lookup: (e: InkEntry) => InkProof,
  ledger: unknown,
  balance: unknown,
  now = Date.now(),
): { results: InkResult[]; ledger: InkLedgerRow[]; balance: number } {
  const history = parseLedgerColumn(ledger);
  const settled = new Set(history.map((l) => l.duelId));
  const base = typeof balance === 'number' && Number.isFinite(balance) && balance > 0 ? balance : 0;
  const results: InkResult[] = [];
  const fresh: InkLedgerRow[] = [];
  let appliedTotal = 0;

  if (!Array.isArray(entries)) return { results, ledger: history, balance: base };

  for (const raw of entries) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue; // junk never existed as an entry
    const e = raw as InkEntry;
    const drop = (): InkResult => ({ duelId: String((e as unknown as Record<string, unknown>).duelId ?? ''), verdict: 'dropped', applied: 0 });
    if (settled.has(e.duelId)) { results.push(drop()); continue; }
    const { cap, verifiable } = capFor(e, lookup(e), accountId);
    let applied = 0;
    let verdict: InkVerdict = 'dropped';
    // a "spend" that ADDS ink is hostile — spend only ever accepts negative deltas
    if (cap > 0 && e.delta > 0 && e.mode !== 'spend') {
      applied = Math.min(e.delta, cap);
      verdict = verifiable && e.delta <= cap ? 'verified' : 'bounded';
    } else if (cap > 0 && e.delta < 0 && e.mode === 'spend') {
      applied = Math.max(e.delta, -cap);
      verdict = 'bounded';
    }
    results.push({ duelId: e.duelId, verdict, applied });
    if (verdict !== 'dropped') {
      settled.add(e.duelId);
      fresh.push({ duelId: e.duelId, mode: e.mode, d: applied, v: verdict, at: now });
      appliedTotal += applied;
    }
  }

  return {
    results,
    ledger: [...history, ...fresh].slice(-INK_LEDGER_MAX),
    balance: Math.max(0, base + appliedTotal),
  };
}
