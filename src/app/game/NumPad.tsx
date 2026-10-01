// NumPad.tsx — 5x2 numerals + Erase, remaining counts, Hush overlay (S05).
'use client';
import type { LocalDuel } from '@/game/localDuel';
import styles from './Duel.module.css';
import type { Digit } from '@shared/config';

export default function NumPad({ duel }: { duel: LocalDuel }) {
  const st = duel.state;
  const me = st.players[0];
  const flags = duel.flags();
  const counts = Array.from({ length: 10 }, () => 0);
  for (let c = 0; c < 81; c++) if (me.board[c] !== 0) counts[me.board[c]]++;
  const pencil = duel.pencil;

  return (
    <div className={`${styles.numPad} ${flags.hushed ? styles.hushedPad : ''}`} role="group" aria-label="Number pad">
      {Array.from({ length: 9 }, (_, i) => {
        const d = (i + 1) as Digit;
        const remaining = 9 - counts[d];
        const complete = remaining <= 0;
        return (
          <button
            key={d}
            className={`${styles.numTile} ${complete ? styles.numComplete : ''} digits`}
            disabled={complete}
            aria-label={`${d}, ${complete ? 'complete' : `${remaining} remaining`}${pencil ? ', pencil mode' : ''}`}
            onClick={() => {
              if (duel.selected === null) return;
              if (pencil && !flags.miasma) duel.toggleNote(duel.selected, d);
              else duel.place(duel.selected, d);
            }}
          >
            <span style={{ backgroundImage: 'url(/assets/ui/num-tile-normal.svg)' }} className={styles.numTileBg} aria-hidden />
            <b>{d}</b>
            {!complete && <small>{remaining}</small>}
            {complete && <small aria-hidden>·</small>}
          </button>
        );
      })}
      <button
        className={styles.numTile}
        aria-label="Erase notes"
        onClick={() => {
          if (duel.selected === null) return;
          duel.setNotes(duel.selected, []);
          duel.select(duel.selected);
        }}
      >
        <span style={{ backgroundImage: 'url(/assets/ui/num-tile-normal.svg)' }} className={styles.numTileBg} aria-hidden />
        <b className={styles.eraseGlyph}>⌫</b>
      </button>
      {flags.hushed && (
        <div className={styles.hushOverlay} style={{ backgroundImage: 'url(/assets/overlays/hush.svg)' }} aria-label="Hushed: the pad is dead">
          <span>Hushed</span>
        </div>
      )}
    </div>
  );
}
