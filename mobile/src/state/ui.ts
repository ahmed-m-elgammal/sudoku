// ASSIZE mobile — UI screen router.
//
// PORT of ../src/state/ui.ts. The screen machine itself is UNCHANGED: the web build
// has no URL routing for the game, GameShell is a `switch (screen)`, and the
// `prev`/`direction` pair drives the page-turn variant. Do not introduce a navigator.
//
// The only edit: `synth.pageTurn()` becomes `audio.pageTurn()`.
//
// New in this port: Android hardware back. The web build never needed it; a phone
// does. `goBack()` is the honest implementation — pop to `prev`, or no-op at a root.
import { create } from 'zustand';
import type { DuelReplay } from '@shared/replay';
import type { ShadeProfile } from '@shared/shade';
import type { ServerDuelInit } from '@/game/net/client';
import { audio } from '@/platform/audio';

export type Screen =
  | 'boot' | 'duel' | 'tutorial' | 'antechamber' | 'orders' | 'matchmaking' | 'versus'
  | 'result' | 'reliquary' | 'folioMap' | 'folioDetail' | 'daily' | 'cabinet'
  | 'season' | 'ledger' | 'settings' | 'offline' | 'story' | 'purse' | 'friend'
  | 'endingChoice' // T6 — the Balance / Burn verdict after the Orsolo reveal
  | 'echoes'       // T7 — the Shade Echoes shelf (duel a stored replay)
  | 'endless'      // T18 — the Endless Assize ladder
  | 'weekly';      // T21 — the Weekly Assize (rotating rule modifiers)

export interface StoryPayload {
  lines: string[];
  plate: string;
  then: Screen;
  campaignIndex?: { folio: number; duel: number };
  ending?: 'balance' | 'burn';
}

export type DuelMode =
  | 'tutorial' | 'campaign' | 'daily' | 'practice'
  | 'shade' | 'ranked' | 'friend' | 'replay' | 'endless' | 'weekly';

export type PlayerSeat = 0 | 1;

interface UiStore {
  screen: Screen;
  prev: Screen | null;
  direction: number; // page turn variant
  story: StoryPayload | null;
  duelMode: DuelMode;
  pendingEcho: DuelReplay | null;
  pendingPersonalShade: { replay: DuelReplay; profile: ShadeProfile } | null;
  endlessRung: number | null;
  campaignDuel: { folio: number; duel: number } | null;
  lastResult: {
    winner: PlayerSeat | 'draw'; reason: string; mode: string;
    claims: [number, number]; mistakes: [number, number]; abilities: [number, number];
    timeMs: number; sealTimeline: [number, number, number][]; ratingDelta: number | null;
    ink: number; shadeDuel: boolean; reliquaryWon: boolean;
  } | null;
  pendingFoe: { name: string; order: string; shade: boolean; standing: number; tier?: string; range?: [number, number] } | null;
  serverDuel: ServerDuelInit | null;
  go: (s: Screen, payload?: Partial<UiStore>) => void;
  goBack: () => void;
  boot: () => void;
}

export const useUi = create<UiStore>((set, get) => ({
  screen: 'boot',
  prev: null,
  direction: 1,
  story: null,
  duelMode: 'tutorial',
  campaignDuel: null,
  lastResult: null,
  pendingFoe: null,
  pendingEcho: null,
  pendingPersonalShade: null,
  endlessRung: null,
  serverDuel: null,
  go: (s, payload) => {
    audio.pageTurn();
    const cur = get();
    set({ screen: s, prev: cur.screen, direction: cur.direction * -1, ...payload });
  },
  // Android hardware back / iOS swipe-back: pop to `prev`. At the root, do nothing —
  // the OS then closes the app, which is the correct behaviour at a root screen.
  goBack: () => {
    const { prev } = get();
    if (!prev) return;
    audio.pageTurn();
    const cur = get();
    set({ screen: prev, prev: cur.prev, direction: cur.direction * -1 });
  },
  // Spec R1: boot lands straight in the tutorial duel. No menu, no login.
  boot: () => set({ screen: 'tutorial', duelMode: 'tutorial' }),
}));
