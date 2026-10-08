// LedgerProfile law — the parts of S17 that can be pinned without native chrome.
//
// The web build keeps this math inline in ../src/app/game/LedgerProfile.tsx — the
// spark-line points (:24), the win-rate percentiles (:94-98), the recent-pleas cap
// (:132), the T13 server-Ink audit guard (:36), the recovery-restore max law
// (:214-221) and the save-import version contract (:191-197). This port extracts
// them (the seasonLaw/cabinetLaw precedent) so the gate can pin them — specs/17
// phase 5.6's done-when is "a recovery code moves Ink to another device", which
// rests on exactly the three laws below: validate → restore (max), the audit
// guard, and the v:2 save contract.
import type { SaveStateV2 } from '@/state/save';

/** the standing window — the web's `standingHistory.slice(-20)` (:23). */
export const STANDING_WINDOW = 20;

/** the recent-pleas cap — the web's `recent.slice(0, 20)` (:132). */
export const RECENT_CAP = 20;

/** the name input's cap — the web input's maxLength={24} (:50). */
export const NAME_MAX = 24;

/**
 * The spark polyline (LedgerProfile.tsx:24), verbatim: x sweeps 0..280 across the
 * window, y maps Standing 800..2000 onto 70..0. The clamp is on the TOP side
 * only — `Math.min(70, …)` — so a Standing below 800 yields y > 70 and plots
 * BELOW the frame (the SVG silently crops it). Reported quirk, carried, not fixed.
 */
export function sparkPoints(history: number[]): string {
  const hist = history.slice(-STANDING_WINDOW);
  return hist
    .map(
      (v, i) =>
        `${(i / Math.max(1, hist.length - 1)) * 280},${70 - Math.min(70, ((v - 800) / 1200) * 70)}`,
    )
    .join(' ');
}

/** the web's literal Order row (LedgerProfile.tsx:94) — the win-rate rows, this order. */
export const WIN_RATE_ORDERS = ['scholar', 'executioner', 'apothecary', 'warden'] as const;

/** the web's win-rate read (LedgerProfile.tsx:95-97): a missing Order falls back to {w:0,l:0}. */
export function winRatePct(
  byOrder: Record<string, { w: number; l: number }>,
  order: string,
): number {
  const rec = byOrder[order] ?? { w: 0, l: 0 };
  const total = rec.w + rec.l;
  return total ? Math.round((rec.w / total) * 100) : 0;
}

/**
 * The T13 server-Ink audit guard (LedgerProfile.tsx:36): only an ok response
 * carrying a finite ink number is shown — anything else leaves the line hidden
 * (offline: the line simply stays hidden, the web's own comment).
 */
export function serverInkFrom(res: { ok?: boolean; ink?: unknown } | null | undefined): number | null {
  return res && res.ok && typeof res.ink === 'number' && Number.isFinite(res.ink)
    ? res.ink
    : null;
}

/**
 * The recovery restore (LedgerProfile.tsx:214-218): an ok response carrying an
 * ink number restores; anything else (bad code, refused, offline) is the error
 * note's territory — the caller sounds it.
 */
export function recoveryInkFrom(res: { ok?: boolean; ink?: unknown } | null | undefined): number | null {
  return res && res.ok && typeof res.ink === 'number' ? res.ink : null;
}

/**
 * The T13 max law, verbatim intent (LedgerProfile.tsx:215-218): the response's
 * server-known Ink applies as MAX — the client may hold un-synced local Ink the
 * server never heard about. (The web's `res.ink ?? 0` inside the branch is dead —
 * the typeof guard already proved the number — so the max is taken directly.)
 */
export function restoredInk(current: number, serverInk: number): number {
  return Math.max(current, serverInk);
}

/**
 * The save-import contract (LedgerProfile.tsx:190-197): JSON.parse inside a
 * try, then `parsed && parsed.v === 2` — anything else is refused fail-closed
 * (the web sounds its error). NOTE (reported quirk, carried): the web hands the
 * parsed object to the store UNMIGRATED — a hostile v:2 file rides the session
 * raw, and the migration law only catches it on the next load. Both builds.
 */
export function parseSaveImport(text: string): SaveStateV2 | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && (parsed as { v?: unknown }).v === 2) {
      return parsed as SaveStateV2;
    }
    return null;
  } catch {
    return null;
  }
}

/** the export file's name — the web's `a.download = 'assize-save.json'` (:178). */
export const EXPORT_FILE_NAME = 'assize-save.json';

/** the export payload (LedgerProfile.tsx:175): the save, pretty-printed, 2-space. */
export const exportPayload = (save: SaveStateV2): string => JSON.stringify(save, null, 2);
