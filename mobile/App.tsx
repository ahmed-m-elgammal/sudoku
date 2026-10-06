// ASSIZE mobile — app entry.
//
// The web build's GameShell booted the save, flushed the Ink ledger, registered the
// service worker, unlocked audio on first pointerdown, and applied the player's
// accessibility settings to the document root. The mobile entry does the same four
// things in the same order, with the platform equivalents:
//
//   service worker (PWA)      -> nothing: RN has no SW; offline play is inherent
//                                because the engine runs locally (spec §6)
//   document.dataset.*        -> DisplaySettingsProvider (src/platform/display.tsx)
//   pointerdown -> synth.unlock -> first touch (root onTouchStart)
//   keyboard listeners        -> none on a phone; an iPad key handler is a Phase B nicety
//
// Spec R1: boot lands straight into the live tutorial duel. No login, no menu.
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSave } from '@/state/save';
import { flushInkLedger } from '@/state/inkLedger';
import { loadIdentity } from '@/state/identity';
import { DisplaySettingsProvider } from '@/platform/display';
import { audio } from '@/platform/audio';
import { setHapticsEnabled } from '@/platform/haptics';
import { palette } from '@/theme/tokens';
import GameShell from '@/ui/GameShell';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <DisplaySettingsProvider>
          <Boot />
        </DisplaySettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Boot() {
  const loaded = useSave((s) => s.loaded);
  const settings = useSave((s) => s.save?.settings);

  useEffect(() => {
    void useSave.getState().load().then(() => flushInkLedger());
    void loadIdentity();
  }, []);

  // the player's haptics + volume choices drive the platform seams, not the screens
  useEffect(() => {
    if (!settings) return;
    setHapticsEnabled(settings.haptics);
    audio.setVolumes(settings.music, settings.fx);
  }, [settings]);

  // iOS/Android require a user gesture before audio may start
  const unlock = () => audio.unlock();

  if (!loaded) {
    return <View style={styles.boot} onTouchStart={unlock} />;
  }

  return (
    <View style={styles.root} onTouchStart={unlock}>
      <StatusBar style="light" />
      <GameShell />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.inkBlack },
  boot: { flex: 1, backgroundColor: palette.inkBlack },
});
