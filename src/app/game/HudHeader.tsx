// HudHeader.tsx — portraits, Roman medallion clock, wax seal pips, status chips (S05 header).
'use client';
import type { LocalDuel } from '@/game/localDuel';
import styles from './Duel.module.css';
import { orderMeta } from '@shared/orders';
import i18n from '@/i18n/en.json';

const ROMAN_MIN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export default function HudHeader({ duel }: { duel: LocalDuel }) {
  const st = duel.state;
  const [me, foe] = st.players;
  const mins = Math.floor(st.clockMs / 60000);
  const medallion = mins <= 10 ? ROMAN_MIN[mins] : 'X';

  return (
    <header className={styles.hud}>
      <div className={styles.hudSide}>
        <span className={styles.portrait} style={{ backgroundImage: `url(${orderMeta(me.order).portrait})` }} role="img" aria-label={`Your portrait, ${orderMeta(me.order).name}`} />
        <SealPips n={me.seals} max={7} you />
        <StatusChips duel={duel} seat={0} />
      </div>
      <div className={styles.hudCenter}>
        <span className={`${styles.medallion} roman`} style={{ backgroundImage: 'url(/assets/ui/medallion.svg)' }}>{medallion}</span>
      </div>
      <div className={styles.hudSide}>
        <StatusChips duel={duel} seat={1} />
        <SealPips n={foe.seals} max={foe.seals > 7 ? foe.seals : 7} />
        <span className={styles.portrait} style={{ backgroundImage: `url(${orderMeta(foe.order).portrait})` }} role="img" aria-label={`Foe portrait, ${orderMeta(foe.order).name}`} />
      </div>
    </header>
  );
}

function SealPips({ n, max, you }: { n: number; max: number; you?: boolean }) {
  return (
    <div className={styles.pips} role="status" aria-label={`${you ? 'Your' : "Foe's"} Seals: ${n} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={`${styles.pip} ${i < n ? styles.pipFilled : ''} ${you ? styles.pipYou : ''}`} aria-hidden />
      ))}
    </div>
  );
}

function StatusChips({ duel, seat }: { duel: LocalDuel; seat: 0 | 1 }) {
  const p = duel.state.players[seat];
  if (!p.statuses.length) return null;
  return (
    <div className={styles.chips}>
      {p.statuses.map((s) => {
        const left = Math.max(0, (s.endsAtMs - duel.state.clockMs) / 1000);
        return (
          <span key={s.uid} className={styles.chip} title={i18n.duel.status[s.type]}>
            <i className={styles.chipIcon} style={{ backgroundImage: `url(/assets/statuses/status-${s.type}.svg)` }} aria-hidden />
            <small>{i18n.duel.status[s.type]}</small>
            <b className="digits">{left.toFixed(0)}</b>
            <svg className={styles.chipRing} viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="10" strokeDasharray={2 * Math.PI * 10}
                strokeDashoffset={2 * Math.PI * 10 * (1 - left / 10)} />
            </svg>
          </span>
        );
      })}
    </div>
  );
}
