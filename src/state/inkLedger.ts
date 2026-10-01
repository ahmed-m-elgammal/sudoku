// ASSIZE T13 — client side of the Ink ledger. Every award site reports its delta here;
// the entry joins a persisted pending queue (survives reloads, works offline) and is
// flushed best-effort to the server's /api/ink, where it is verified against the duel
// log, bounded to a per-mode cap, or dropped as a replay. Fire-and-forget: nothing in
// the game waits on the ledger, and a failed flush retries on the next award or boot.
'use client';
import { useSave } from './save';
import { loadIdentity } from './identity';
import { net } from '@/net/client';

const PENDING_MAX = 200;   // same cap as the server's ledger column
const BATCH_MAX = 50;      // server sanitize law (INK_BATCH_MAX)
const FLUSH_PASSES = 6;    // bounded catch-up per flush (6 × 50 = 300 > PENDING_MAX)

export interface InkAward { duelId: string; mode: string; delta: number }

export function recordInk(a: InkAward): void {
  if (!Number.isFinite(a.delta) || a.delta === 0) return;
  if (typeof a.duelId !== 'string' || !a.duelId || a.duelId.length > 120) return;
  const delta = Math.round(a.delta);
  useSave.getState().update((cur) => {
    const rest = (cur.economy.pending ?? []).filter((p) => p.duelId !== a.duelId);
    rest.push({ duelId: a.duelId, mode: a.mode, delta, t: Date.now() });
    return { ...cur, economy: { ...cur.economy, pending: rest.slice(-PENDING_MAX) } };
  });
  void flushInkLedger();
}

let inFlight = false;

export async function flushInkLedger(): Promise<void> {
  if (inFlight) return; // one flush at a time; recordInk re-fires after the queue updates
  inFlight = true;
  try {
    for (let pass = 0; pass < FLUSH_PASSES; pass++) {
      const pending = useSave.getState().save?.economy.pending ?? [];
      if (!pending.length) return;
      const { id, secret, name } = await loadIdentity();
      // bootstrap first: an identity that never authed has no server account, and
      // /api/ink is auth-gated (matchmaking bootstraps the same way)
      const a = await net.auth({ id, secret, name });
      if (!a || !a.ok) return;
      const res = await net.ink({
        id, secret,
        entries: pending.slice(0, BATCH_MAX).map(({ duelId, mode, delta }) => ({ duelId, mode, delta })),
      });
      // offline / unauthenticated / malformed: keep pending, retry on the next flush
      if (!res || !res.ok || !Array.isArray(res.results)) return;
      const acked = new Set(res.results.map((r) => r.duelId));
      if (!acked.size) return; // no progress possible this round
      useSave.getState().update((cur) => ({
        ...cur,
        economy: { ...cur.economy, pending: cur.economy.pending.filter((p) => !acked.has(p.duelId)) },
      }));
    }
  } catch {
    // the ledger never breaks the duel: any transport error leaves pending intact
  } finally {
    inFlight = false;
  }
}
