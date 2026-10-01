// MirrorStrip.tsx — the opponent's 9x9 dot matrix (S05 mirror strip, ~54px, tap expands).
// Ticker.tsx — the one-line diegetic event log above the board.
'use client';
import { useState } from 'react';
import type { LocalDuel } from '@/game/localDuel';
import styles from './Duel.module.css';
import i18n from '@/i18n/en.json';

export function MirrorStrip({ duel }: { duel: LocalDuel }) {
  const [big, setBig] = useState(false);
  const foe = duel.state.players[1];
  const claimed = duel.state.unitOwner;
  return (
    <div
      className={`${styles.mirror} ${big ? styles.mirrorBig : ''}`}
      role="img"
      aria-label={i18n.duel.mirror.label}
      onClick={() => setBig(!big)}
    >
      {Array.from({ length: 81 }, (_, c) => (
        <i key={c} className={`${styles.mirrorDot} ${foe.board[c] ? styles.mirrorInk : ''}`} aria-hidden />
      ))}
      {Object.entries(claimed).map(([unit, owner]) => (
        <i key={unit} className={`${styles.mirrorStamp} ${owner === 1 ? styles.mirrorFoe : ''}`} data-unit={unit} aria-hidden />
      ))}
    </div>
  );
}

export function Ticker({ duel }: { duel: LocalDuel }) {
  const events = duel.state.events;
  const last = events[events.length - 1];
  const text = last ? formatEvent(last) : i18n.tutorial.shadeName + ' waits.';
  return (
    <p className={styles.ticker} role="log" aria-live="polite">{text}</p>
  );
}

function formatEvent(e: Record<string, unknown>): string {
  const you = i18n.common.you;
  const foeName = 'The foe';
  switch (e.kind) {
    case 'placed': return e.player === 0 ? i18n.duel.log.placed.replace('{player}', you) : `${foeName} sets a digit.`;
    case 'mistake': return (e.forgiven ? i18n.duel.log.mistakeForgiven : i18n.duel.log.mistake).replace('{player}', e.player === 0 ? you : foeName);
    case 'claim': {
      const unit = String(e.unit ?? '');
      const by = e.player === 0 ? you : foeName;
      const target = e.player === 0 ? foeName : you;
      if (e.deferred) return i18n.duel.log.claimDeferred.replace('{unit}', unitName(unit));
      const tpl = e.clean ? i18n.duel.log.claimClean : i18n.duel.log.claim;
      return tpl.replace('{unit}', unitName(unit)).replace('{player}', by).replace('{target}', target).replace('{n}', String(e.damage ?? 1));
    }
    case 'ability': return i18n.duel.log.ability.replace('{player}', e.player === 0 ? you : foeName).replace('{ability}', String(e.ability ?? 'a rite'));
    case 'status': return i18n.duel.log.statusApplied.replace('{status}', i18n.duel.status[String(e.status) as keyof typeof i18n.duel.status] ?? 'A rite').replace('{player}', e.player === 0 ? you : foeName);
    case 'statusEnded': return i18n.duel.log.statusEnded.replace('{status}', i18n.duel.status[String(e.status) as keyof typeof i18n.duel.status] ?? 'A rite').replace('{player}', e.player === 0 ? you : foeName);
    case 'negated': return i18n.duel.log.negated.replace('{player}', e.player === 0 ? you : foeName);
    case 'mirrored': return i18n.duel.log.mirrored.replace('{player}', e.player === 0 ? you : foeName);
    case 'forfeit': return i18n.duel.log.forfeit.replace('{player}', e.player === 0 ? you : foeName);
    case 'end': return e.winner === 'draw' ? i18n.duel.log.draw : i18n.duel.log.win.replace('{player}', e.winner === 0 ? you : foeName);
    default: return '…';
  }
}

function unitName(u: string): string {
  const kind = u[0] as 'r' | 'c' | 'b';
  const n = parseInt(u.slice(1), 10) + 1;
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n] ?? String(n);
  const label = kind === 'r' ? i18n.duel.units.r : kind === 'c' ? i18n.duel.units.c : i18n.duel.units.b;
  return `${label} ${roman}`;
}
