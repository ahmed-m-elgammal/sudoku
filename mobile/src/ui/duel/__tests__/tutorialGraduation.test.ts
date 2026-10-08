// The graduation law (src/ui/duel/tutorialGraduation.ts) — the once-per-save gate
// that makes the G13 replay entries safe to ship.
//
// Before G13 the tutorial could only ever complete once per save, so the +100
// graduation was written unconditionally on both completion paths. The replay entries
// (Antechamber + Settings) make re-completions a normal event, and the plan pins the
// law: "replays grant no repeat +100 (graduation Ink is once-per-save)". These tests
// pin that law for BOTH paths and the farm-proof composition:
//
//   GRAD-1  the first win graduates: flags + graduation Ink + the reliquary candle
//   GRAD-2  a replay win re-unlocks nothing and re-pays nothing
//   GRAD-3  the first confirmed skip also graduates (+100, but NO reliquary candle —
//           an abandoned duel lights no wax)
//   GRAD-4  a replay skip re-unlocks nothing and re-pays nothing
//   GRAD-5  the gate is null-safe and honest for a fresh install
//   GRAD-6  the farm-proof soak: win → win → skip → skip pays +100 exactly ONCE
//   GRAD-7  the ordinary duel economy is untouched: claims/duel ink rows survive the
//           graduation write (the functions only touch the graduation fields)
import { describe, it, expect } from 'vitest';
import { freshSave } from '@/state/save';
import {
  isGraduated, completeTutorialByWin, completeTutorialBySkip, GRADUATION_INK,
} from '../tutorialGraduation';

const fresh = () => freshSave('the Clerk');

describe('tutorialGraduation · the once-per-save law (M1 G13)', () => {
  it('GRAD-1 the first win graduates: flags, +100 Ink, the reliquary candle', () => {
    const s0 = fresh();
    expect(isGraduated(s0)).toBe(false);
    const s1 = completeTutorialByWin(s0);
    expect(s1.tutorialDone).toBe(true);
    expect(s1.antechamberUnlocked).toBe(true);
    expect(s1.economy.ink).toBe(s0.economy.ink + GRADUATION_INK);
    expect(s1.economy.reliquaryProgress).toBe(s0.economy.reliquaryProgress + 1);
  });

  it('GRAD-2 a replay win re-unlocks nothing and re-pays nothing', () => {
    const s1 = completeTutorialByWin(fresh());
    const s2 = completeTutorialByWin(s1);
    expect(s2.tutorialDone).toBe(true);
    expect(s2.antechamberUnlocked).toBe(true);
    expect(s2.economy.ink).toBe(s1.economy.ink); // no repeat +100
    expect(s2.economy.reliquaryProgress).toBe(s1.economy.reliquaryProgress); // no second candle
  });

  it('GRAD-3 the first confirmed skip graduates with Ink but lights NO candle', () => {
    const s0 = fresh();
    const s1 = completeTutorialBySkip(s0);
    expect(s1.tutorialDone).toBe(true);
    expect(s1.antechamberUnlocked).toBe(true);
    expect(s1.economy.ink).toBe(s0.economy.ink + GRADUATION_INK);
    expect(s1.economy.reliquaryProgress).toBe(s0.economy.reliquaryProgress);
  });

  it('GRAD-4 a replay skip re-unlocks nothing and re-pays nothing', () => {
    const s1 = completeTutorialBySkip(completeTutorialByWin(fresh()));
    const s2 = completeTutorialBySkip(s1);
    expect(s2.economy.ink).toBe(s1.economy.ink);
    expect(s2.economy.reliquaryProgress).toBe(s1.economy.reliquaryProgress);
  });

  it('GRAD-5 the gate is null-safe (a save still loading has not graduated)', () => {
    expect(isGraduated(null)).toBe(false);
    expect(isGraduated(undefined)).toBe(false);
    expect(isGraduated(fresh())).toBe(false);
    expect(isGraduated(completeTutorialByWin(fresh()))).toBe(true);
  });

  it('GRAD-6 the farm-proof soak: win → win → skip → skip pays the graduation ONCE', () => {
    let s = fresh();
    const startInk = s.economy.ink;
    const startReliquary = s.economy.reliquaryProgress;
    s = completeTutorialByWin(s);
    s = completeTutorialByWin(s); // replay from the hub, won again
    s = completeTutorialBySkip(s); // replay from settings, skipped
    s = completeTutorialBySkip(s); // and skipped again
    expect(s.economy.ink).toBe(startInk + GRADUATION_INK);
    expect(s.economy.reliquaryProgress).toBe(startReliquary + 1);
    expect(s.tutorialDone).toBe(true);
  });

  it('GRAD-7 the write is surgical: stats, standing and the daily ledger survive untouched', () => {
    const s0 = fresh();
    s0.stats.duels = 41;
    s0.standing = 1233;
    s0.daily.streak = 4;
    const s1 = completeTutorialByWin(s0);
    expect(s1.stats).toBe(s0.stats);
    expect(s1.standing).toBe(s0.standing);
    expect(s1.daily).toBe(s0.daily);
    expect(s1.campaign).toBe(s0.campaign);
    // the graduation is additive on the SAME economy object's fields, not a replacement
    expect(s1.economy.sigils).toBe(s0.economy.sigils);
    expect(s1.economy.pending).toBe(s0.economy.pending);
  });
});
