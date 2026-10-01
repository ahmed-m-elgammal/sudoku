// AbilityBar.tsx — three engraved tiles with sigil, cooldown ring, countdown, ready pulse (S05).
'use client';
import { useState } from 'react';
import type { AnyDuel } from './useDuelSession';
import styles from './Duel.module.css';
import { orderMeta } from '@shared/orders';
import { CONFIG, ORDER_ABILITIES, type AbilityId } from '@shared/config';
import i18n from '@/i18n/en.json';

const ABILITY_TARGETS: Partial<Record<AbilityId, string>> = { augur: 'cell', fairCopy: 'cell' };

export default function AbilityBar({ duel }: { duel: AnyDuel }) {
  const [descFor, setDescFor] = useState<AbilityId | null>(null);
  const me = duel.state.players[0];
  const meta = orderMeta(me.order);
  const abilities = ORDER_ABILITIES[me.order];

  return (
    <div className={styles.abilityBar} role="toolbar" aria-label={`${meta.name} abilities`}>
      {abilities.map((id, idx) => {
        const rt = me.abilities[id];
        const full = (CONFIG.abilityCdMs as Record<string, number>)[id] ?? 1;
        const pct = rt.cdLeftMs > 0 ? rt.cdLeftMs / (rt.usedOnce ? full : full * CONFIG.abilities.firstUseCooldownFactor) : 0;
        const ready = rt.cdLeftMs <= 0 && rt.usesLeft !== 0;
        const tinctureNote = id === 'tincture' && rt.usesLeft !== null ? `×${rt.usesLeft}` : '';
        return (
          <button
            key={id}
            className={`${styles.abilityTile} ${ready ? styles.abilityReady : ''}`}
            aria-label={`${i18n.orders[me.order].abilities[id].name}. ${i18n.orders[me.order].abilities[id].desc}`}
            onClick={() => {
              const target = ABILITY_TARGETS[id];
              duel.ability(id, target === 'cell' && duel.selected !== null ? { cell: duel.selected } : {});
            }}
            onContextMenu={(e) => { e.preventDefault(); setDescFor(descFor === id ? null : id); }}
            onPointerDown={(e) => { if (e.pointerType === 'mouse' && e.button === 2) return; }}
          >
            <span className={styles.abilitySigil} style={{ backgroundImage: `url(/assets/sigils/${meta.abilities[idx].icon}.svg)` }} aria-hidden />
            <span className={styles.abilityName}>{i18n.orders[me.order].abilities[id].name}</span>
            {tinctureNote && <span className={styles.abilityUses}>{tinctureNote}</span>}
            {pct > 0 && (
              <>
                <svg className={styles.cdRing} viewBox="0 0 72 72" aria-hidden>
                  <circle className={styles.cdTrack} cx="36" cy="36" r="30" />
                  <circle
                    className={styles.cdFill}
                    cx="36" cy="36" r="30"
                    strokeDasharray={2 * Math.PI * 30}
                    strokeDashoffset={2 * Math.PI * 30 * (1 - pct)}
                  />
                </svg>
                <span className={`${styles.cdText} digits`}>{Math.ceil(rt.cdLeftMs / 1000)}</span>
              </>
            )}
            <span className={styles.abilityKey} aria-hidden>{['Q', 'W', 'E'][idx]}</span>
          </button>
        );
      })}
      {descFor && (
        <div className={styles.abilityDesc} role="note">
          <b>{i18n.orders[me.order].abilities[descFor].name}</b>
          <p>{i18n.orders[me.order].abilities[descFor].desc}</p>
        </div>
      )}
    </div>
  );
}
