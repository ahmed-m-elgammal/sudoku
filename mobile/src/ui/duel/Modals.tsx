// Modals.tsx — the duel's four blocking surfaces: pause, concede-confirm, the S08
// reconnect countdown, and Orsolo's "He adapts." callout.
//
// PORT of the modal blocks in ../src/app/game/DuelScreen.tsx. The web build hand-rolled
// every one of them: a local `<Modal>` component plus `<div className="modal-backdrop"
// role="dialog" aria-modal="true">`, and `<div role="alertdialog">` for the disconnect.
// RN has no shadcn here (the web build never used it) — `Modal` + the same roles and the
// same dismissal law is the faithful translation.
//
// The swap callout is explicitly NON-blocking: `pointer-events: none` on the web, so play
// never stops. Here it renders under the duel and touches nothing.

import { useEffect, useState } from 'react';
import { Animated, Image, Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import { orderMeta } from '@shared/orders';
import { images, orderPortraits } from '@/theme/assets';
import { i18n, tf } from '@/i18n';
import { layout, type Theme } from '@/theme/tokens';

const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

export interface ModalProps {
  title: string;
  theme: Theme;
  children: React.ReactNode;
  onRequestClose?: () => void;
}

/** The duel's modal shell — the web build's `Modal` + `.modal-backdrop`. */
export function DuelModal({ title, theme, children, onRequestClose }: ModalProps) {
  return (
    <RNModal transparent animationType="fade" visible onRequestClose={onRequestClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.bg }]}>
        <View
          accessibilityRole="alert"
          accessibilityLabel={title}
          style={[styles.sheet, { backgroundColor: theme.bgRaised, borderColor: theme.focus }]}
        >
          <Text style={[styles.title, { color: theme.fg }]}>{title}</Text>
          {children}
        </View>
      </View>
    </RNModal>
  );
}

export interface PauseModalProps {
  theme: Theme;
  foeName: string;
  onResume: () => void;
  onConcede: () => void;
}

export function PauseModal({ theme, foeName, onResume, onConcede }: PauseModalProps) {
  return (
    <DuelModal title={i18n.duel.toolbar.pause} theme={theme} onRequestClose={onResume}>
      <Text style={[styles.body, { color: theme.fgDim }]}>
        {tf('duel.pause.body', { foe: foeName })}
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onResume}
          accessibilityRole="button"
          style={[styles.btn, { backgroundColor: theme.focus }]}
        >
          <Text style={[styles.btnText, { color: theme.bg }]}>{i18n.duel.toolbar.resume}</Text>
        </Pressable>
        <Pressable
          onPress={onConcede}
          accessibilityRole="button"
          style={[styles.btn, { backgroundColor: theme.accent }]}
        >
          <Text style={[styles.btnText, { color: theme.fg }]}>{i18n.duel.toolbar.concede}</Text>
        </Pressable>
      </View>
    </DuelModal>
  );
}

