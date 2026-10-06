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

export interface SaveStateV2 {
  v: 2;
  tutorialDone: boolean;
  antechamberUnlocked: boolean;
  campaign: { folioIdx: number; duelIdx: number; stars: Record<string, number>; ended: boolean; ending?: 'balance' | 'burn' };
  order: OrderId;
  unlockedOrders: OrderId[];
  economy: { ink: number; sigils: number; reliquaryProgress: number; pending: PendingInk[] };
  cosmetics: {
    owned: string[];
    equipped: { board: string; wax: string; frame: string; numerals: string; stamps: string; banner: string };
  };
  season: { ink: number; claimed: string[]; patron: boolean; endsAt: number };
  daily: { lastDate: string | null; streak: number; best: number; candlesToday: number; candlesDate: string | null; times: Record<string, number> };
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
  name: string;
}

// The Endless ladder salt is minted once per Clerk and PERSISTED — a re-minted salt
// silently rewrites every rung's tablet. Hence this lives in freshSave, not in a load.
const newEndlessSalt = (): string => Math.random().toString(36).slice(2, 10);

export const freshSave = (name: string): SaveStateV2 => ({
  v: 2,
  tutorialDone: false,
  antechamberUnlocked: false,
  campaign: { folioIdx: 0, duelIdx: 0, stars: {}, ended: false },
  order: 'scholar',
  unlockedOrders: ['scholar', 'executioner'],
  economy: { ink: 0, sigils: 0, reliquaryProgress: 0, pending: [] },
  cosmetics: {
    owned: ['board-aged-vellum', 'wax-oxblood', 'frame-bronze', 'numerals-linocut', 'stamp-fleur', 'banner-standard'],
    equipped: { board: 'board-aged-vellum', wax: 'wax-oxblood', frame: 'frame-bronze', numerals: 'numerals-linocut', stamps: 'stamp-fleur', banner: 'banner-standard' },
  },
  season: { ink: 0, claimed: [], patron: false, endsAt: Date.now() + 8 * 7 * 86400_000 },
  daily: { lastDate: null, streak: 0, best: 0, candlesToday: 0, candlesDate: null, times: {} },
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
  name,
});

interface SaveStore {
  save: SaveStateV2 | null;
  loaded: boolean;
  load: () => Promise<void>;
  update: (fn: (s: SaveStateV2) => SaveStateV2) => void;
  unlockAchievement: (id: string) => void;
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
  load: async () => {
    const existing = await storage.get<SaveStateV2>('save', 'me');
    const migrated = existing ? migrate(existing) : null;
    set({ save: migrated, loaded: true });
    if (!migrated) {
      const id = await loadIdentity();
      if (!id.name) {
        id.name = generateName();
        await saveIdentity(id);
      }
      const fresh = freshSave(id.name);
      await storage.set('save', 'me', fresh);
      set({ save: fresh });
    } else if (existing && !existing.endless) {
      // T18 migration: persist the freshly minted endless state (its salt must
      // stick, or rung duels would re-derive from a new seed every load)
      await storage.set('save', 'me', migrated);
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
  addInk: (n) => get().update((s) => ({ ...s, economy: { ...s.economy, ink: Math.max(0, s.economy.ink + n) } })),
  addSigils: (n) => get().update((s) => ({ ...s, economy: { ...s.economy, sigils: Math.max(0, s.economy.sigils + n) } })),
}));

// UNCHANGED from the web build — every branch here is a hostile-input guard.
function migrate(s: SaveStateV2): SaveStateV2 {
  if (s.v === 2) {
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
      economy: { ...s.economy, pending },
      endless: sanitizeEndless(s.endless),
      weekly: s.weekly && typeof s.weekly === 'object'
        ? { lastWeek: typeof s.weekly.lastWeek === 'number' && Number.isFinite(s.weekly.lastWeek) ? Math.floor(s.weekly.lastWeek) : null }
        : { lastWeek: null },
    };
  }
  return { ...freshSave(s.name ?? 'the Clerk'), ...s, v: 2 };
}
