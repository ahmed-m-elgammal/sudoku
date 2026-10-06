// ASSIZE mobile — display settings.
//
// The web build wrote the player's accessibility choices onto the document element as
// data-attributes and let CSS react to them (GameShell.tsx:49-52):
//
//   root.dataset.text      = 's' | 'm' | 'l'
//   root.dataset.contrast  = 'normal' | 'high'
//   root.dataset.motion    = 'full' | 'reduced'
//
// CSS Modules and a `data-motion` animation kill-list are not available in RN, so the
// same three switches are exposed as a hook. The RULE is preserved exactly: the
// reduced-motion kill-list still lands every animation on its settled state — no
// cascade, no splash, no push, instant tint, no transition.
//
// The OS Reduce Motion switch is an ADDITIONAL source: specs/13 requires honouring it,
// and the web build could not (no API) — so this is a genuine improvement, not a port.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSave } from '@/state/save';
import type { DisplaySettings } from './types';

const DisplayContext = createContext<DisplaySettings>({
  text: 'm',
  contrast: false,
  reducedMotion: false,
  leftHand: false,
  systemReducedMotion: false,
  motionReduced: () => false,
});

export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
  const settings = useSave((s) => s.save?.settings);
  const [systemReducedMotion, setSystemReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setSystemReduced(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
      setSystemReduced(on);
    });
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  const value = useMemo<DisplaySettings>(() => {
    const reducedMotion = settings?.reducedMotion ?? false;
    return {
      text: settings?.text ?? 'm',
      contrast: settings?.contrast ?? false,
      reducedMotion,
      leftHand: settings?.leftHand ?? false,
      systemReducedMotion,
      motionReduced: () => reducedMotion || systemReducedMotion,
    };
  }, [settings?.text, settings?.contrast, settings?.reducedMotion, settings?.leftHand, systemReducedMotion]);

  return <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>;
}

export function useDisplaySettings(): DisplaySettings {
  return useContext(DisplayContext);
}

/** Convenience predicate for animation call sites. */
export function useMotionReduced(): boolean {
  const d = useDisplaySettings();
  return d.reducedMotion || d.systemReducedMotion;
}

/** Text scale for the 's' | 'm' | 'l' setting. */
export const TEXT_SCALE = { s: 0.9, m: 1, l: 1.18 } as const;
export const textScale = (text: 's' | 'm' | 'l'): number => TEXT_SCALE[text] ?? 1;
