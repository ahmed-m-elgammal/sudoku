// Phase 4 launcher screens — the pure laws the gate can pin without native chrome.
//
// The three mode screens (Daily/Weekly/Endless) are launchers over the already-
// gated duel runtime, so their testable surface is the copy/format/token law:
//   · fmtClock / fmtCountdown — the web build's inline JSX clock math, now
//     extracted into dailyFormat.ts; pinned against hand-computed values.
//   · the daily "you"-row wash token — the web's inline rgba(165,136,73,0.12),
//     lifted verbatim into tokens (the no-colour-literal law's escape hatch).
//   · the i18n superset law — every web en.json key exists in the mobile
//     dictionary with an EQUAL value. Mobile may be a strict superset (the
//     scaffold ships 10 mobile-only keys for a11y/log affordances: duel.pad.*,
//     duel.log.*, tutorial.waits, duel.pause, duel.swap.arrow) but may never
//     drift or drop web copy — this pins daily/weekly/endless forever.
import { describe, it, expect } from 'vitest';
import { fmtClock, fmtCountdown } from '@/ui/screens/dailyFormat';
import { palette, themeFor } from '@/theme/tokens';
import webEn from '../../../../../src/i18n/en.json';
import mobileEn from '@/i18n/en.json';

describe('daily clock formats (web DailyScreen inline math)', () => {
  it('formats leaderboard times as unpadded m:ss', () => {
    expect(fmtClock(0)).toBe('0:00');
    expect(fmtClock(59_999)).toBe('0:59');
    expect(fmtClock(60_000)).toBe('1:00');
    expect(fmtClock(90_214)).toBe('1:30');
    expect(fmtClock(3_599_400)).toBe('59:59');
    expect(fmtClock(3_600_000)).toBe('60:00');
  });

  it('formats the midnight countdown as padded HH:MM:SS', () => {
    expect(fmtCountdown(0)).toBe('00:00:00');
    expect(fmtCountdown(59)).toBe('00:00:59');
    expect(fmtCountdown(3_661)).toBe('01:01:01');
    expect(fmtCountdown(45_296)).toBe('12:34:56');
  });
});

describe('the daily you-row wash token', () => {
  it('carries the web inline value verbatim (brass at 12%)', () => {
    expect(themeFor().youRowWash).toBe('rgba(165, 136, 73, 0.12)');
    // and it really is the brass family, not a stray constant
    expect(palette.brass).toBe('#a58849');
  });

  it('survives the high-contrast cascade untouched (the web literal does not switch either)', () => {
    expect(themeFor({ contrast: true }).youRowWash).toBe('rgba(165, 136, 73, 0.12)');
  });
});

describe('the i18n superset law', () => {
  const walk = (web: unknown, mob: unknown, path: string): string[] => {
    if (typeof web !== typeof mob) return [`TYPE ${path}`];
    if (Array.isArray(web)) return JSON.stringify(web) === JSON.stringify(mob) ? [] : [`ARRAY ${path}`];
    if (web && typeof web === 'object') {
      const out: string[] = [];
      for (const [k, v] of Object.entries(web as Record<string, unknown>)) {
        if (!(k in (mob as Record<string, unknown>))) out.push(`MISSING ${path}.${k}`);
        else out.push(...walk(v, (mob as Record<string, unknown>)[k], `${path}.${k}`));
      }
      return out;
    }
    return web === mob ? [] : [`DRIFT ${path}: ${JSON.stringify(web)} vs ${JSON.stringify(mob)}`];
  };

  it('every web en.json key exists on mobile with an equal value', () => {
    expect(walk(webEn, mobileEn, 'en')).toEqual([]);
  });

  it("the three launcher screens' copy is present on mobile", () => {
    const m = mobileEn as unknown as Record<string, Record<string, unknown>>;
    for (const key of [
      'title', 'sub', 'countdown', 'start', 'attempted', 'mistakeNote', 'streak',
      'leaderboard', 'you', 'emptyBoard', 'candle', 'candleNote',
    ]) expect(m.daily[key]).toBeDefined();
    for (const key of [
      'title', 'sub', 'writsLabel', 'foeLabel', 'tierLabel', 'sealsLabel',
      'arcBadge', 'sit', 'satLine', 'openLine', 'endsLabel', 'law', 'back',
    ]) expect(m.weekly[key]).toBeDefined();
    for (const key of [
      'title', 'sub', 'rungLabel', 'bestLabel', 'nextLabel', 'seals',
      'bossBadge', 'queueLabel', 'ascend', 'law', 'back',
    ]) expect(m.endless[key]).toBeDefined();
  });
});
