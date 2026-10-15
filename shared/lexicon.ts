// ASSIZE Clerk's Lexicon — the in-app glossary data (docs/STORY_HOLD_PLAN.md P2.5).
//
// One source for both platforms: entry text lives HERE, screen chrome
// (title/back) lives in the dictionaries. Every number is copied verbatim
// from docs/BALANCE.md (which mirrors shared/config.ts) — the exhaustiveness
// suite (shared/__tests__/lexicon.test.ts) pins each rite's cooldown and each
// status's duration against CONFIG, so a balance change that forgets the
// glossary fails CI instead of lying to the player.
import type { AbilityId, StatusType } from './config';

export type LexSection = 'court' | 'tablet' | 'arts' | 'orders' | 'ladder';

export const LEXICON_SECTIONS: Record<LexSection, string> = {
  court: 'The Court',
  tablet: 'The Tablet',
  arts: "The Foe's Arts",
  orders: 'The Orders',
  ladder: 'The Ladder',
};

export interface LexEntry {
  /** Unique key — usually the AbilityId, StatusType, or word it documents. */
  term: string;
  section: LexSection;
  /** The in-fiction name. */
  fiction: string;
  /** One plain sentence carrying the meaning. */
  plain: string;
  /** The exact number where one exists (durations, cooldowns, counts). */
  value?: string;
  /** This entry documents the rite (compile-driven exhaustiveness). */
  ability?: AbilityId;
  /** This entry documents the suffered status (compile-driven exhaustiveness). */
  status?: StatusType;
}

export const LEXICON: readonly LexEntry[] = [
  // ---- the Court
  { term: 'assize', section: 'court', fiction: 'Assize', plain: 'The Ninefold court; every quarrel in Novem is settled by duel.' },
  { term: 'reckoning-word', section: 'court', fiction: 'Reckoning', plain: 'Complete the Tablet first and the duel is yours, by rights.' },
  { term: 'plea', section: 'court', fiction: 'Plea', plain: 'One duel; two pleaders; nine by nine.' },
  // ---- the Tablet
  { term: 'seal', section: 'tablet', fiction: 'Seal', plain: 'Seven wax lives; a wrong digit breaks one, and a Magistrate holds eight.', value: '7' },
  { term: 'given', section: 'tablet', fiction: 'Given', plain: 'A printed digit; fixed, true, and unplayable.' },
  { term: 'claim', section: 'tablet', fiction: 'Claim', plain: 'Complete a row, column, or box to take it; it deals 1 Seal.', value: '1' },
  { term: 'clean', section: 'tablet', fiction: 'Clean', plain: 'A claim with no mistakes and no Augur in the unit deals 2.', value: '2' },
  { term: 'ink', section: 'tablet', fiction: 'Ink', plain: "The court's coin; a win mints 30, a loss 10.", value: '30 win · 10 loss' },
  // ---- the Foe's Arts (the five suffered statuses; four entries double as
  // their rites — value carries the suffered duration first, the rite's
  // cooldown second, both verbatim from BALANCE.md)
  { term: 'chain', section: 'arts', fiction: 'Chain', plain: 'One empty cell is locked.', value: '8 s', status: 'chain' },
  { term: 'smudge', section: 'arts', fiction: 'Smudge', plain: "Five of your placed digits blur unreadably.", value: '7 s · rite 24 s', ability: 'smudge', status: 'smudge' },
  { term: 'hush', section: 'arts', fiction: 'Hush', plain: 'The number pad is dead.', value: '2.5 s · rite 35 s', ability: 'hush', status: 'hush' },
  { term: 'miasma', section: 'arts', fiction: 'Miasma', plain: 'Your notes are erased and pencil is barred.', value: '10 s · rite 28 s', ability: 'miasma', status: 'miasma' },
  { term: 'quarantine', section: 'arts', fiction: 'Quarantine', plain: 'A chosen unit cannot be claimed by the foe.', value: '12 s · rite 35 s', ability: 'quarantine', status: 'quarantine' },
  // ---- the Orders (passive, then its three rites, per Order)
  { term: 'marginalia', section: 'orders', fiction: 'Marginalia', plain: 'Scholar passive: your first mistake each duel costs no Seal.' },
  { term: 'augur', section: 'orders', fiction: 'Augur', plain: 'Reveal the correct digit in the selected empty cell; it voids Clean.', value: '40 s', ability: 'augur' },
  { term: 'unseal', section: 'orders', fiction: 'Unseal', plain: 'Clear all statuses on your board and go immune for 6 s.', value: '30 s', ability: 'unseal' },
  { term: 'fairCopy', section: 'orders', fiction: 'Fair Copy', plain: 'Auto-fill correct pencil candidates for the selected box.', value: '20 s', ability: 'fairCopy' },
  { term: 'lastRites', section: 'orders', fiction: 'Last Rites', plain: 'Executioner passive: claims deal +1 while the foe holds 3 or fewer Seals.' },
  { term: 'sever', section: 'orders', fiction: 'Sever', plain: "Chain the empty cell in the foe's most nearly complete unit.", value: '25 s', ability: 'sever' },
  { term: 'reckoning', section: 'orders', fiction: 'Reckoning', plain: 'Your next claim within 20 s deals +1.', value: '45 s', ability: 'reckoning' },
  { term: 'distiller', section: 'orders', fiction: 'Distiller', plain: 'Apothecary passive: statuses you apply last 2 s longer.' },
  { term: 'tincture', section: 'orders', fiction: 'Tincture', plain: 'Restore 1 Seal, never past 7; two vials per duel.', value: '60 s · ×2', ability: 'tincture' },
  { term: 'bulwark', section: 'orders', fiction: 'Bulwark', plain: 'Warden passive: the first incoming status each duel is negated.' },
  { term: 'ward', section: 'orders', fiction: 'Ward', plain: 'Negate the next incoming status within 15 s.', value: '40 s', ability: 'ward' },
  { term: 'mirror', section: 'orders', fiction: 'Mirror', plain: 'Reflect the next incoming status back within 10 s.', value: '45 s', ability: 'mirror' },
  // ---- the Ladder
  { term: 'standing', section: 'ladder', fiction: 'Standing', plain: 'Your rank-number; wins raise it, losses lower it, all begin at 1000.', value: '1000' },
  { term: 'rank', section: 'ladder', fiction: 'Rank', plain: 'Eight titles from Scrivener to Lord of the Assize, three divisions each.', value: '8 ranks' },
  { term: 'shade', section: 'ladder', fiction: 'Shade', plain: "An ink-echo dueling on another's behalf — every bot foe, honestly named." },
];

export function lexEntryForAbility(id: AbilityId): LexEntry | undefined {
  return LEXICON.find((e) => e.ability === id);
}

export function lexEntryForStatus(id: StatusType): LexEntry | undefined {
  return LEXICON.find((e) => e.status === id);
}
