// useDuelSession — creates and owns the duel runtime, wires engine events to audio,
// haptics and the Result flow, and feeds the pure fx law in `@/game/fx`.
//
// PORT of ../src/app/game/useDuelSession.ts. The engine, the event stream and the fx law
// are untouched; only the platform surfaces change:
//
//   synth.*            → audio.*        (the 18-method AudioBackend)
//   navigator.vibrate  → haptics.*      (the seam, which decides feel per platform)
//   window.setTimeout  → setTimeout     (RN global, same semantics)
//   window.__assizeDuel→ globalThis     (kept only as a browser/dev probe)
//
// The runtime is typed as the `DuelRuntime` INTERFACE, not as the `LocalDuel` class.
// That is the load-bearing decision: when `ServerDuel` lands (specs/17 phase 4.4) it
// satisfies the same interface and NO component below this line changes. The web build's
// `AnyDuel` union did the same job with types; this does it with an interface.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { LocalDuel } from '@/game/localDuel';
import { ServerDuel } from '@/game/serverDuel';
import type { DuelRuntime, DuelSessionSpec, LocalDuelOpts, DuelEvent } from '@/game/duelRuntime';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { audio } from '@/platform/audio';
import { haptics } from '@/platform/haptics';
import {
  floodFromEvent, tierForEvent, hitStopFromEvent, heatFromState, advanceRuns, Cue,
  SHAKE_MS, FLOOD_CLEAR_MS, HIT_STOP_MS, SLOW_INK_MS,
  type Flood, type Shake, type ShakeTier, type HitStop, type Heat,
} from '@/game/fx';
import { FOLIOS } from '@shared/orders';
import { profileForStanding, tieredTechniques } from '@shared/shade';
import { BOSS_SCRIPTS } from '@shared/phaseScript';
import { endlessFoe, newEndlessState } from '@shared/endless';
import { weekIndexFor, weeklyForWeek } from '@shared/weekly';

export type { DuelSessionSpec, LocalDuelOpts };

