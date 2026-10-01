// Board.tsx — the sealed Tablet (S05 board). DOM/SVG, accessibility-first (spec §6).
// Every grid item gets an explicit position: 9x9 cells + right row gutter + bottom column gutter.
// J1 — owned units tint as territory, a resolved claim floods its 9 cells in a
// 30 ms-per-cell cascade and bursts a matte ink splash at the unit's centroid.
// J2 — the whole Tablet shakes in tiers (claim = T2, phase/swap/verdict = T3).
// All presentation law lives in src/game/fx.ts; this file only applies it.
'use client';
import { useMemo, type CSSProperties } from 'react';
import type { LocalDuel } from '@/game/localDuel';
import styles from './Duel.module.css';
import { UNIT_CELLS, ROW_OF, COL_OF, BOX_OF } from '@shared/config';
import { cellsOfFlood, centroidOfUnit, ownerOfCell, type Flood, type Shake } from '@/game/fx';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

// J1 — matte ink droplets (style bible: no gradients, no glow — ever)
function InkSplash() {
  return (
    <svg viewBox="0 0 68 68" aria-hidden>
      <ellipse cx="34" cy="34" rx="13" ry="11" />
      <ellipse cx="12" cy="26" rx="4.5" ry="3.6" transform="rotate(-24 12 26)" />
      <ellipse cx="56" cy="20" rx="3.8" ry="3.1" transform="rotate(18 56 20)" />
      <ellipse cx="55" cy="50" rx="4.6" ry="3.7" transform="rotate(-40 55 50)" />
      <ellipse cx="20" cy="54" rx="3.4" ry="2.8" transform="rotate(30 20 54)" />
      <ellipse cx="34" cy="8" rx="3" ry="2.5" />
      <circle cx="63" cy="35" r="2.2" />
      <circle cx="6" cy="42" r="2" />
    </svg>
  );
}

// J2 — nonce-parity classes retrigger consecutive shakes without remounts
function shakeClass(shake: Shake | null): string {
  if (!shake) return '';
  const alt = shake.nonce % 2 === 0 ? 'B' : 'A';
  return shake.tier === 3 ? styles[`shakeT3${alt}`] : styles[`shakeT2${alt}`];
}

