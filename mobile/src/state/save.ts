// ASSIZE mobile — the save store.
//
// PORT of ../src/state/save.ts. The shape (SaveStateV2), `freshSave`, and the
// `migrate()` sanitising law are UNCHANGED — the migration law is the thing that
// keeps a hostile or half-written row from corrupting a boot. The only edits are the
// two storage calls (IndexedDB -> the PlatformStorage seam) and `structuredClone`
// (verified present on Hermes; the JSON fallback keeps old JSC engines honest).

import { create } from 'zustand';
import type { OrderId } from '@shared/config';
import { newEndlessState, sanitizeEndless, type EndlessState } from '@shared/endless';
import { storage } from '@/platform/storage';
import { loadIdentity, saveIdentity, generateName } from './identity';

export interface PendingInk { duelId: string; mode: string; delta: number; t: number }

/** The quarantine slot's shape (platform/storage.ts — A9). */
interface QuarantineBlob { raw: string; at: number }

export interface SaveStateV2 {
  v: 2;
  tutorialDone: boolean;
  antechamberUnlocked: boolean;
  campaign: { folioIdx: number; duelIdx: number; stars: Record<string, number>; ended: boolean; ending?: 'balance' | 'burn'; chronicleSeen: string[] };
  order: OrderId;
  unlockedOrders: OrderId[];
  economy: { ink: number; sigils: number; reliquaryProgress: number; pending: PendingInk[] };
  cosmetics: {
    owned: string[];
    equipped: { board: string; wax: string; frame: string; numerals: string; stamps: string; banner: string };
  };
  season: { ink: number; claimed: string[]; patron: boolean; endsAt: number };
  daily: { lastDate: string | null; streak: number; best: number; candlesToday: number; candlesDate: string | null; times: Record<string, number>;
    /** A15 — the Tablet-modes Ink budget: the UTC day the total belongs to, and the amount credited so far that day. */
    farmInkDay: string | null; farmInk: number };
  achievements: Record<string, number>;
  stats: {
    duels: number; wins: number; losses: number; draws: number;
    claims: number; cleanClaims: number; abilitiesUsed: number; augurUses: number;
    byOrder: Record<string, { w: number; l: number }>;
    longestStreak: number;
    standingHistory: number[];
    recent: { t: number; mode: string; result: 'w' | 'l' | 'd'; foe: string; shade: boolean; order: OrderId }[];
  };
  standing: number;
  endless: EndlessState;         // T18 — the Endless Assize ladder
  weekly: { lastWeek: number | null }; // T21 — the Weekly Assize (one completion per week)
  settings: {
    music: number; fx: number; haptics: boolean; contrast: boolean; reducedMotion: boolean;
    text: 's' | 'm' | 'l'; autoNotes: boolean; highlights: boolean; leftHand: boolean; telemetry: boolean;
  };
  /**
   * P3.3 — first-hit explainer flags. statusExplained lists every status the
   * Clerk has already suffered once (and been told about); hostile-proofed
   * like chronicleSeen.
   */
  flags: { statusExplained: string[] };
  name: string;
}

// The Endless ladder salt is minted once per Clerk and PERSISTED — a re-minted salt
// silently rewrites every rung's tablet. Hence this lives in freshSave, not in a load.
const newEndlessSalt = (): string => Math.random().toString(36).slice(2, 10);

export const freshSave = (name: string): SaveStateV2 => ({
  v: 2,
  tutorialDone: false,
  antechamberUnlocked: false,
  campaign: { folioIdx: 0, duelIdx: 0, stars: {}, ended: false, chronicleSeen: [] },
  order: 'scholar',
  unlockedOrders: ['scholar', 'executioner'],
  economy: { ink: 0, sigils: 0, reliquaryProgress: 0, pending: [] },
  cosmetics: {
    owned: ['board-aged-vellum', 'wax-oxblood', 'frame-bronze', 'numerals-linocut', 'stamp-fleur', 'banner-standard'],
    equipped: { board: 'board-aged-vellum', wax: 'wax-oxblood', frame: 'frame-bronze', numerals: 'numerals-linocut', stamps: 'stamp-fleur', banner: 'banner-standard' },
  },
  season: { ink: 0, claimed: [], patron: false, endsAt: Date.now() + 8 * 7 * 86400_000 },
  daily: { lastDate: null, streak: 0, best: 0, candlesToday: 0, candlesDate: null, times: {}, farmInkDay: null, farmInk: 0 },
  achievements: {},
  stats: {
    duels: 0, wins: 0, losses: 0, draws: 0,
    claims: 0, cleanClaims: 0, abilitiesUsed: 0, augurUses: 0,
    byOrder: {}, longestStreak: 0, standingHistory: [1000], recent: [],
  },
  standing: 1000,
  endless: newEndlessState(newEndlessSalt()),
  weekly: { lastWeek: null },
  settings: {
    music: 0.3, fx: 0.7, haptics: true, contrast: false, reducedMotion: false,
    text: 'm', autoNotes: true, highlights: true, leftHand: false, telemetry: true,
  },
  flags: { statusExplained: [] },
  name,
});

