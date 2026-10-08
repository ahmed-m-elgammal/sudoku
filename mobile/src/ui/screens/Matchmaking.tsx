// Matchmaking — S06 "Summoning": engraved hourglass, rotating flavour lines, Cancel.
//
// PORT of ../src/app/game/Matchmaking.tsx (specs/17 phase 4.4). Socket join_queue with
// the guest identity; the server pairs by Standing with widening windows and runs its
// own Shade fallback at 4 s — the client waits JUST PAST it (+500 ms) so the
// authoritative 'matched' (human or Shade) wins the race, and the local fallback is
// the honest offline path (R7: a Shade is always labelled a Shade). Copy is
// i18n.matchmaking.*; the hourglass is the duel registry's sigil-hourglass with the
// web's 180 ms ink-settle (reduced motion renders it settled).
//
// Queue laws this port keeps honest (the web's effect deps re-ran the join on every
// save write — a second join_queue could match the player against their own entry):
//   · the join lifecycle runs EXACTLY ONCE per mount (the effect deps are the stable
//     `go` alone), reading the save through useSave.getState() at each await so no
//     stale snapshot is ever sent;
//   · the secret is never duplicated into plain storage — it lives in the Keychain
//     identity (loadIdentity), which ServerDuel reads when the duel screen mounts;
//   · every await is followed by the cancelled/settled guard, so a late auth can
//     never join_queue after the player left (a ghost the server would pair at 4 s).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Art from '@/ui/Art';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { loadIdentity } from '@/state/identity';
import { net } from '@/game/net/client';
import { audio } from '@/platform/audio';
import { useDisplaySettings, useMotionReduced } from '@/platform/display';
import { fonts, layout, palette, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import { sigilArt } from '@/ui/duel/duelAssets';
import {
  SHADE_FALLBACK_WAIT_MS, matchedToNav, shadeFallbackNav, type MatchedPayload,
} from './matchmakingLaw';

export default function Matchmaking() {
  const go = useUi((s) => s.go);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);
  const [line, setLine] = useState(0);
  const joinedRef = useRef(false); // settled: matched, or the Shade fallback fired

  // the rotating flavour lines — 1400 ms, the web's cadence
  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % i18n.matchmaking.lines.length), 1400);
    return () => clearInterval(t);
  }, []);

  // THE QUEUE JOIN. Deps are [go] (stable) — the join lifecycle runs exactly once per
  // mount, so an unrelated save write mid-queue (the standing sync below, an Ink
  // flush) can never tear the listener down and re-join behind it: on the web that
  // re-run sent a SECOND join_queue for the same socket, and the authoritative queue
  // could then match the player against their own stale entry. The save is read
  // through useSave.getState() at each await, so nothing stale is sent and no save
  // subscription re-renders the room while it waits.
  useEffect(() => {
    const save0 = useSave.getState().save;
    if (!save0) return; // unreachable in practice: App gates the shell on the loaded save
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let off: (() => void) | null = null;

    (async () => {
      const id = await loadIdentity();
      if (cancelled) return;
      const ok = await net.connect();
      if (cancelled) return;
      if (ok && !joinedRef.current) {
        // listen for a server match (human or Shade from the authoritative queue)
        off = net.on('matched', (p) => {
          if (joinedRef.current || cancelled) return;
          joinedRef.current = true;
          const fresh = useSave.getState().save;
          if (!fresh) return;
          go('versus', matchedToNav(p as MatchedPayload, { name: fresh.name, order: fresh.order }));
        });
        // register/sync the guest identity with the court first — join_queue
        // authenticates against the server account, so an unregistered guest
        // would be silently dropped from the queue (found via T2 e2e testing).
        try {
          const res = await net.auth({ id: id.id, secret: id.secret, name: save0.name, recoveryHash: id.recoveryHash });
          const s = useSave.getState();
          if (res?.ok && typeof res.standing === 'number' && s.save && s.save.stats.duels === 0 && s.save.standing !== res.standing) {
            s.update((cur) => ({ ...cur, standing: res.standing }));
          }
        } catch { /* offline: the Shade fallback still fires */ }
        if (cancelled || joinedRef.current) return;
        net.send('join_queue', { accountId: id.id, secret: id.secret, name: save0.name, order: save0.order });
      }
    })();

    const tickWait = (elapsed: number) => {
      if (cancelled || joinedRef.current) return;
      if (elapsed >= SHADE_FALLBACK_WAIT_MS) {
        joinedRef.current = true;
        // no human answered: local Shade duel, honestly labelled (R7)
        const fresh = useSave.getState().save;
        if (fresh) go('versus', shadeFallbackNav(fresh));
        return;
      }
      timer = setTimeout(() => tickWait(elapsed + 250), 250);
    };
    timer = setTimeout(() => tickWait(250), 250);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      off?.();
      // never leave a ghost behind in the authoritative queue
      net.send('leave_queue', {});
    };
  }, [go]);

  const hourglass = sigilArt('sigil-hourglass');

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <View style={styles.center}>
        {hourglass ? <InkSettleSigil uri={hourglass} size={72} /> : null}
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.fg, fontSize: 2 * fs.md, letterSpacing: 0.02 * 2 * fs.md, marginTop: 14, marginBottom: 6 }]}
        >
          {i18n.matchmaking.title}
        </Text>
        <Text style={[styles.line, { color: theme.fgDim, fontSize: fs.sm, minHeight: 24 }]}>
          {i18n.matchmaking.lines[line]}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.matchmaking.cancel}
          onPress={() => { audio.uiTap(); go('antechamber'); }}
          style={({ pressed }) => [
            styles.cancel,
            { backgroundColor: theme.bgRaised, borderColor: palette.brassDim, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[styles.cancelText, { color: theme.fg, fontSize: fs.md, letterSpacing: 0.06 * fs.md }]}>{i18n.matchmaking.cancel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The web's `.ink-settle`: scale 1.14 -> 1, opacity 0.65 -> 1, 180 ms ease-out. */
function InkSettleSigil({ uri, size }: { uri: string; size: number }) {
  const motionReduced = useMotionReduced();
  // useState lazy init (the FxLayers convention) — the animated value is stable
  // state, not a ref read during render.
  const [anim] = useState(() => new Animated.Value(motionReduced ? 1 : 0));

  useEffect(() => {
    if (motionReduced) return; // the kill-list law: render settled, animate nothing
    const a = Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [anim, motionReduced]);

  const scale = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1.14, 0.97, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.65, 1, 1] });
  return (
    <Animated.View style={{ transform: [{ scale }], opacity }} accessibilityLabel="">
      <Art uri={uri} width={size} height={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // web main: display grid, placeItems center — the column is the whole screen
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontFamily: fonts.display }, // size/tracking ride inline from the text scale
  line: { fontFamily: fonts.bodyItalic, textAlign: 'center' },
  // web button.btn: marginTop 22
  cancel: {
    marginTop: 22,
    minHeight: layout.touch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontFamily: fonts.display },
});
