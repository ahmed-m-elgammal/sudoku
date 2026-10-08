// AbilityBar.tsx — the three engraved rite tiles: sigil, name, cooldown ring, countdown.
//
// PORT of ../src/app/game/AbilityBar.tsx. The cooldown maths is byte-for-byte the web
// build's, including the first-use factor (a rite's FIRST cast starts at 50 % cooldown,
// so its ring reads against a half-length bar).
//
// Two behavioural changes, both port-mandated:
//  · the long-press description panel was a right-click on the web (`onContextMenu`);
//    a phone has no right-click, so it is a long press — the same gesture, on the only
//    input device the player has. The copy is unchanged.
//  · M1 (docs/TUTORIAL_OPTIMIZATION_PLAN.md G6): the web tile's Q/W/E keyboard hint is
//    NOT ported — this build is tap-only (AGENTS.md: phone play is touch-first), and a
//    desktop keyboard hint on a phone tile is exactly the kind of broken window that
//    reads as a glitch to a new player.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { CONFIG, ORDER_ABILITIES, type AbilityId } from '@shared/config';
import { orderMeta } from '@shared/orders';
import type { DuelRuntime } from '@/game/duelRuntime';
import { duelSvgs, sigilSvg } from './duelAssets';
import { i18n } from '@/i18n';
import { audio } from '@/platform/audio';
import { fonts, layout, type Theme } from '@/theme/tokens';

export interface AbilityBarProps {
  duel: DuelRuntime;
  theme: Theme;
}

const ABILITY_TARGETS: Partial<Record<AbilityId, string>> = { augur: 'cell', fairCopy: 'cell' };
const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

export default function AbilityBar({ duel, theme }: AbilityBarProps) {
  const [descFor, setDescFor] = useState<AbilityId | null>(null);
  const me = duel.state.players[0];
  const meta = orderMeta(me.order);
  const abilities = ORDER_ABILITIES[me.order];
  const copy = i18n.orders[me.order].abilities;

  return (
    <View style={styles.bar}>
      {abilities.map((id, idx) => {
        const rt = me.abilities[id];
        const full = (CONFIG.abilityCdMs as Record<string, number>)[id] ?? 1;
        const span = rt.usedOnce ? full : full * CONFIG.abilities.firstUseCooldownFactor;
        const pct = rt.cdLeftMs > 0 ? rt.cdLeftMs / span : 0;
        const ready = rt.cdLeftMs <= 0 && rt.usesLeft !== 0;
        const usesNote = id === 'tincture' && rt.usesLeft !== null ? `×${rt.usesLeft}` : '';
        const sigil = sigilSvg(meta.abilities[idx].icon);

        return (
          <Pressable
            key={id}
            onPress={() => {
              audio.cast(idx);
              const target = ABILITY_TARGETS[id];
              duel.ability(id, target === 'cell' && duel.selected !== null ? { cell: duel.selected } : {});
            }}
            onLongPress={() => setDescFor(descFor === id ? null : id)}
            accessibilityRole="button"
            accessibilityLabel={`${copy[id].name}. ${copy[id].desc}`}
            accessibilityState={{ disabled: !ready }}
            style={[styles.tile, { borderColor: ready ? theme.focus : theme.lineStrong, backgroundColor: theme.bgRaised }]}
          >
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <SvgUri width="100%" height="100%" uri={duelSvgs.abilityTile} opacity={theme.tileArtAlpha} />
            </View>

            {sigil ? <SvgUri width={26} height={26} uri={sigil} /> : null}
            <Text style={[styles.name, { color: theme.fg }]} numberOfLines={1} allowFontScaling={false}>
              {copy[id].name}
            </Text>

            {usesNote ? (
              <Text style={[styles.uses, { color: theme.focus }]} allowFontScaling={false}>
                {usesNote}
              </Text>
            ) : null}

            {pct > 0 ? (
              <>
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <SvgUri width="100%" height="100%" uri={cooldownRing(pct, theme)} />
                </View>
                <Text style={[styles.cdText, { color: theme.fgDim }]} allowFontScaling={false}>
                  {Math.ceil(rt.cdLeftMs / 1000)}
                </Text>
              </>
            ) : null}
          </Pressable>
        );
      })}

      {descFor ? (
        <View
          accessibilityRole="summary"
          style={[styles.desc, { backgroundColor: theme.bgRaised, borderColor: theme.focus }]}
        >
          <Text style={[styles.descName, { color: theme.fg }]}>{copy[descFor].name}</Text>
          <Text style={[styles.descBody, { color: theme.fgDim }]}>{copy[descFor].desc}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The cooldown ring as a data URI SVG — a stroked circle with a dash offset. Built as a
 * string rather than a `<Circle>` because the ring must sit UNDER the tile's text with a
 * single absolutely-positioned layer, which is what the web CSS did.
 *
 * Colours come from the theme, never from a literal.
 */
function cooldownRing(pct: number, theme: Theme) {
  const offset = RING_C * (1 - Math.max(0, Math.min(1, pct)));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">` +
    `<circle cx="36" cy="36" r="${RING_R}" fill="none" stroke="${theme.cdTrack}" stroke-width="2"/>` +
    `<circle cx="36" cy="36" r="${RING_R}" fill="none" stroke="${theme.focus}" stroke-width="3"` +
    ` stroke-dasharray="${RING_C}" stroke-dashoffset="${offset}"` +
    ` transform="rotate(-90 36 36)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 6 },
  tile: {
    flex: 1,
    height: 60,
    borderWidth: 1.5,
    borderRadius: layout.radius + 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    overflow: 'hidden',
  },
  name: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 0.5 },
  uses: { position: 'absolute', top: 2, right: 5, fontSize: 10 },
  cdText: { position: 'absolute', top: 3, left: 5, fontSize: 11 },
  desc: {
    position: 'absolute',
    bottom: '100%',
    left: 10,
    right: 10,
    borderWidth: 1,
    borderRadius: layout.radius,
    paddingHorizontal: 10,
    paddingVertical: 8,
    zIndex: 20,
  },
  descName: { fontFamily: fonts.display },
  descBody: { fontSize: 13 },
});