interface SaveStore {
  save: SaveStateV2 | null;
  loaded: boolean;
  /** A9 — when the last boot replaced a corrupt ledger: when it was quarantined. */
  quarantinedAt: number | null;
  load: () => Promise<void>;
  update: (fn: (s: SaveStateV2) => SaveStateV2) => void;
  unlockAchievement: (id: string) => void;
  /**
   * P2.4 — record a story beat as seen ('prologue', 'interlude1', 'folio:<key>',
   * …). Append-only and idempotent: re-marking never duplicates, and a hostile
   * id degrades to a capped string, never a crash.
   */
  markChronicle: (beat: string) => void;
  /**
   * P3.3 — record a status as explained (first-hit toast shown). Same
   * append-only, idempotent, hostile-proofed law.
   */
  markStatusExplained: (status: string) => void;
  addInk: (n: number) => void;
  addSigils: (n: number) => void;
}

const deepClone = <T,>(v: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v)) as T;
};

export const useSave = create<SaveStore>((set, get) => ({
  save: null,
  loaded: false,
  quarantinedAt: null,
  load: async () => {
    // DAY1 boot-race fix — `loaded` commits ONLY once the save is materialized. The
    // old order (`set({ save, loaded: true })` BEFORE the first-run identity/fresh
    // writes) let the BootScreen's 1.2 s timer beat the Keychain write on a slow
    // first launch: GameShell mounted, specFromUi() dereferenced a null save, and —
    // with no error boundary below it — the app died on the store-review path.
    // Every await that could reject is caught: the boot gate must always open (an
    // in-memory session beats a permanent black screen).
    const existing = await storage.get<SaveStateV2>('save', 'me');
    const migrated = existing ? migrate(existing) : null;
    if (!migrated) {
      // A9 — distinguish a FIRST RUN from a REPLACED ledger. storage.get already
      // quarantined the unreadable bytes it met; if a quarantine exists for the save
      // key, this boot is a replacement, and the wipe is not silent: the timestamp is
      // surfaced on the store (the Ledger's recovery section reads it) and the
      // breadcrumb lands in the log for support.
      let quarantinedAt: number | null = null;
      try {
        const q = await storage.get<QuarantineBlob>('save', 'me.quarantine');
        if (q && typeof q.at === 'number' && Number.isFinite(q.at)) {
          quarantinedAt = q.at;
          console.warn('[assize] save: corrupt ledger replaced — the previous blob is preserved under save/me.quarantine');
        }
      } catch { /* diagnostics only — never wedge the boot gate */ }
      let name = 'the Clerk';
      try {
        const id = await loadIdentity();
        if (!id.name) {
          id.name = generateName();
          await saveIdentity(id);
        }
        name = id.name;
      } catch { /* a hostile Keychain must not wedge the boot gate */ }
      const fresh = freshSave(name);
      try { await storage.set('save', 'me', fresh); } catch { /* in-memory save still runs the session */ }
      set({ save: fresh, loaded: true, quarantinedAt });
    } else {
      if (existing && !existing.endless) {
        // T18 migration: persist the freshly minted endless state (its salt must
        // stick, or rung duels would re-derive from a new seed every load)
        try { await storage.set('save', 'me', migrated); } catch { /* best-effort persist */ }
      }
      set({ save: migrated, loaded: true });
    }
  },
  update: (fn) => {
    const cur = get().save;
    if (!cur) return;
    const next = fn(deepClone(cur));
    set({ save: next });
    void storage.set('save', 'me', next);
  },
  unlockAchievement: (id) => {
    const s = get().save;
    if (!s || s.achievements[id]) return;
    get().update((cur) => ({ ...cur, achievements: { ...cur.achievements, [id]: Date.now() } }));
  },
  markChronicle: (beat) => {
    if (typeof beat !== 'string' || !beat) return;
    const id = beat.slice(0, 40);
    const s = get().save;
    if (!s || (s.campaign.chronicleSeen ?? []).includes(id)) return;
    get().update((cur) => ({
      ...cur,
      campaign: {
        ...cur.campaign,
        chronicleSeen: [...(cur.campaign.chronicleSeen ?? []), id].slice(0, 64),
      },
    }));
  },
  /**
   * P3.3 — record a status as explained (first-hit toast shown). Same
   * append-only, idempotent, hostile-proofed law as markChronicle.
   */
  markStatusExplained: (status) => {
    if (typeof status !== 'string' || !status) return;
    const id = status.slice(0, 40);
    const s = get().save;
    if (!s || (s.flags?.statusExplained ?? []).includes(id)) return;
    get().update((cur) => ({
      ...cur,
      flags: { ...(cur.flags ?? {}), statusExplained: [...(cur.flags?.statusExplained ?? []), id].slice(0, 16) },
    }));
  },
  addInk: (n) => get().update((s) => ({ ...s, economy: { ...s.economy, ink: Math.max(0, s.economy.ink + n) } })),
  addSigils: (n) => get().update((s) => ({ ...s, economy: { ...s.economy, sigils: Math.max(0, s.economy.sigils + n) } })),
}));