export interface ConcedeModalProps {
  theme: Theme;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConcedeModal({ theme, onConfirm, onCancel }: ConcedeModalProps) {
  return (
    <DuelModal title={i18n.duel.concedeConfirm.title} theme={theme} onRequestClose={onCancel}>
      <Text style={[styles.body, { color: theme.fgDim }]}>{i18n.duel.concedeConfirm.body}</Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          style={[styles.btn, { backgroundColor: theme.accent }]}
        >
          <Text style={[styles.btnText, { color: theme.fg }]}>{i18n.duel.concedeConfirm.confirm}</Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          style={[styles.btn, { borderColor: theme.lineStrong, borderWidth: 1 }]}
        >
          <Text style={[styles.btnText, { color: theme.fg }]}>{i18n.duel.concedeConfirm.cancel}</Text>
        </Pressable>
      </View>
    </DuelModal>
  );
}

export interface DisconnectModalProps {
  state: { secondsLeft: number; graceS: number; who: string };
  theme: Theme;
}

/** S08 — the peer dropped and the server-ticked grace is draining. An `alertdialog`. */
export function DisconnectModal({ state, theme }: DisconnectModalProps) {
  const drain = Math.max(0, Math.min(1, state.secondsLeft / Math.max(1, state.graceS)));
  return (
    <RNModal transparent animationType="fade" visible>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        accessibilityLabel={i18n.duel.disconnect.title}
        style={[styles.backdrop, { backgroundColor: theme.bg }]}
      >
        <View style={[styles.sheet, { backgroundColor: theme.bgRaised, borderColor: theme.accent }]}>
          <Text style={[styles.title, { color: theme.fg }]}>{i18n.duel.disconnect.title}</Text>
          <Text style={[styles.body, { color: theme.fgDim }]}>
            {tf('duel.disconnect.peerBody', { who: state.who, s: state.secondsLeft })}
          </Text>
          <View style={styles.ringWrap}>
            <Svg width={72} height={72} viewBox="0 0 72 72">
              <Circle cx={36} cy={36} r={RING_R} fill="none" stroke={theme.lineStrong} strokeWidth={3} />
              <Circle
                cx={36}
                cy={36}
                r={RING_R}
                fill="none"
                stroke={theme.accent}
                strokeWidth={4}
                strokeDasharray={`${RING_C} ${RING_C}`}
                strokeDashoffset={RING_C * (1 - drain)}
                rotation={-90}
                origin="36, 36"
              />
            </Svg>
            <Text style={[styles.count, { color: theme.fg }]} allowFontScaling={false}>
              {state.secondsLeft}
            </Text>
          </View>
        </View>
      </View>
    </RNModal>
  );
}

export interface SwapBannerProps {
  banner: { from: string; to: string };
  /** the foe's name, for the callout copy */
  foeName: string;
  theme: Theme;
}

/**
 * T4/T20 — "He adapts." A non-blocking callout: it renders above the board and swallows
 * nothing. The old Order's portrait, an arrow, the new one.
 */
export function SwapBanner({ banner, foeName, theme }: SwapBannerProps) {
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    anim.setValue(0);
    const a = Animated.timing(anim, { toValue: 1, duration: 4200, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [anim, banner]);

  const fromKey = orderPortraits[banner.from];
  const toKey = orderPortraits[banner.to];

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLiveRegion="assertive"
      style={[styles.swap, { backgroundColor: theme.bgRaised, borderColor: theme.focus, opacity: anim }]}
    >
      <View style={styles.sigils}>
        <View style={styles.sigil}>
          {fromKey ? <OrderImage orderKey={fromKey} /> : null}
        </View>
        <Text style={[styles.arrow, { color: theme.focus }]}>{i18n.duel.swap.arrow}</Text>
        <View style={[styles.sigil, styles.sigilNew]}>
          {toKey ? <OrderImage orderKey={toKey} /> : null}
        </View>
      </View>
      <Text style={[styles.swapTitle, { color: theme.focus }]}>{i18n.duel.swap.title}</Text>
      <Text style={[styles.swapBody, { color: theme.fg }]}>
        {tf('duel.swap.body', {
          name: foeName,
          from: orderMeta(banner.from as Parameters<typeof orderMeta>[0]).name,
          to: orderMeta(banner.to as Parameters<typeof orderMeta>[0]).name,
        })}
      </Text>
      <Text style={[styles.swapNote, { color: theme.fgDim }]}>{i18n.duel.swap.note}</Text>
    </Animated.View>
  );
}

function OrderImage({ orderKey }: { orderKey: keyof typeof images }) {
  return <Image source={images[orderKey]} style={styles.sigilImg} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.97 },
  sheet: {
    width: '86%',
    maxWidth: 340,
    padding: 20,
    borderWidth: 1,
    borderRadius: layout.radiusLg,
  },
  title: { fontFamily: 'IM Fell English SC', fontSize: 22, marginBottom: 8 },
  body: { fontSize: 15, marginBottom: 14 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: layout.radius, minHeight: layout.touch, justifyContent: 'center' },
  btnText: { fontFamily: 'IM Fell English SC', fontSize: 15 },
  ringWrap: { alignSelf: 'center', width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  count: { position: 'absolute', fontFamily: 'Libre Caslon Text', fontSize: 20 },
  swap: {
    position: 'absolute',
    alignSelf: 'center',
    width: '88%',
    maxWidth: 380,
    borderWidth: 1,
    borderRadius: layout.radiusLg,
    padding: 16,
    alignItems: 'center',
    zIndex: 40,
  },
  sigils: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  sigil: { width: 46, height: 46, opacity: 0.6 },
  sigilNew: { opacity: 1 },
  sigilImg: { width: '100%', height: '100%' },
  arrow: { fontSize: 20 },
  swapTitle: { fontFamily: 'IM Fell English SC', fontSize: 18 },
  swapBody: { fontSize: 14, textAlign: 'center', marginTop: 4 },
  swapNote: { fontSize: 12, textAlign: 'center', marginTop: 6, fontStyle: 'italic' },
});