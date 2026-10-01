// UI screen router (page turns, spec §4). Boot lands directly in the tutorial duel (R1).
'use client';
import { create } from 'zustand';
import { synth } from '@/audio/synth';

export type Screen =
  | 'boot' | 'duel' | 'tutorial' | 'antechamber' | 'orders' | 'matchmaking' | 'versus'
  | 'result' | 'reliquary' | 'folioMap' | 'folioDetail' | 'daily' | 'cabinet'
  | 'season' | 'ledger' | 'settings' | 'offline' | 'story' | 'purse' | 'friend'
  | 'endingChoice' // T6 — the Balance / Burn verdict after the Orsolo reveal
  | 'echoes'       // T7 — the Shade Echoes shelf (duel a stored replay)
  | 'endless';     // T18 — the Endless Assize ladder

export interface StoryPayload {
  lines: string[];
  plate: string;         // asset path
  then: Screen;
  campaignIndex?: { folio: number; duel: number };
  ending?: 'balance' | 'burn';
}

interface UiStore {
  screen: Screen;
  prev: Screen | null;
  direction: number; // page turn variant
  story: StoryPayload | null;
  duelMode: 'tutorial' | 'campaign' | 'daily' | 'practice' | 'shade' | 'ranked' | 'friend' | 'replay' | 'endless';
  pendingEcho: import('@shared/replay').DuelReplay | null; // T7 — the chosen echo for a replay duel
  // T17 — "Your Shade": the echo mined into a personal profile + the echo it came from
  pendingPersonalShade: { replay: import('@shared/replay').DuelReplay; profile: import('@shared/shade').ShadeProfile } | null;
  // T18 — the Endless rung this duel ascends (0-based; null = the save's current rung)
  endlessRung: number | null;
  campaignDuel: { folio: number; duel: number } | null;
  lastResult: {
    winner: PlayerSeat | 'draw'; reason: string; mode: string;
    claims: [number, number]; mistakes: [number, number]; abilities: [number, number];
    timeMs: number; sealTimeline: Array<[number, number, number]>; ratingDelta: number | null;
    ink: number; shadeDuel: boolean; reliquaryWon: boolean;
  } | null;
  pendingFoe: { name: string; order: string; shade: boolean; standing: number; tier?: string; range?: [number, number] } | null;
  serverDuel: import('@/game/serverDuel').ServerDuelInit | null;
  go: (s: Screen, payload?: Partial<UiStore>) => void;
  boot: () => void;
}

export type PlayerSeat = 0 | 1;

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
    synth.pageTurn();
    const cur = get();
    set({ screen: s, prev: cur.screen, direction: cur.direction * -1, ...payload });
  },
  boot: () => set({ screen: 'tutorial', duelMode: 'tutorial' }),
}));
