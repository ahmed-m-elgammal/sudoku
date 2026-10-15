// P2.4 — the Chronicle's pure law (chronicleLaw.ts).
//
//   LAW-1  the order is the story order: prologue, folios I–III, interlude 1,
//          folios IV–VI, interlude 2, folios VII–IX, reveal, both endings.
//   LAW-2  every beat resolves title + verbatim canon lines + a plate path.
//   LAW-3  locked labels never spoil: interlude/reveal/ending rows read Sealed.
//   LAW-4  unknown ids resolve to null (fail-closed).
import { describe, it, expect } from 'vitest';
import {
  CHRONICLE_ORDER, chronicleBeat, chronicleLockedLabel, isChronicleSeen,
} from '@/ui/screens/chronicleLaw';
import { i18n } from '@/i18n';

describe('chronicleLaw (P2.4)', () => {
  it('LAW-1 the order is the story order (15 beats)', () => {
    expect(CHRONICLE_ORDER).toEqual([
      'prologue',
      'folio:halbrecht', 'folio:vael', 'folio:ilse',
      'interlude1',
      'folio:anselm', 'folio:corvane', 'folio:quill',
      'interlude2',
      'folio:marchetti', 'folio:nox', 'folio:orsolo',
      'reveal',
      'ending:balance', 'ending:burn',
    ]);
  });

  it('LAW-2 beats resolve title, verbatim lines, and a plate', () => {
    const folio = chronicleBeat('folio:halbrecht');
    expect(folio?.title).toContain('Halbrecht');
    expect(folio?.lines.join(' ')).toContain("The Headsman's yard is quiet");
    expect(folio?.plate).toContain('plate-folio-1.webp');
    expect(chronicleBeat('prologue')?.lines).toHaveLength(4);
    expect(chronicleBeat('reveal')?.lines).toHaveLength(4); // Orsolo's 3 + the Clerk's reply (P3.4)
    expect(chronicleBeat('reveal')?.lines.join(' ')).toContain('the pen is in my hand');
    expect(chronicleBeat('ending:burn')?.lines.length).toBeGreaterThan(0);
  });

  it('LAW-3 locked labels never spoil the plot', () => {
    expect(chronicleLockedLabel('reveal')).toBe(i18n.duel.chronicle.sealed);
    expect(chronicleLockedLabel('interlude1')).toBe(i18n.duel.chronicle.sealed);
    expect(chronicleLockedLabel('ending:burn')).toBe(i18n.duel.chronicle.sealed);
    expect(chronicleLockedLabel('reveal')).not.toContain('Ninth');
    // folio titles are public (they hang on the FolioMap)
    expect(chronicleLockedLabel('folio:halbrecht')).toContain('Halbrecht');
  });

  it('LAW-4 unknown ids resolve to null and unseen reads false', () => {
    expect(chronicleBeat('folio:nope')).toBeNull();
    expect(chronicleBeat('')).toBeNull();
    expect(isChronicleSeen([], 'prologue')).toBe(false);
    expect(isChronicleSeen(undefined, 'prologue')).toBe(false);
    expect(isChronicleSeen(['prologue'], 'prologue')).toBe(true);
  });
});