export interface DuelFxState {
  flood: Flood | null;
  shake: Shake | null;
  hitStop: HitStop | null;
  slowInk: boolean;
  heat: Heat | null;
}
export function useDuelSession(spec: DuelSessionSpec | null) {
  const lastSeqRef = useRef(0);
  // specs/17 phase 4.4 — a server-authoritative duel (ranked / friend / server Shade)
  // carries its own init in the screen machine; when present it REPLACES the local spec
  // (the web build's effect order: serverDuel first, spec second).
  const serverInit = useUi((s) => s.serverDuel);

  // ---- fx state. Every one of these is driven by a self-cleaning Cue: the timer is the
  //      ONLY cleaner, so a stuck shake or a permanently flooded cell is structurally
  //      impossible (pinned by the web build's "no stuck shake after 1000 events" fuzz).
  const [flood, setFlood] = useState<Flood | null>(null);
  const [shake, setShake] = useState<Shake | null>(null);
  const [hitStop, setHitStop] = useState<HitStop | null>(null);
  const [slowInk, setSlowInk] = useState(false);
  const [heat, setHeat] = useState<Heat | null>(null);

  const floodCue = useRef<Cue<Flood> | null>(null);
  const shakeCue = useRef<Cue<Shake> | null>(null);
  const hitStopCue = useRef<Cue<HitStop> | null>(null);
  const slowInkCue = useRef<Cue<true> | null>(null);
  const heatRef = useRef<Heat | null>(null);
  const runsRef = useRef<[number, number]>([0, 0]);
  const lastClaimerRef = useRef(-1);
  const fxNonce = useRef(1);

  if (!floodCue.current) floodCue.current = new Cue<Flood>(() => FLOOD_CLEAR_MS, setFlood);
  if (!shakeCue.current) shakeCue.current = new Cue<Shake>((s) => SHAKE_MS[s.tier], setShake);
  if (!hitStopCue.current) hitStopCue.current = new Cue<HitStop>(() => HIT_STOP_MS, setHitStop);
  if (!slowInkCue.current) slowInkCue.current = new Cue<true>(() => SLOW_INK_MS, (v) => setSlowInk(v !== null));

  const fireShake = useCallback((tier: ShakeTier) => {
    shakeCue.current?.set({ tier, nonce: fxNonce.current++ });
  }, []);

  const makeDuel = useCallback(
    (init: typeof serverInit, s: DuelSessionSpec | null): DuelRuntime | null =>
      init
        ? new ServerDuel(init)
        : s
          ? new LocalDuel({
              ...s,
              onPhase: () => fireShake(3), // J2 — a boss phase ENTRY shakes T3
            })
          : null,
    [fireShake],
  );

  const [prevSpec, setPrevSpec] = useState(spec);
  const [prevServer, setPrevServer] = useState(serverInit);
  const [duel, setDuel] = useState<DuelRuntime | null>(() => makeDuel(serverInit, spec));

  if (spec !== prevSpec || serverInit !== prevServer) {
    setPrevSpec(spec);
    setPrevServer(serverInit);
    if (duel) duel.destroy();
    setDuel(makeDuel(serverInit, spec));
  }

  useEffect(() => {
    if (!duel) return;
    // A new duel's events restart at seq 0. The web build fixed this as a parity bug
    // (T21/J2): a rematch's first claims were swallowed by the previous duel's high-water
    // mark, so the flood/shake never fired on the rematch.
    lastSeqRef.current = -1;
    runsRef.current = [0, 0];
    lastClaimerRef.current = -1;
    heatRef.current = null;
    duel.start();
    return () => {
      duel.destroy();
      floodCue.current?.dispose();
      shakeCue.current?.dispose();
      hitStopCue.current?.dispose();
      slowInkCue.current?.dispose();
      setFlood(null);
      setShake(null);
      setHitStop(null);
      setSlowInk(false);
      setHeat(null);
    };
  }, [duel]);

  // The web build throttled this to ~66 ms (~15 fps) on purpose. RN's reconciler is
  // slower than the DOM's, so the cap is a FEATURE here — but every board cell must be
  // memoised or 81 cells x 15 fps will jank (risk R4). Both runtimes keep the same law.
  const version = useSyncExternalStore(
    (cb) => (duel ? duel.subscribe(cb) : () => {}),
    () => duel?.getSnapshot() ?? 0,
  );

  // Sound + fx for foe-side and duel-level events. `hookEvent` is local to this effect
  // and reads refs and the stable `fireShake`, so the effect deps stay [version, duel, fireShake].
  useEffect(() => {
    if (!duel) return;

    function hookEvent(e: DuelEvent) {
      switch (e.kind) {
        case 'claim': {
          const player = e.player as 0 | 1;
          if (player === 1) audio.claimLost();
          else audio.claimWon();
          audio.stamp();
          haptics.claim((e as { clean?: boolean }).clean === true);
          break;
        }
        case 'status':
          audio.statusApplied();
          haptics.status();
          break;
        case 'statusEnded':
          audio.statusEnded();
          break;
        case 'negated':
        case 'mirrored':
          audio.padlock();
          break;
        case 'orderSwap':
          audio.orderSwap();
          haptics.orderSwap();
          break;
        case 'end':
          slowInkCue.current?.set(true); // J3 — 300 ms of slow ink before the verdict
          break;
        default:
          break;
      }
      // J1/J2 — the fx law reads the SAME deduped stream. fx.ts is fail-closed: deferred
      // claims and hostile events drive nothing.
      const f = floodFromEvent(e);
      if (f) {
        floodCue.current?.set(f);
        // J4 — the run law rides the same validated claims (a hostile event feeds neither)
        const adv = advanceRuns(runsRef.current, lastClaimerRef.current, f.player);
        runsRef.current = adv.runs;
        lastClaimerRef.current = adv.lastClaimer;
      }
      const hs = hitStopFromEvent(e);
      if (hs) hitStopCue.current?.set({ ...hs, nonce: fxNonce.current++ });
      const tier = tierForEvent(e);
      if (tier) fireShake(tier);
    }

    for (const e of duel.state.events) {
      if (e.seq <= lastSeqRef.current) continue;
      lastSeqRef.current = e.seq;
      hookEvent(e);
    }
    // J4 — heat re-derives from PUBLIC state on every push (Seals only move via events).
    // Compare-and-set so a clock tick that adds no events never re-renders the room.
    const st = duel.state;
    const next = heatFromState([st.players[0]?.seals, st.players[1]?.seals], runsRef.current);
    const prev = heatRef.current;
    if (!prev || prev.heat !== next.heat || prev.cold !== next.cold) {
      heatRef.current = next;
      setHeat(next);
      audio.setHeat(next.heat); // the gallery murmur follows the same law
    }
  }, [version, duel, fireShake]);

  return { duel, version, flood, shake, hitStop, slowInk, heat } satisfies DuelFxState & { duel: DuelRuntime | null; version: number };
}

// ------------------------------------------------------------------ specFromUi

/** The Daily's tier rotates on a fixed 7-day calendar, keyed by UTC day. */
const DAILY_TIERS = ['Medium', 'Easy', 'Medium', 'Hard', 'Medium', 'Expert', 'Hard'] as const;
type PlayableTier = 'Easy' | 'Medium' | 'Hard' | 'Expert';

