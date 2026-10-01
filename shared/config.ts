// ASSIZE shared config — every tunable number, exactly as specified (spec §1, §2, §3, §7, §8).
// One constant for the working title (spec R-preamble). Mirrored in /docs/BALANCE.md with reasoning.

export const GAME_TITLE = 'ASSIZE';

export const CONFIG = {
  duel: {
    durationMs: 600_000,            // Sudden Judgment at 10:00
    reconnectGraceMs: 20_000,       // disconnect grace before forfeit
    finalStatusBanMs: 10_000,       // statuses never apply in the final 10s
    statusGlobalGapMs: 4_000,       // anti-frustration: 4s gap between incoming statuses
    statusImmunityMs: 5_000,        // 5s immunity to a status type after it ends
    oneActivePerType: true,
    countdownMs: 3_000,             // versus splash 3-2-1
  },
  seals: {
    start: 7,
    magistrate: 8,                  // Magistrates have 8 Seals
    tinctureCap: 7,                 // Tincture restores up to this cap
  },
  placement: {
    wrongSealCost: 1,               // wrong digit costs 1 Seal
    wrongClearMs: 1_000,            // the digit clears after 1.0s
    flinchMs: 3_000,                // "Flinch": cooldowns pause for 3s
    momentumReductionMs: 500,       // each correct placement reduces all cooldowns by 0.5s
  },
  claims: {
    damage: 1,                      // a claim deals 1 Seal
    cleanBonus: 1,                  // Clean claim deals 2 total
    inkPerClaim: 3,                 // completing an already-claimed unit earns Ink only
  },
  abilities: {
    firstUseCooldownFactor: 0.5,    // first use of each ability starts at 50% cooldown
  },
  statusDurationsMs: {
    chain: 8_000,                   // CHAIN: empty cell uneditable
    smudge: 7_000,                  // SMUDGE: 5 placed digits blurred
    smudgeDigits: 5,
    hush: 2_500,                    // HUSH: number pad dead
    miasma: 10_000,                 // MIASMA: notes erased, pencil disabled
    quarantine: 12_000,             // QUARANTINE: unit unclaimable by target
  },
  orders: {
    scholar:     { name: 'Order of the Quill',  passive: 'marginalia' },   // first mistake costs no Seal
    executioner: { name: 'Order of the Axe',    passive: 'lastRites' },    // claims +1 when foe <= 3 Seals
    apothecary:  { name: 'Order of the Vial',   passive: 'distiller' },    // statuses you apply last +2s
    warden:      { name: 'Order of the Lantern', passive: 'bulwark' },     // first incoming status negated
  },
  abilityCdMs: {
    augur: 40_000, unseal: 30_000, fairCopy: 20_000,
    sever: 25_000, hush: 35_000, reckoning: 45_000, reckoningWindowMs: 20_000,
    smudge: 24_000, tincture: 60_000, miasma: 28_000,
    ward: 40_000, wardWindowMs: 15_000,
    mirror: 45_000, mirrorWindowMs: 10_000,
    quarantine: 35_000,
    unsealImmunityMs: 6_000,
    tinctureUsesPerDuel: 2,
    wardNegateWindowMs: 15_000,
    mirrorReflectWindowMs: 10_000,
  } as Record<string, number>,
  unlocks: {
    scholar: 'start', executioner: 'start',
    apothecary: 'folio-2',            // after Folio II
    warden: 'folio-4',                // after Folio IV
  },
  puzzle: {
    tiers: {
      Easy:   { givens: [36, 40], maxGrade: 1 },  // singles only
      Medium: { givens: [30, 35], maxGrade: 2 },
      Hard:   { givens: [26, 29], minGrade: 2 },  // pairs and pointing
      Expert: { givens: [22, 25], minGrade: 3 },  // X-wing and chains
    },
    maxGenerationAttempts: 40,
  },
  rating: {
    start: 1000,
    k: 32,
    kAbove1600: 20,
  },
  ranks: ['Scrivener', 'Clerk', 'Notary', 'Advocate', 'Magistrate', 'High Magistrate', 'Justiciar', 'Lord of the Assize'] as const,
  divisionsPerRank: 3,               // except the last rank (1 division)
  economy: {
    inkWin: 30, inkLoss: 10,
    inkClaim: 3, inkCleanBonus: 2,
    inkDailyFirstWin: 50,
    reliquaryEveryWins: 3,
    practiceDailyInkCap: 50,
  },
  daily: {
    mistakePenaltyMs: 10_000,        // +10s per mistake
    leaderboardSize: 100,
    streakName: 'Unbroken Days',
  },
  matchmaking: {
    shadeFallbackMs: 4_000,          // max wait before pairing with a Shade
    windowWidenMs: 2_000,            // widen window every 2s
  },
} as const;

export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type PlayerId = 0 | 1;       // 0 = you, 1 = opponent (from the acting client's perspective the engine is absolute: 0/1 seats)
export type UnitId = string;        // 'r0'..'r8' | 'c0'..'c8' | 'b0'..'b8'
export type OrderId = 'scholar' | 'executioner' | 'apothecary' | 'warden';
export type AbilityId =
  | 'augur' | 'unseal' | 'fairCopy'
  | 'sever' | 'hush' | 'reckoning'
  | 'smudge' | 'tincture' | 'miasma'
  | 'ward' | 'mirror' | 'quarantine';
export type StatusType = 'chain' | 'smudge' | 'hush' | 'miasma' | 'quarantine';
export type Tier = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export const ORDER_ABILITIES: Record<OrderId, AbilityId[]> = {
  scholar: ['augur', 'unseal', 'fairCopy'],
  executioner: ['sever', 'hush', 'reckoning'],
  apothecary: ['smudge', 'tincture', 'miasma'],
  warden: ['ward', 'mirror', 'quarantine'],
};

export const STATUS_OF_ABILITY: Partial<Record<AbilityId, StatusType>> = {
  sever: 'chain', hush: 'hush', smudge: 'smudge', miasma: 'miasma', quarantine: 'quarantine',
};

export const ROW_OF = (c: number) => Math.floor(c / 9);
export const COL_OF = (c: number) => c % 9;
export const BOX_OF = (c: number) => Math.floor(ROW_OF(c) / 3) * 3 + Math.floor(COL_OF(c) / 3);
export const UNIT_CELLS: Record<UnitId, number[]> = (() => {
  const m: Record<string, number[]> = {};
  for (let r = 0; r < 9; r++) m[`r${r}`] = Array.from({ length: 9 }, (_, i) => r * 9 + i);
  for (let c = 0; c < 9; c++) m[`c${c}`] = Array.from({ length: 9 }, (_, i) => i * 9 + c);
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3;
    m[`b${b}`] = Array.from({ length: 9 }, (_, i) => (br + Math.floor(i / 3)) * 9 + bc + (i % 3));
  }
  return m;
})();
export const UNITS_OF_CELL = (cell: number): UnitId => {
  void cell; return '';
};
export const CELL_UNITS = (cell: number): [UnitId, UnitId, UnitId] => [
  `r${ROW_OF(cell)}`, `c${COL_OF(cell)}`, `b${BOX_OF(cell)}`,
];
