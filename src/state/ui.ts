// UI screen router (page turns, spec §4). Boot lands directly in the tutorial duel (R1).
'use client';
import { create } from 'zustand';
import { synth } from '@/audio/synth';

export type Screen =
  | 'boot' | 'duel' | 'tutorial' | 'antechamber' | 'orders' | 'matchmaking' | 'versus'
  | 'result' | 'reliquary' | 'folioMap' | 'folioDetail' | 'daily' | 'cabinet'
  | 'season' | 'ledger' | 'settings' | 'offline' | 'story' | 'purse' | 'friend';

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
  duelMode: 'tutorial' | 'campaign' | 'daily' | 'practice' | 'shade' | 'ranked' | 'friend';
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
  serverDuel: null,
  go: (s, payload) => {
    synth.pageTurn();
    const cur = get();
    set({ screen: s, prev: cur.screen, direction: cur.direction * -1, ...payload });
  },
  boot: () => set({ screen: 'tutorial', duelMode: 'tutorial' }),
}));
