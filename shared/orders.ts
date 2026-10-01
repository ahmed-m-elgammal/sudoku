// ASSIZE Orders — display metadata + unlock rules (spec §2 ORDERS). All four are free via play.
import type { AbilityId, OrderId, Tier } from './config';

export interface AbilityMeta {
  id: AbilityId;
  name: string;          // i18n key suffix; full copy lives in i18n/en.json
  icon: string;          // sigil asset id
  cdLabel: string;
  target: 'self' | 'foe' | 'cell' | 'box' | 'unit';
}

export interface OrderMeta {
  id: OrderId;
  name: string;
  epithet: string;
  passiveName: string;
  passiveDescKey: string;
  portrait: string;
  unlockAfter: 'start' | 'folio-2' | 'folio-4';
  abilities: AbilityMeta[];
}

export const ORDERS: OrderMeta[] = [
  {
    id: 'scholar',
    name: 'Scholar',
    epithet: 'Order of the Quill',
    passiveName: 'Marginalia',
    passiveDescKey: 'passive.scholar',
    portrait: '/assets/portraits/order-scholar.webp',
    unlockAfter: 'start',
    abilities: [
      { id: 'augur', name: 'Augur', icon: 'sigil-eye', cdLabel: '40s', target: 'cell' },
      { id: 'unseal', name: 'Unseal', icon: 'sigil-key', cdLabel: '30s', target: 'self' },
      { id: 'fairCopy', name: 'Fair Copy', icon: 'sigil-quill', cdLabel: '20s', target: 'box' },
    ],
  },
  {
    id: 'executioner',
    name: 'Executioner',
    epithet: 'Order of the Axe',
    passiveName: 'Last Rites',
    passiveDescKey: 'passive.executioner',
    portrait: '/assets/portraits/order-executioner.webp',
    unlockAfter: 'start',
    abilities: [
      { id: 'sever', name: 'Sever', icon: 'sigil-dagger', cdLabel: '25s', target: 'foe' },
      { id: 'hush', name: 'Hush', icon: 'sigil-hourglass', cdLabel: '35s', target: 'foe' },
      { id: 'reckoning', name: 'Reckoning', icon: 'sigil-axe', cdLabel: '45s', target: 'self' },
    ],
  },
  {
    id: 'apothecary',
    name: 'Apothecary',
    epithet: 'Order of the Vial',
    passiveName: 'Distiller',
    passiveDescKey: 'passive.apothecary',
    portrait: '/assets/portraits/order-apothecary.webp',
    unlockAfter: 'folio-2',
    abilities: [
      { id: 'smudge', name: 'Smudge', icon: 'sigil-vial', cdLabel: '24s', target: 'foe' },
      { id: 'tincture', name: 'Tincture', icon: 'sigil-cup', cdLabel: '60s ×2', target: 'self' },
      { id: 'miasma', name: 'Miasma', icon: 'sigil-censer', cdLabel: '28s', target: 'foe' },
    ],
  },
  {
    id: 'warden',
    name: 'Warden',
    epithet: 'Order of the Lantern',
    passiveName: 'Bulwark',
    passiveDescKey: 'passive.warden',
    portrait: '/assets/portraits/order-warden.webp',
    unlockAfter: 'folio-4',
    abilities: [
      { id: 'ward', name: 'Ward', icon: 'sigil-shield', cdLabel: '40s', target: 'self' },
      { id: 'mirror', name: 'Mirror', icon: 'sigil-lantern', cdLabel: '45s', target: 'self' },
      { id: 'quarantine', name: 'Quarantine', icon: 'sigil-bar', cdLabel: '35s', target: 'unit' },
    ],
  },
];

export const orderMeta = (id: OrderId) => ORDERS.find((o) => o.id === id)!;

// Campaign duel definitions (spec §1 THE NINE FOLIOS) — narrative text lives in i18n + docs/STORY.md.
export interface FoeDef {
  key: string;              // i18n key root, e.g. 'mag.halbrecht'
  name: string;
  order: OrderId;
  seals: number;
  tier: Tier;
  shadeKind: 'minor' | 'lieutenant' | 'magistrate';
  adaptive?: boolean;       // Orsolo swaps Orders at 4 Seals
}

export interface FolioDef {
  numeral: string;
  key: string;
  duels: [FoeDef, FoeDef, FoeDef];
}

const mk = (key: string, name: string, order: OrderId, tier: Tier, kind: FoeDef['shadeKind'], seals = 7, adaptive = false): FoeDef =>
  ({ key: `mag.${key}`, name, order, tier, shadeKind: kind, seals, adaptive });

