// ASSIZE shell — boots straight into the tutorial duel (spec R1: live board within 2s).
'use client';
import { useEffect } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { loadIdentity } from '@/state/identity';
import { synth } from '@/audio/synth';

import BootScreen from './BootScreen';
import DuelScreen from './DuelScreen';
import Antechamber from './Antechamber';
import OrderSelect from './OrderSelect';
import Matchmaking from './Matchmaking';
import Versus from './Versus';
import ResultScreen from './ResultScreen';
import ReliquaryScreen from './ReliquaryScreen';
import FolioMap from './FolioMap';
import FolioDetail from './FolioDetail';
import DailyScreen from './DailyScreen';
import CabinetScreen from './CabinetScreen';
import SeasonLedger from './SeasonLedger';
import LedgerProfile from './LedgerProfile';
import SettingsScreen from './SettingsScreen';
import OfflineScreen from './OfflineScreen';
import StoryCard from './StoryCard';
import EndingChoice from './EndingChoice';
import PurseScreen from './PurseScreen';
import FriendScreen from './FriendScreen';
import EchoesScreen from './EchoesScreen';
import EndlessScreen from './EndlessScreen';
import WeeklyScreen from './WeeklyScreen';

export default function GameShell() {
  const screen = useUi((s) => s.screen);
  const save = useSave((s) => s.save);
  const loaded = useSave((s) => s.loaded);

  useEffect(() => {
    void useSave.getState().load();
    // PWA registration (spec §6)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* offline still works via engine-local modes */ });
    }
  }, []);

  useEffect(() => {
    if (!save) return;
    const root = document.documentElement;
    root.dataset.text = save.settings.text;
    root.dataset.contrast = save.settings.contrast ? 'high' : 'normal';
    root.dataset.motion = save.settings.reducedMotion ? 'reduced' : 'full';
  }, [save]);

  useEffect(() => {
    const unlock = () => synth.unlock();
    window.addEventListener('pointerdown', unlock, { once: false });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    void loadIdentity();
  }, []);

  if (!loaded) {
    return (
      <main className="boot-skeleton" aria-busy="true">
        <div className="skeleton-parchment boot-plate" />
      </main>
    );
  }

  switch (screen) {
    case 'boot': return <BootScreen />;
    case 'duel': case 'tutorial': return <DuelScreen />;
    case 'antechamber': return <Antechamber />;
    case 'orders': return <OrderSelect />;
    case 'matchmaking': return <Matchmaking />;
    case 'versus': return <Versus />;
    case 'result': return <ResultScreen />;
    case 'reliquary': return <ReliquaryScreen />;
    case 'folioMap': return <FolioMap />;
    case 'folioDetail': return <FolioDetail />;
    case 'daily': return <DailyScreen />;
    case 'cabinet': return <CabinetScreen />;
    case 'season': return <SeasonLedger />;
    case 'ledger': return <LedgerProfile />;
    case 'settings': return <SettingsScreen />;
    case 'offline': return <OfflineScreen />;
    case 'story': return <StoryCard />;
    case 'endingChoice': return <EndingChoice />;
    case 'purse': return <PurseScreen />;
    case 'friend': return <FriendScreen />;
    case 'echoes': return <EchoesScreen />;
    case 'endless': return <EndlessScreen />;
    case 'weekly': return <WeeklyScreen />;
    default: return <BootScreen />;
  }
}
