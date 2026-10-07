// rank.ts — Standing → rank label + emblem (spec §2 RATING: 8 ranks, 3 divisions
// each except last). PORT of ../src/app/game/rank.ts, verbatim: the CONFIG.ranks
// ladder lives in the shared engine, and the arithmetic is the save's law.
import { CONFIG } from '@shared/config';

export function rankOfStanding(standing: number): { id: string; label: string; division: string; index: number } {
  const perRank = 250; // 8 ranks spanning ~2000 Standing
  const idx = Math.min(CONFIG.ranks.length - 1, Math.max(0, Math.floor((standing - 800) / perRank)));
  const label = CONFIG.ranks[idx];
  const id = label.toLowerCase().replace(/\s+/g, '-');
  const into = standing - (800 + idx * perRank);
  const division = idx === CONFIG.ranks.length - 1
    ? ''
    : ['First Division', 'Second Division', 'Third Division'][Math.min(2, Math.floor(into / (perRank / 3)))];
  return { id, label, division, index: idx };
}
