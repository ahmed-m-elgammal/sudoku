// Ticker.tsx — the one-line diegetic event log above the board.
//
// PORT of the Ticker half of ../src/app/game/HudBits.tsx. Every template comes from
// `i18n/en.json` (`duel.log.*`) and every `{placeholder}` is filled through `tf()`, so the
// copy stays in the dictionary and a missing key shows its own path instead of a blank.
//
// The web build hardcoded three strings here — the foe's "sets a digit", "The foe", and
// "a different Order". Those are presentation-only and have no dictionary entry, so they
// are resolved through the dictionary where one exists (`common.theShade`) and otherwise
// degrade to the same words the web build showed.

import { StyleSheet, Text, View } from 'react-native';
import type { DuelRuntime } from '@/game/duelRuntime';
import { i18n, tf } from '@/i18n';
import { type Theme, fonts } from '@/theme/tokens';

export interface TickerProps {
  duel: DuelRuntime;
  theme: Theme;
}

export default function Ticker({ duel, theme }: TickerProps) {
  const events = duel.state.events;
  const last = events[events.length - 1];
  // `mode` lives on the concrete options bag (LocalDuelOpts), not on the shared
  // `DuelRuntimeOpts` the interface exposes — so it is read the same narrow way the web
  // build read it. A runtime without `mode` simply is not the tutorial.
  const mode = (duel.opts as { mode?: string }).mode;
  const quiet = mode === 'tutorial'
      ? tf('tutorial.waits', { name: i18n.tutorial.shadeName })
      : i18n.duel.log.waiting;

  return (
    <View style={styles.wrap}>
      <Text
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        numberOfLines={1}
        style={[styles.text, { color: theme.fgDim }]}
        allowFontScaling={false}
      >
        {last ? formatEvent(last as unknown as Record<string, unknown>) : quiet}
      </Text>
    </View>
  );
}

function formatEvent(e: Record<string, unknown>): string {
  const you = i18n.common.you;
  const foeName = i18n.common.theShade;
  const who = (p: unknown) => (p === 0 ? you : foeName);
  const status = (s: unknown) => i18n.duel.status[String(s) as keyof typeof i18n.duel.status] ?? i18n.duel.status.chain;

  switch (e.kind) {
    case 'placed':
      return e.player === 0
        ? tf('duel.log.placed', { player: you })
        : `${foeName} ${i18n.duel.log.setsDigit}`;

    case 'mistake':
      return tf(e.forgiven ? 'duel.log.mistakeForgiven' : 'duel.log.mistake', { player: who(e.player) });

    case 'claim': {
      const by = who(e.player);
      const target = e.player === 0 ? foeName : you;
      if (e.deferred) return tf('duel.log.claimDeferred', { unit: unitName(String(e.unit ?? '')) });
      return tf(e.clean ? 'duel.log.claimClean' : 'duel.log.claim', {
        unit: unitName(String(e.unit ?? '')),
        player: by,
        target,
        n: String(e.damage ?? 1),
      });
    }

    case 'ability':
      return tf('duel.log.ability', { player: who(e.player), ability: String(e.ability ?? '') });

    case 'status':
      return tf('duel.log.statusApplied', { status: status(e.status), player: who(e.player) });

    case 'statusEnded':
      return tf('duel.log.statusEnded', { status: status(e.status), player: who(e.player) });

    case 'negated':
      return tf('duel.log.negated', { player: who(e.player) });

    case 'mirrored':
      return tf('duel.log.mirrored', { player: who(e.player) });

    case 'orderSwap':
      return tf('duel.log.orderSwap', {
        player: who(e.player),
        from: orderName(String(e.from)),
        to: orderName(String(e.to)),
      });

    case 'forfeit':
      return tf('duel.log.forfeit', { player: who(e.player) });

    case 'end':
      return e.winner === 'draw'
        ? i18n.duel.log.draw
        : tf('duel.log.win', { player: who(e.winner) });

    default:
      return i18n.duel.log.ellipsis;
  }
}

/** "Row IV" / "Column II" / "Box VII" — the dictionary's unit word plus a Roman numeral. */
function unitName(u: string): string {
  const kind = u[0] as 'r' | 'c' | 'b';
  const n = parseInt(u.slice(1), 10) + 1;
  const roman = i18n.common.roman[n] ?? String(n);
  const label = kind === 'r' ? i18n.duel.units.r : kind === 'c' ? i18n.duel.units.c : i18n.duel.units.b;
  return `${label} ${roman}`;
}

function orderName(id: string): string {
  const o = (i18n.orders as unknown as Record<string, { name: string }>)[id];
  return o?.name ?? id;
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingVertical: 2, minHeight: 22 },
  // tokens.ts law: italics come from the registered italic FAMILY, not fontStyle —
  // RN cannot synthesize italics for custom-loaded faces (web: IM Fell DW Pica Italic).
  text: { fontFamily: fonts.bodyItalic, fontSize: 13, textAlign: 'center' },
});