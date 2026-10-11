// ASSIZE mobile — GameShell.
//
// A direct port of ../src/app/game/GameShell.tsx. The `switch (screen)` over the
// zustand screen machine IS the navigation architecture of this game. There is no
// router and there must not be one (see mobile/AGENTS.md §2).
//
// New in this port, and the only addition over the web build: Android hardware back
// and the iOS swipe-back gesture pop to `ui.goBack()`, which is a no-op at a root
// screen so the OS closes the app instead of trapping the player in the shell.
//
// DAY2 back-nav hardening: ONE listener owns the gesture. Before popping, it consults
// the screen-owned back guard (ui.backGuard) FRESH at the call — the duel screen uses
// it to confirm an abandon and to shield the disconnect grace. No coexisting handlers,
// no LIFO-order reasoning between GameShell and the screens.

import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useUi } from '@/state/ui';

import BootScreen from './screens/BootScreen';
import DuelScreen from './duel/DuelScreen';
import Antechamber from './screens/Antechamber';
import OrderSelect from './screens/OrderSelect';
import Matchmaking from './screens/Matchmaking';
import Versus from './screens/Versus';
import ResultScreen from './screens/ResultScreen';
import ReliquaryScreen from './screens/ReliquaryScreen';
import FolioMap from './screens/FolioMap';
import FolioDetail from './screens/FolioDetail';
import DailyScreen from './screens/DailyScreen';
import CabinetScreen from './screens/CabinetScreen';
import SeasonLedger from './screens/SeasonLedger';
import LedgerProfile from './screens/LedgerProfile';
import SettingsScreen from './screens/SettingsScreen';
import OfflineScreen from './screens/OfflineScreen';
import StoryCard from './screens/StoryCard';
import EndingChoice from './screens/EndingChoice';
import PurseScreen from './screens/PurseScreen';
import FriendScreen from './screens/FriendScreen';
import EchoesScreen from './screens/EchoesScreen';
import EndlessScreen from './screens/EndlessScreen';
import WeeklyScreen from './screens/WeeklyScreen';

export default function GameShell() {
  const screen = useUi((s) => s.screen);
  const goBack = useUi((s) => s.goBack);
  // G10 — the duel screens key on the store's duelNonce so a bumped nonce remounts
  // the screen with a fresh runtime (the tutorial replay re-enters the SAME screen).
  const duelNonce = useUi((s) => s.duelNonce);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // `true` only when the gesture was consumed — by the screen's guard (a live
      // duel confirms, a grace modal shields) or by an actual pop. Returning true
      // unconditionally — the old behaviour — SWALLOWS the event at a root screen,
      // which is precisely what stops the OS from ever closing the app with the
      // back button.
      const guard = useUi.getState().backGuard;
      if (guard && guard()) return true;
      return goBack();
    });
    return () => sub.remove();
  }, [goBack]);

  switch (screen) {
    case 'boot': return <BootScreen />;
    case 'duel': case 'tutorial': return <DuelScreen key={duelNonce} />;
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