export default function Board({ duel, flood, shake }: { duel: LocalDuel | import('@/game/serverDuel').ServerDuel; flood: Flood | null; shake: Shake | null }) {
  const st = duel.state;
  const me = st.players[0];
  const flags = duel.flags();
  const sel = duel.selected;

  const sameDigitCells = useMemo(() => {
    const same = new Set<number>();
    if (sel !== null) {
      const v = me.board[sel];
      if (v) for (let c = 0; c < 81; c++) if (me.board[c] === v) same.add(c);
    }
    return same;
  }, [sel, me.board, duel.version]);

  // J1 — the current flood's cells and splash anchor (fail-closed helpers; null floods nothing)
  const floodCells = useMemo(() => (flood ? cellsOfFlood(flood.unit) : null), [flood]);
  const splash = useMemo(() => (flood ? centroidOfUnit(flood.unit) : null), [flood]);

  const stampFor = (unit: string) => {
    const owner = st.unitOwner[unit];
    if (owner === undefined) return null;
    return owner === 0 ? 'fleur' : 'tau';
  };
  const quarantinedByFoe = flags.quarantinedUnits;

  return (
    <div className={`${styles.boardWrap} ${shakeClass(shake)}`} role="grid" aria-label="The sealed Tablet, nine by nine">
      {/* J1 — one matte ink splash per resolved claim, anchored at the unit's centroid */}
      {flood && splash && (
        <span
          key={flood.seq}
          className={styles.inkSplash}
          aria-hidden
          style={{
            left: `calc((100% - 20px) * ${splash.cx})`,
            top: `calc((100% - 20px) * ${splash.cy})`,
            color: flood.player === 0 ? 'var(--oxblood)' : 'var(--ash)',
            transform: `rotate(${(flood.seq * 37) % 360}deg)`,
          }}
        >
          <InkSplash />
        </span>
      )}
      {/* corner box stamps — absolutely positioned at box corners */}
      {Array.from({ length: 9 }, (_, b) => {
        const s = stampFor(`b${b}`);
        const q = quarantinedByFoe.has(`b${b}`);
        const br = Math.floor(b / 3), bc = b % 3;
        return (
          <div
            key={`bc${b}`}
            className={`${styles.boxStamp} ${q ? styles.quarantined : ''}`}
            style={{ left: `${bc * 33.333}%`, top: `${br * 33.333}%` }}
            aria-hidden={!s}
          >
            {s && <span className={`${styles.stampGlyph} ${s === 'fleur' ? styles.stampYou : styles.stampFoe}`} aria-label={`Box ${ROMAN[b]} claimed`} />}
          </div>
        );
      })}
      {Array.from({ length: 81 }, (_, c) => {
        const v = me.board[c];
        const isGiven = st.givens[c] !== 0;
        const isSel = sel === c;
        const chained = flags.chained.has(c);
        const smudged = flags.smudged.has(c);
        const wrongNow = duel.lastWrong === c && duel.lastWrongClearAt > st.clockMs;
        const wrongVariant = (duel.wrongVariant % 3) + 1;
        const notes = duel.notes.get(c);
        const canSelect = !isGiven && !chained;
        const r = ROW_OF(c), col = COL_OF(c);
        // J1 — territory tint (box > row > col precedence lives in fx.ts) + cascade membership
        const owned = ownerOfCell(c, st.unitOwner);
        const fi = flood ? (floodCells ? floodCells.indexOf(c) : -1) : -1;
        const floodCls = fi >= 0 && flood ? (flood.seq % 2 === 0 ? styles.floodCellB : styles.floodCellA) : '';
        const floodStyle: CSSProperties | undefined = fi >= 0 && flood
          ? ({
              '--flood-i': fi,
              '--flood-strong': flood.player === 0 ? 'rgba(123, 26, 31, 0.34)' : 'rgba(141, 138, 130, 0.40)',
              '--flood-settle': flood.player === 0 ? 'rgba(123, 26, 31, 0.09)' : 'rgba(141, 138, 130, 0.15)',
            } as CSSProperties)
          : undefined;
        return (
          <button
            key={c}
            role="gridcell"
            tabIndex={canSelect ? 0 : -1}
            aria-disabled={!canSelect}
            aria-label={cellAria(c, v, isGiven, chained, smudged)}
            className={[
              styles.cell,
              isGiven ? styles.given : '',
              isSel ? styles.selected : '',
              !isSel && sameDigitCells.has(c) ? styles.sameDigit : '',
              chained ? styles.chained : '',
              wrongNow ? styles.wrong : '',
              owned === 0 ? styles.ownedYou : owned === 1 ? styles.ownedFoe : '',
              floodCls,
              (r % 3 === 2 && r < 8) ? styles.thickBottom : '',
              (col % 3 === 2 && col < 8) ? styles.thickRight : '',
              BOX_OF(c) % 2 === 0 ? styles.boxEven : '',
            ].join(' ')}
            style={{
              gridRow: r + 1,
              gridColumn: col + 1,
              ...(wrongNow ? { backgroundImage: `url(/assets/overlays/strike-${wrongVariant}.svg)` } : {}),
              ...floodStyle,
            }}
            onClick={() => { duel.select(c); }}
            data-cell={c}
          >
            {v !== 0 && !smudged && <span className={`digits ${styles.digit} ${isGiven ? styles.givenDigit : ''}`}>{v}</span>}
            {v !== 0 && smudged && <span className={styles.smudgeBlot} style={{ backgroundImage: 'url(/assets/overlays/smudge.svg)' }} aria-label="smudged digit" />}
            {chained && <span className={styles.chainMark} style={{ backgroundImage: 'url(/assets/overlays/chain.svg)' }} />}
            {v === 0 && notes && notes.size > 0 && (
              <span className={styles.notes}>
                {Array.from({ length: 9 }, (_, i) => (
                  <i key={i} className={notes.has(i + 1) ? styles.noteOn : undefined}>{i + 1}</i>
                ))}
              </span>
            )}
            {flags.miasma && v === 0 && <span className={styles.miasmaHatch} style={{ backgroundImage: 'url(/assets/overlays/miasma.svg)' }} />}
          </button>
        );
      })}
      {/* row gutter (right column) */}
      {Array.from({ length: 9 }, (_, r) => {
        const s = stampFor(`r${r}`);
        const q = quarantinedByFoe.has(`r${r}`);
        return (
          <div key={`rg${r}`} className={`${styles.rowGutterCell} ${q ? styles.quarantined : ''}`} style={{ gridRow: r + 1, gridColumn: 10 }} aria-hidden>
            {s && <span className={`${styles.stampGlyph} ${s === 'fleur' ? styles.stampYou : styles.stampFoe}`} data-stamp={s} aria-label={`Row ${ROMAN[r]} claimed`} />}
          </div>
        );
      })}
      {/* column gutter (bottom row) */}
      {Array.from({ length: 9 }, (_, c) => {
        const s = stampFor(`c${c}`);
        const q = quarantinedByFoe.has(`c${c}`);
        return (
          <div key={`cg${c}`} className={`${styles.colGutterCell} ${q ? styles.quarantined : ''}`} style={{ gridRow: 10, gridColumn: c + 1 }} aria-hidden>
            {s && <span className={`${styles.stampGlyph} ${s === 'fleur' ? styles.stampYou : styles.stampFoe}`} data-stamp={s} aria-label={`Column ${ROMAN[c]} claimed`} />}
          </div>
        );
      })}
    </div>
  );
}

function cellAria(c: number, v: number, isGiven: boolean, chained: boolean, smudged: boolean) {
  const r = ROW_OF(c) + 1, col = COL_OF(c) + 1;
  let s = `Row ${r}, column ${col}, `;
  if (isGiven) s += `given ${v}`;
  else if (v) s += smudged ? 'placed digit smudged' : `placed ${v}`;
  else s += chained ? 'empty, chained' : 'empty';
  return s;
}