// UNCHANGED from the web build — every branch here is a hostile-input guard.
// Exported for the gate: the chronicle migration is pinned by chronicle.test.ts.
export function migrate(s: SaveStateV2): SaveStateV2 {
  if (s.v === 2) {
    // P2.4 — saves from before the Chronicle gain an empty ledger; a hostile
    // chronicleSeen degrades to one, like every sibling here.
    const chronicleSeen = Array.isArray((s.campaign as { chronicleSeen?: unknown } | undefined)?.chronicleSeen)
      ? ((s.campaign as { chronicleSeen: unknown[] }).chronicleSeen
        .filter((b): b is string => typeof b === 'string' && b.length > 0)
        .map((b) => b.slice(0, 40))
        .slice(0, 64))
      : [];
    // P3.3 — saves from before the first-hit explainer gain empty flags; a
    // hostile flags blob degrades the same way.
    const statusExplained = Array.isArray((s.flags as { statusExplained?: unknown } | undefined)?.statusExplained)
      ? ((s.flags as { statusExplained: unknown[] }).statusExplained
        .filter((b): b is string => typeof b === 'string' && b.length > 0)
        .map((b) => b.slice(0, 40))
        .slice(0, 16))
      : [];
    // T18 — hostile/legacy endless states are sanitized on every load, and a
    // save from before this iteration gains a fresh (persisted) ladder.
    // T21 — saves from before the Weekly Assize gain its ledger, hostile or not.
    // T13 — saves from before the Ink ledger gain an empty pending queue (hostile-proofed).
    const pending = Array.isArray(s.economy?.pending)
      ? (s.economy.pending as unknown[])
        .filter((p): p is PendingInk => !!p && typeof p === 'object'
          && typeof (p as PendingInk).duelId === 'string'
          && typeof (p as PendingInk).mode === 'string'
          && typeof (p as PendingInk).delta === 'number'
          && Number.isFinite((p as PendingInk).delta)
          && (p as PendingInk).delta !== 0)
        .slice(0, 200)
        .map((p) => ({ duelId: p.duelId, mode: p.mode, delta: p.delta, t: typeof p.t === 'number' && Number.isFinite(p.t) ? p.t : 0 }))
      : [];
    return {
      ...s,
      campaign: { ...s.campaign, chronicleSeen },
      flags: { ...(s.flags ?? {}), statusExplained },
      economy: { ...s.economy, pending },
      endless: sanitizeEndless(s.endless),
      weekly: s.weekly && typeof s.weekly === 'object'
        ? { lastWeek: typeof s.weekly.lastWeek === 'number' && Number.isFinite(s.weekly.lastWeek) ? Math.floor(s.weekly.lastWeek) : null }
        : { lastWeek: null },
      // A15 — the Tablet-modes Ink budget sanitises like its `daily` siblings: a
      // hostile row degrades to an empty budget (a fresh day refills it anyway).
      daily: {
        ...s.daily,
        farmInkDay: s.daily && typeof s.daily === 'object' && typeof (s.daily as { farmInkDay?: unknown }).farmInkDay === 'string'
          && ((s.daily as { farmInkDay: string }).farmInkDay.length <= 10)
          ? (s.daily as { farmInkDay: string }).farmInkDay
          : null,
        farmInk: s.daily && typeof s.daily === 'object' && typeof (s.daily as { farmInk?: unknown }).farmInk === 'number'
          && Number.isFinite((s.daily as { farmInk: number }).farmInk)
          ? Math.max(0, Math.floor((s.daily as { farmInk: number }).farmInk))
          : 0,
      },
    };
  }
  return { ...freshSave(s.name ?? 'the Clerk'), ...s, v: 2 };
}
