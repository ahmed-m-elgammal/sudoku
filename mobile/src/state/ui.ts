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
  | 'weekly'       // T21 — the Weekly Assize (rotating rule modifiers)
  | 'chronicle'    // P2.4 — the re-readable Ledger of story beats (a reading
                   // screen: deliberately NOT in DEAD_ENDS, so back can land)
  | 'lexicon';     // P2.5 — the Clerk's Lexicon, the in-app glossary (same law)

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

/**
 * DAY2 back-nav hardening — the screens where hardware back means "exit the app".
 * The hub is THE root of the navigation tree (BootScreen advances straight to it or
 * into the tutorial); popping past it must hand the gesture to the OS, never bounce
 * the player through the splash again.
 */
const ROOT_SCREENS: ReadonlySet<Screen> = new Set<Screen>(['boot', 'antechamber']);

/**
 * DAY2 back-nav hardening — screens that must never be a back DESTINATION:
 *  · 'duel'/'tutorial' — a finished duel would REMOUNT with the same spec and re-award
 *    its economy (the daily double-ink path); a live duel is left only through the
 *    duel screen's own confirm flow.
 *  · 'boot' — the splash auto-advances; popping back to it re-shows and bounces.
 *  · 'story'/'endingChoice' — narrative beats replay themselves.
 *  · 'reliquary' — the chest ritual re-rolls on every mount; it is entered, never
 *    re-entered (A7).
 * Each remaps to the hub instead — the honest neutral destination.
 */
const DEAD_ENDS: ReadonlySet<Screen> = new Set<Screen>([
  'boot', 'duel', 'tutorial', 'story', 'endingChoice', 'reliquary',
]);

interface UiStore {
  screen: Screen;
  prev: Screen | null;
  direction: number; // page turn variant
  story: StoryPayload | null;
  duelMode: DuelMode;
  /**
   * DAY2 — a screen-owned back guard. When a screen must intercept hardware back
   * (the duel confirms an abandon; the disconnect grace must not be popped), it
   * registers a guard here; GameShell's single BackHandler consults it FRESH at the
   * call and consumes the gesture when the guard returns true. One listener, one
   * order — no LIFO reasoning between coexisting handlers.
   */
  backGuard: (() => boolean) | null;
  setBackGuard: (g: (() => boolean) | null) => void;
  /**
   * M1 (docs/TUTORIAL_OPTIMIZATION_PLAN.md G10) — bumped to force the duel screens
   * to REMOUNT with a fresh runtime: the tutorial-replay routing re-enters the same
   * screen, and the shell's switch would otherwise reuse the ended duel instance.
   * Also the hook the M2/G13 replay entry points will use.
   */
  duelNonce: number;
  pendingEcho: DuelReplay | null;
  pendingPersonalShade: { replay: DuelReplay; profile: ShadeProfile } | null;
  endlessRung: number | null;
  campaignDuel: { folio: number; duel: number } | null;
  lastResult: {
    winner: PlayerSeat | 'draw'; reason: string; mode: string;
    claims: [number, number]; mistakes: [number, number]; abilities: [number, number];
    timeMs: number; sealTimeline: [number, number, number][]; ratingDelta: number | null;
    ink: number; shadeDuel: boolean; reliquaryWon: boolean;
    /** P2.3 — the fought folio's key (campaign only); lets ResultScreen voice the Magistrate. */
    campaignFolioKey?: string;
  } | null;
  pendingFoe: { name: string; order: string; shade: boolean; standing: number; tier?: string; range?: [number, number] } | null;
  serverDuel: ServerDuelInit | null;
  go: (s: Screen, payload?: Partial<UiStore>) => void;
  /**
   * pops to `prev`; true when it consumed the gesture, false at a root screen (the
   * OS closes the app). DAY2: a root screen never pops (the hub↔splash bounce), and
   * a dead-end destination remaps to the hub (the result→duel double-award path).
   */
  goBack: () => boolean;
  boot: () => void;
}

export const useUi = create<UiStore>((set, get) => ({
  screen: 'boot',
  prev: null,
  direction: 1,
  story: null,
  duelMode: 'tutorial',
  duelNonce: 0,
  campaignDuel: null,
  lastResult: null,
  pendingFoe: null,
  pendingEcho: null,
  pendingPersonalShade: null,
  endlessRung: null,
  serverDuel: null,
  backGuard: null,
  setBackGuard: (g) => set({ backGuard: g }),
  go: (s, payload) => {
    audio.pageTurn();
    const cur = get();
    set({ screen: s, prev: cur.screen, direction: cur.direction * -1, ...payload });
  },
  // Android hardware back / iOS swipe-back: pop to `prev`. Pop ONCE and clear `prev` —
  // the old `prev: cur.prev` kept the previous screen under itself, so the second back
  // re-set the same screen forever (a page-turn loop that never exits).
  //
  // DAY2 back-nav hardening (the report's 3.3.4 cluster, one law):
  //  · at a ROOT screen (the hub, the splash) return false — the OS closes the app.
  //    The old behaviour popped to `prev:'boot'`, re-showed the splash, which
  //    auto-advanced 1.2 s later: back on the hub could never leave the app.
  //  · a dead-end destination (a duel screen, the splash, a narrative beat, the
  //    chest ritual) remaps to the hub. Popping into 'duel' remounted a brand-new
  //    duel with the same spec — finishing that replayed daily re-awarded its ink.
  goBack: () => {
    const { screen, prev } = get();
    if (ROOT_SCREENS.has(screen) || !prev) return false;
    const dest = DEAD_ENDS.has(prev) ? 'antechamber' : prev;
    audio.pageTurn();
    set({ screen: dest, prev: null, direction: get().direction * -1 });
    return true;
  },
  // Spec R1: boot lands straight in the tutorial duel. No menu, no login.
  boot: () => set({ screen: 'tutorial', duelMode: 'tutorial' }),
}));
