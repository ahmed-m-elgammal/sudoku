// P3.3 — the first-hit explainer gate (shouldExplainStatus).
//
//   EXP-1  the Clerk's own suffering outside the tutorial earns one telling.
//   EXP-2  the tutorial teaches in place — never toasted.
//   EXP-3  the foe's suffering, and unknown statuses, earn nothing.
//   EXP-4  the engine's final-10 s ban is honored (hostile input is no lesson).
//   EXP-5  explained-once means explained-ever.
import { describe, it, expect } from 'vitest';
import { shouldExplainStatus } from '@/ui/duel/useDuelSession';

const DUR = 600_000;
const open = {
  player: 0, mode: 'campaign', clockMs: 100_000, durationMs: DUR, explained: [] as string[],
};

describe('shouldExplainStatus (P3.3)', () => {
  it('EXP-1 the first suffering earns a telling, the second does not', () => {
    expect(shouldExplainStatus({ ...open, status: 'miasma' })).toBe('miasma');
    expect(shouldExplainStatus({ ...open, status: 'miasma', explained: ['miasma'] })).toBeNull();
  });

  it('EXP-2 the tutorial teaches in place', () => {
    expect(shouldExplainStatus({ ...open, mode: 'tutorial', status: 'miasma' })).toBeNull();
  });

  it('EXP-3 the foe can suffer in silence; unknown statuses too', () => {
    expect(shouldExplainStatus({ ...open, player: 1, status: 'miasma' })).toBeNull();
    expect(shouldExplainStatus({ ...open, status: 'blessing' })).toBeNull();
    expect(shouldExplainStatus({ ...open, status: undefined })).toBeNull();
  });

  it('EXP-4 the final 10 s are lesson-silent', () => {
    expect(shouldExplainStatus({ ...open, clockMs: DUR - 10_000, status: 'chain' })).toBe('chain');
    expect(shouldExplainStatus({ ...open, clockMs: DUR - 9_999, status: 'chain' })).toBeNull();
  });

  it('EXP-5 a hostile clock never teaches', () => {
    expect(shouldExplainStatus({ ...open, clockMs: NaN, status: 'chain' })).toBeNull();
    expect(shouldExplainStatus({ ...open, durationMs: 0, status: 'chain' })).toBeNull();
  });
});
