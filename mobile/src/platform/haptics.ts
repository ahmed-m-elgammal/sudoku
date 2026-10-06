// ASSIZE mobile — haptics.
//
// Replaces `navigator.vibrate(...)` at the six web call sites. The mapping is exact:
//
//   localDuel.ts:171,347  navigator.vibrate?.([40, 70, 110])  -> orderSwap()
//   localDuel.ts:235      navigator.vibrate?.(60)             -> mistake()
//   useDuelSession:133    navigator.vibrate?.(40)  on clean    -> claim(true)
//   useDuelSession:136    navigator.vibrate?.(30)  on status   -> status()
//   useDuelSession:139    navigator.vibrate?.([30, 50, 90])    -> orderSwap()
//
// Semantics, not patterns: a call site says WHAT happened, this file decides how that
// feels on each platform. Every method is a no-op when haptics are off or unsupported
// — a phone without a taptic engine must not throw.

import * as Haptics from 'expo-haptics';
import type { Haptics as HapticsPort } from './types';

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

const fire = (fn: () => Promise<unknown>): void => {
  if (!enabled) return;
  // fire-and-forget: haptics are decoration, never awaited by the duel
  void fn().catch(() => {});
};

export const haptics: HapticsPort = {
  /** a digit landed — the highest-frequency action in the game, so it stays light */
  tick() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  /** a claim broke a Seal; a Clean claim gets a second, harder pulse */
  claim(clean: boolean) {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    if (clean) {
      setTimeout(() => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)), 90);
    }
  },

  /** a wrong digit burned ink — the one the player must feel in their hand */
  mistake() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },

  /** one of your rites landed on the foe */
  status() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
  },

  /** "He adapts." — an Order set aside mid-duel */
  orderSwap() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    setTimeout(() => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 70);
    setTimeout(() => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 180);
  },

  /** boss phase entry, and the duel-ending verdict */
  impact() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
};