export const FOLIOS: FolioDef[] = [
  { numeral: 'I', key: 'halbrecht', duels: [mk('halbrecht.s1', 'Halbrecht', 'executioner', 'Easy', 'minor'), mk('halbrecht.s2', 'Halbrecht', 'executioner', 'Easy', 'lieutenant'), mk('halbrecht', 'Halbrecht the Headsman', 'executioner', 'Medium', 'magistrate', 8)] },
  { numeral: 'II', key: 'vael', duels: [mk('vael.s1', 'Vael', 'apothecary', 'Easy', 'minor'), mk('vael.s2', 'Vael', 'apothecary', 'Medium', 'lieutenant'), mk('vael', 'Mother Vael, the Apothecary', 'apothecary', 'Medium', 'magistrate', 8)] },
  { numeral: 'III', key: 'ilse', duels: [mk('ilse.s1', 'Ilse', 'executioner', 'Medium', 'minor'), mk('ilse.s2', 'Ilse', 'executioner', 'Medium', 'lieutenant'), mk('ilse', 'Cantor Ilse, the Bellringer', 'executioner', 'Hard', 'magistrate', 8)] },
  { numeral: 'IV', key: 'anselm', duels: [mk('anselm.s1', 'Anselm', 'warden', 'Medium', 'minor'), mk('anselm.s2', 'Anselm', 'warden', 'Hard', 'lieutenant'), mk('anselm', 'Brother Anselm, Warden of the Lantern', 'warden', 'Hard', 'magistrate', 8)] },
  { numeral: 'V', key: 'corvane', duels: [mk('corvane.s1', 'Corvane', 'warden', 'Hard', 'minor'), mk('corvane.s2', 'Corvane', 'warden', 'Hard', 'lieutenant'), mk('corvane', 'Dame Corvane, the Cartographer', 'warden', 'Hard', 'magistrate', 8)] },
  { numeral: 'VI', key: 'quill', duels: [mk('quill.s1', 'Quill', 'scholar', 'Hard', 'minor'), mk('quill.s2', 'Quill', 'scholar', 'Hard', 'lieutenant'), mk('quill', 'Tobias Quill, the Forger', 'scholar', 'Expert', 'magistrate', 8)] },
  { numeral: 'VII', key: 'marchetti', duels: [mk('marchetti.s1', 'Marchetti', 'executioner', 'Hard', 'minor'), mk('marchetti.s2', 'Marchetti', 'executioner', 'Expert', 'lieutenant'), mk('marchetti', 'Lord Marchetti, the Moneylender', 'executioner', 'Expert', 'magistrate', 8)] },
  { numeral: 'VIII', key: 'nox', duels: [mk('nox.s1', 'Nox', 'apothecary', 'Expert', 'minor'), mk('nox.s2', 'Nox', 'apothecary', 'Expert', 'lieutenant'), mk('nox', 'Old Nox, the Gravedigger', 'apothecary', 'Expert', 'magistrate', 8)] },
  { numeral: 'IX', key: 'orsolo', duels: [mk('orsolo.s1', 'Orsolo', 'scholar', 'Expert', 'minor'), mk('orsolo.s2', 'Orsolo', 'warden', 'Expert', 'lieutenant'), mk('orsolo', 'Magistrate Orsolo, the Ninth Seal', 'scholar', 'Expert', 'magistrate', 8, true)] },
];

export const totalCampaignDuels = FOLIOS.reduce((n, f) => n + f.duels.length, 0); // 27

// ---------------------------------------------------------------- T4 — Orsolo's adaptive swap
// Story: "I have worn nine Orders waiting for you." Mechanic: when the Ninth falls to
// 4 Seals he sets his Order aside and answers YOURS with the one that hurts it most.
//   Scholar (info + one forgiven mistake) → Apothecary: Smudge/Miasma bury information,
//                                           Tincture out-sustains a recovery Order.
//   Executioner (burst pressure)          → Warden: Bulwark/Ward/Mirror eat the pressure
//                                           and reflect it back.
//   Apothecary (status grind)             → Executioner: Reckoning + Last Rites race past
//                                           the vial before the grind lands.
//   Warden (defense + denial)             → Scholar: Augur and Fair Copy out-tempo a wall.
export const ADAPTIVE_COUNTER: Record<OrderId, OrderId> = {
  scholar: 'apothecary',
  executioner: 'warden',
  apothecary: 'executioner',
  warden: 'scholar',
};

// Pure and total: picks the counter to the player's Order; if the Ninth already wears it
// (e.g. player Warden vs Orsolo opening Scholar) he rotates one step further — he has,
// after all, worn them all. Deterministic, no rng.
export const adaptiveSwapTarget = (playerOrder: OrderId, currentFoeOrder: OrderId): OrderId => {
  const base = ADAPTIVE_COUNTER[playerOrder];
  return base === currentFoeOrder ? ADAPTIVE_COUNTER[base] : base;
};
