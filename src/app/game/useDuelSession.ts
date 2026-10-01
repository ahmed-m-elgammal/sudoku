// useDuelSession — creates and owns a LocalDuel for solo/Shade/tutorial duels,
// wires engine events to synth/haptics and to the Result flow.
'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { LocalDuel, type LocalDuelOpts } from '@/game/localDuel';
import { ServerDuel, type ServerDuelInit } from '@/game/serverDuel';
import { useUi, type PlayerSeat } from '@/state/ui';
import { useSave } from '@/state/save';
import { synth } from '@/audio/synth';
import { profileForStanding } from '@shared/shade';
import { FOLIOS } from '@shared/orders';
import type { DuelEvent } from '@shared/engine';

export interface DuelSessionSpec {
  mode: LocalDuelOpts['mode'];
  seed: string;
  tier: LocalDuelOpts['tier'];
  orders: [LocalDuelOpts['orders'][0], LocalDuelOpts['orders'][1]];
  names: [string, string];
  seals?: [number, number];
  foeProfile?: ShadeProfile;
}

export function useDuelSession(spec: DuelSessionSpec | null) {
  const ref = useRef<LocalDuel | ServerDuel | null>(null);
  const [, setTick] = useState(0);
  const lastSeqRef = useRef(0);
  const serverDuel = useUi((s) => s.serverDuel);

  useEffect(() => {
    // server-authoritative duel (ranked / friend): the socket 'matched' payload drives it
    if (serverDuel) {
      const sd = new ServerDuel(serverDuel);
      ref.current = sd;
      setTick((t) => t + 1);
      sd.start();
      return () => { sd.destroy(); ref.current = null; };
    }
    if (!spec) return;
    const save = useSave.getState().save;
    const profile = spec.foeProfile ?? profileForStanding(save?.standing ?? 1000);
    const duel = new LocalDuel({ ...spec, foeProfile: profile });
    ref.current = duel;
    setTick((t) => t + 1);
    duel.start();
    // test hook for browser verification (agent-browser eval); harmless in production
    (window as unknown as { __assizeDuel?: unknown }).__assizeDuel = duel;
    return () => { duel.destroy(); ref.current = null; };
  }, [spec, serverDuel]);

  const duel = ref.current;
  const version = useSyncExternalStore(
    (cb) => (duel ? duel.subscribe(cb) : () => {}),
    () => duel?.getSnapshot() ?? 0,
  );

  // sound hooks for foe-side events
  useEffect(() => {
    if (!duel) return;
    const events = duel.state.events;
    for (const e of events) {
      if (e.seq <= lastSeqRef.current) continue;
      lastSeqRef.current = e.seq;
      hookEvent(e);
    }
  }, [version, duel]);

  return { duel, version };
}

function hookEvent(e: DuelEvent) {
  switch (e.kind) {
    case 'claim': {
      const player = e.player as PlayerSeat;
      if (player === 1) synth.claimLost(); else synth.claimWon();
      synth.stamp();
      if ((e as { clean?: boolean }).clean) navigator.vibrate?.(40);
      break;
    }
    case 'status': synth.statusApplied(); navigator.vibrate?.(30); break;
    case 'statusEnded': synth.statusEnded(); break;
    case 'negated': case 'mirrored': synth.padlock(); break;
    case 'end': break; // handled by finish()
  }
}

// build the session spec from the UI store's mode + campaign pointer
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
    const shadeTierFactor = foe.shadeKind === 'minor' ? 0.75 : foe.shadeKind === 'lieutenant' ? 1 : 1.25;
    const prof = profileForStanding(save.standing);
    return {
      mode: 'campaign',
      seed: `campaign-${folio.key}-${ui.campaignDuel.duel}`,
      tier: foe.tier,
      orders: [save.order, foe.order],
      names: ['You', foe.name],
      seals: [7, foe.seals],
      foeProfile: {
        ...prof,
        name: foe.name,
        order: foe.order,
        placeDelayMs: [Math.round(prof.placeDelayMs[0] / shadeTierFactor), Math.round(prof.placeDelayMs[1] / shadeTierFactor)],
        mistakeRate: Math.max(0.02, prof.mistakeRate / shadeTierFactor),
        singlesSkill: Math.min(0.97, prof.singlesSkill * shadeTierFactor),
      },
    };
  }
  if (mode === 'daily') {
    const key = new Date().toISOString().slice(0, 10);
    return {
      mode: 'daily', seed: `assize-daily-${key}`, tier: dailyTier(key),
      orders: [save.order, 'executioner'], names: ['You', 'The Tablet'],
      foeProfile: { ...profileForStanding(1), placeDelayMs: [99999, 100000], mistakeRate: 0, aggression: 0, singlesSkill: 0 }, // solo: the Tablet does not play
    };
  }
  const tier = (ui as { practiceTier?: string }).practiceTier as 'Easy' | 'Medium' | 'Hard' | 'Expert' | undefined;
  return {
    mode: 'practice', seed: `practice-${Date.now()}`, tier: tier ?? 'Medium',
    orders: [save.order, 'executioner'], names: ['You', 'The Tablet'],
    foeProfile: { ...profileForStanding(1), placeDelayMs: [99999, 100000], mistakeRate: 0, aggression: 0, singlesSkill: 0 },
  };
}

const DAILY_TIERS = ['Medium', 'Easy', 'Medium', 'Hard', 'Medium', 'Expert', 'Hard'] as const;
function dailyTier(dateKey: string): 'Easy' | 'Medium' | 'Hard' | 'Expert' {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return DAILY_TIERS[(d.getUTCDay() + 6) % 7];
}