function dailyTier(dateKey: string): PlayableTier {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return DAILY_TIERS[(d.getUTCDay() + 6) % 7];
}

/**
 * Build the duel spec from the screen machine's mode + campaign pointer.
 *
 * Ports `specFromUi()` verbatim in structure. One addition: the daily/practice foes are
 * built through `inertProfile()` rather than open-coding the same five fields twice — a
 * de-duplication only, no behaviour change.
 */
export function specFromUi(): DuelSessionSpec {
  const ui = useUi.getState();
  const save = useSave.getState().save!;
  const mode = ui.duelMode;

  if (mode === 'tutorial') {
    return {
      mode: 'tutorial', seed: 'tutorial-orsolo', tier: 'Easy',
      orders: ['scholar', 'executioner'],
      names: ['You', 'Shade of Orsolo'],
    };
  }

  if (mode === 'campaign' && ui.campaignDuel) {
    const folio = FOLIOS[ui.campaignDuel.folio];
    const foe = folio.duels[ui.campaignDuel.duel];
    const factor = foe.shadeKind === 'minor' ? 0.75 : foe.shadeKind === 'lieutenant' ? 1 : 1.25;
    const prof = profileForStanding(save.standing);
    return {
      mode: 'campaign',
      seed: `campaign-${folio.key}-${ui.campaignDuel.duel}`,
      tier: foe.tier,
      orders: [save.order, foe.order],
      names: ['You', foe.name],
      seals: [7, foe.seals],
      adaptive: foe.adaptive === true,
      foeScript: foe.script ? BOSS_SCRIPTS[foe.script] : undefined,
      foeProfile: {
        ...prof,
        name: foe.name,
        order: foe.order,
        placeDelayMs: [
          Math.round(prof.placeDelayMs[0] / factor),
          Math.round(prof.placeDelayMs[1] / factor),
        ],
        mistakeRate: Math.max(0.02, prof.mistakeRate / factor),
        singlesSkill: Math.min(0.97, prof.singlesSkill * factor),
        techniques: tieredTechniques(prof.techniques ?? 0, foe.shadeKind),
      },
    };
  }

  if (mode === 'replay' && ui.pendingEcho) {
    const echo = ui.pendingEcho;
    return {
      mode: 'replay', seed: echo.seed, tier: echo.tier, orders: echo.orders,
      names: ['You', echo.names[0]], seals: echo.seals, replay: echo,
    };
  }

  if (mode === 'shade' && ui.pendingPersonalShade) {
    const { replay, profile } = ui.pendingPersonalShade;
    return {
      mode: 'shade',
      seed: `your-shade-${Date.now()}`,
      tier: replay.tier,
      orders: [save.order, profile.order],
      names: ['You', profile.name],
      foeProfile: profile,
    };
  }

  if (mode === 'daily') {
    const key = new Date().toISOString().slice(0, 10);
    return {
      mode: 'daily', seed: `assize-daily-${key}`, tier: dailyTier(key),
      orders: [save.order, 'executioner'], names: ['You', 'The Tablet'],
      foeProfile: inertProfile(),
    };
  }

  if (mode === 'endless') {
    const ladder = save.endless ?? newEndlessState('novem');
    const foe = endlessFoe(ui.endlessRung ?? ladder.current, ladder.salt);
    return {
      mode: 'endless', seed: foe.seed, tier: foe.tier,
      orders: [save.order, foe.order], names: ['You', foe.name],
      seals: foe.seals, foeProfile: foe.profile, foeScript: foe.script,
    };
  }

  if (mode === 'weekly') {
    const foe = weeklyForWeek(weekIndexFor(Date.now()));
    return {
      mode: 'weekly', seed: foe.seed, tier: foe.tier,
      orders: [save.order, foe.order], names: ['You', foe.name],
      seals: foe.seals, foeProfile: foe.profile, foeScript: foe.script,
      mods: foe.mods,
    };
  }

  // practice
  return {
    mode: 'practice', seed: `practice-${Date.now()}`, tier: 'Medium',
    orders: [save.order, 'executioner'], names: ['You', 'The Tablet'],
    foeProfile: inertProfile(),
  };
}

/** The solo foes: the Tablet does not play. Same profile, daily and practice. */
function inertProfile() {
  return {
    ...profileForStanding(1),
    placeDelayMs: [99999, 100000] as [number, number],
    mistakeRate: 0,
    aggression: 0,
    singlesSkill: 0,
  };
}