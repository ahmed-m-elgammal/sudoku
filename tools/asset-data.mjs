// ASSIZE asset definitions — single source of truth for /assets/manifest.json
// pipeline: "imagegen" (pipeline A in spec §9) | "procedural" (pipeline C)
// Run: bun tools/asset-data.mjs  → writes /assets/manifest.json
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..');
const STYLE = fs.readFileSync(path.join(ROOT, 'assets/style-prefix.txt'), 'utf8').trim();

// ---------------------------------------------------------------- raster gen sizes
// Generator supports: 1024x1024, 768x1344, 864x1152, 1344x768, 1152x864, 1440x720, 720x1440
// Portraits are produced at 864x1152 then center-cropped/sharp-resized to 512x640.
// Plates are produced at 1152x864 then resized to 1080x720. Map 768x1344 -> 1080x1600 (upscale).

const PORTRAITS = [
  ['order-scholar', 'tarot card portrait of the Order of the Quill: a hooded scholar reading a great open ledger by a single candle, quill tucked behind the ear, chains of office, austere and learned, framed by an engraved tarot border of quills and ink drops'],
  ['order-executioner', 'tarot card portrait of the Order of the Axe: a masked executioner resting a great two-handed axe on one shoulder, leather half-mask, heavy apron, rope belt, framed by an engraved tarot border of axes and wax seals'],
  ['order-apothecary', 'tarot card portrait of the Order of the Vial: a plague doctor apothecary in a beaked mask holding up a small glass vial, dried herbs at the belt, framed by an engraved tarot border of vials and twisted roots'],
  ['order-warden', 'tarot card portrait of the Order of the Lantern: a warden in a bell-shaped helm bearing a caged storm lantern, ring of keys, framed by an engraved tarot border of lanterns and iron bars'],
  ['mag-halbrecht', 'tarot card portrait of Magistrate Halbrecht the Headsman: broad-shouldered headsman with a braided grey beard and heavy hood, a great executioner sword laid across his knees, scarred hands, engraved tarot border of rope and blade'],
  ['mag-vael', 'tarot card portrait of Mother Vael the Apothecary: aged shawled matriarch apothecary, beaked plague mask pushed up on her brow, dried herbs and glass vials hanging around her, engraved tarot border of roots and vials'],
  ['mag-ilse', 'tarot card portrait of Cantor Ilse the Bellringer: gaunt tall bellringer woman clutching a small bronze handbell, bell ropes coiled behind her, blindfolded eyes, engraved tarot border of bells and ropes'],
  ['mag-anselm', 'tarot card portrait of Brother Anselm Warden of the Lantern: monastic warden holding a caged lantern at chest height, heavy keys at his belt, tonsured under a bell helm, engraved tarot border of bars and flames'],
  ['mag-corvane', 'tarot card portrait of Dame Corvane the Cartographer: armoured woman cartographer holding rolled maps and brass calipers, raven feather fixed to her helm, engraved tarot border of coastlines and compass roses'],
  ['mag-quill', 'tarot card portrait of Tobias Quill the Forger: nervous thin forger with ink-stained fingers holding a magnifying loupe, ledgers and ink pots on the table before him, engraved tarot border of pens and blot marks'],
  ['mag-marchetti', 'tarot card portrait of Lord Marchetti the Moneylender: richly robed moneylender with many rings weighing coins on a small balance scale, ledger chained to his wrist, engraved tarot border of coins and chains'],
  ['mag-nox', 'tarot card portrait of Old Nox the Gravedigger: ancient bent gravedigger leaning on a spade before a fresh grave, tattered cloak, small lantern hooked on the spade, engraved tarot border of spades and buried roots'],
  ['mag-orsolo', 'tarot card portrait of Magistrate Orsolo the Ninth Seal: tall robed magistrate behind a high collar, face half lost in shadow, nine wax seals arranged in a halo behind his head, engraved tarot border of chains and broken quills'],
  ['shade-orsolo', 'tarot card portrait of a Shade: an ink-echo of a robed magistrate, the figure half-dissolved, lower body breaking apart into dripping ink strokes and flying crows of ink, engraved tarot border half-eaten by ink'],
  ['shade-mark', 'an abstract ink-echo sigil: a human profile silhouette dissolving from the back of the head into ink tendrils and drips, centered on aged paper, engraved like a woodcut printer mark'],
  ['clerk', 'tarot card portrait of the Clerk: a young unnamed scribe in a plain dark doublet, ink-stained fingers pressed together, a sealed folio under one arm, hollow patient eyes, engraved tarot border of ledger lines and a broken seal'],
];

const PLATES = [
  ['plate-prologue', 'a vast sealed court hall at night, nine empty magistrates seats behind a long bench, a lone small clerk standing at a great ledger stand, tall barred windows, one candle'],
  ['plate-folio-1', 'a headsman yard at dawn, a chopping block and a great sword resting on it, straw and long shadows, a crowd of hooded figures at the gate'],
  ['plate-folio-2', 'an apothecary interior crowded with hanging dried herbs, glass vials, a mortar and pestle on a workbench, light through a dirty window'],
  ['plate-folio-3', 'inside a bell tower, enormous bells in darkness, thick ropes descending into the light, a small figure on the ladder'],
  ['plate-folio-4', 'a prison ward of cell doors each with a small caged lantern, a warden walking away with a ring of keys, checkered floor'],
  ['plate-folio-5', 'a cartographers map room, a huge engraved city plan on the table, brass calipers, rolled maps in pots, raven at the window'],
  ['plate-folio-6', 'a forgers scriptorium, an ink-stained desk with ledgers, quills, blotting sand, a forged document held to the light'],
  ['plate-folio-7', 'a counting house, tall chest of coins, a chained ledger, a balance scale, a moneylender silhouette behind a grille'],
  ['plate-folio-8', 'a night graveyard under bare trees, fresh grave earth, a spade standing upright, small lantern glowing low on the mound'],
  ['plate-folio-9', 'the inner ninth court, a single table bearing a sealed tablet and nine broken wax seals, two chairs facing each other'],
  ['plate-interlude-1', 'a plague sealed city street at dusk, a red cross and wax seals painted on a gate, masked and hooded citizens passing, hushed'],
  ['plate-interlude-2', 'the ledger hall by candlelight, endless shelves of bound folios, a clerk on a ladder, drifting dust'],
  ['plate-ending-balance', 'a great open ledger on a stone desk, a quill finishing a final line, brass scales perfectly level beside it, seals whole'],
  ['plate-ending-burn', 'a huge ledger burning in a bronze brazier, broken wax seals cracking in the flames, loose pages rising into dark air'],
  ['plate-orsolo-reveal', 'an old robed magistrate pulling off his seal-ring and mask before a small desk with a candle, an empty chair where a clerk should sit, dawn light on a tablet'],
];

const RASTER = [];
for (const [id, subject] of PORTRAITS) RASTER.push({
  id, pipeline: 'imagegen', dir: 'portraits', genSize: '864x1152',
  out: [
    { file: `${id}.webp`, width: 512, height: 640, primary: true },
    { file: `${id}.png`, width: 512, height: 640, primary: false },
  ],
  prompt: `${STYLE}. ${subject}. Vertical composition.`,
});
for (const [id, subject] of PLATES) RASTER.push({
  id, pipeline: 'imagegen', dir: 'plates', genSize: '1152x864',
  out: [
    { file: `${id}.webp`, width: 1080, height: 720, primary: true },
    { file: `${id}.png`, width: 1080, height: 720, primary: false },
  ],
  prompt: `${STYLE}. ${subject}. Wide composition, negative space at the lower third for caption text.`,
});
RASTER.push({
  id: 'folio-map', pipeline: 'imagegen', dir: 'map', genSize: '768x1344',
  out: [
    { file: 'folio-map.webp', width: 1080, height: 1600, primary: true },
    { file: 'folio-map.png', width: 1080, height: 1600, primary: false },
  ],
  prompt: `${STYLE}. An engraved city map of Novem, a walled medieval city on a river, nine distinct districts separated by canals and walls arranged in three rings of three, city gate sealed with chains, no labels, no text, tall vertical composition, generous parchment margins.`,
});
RASTER.push({
  id: 'og-image', pipeline: 'imagegen', dir: 'brand', genSize: '1440x736',
  out: [{ file: 'og-image.png', width: 1200, height: 630, primary: true }],
  prompt: `${STYLE}. A dark engraved banner: a stone tablet with a nine by nine grid and nine broken wax seals around it, a quill laid across, no text, wide composition.`,
});
RASTER.push({
  id: 'app-icon', pipeline: 'imagegen', dir: 'brand', genSize: '1024x1024',
  out: [{ file: 'app-icon-master.png', width: 1024, height: 1024, primary: true }],
  prompt: `${STYLE}. An oxblood wax seal stamped on parchment bearing a fleur-de-lis and a ring of nine small marks, centered, square composition, dark background.`,
});

// ---------------------------------------------------------------- procedural assets
const P = (id, dir, file, factory, width, height, prompt, extra = {}) => ({
  id, pipeline: 'procedural', dir, factory, width, height,
  out: [{ file, width, height, primary: true }],
  prompt, ...extra,
});

// 24 achievements: [id, title, engraved motif]
export const ACHIEVEMENT_ICONS = [
  ['first-blood', 'First Verdict', 'axe'],
  ['clean-hand', 'A Clean Hand', 'quill'],
  ['seal-breaker', 'Seal-Breaker', 'broken-seal'],
  ['row-lord', 'Lord of Rows', 'ruled-line'],
  ['column-saint', 'Saint of Columns', 'pillar'],
  ['box-wright', 'Box-Wright', 'grid'],
  ['flinchless', 'Unflinching', 'steady-hand'],
  ['tide-turner', 'Tide-Turner', 'wave'],
  ['hush-proof', 'Unspoken', 'finger-lips'],
  ['unchained', 'Unchained', 'broken-chain'],
  ['miasma-walker', 'Miasma-Walker', 'censer'],
  ['smudge-reader', 'Reader of Blots', 'smeared-page'],
  ['augur-faithful', 'Augur-Faithful', 'eye'],
  ['reckoning-dealt', 'Reckoning Dealt', 'sun-axe'],
  ['warden-sworn', 'Sworn to the Lantern', 'lantern'],
  ['scholar-sworn', 'Sworn to the Quill', 'open-book'],
  ['executioner-sworn', 'Sworn to the Axe', 'great-axe'],
  ['apothecary-sworn', 'Sworn to the Vial', 'vial'],
  ['folio-first', 'The First Folio', 'rope-and-blade'],
  ['folio-fifth', 'Halfway Hanged', 'compass'],
  ['folio-ninth', 'The Ninth Seal Broken', 'nine-seals'],
  ['daily-ember', 'Daily Ember', 'candle'],
  ['streak-seven', 'Seven Unbroken', 'candle-ring'],
  ['ledger-keeper', 'Keeper of the Ledger', 'scales'],
];

const sealWaxes = ['oxblood', 'black', 'verdigris', 'gilt', 'ash'];
const waxColors = { oxblood: '#7B1A1F', black: '#17171A', verdigris: '#3E6B5A', gilt: '#A58849', ash: '#8D8A82' };
const stamps = ['fleur', 'tau', 'laurel', 'crown', 'tower', 'scale'];
const PROCEDURAL = [
  // textures
  ...['aged-vellum', 'bone', 'slate', 'plague-linen', 'tallow', 'cathedral-rubric'].map((t, i) =>
    P(`texture-parchment-${t}`, 'textures', `parchment-${t}.svg`, 'texParchment', 1024, 1024,
      `Seamless engraved parchment texture, theme ${t}`, { variant: i })),
  P('texture-charcoal-paper', 'textures', 'charcoal-paper.svg', 'texCharcoal', 1024, 1024, 'Seamless charcoal paper texture'),
  P('texture-brass-plate', 'textures', 'brass-plate.svg', 'texBrass', 1024, 1024, 'Seamless engraved brass plate texture'),
  P('texture-worn-leather', 'textures', 'worn-leather.svg', 'texLeather', 1024, 1024, 'Seamless worn leather texture'),
  // board parts
  P('board-grid-line', 'board', 'grid-line.svg', 'gridLine', 64, 64, 'Ink line brush tile for grid'),
  P('board-box-line', 'board', 'box-line.svg', 'boxLine', 64, 64, 'Thick box ink line brush tile'),
  P('board-corner-ne', 'board', 'corner-ne.svg', 'cornerOrnament', 96, 96, 'Corner ornament', { rot: 0 }),
  P('board-corner-nw', 'board', 'corner-nw.svg', 'cornerOrnament', 96, 96, 'Corner ornament', { rot: 90 }),
  P('board-corner-se', 'board', 'corner-se.svg', 'cornerOrnament', 96, 96, 'Corner ornament', { rot: 270 }),
  P('board-corner-sw', 'board', 'corner-sw.svg', 'cornerOrnament', 96, 96, 'Corner ornament', { rot: 180 }),
  P('board-gutter-strip', 'board', 'gutter-strip.svg', 'gutterStrip', 48, 512, 'Margin gutter strip for claim stamps'),
  // wax seals 5 x 3 states
  ...sealWaxes.flatMap((w) => ['intact', 'cracked', 'broken'].map((s) =>
    P(`seal-${w}-${s}`, 'seals', `seal-${w}-${s}.svg`, 'waxSeal', 128, 128,
      `Wax seal ${w} ${s}`, { wax: waxColors[w], state: s }))),
  // claim stamps 6 designs (fleur = player, tau = opponent, 4 alternates)
  ...stamps.map((s) => P(`stamp-${s}`, 'seals/stamps', `stamp-${s}.svg`, 'claimStamp', 128, 128,
    `Claim stamp ${s}`, { design: s })),
  // overlays
  P('overlay-strike-1', 'overlays', 'strike-1.svg', 'brushStrike', 256, 256, 'Red brush strike variant 1', { variant: 0 }),
  P('overlay-strike-2', 'overlays', 'strike-2.svg', 'brushStrike', 256, 256, 'Red brush strike variant 2', { variant: 1 }),
  P('overlay-strike-3', 'overlays', 'strike-3.svg', 'brushStrike', 256, 256, 'Red brush strike variant 3', { variant: 2 }),
  P('overlay-chain', 'overlays', 'chain.svg', 'chainOverlay', 256, 256, 'Brass padlock and chain overlay'),
  P('overlay-smudge', 'overlays', 'smudge.svg', 'smudgeBlot', 256, 256, 'Ink smudge blot overlay'),
  P('overlay-hush', 'overlays', 'hush.svg', 'hushSeal', 256, 256, 'Wax finger-seal overlay for Hush'),
  P('overlay-miasma', 'overlays', 'miasma.svg', 'miasmaHatch', 256, 256, 'Censer smoke hatching overlay'),
  P('overlay-quarantine', 'overlays', 'quarantine.svg', 'quarantineStripe', 256, 64, 'Hazard gutter stripe for Quarantine'),
  P('overlay-hush-icon', 'overlays', 'hush-icon.svg', 'statusIcon', 128, 128, 'Hush status icon', { status: 'hush' }),
  // ability sigils (12)
  ...['eye', 'key', 'quill', 'dagger', 'hourglass', 'axe', 'vial', 'cup', 'censer', 'shield', 'lantern', 'bar'].map((s) =>
    P(`sigil-${s}`, 'sigils', `sigil-${s}.svg`, 'sigil', 128, 128, `Engraved ability sigil: ${s}`, { sigil: s })),
  // status icons (5)
  ...['chain', 'smudge', 'hush', 'miasma', 'quarantine'].map((s) =>
    P(`status-${s}`, 'statuses', `status-${s}.svg`, 'statusIcon', 128, 128, `Status icon: ${s}`, { status: s })),
  // ui kit
  P('ui-num-tile-normal', 'ui', 'num-tile-normal.svg', 'numTile', 128, 128, 'Number tile, normal', { state: 'normal' }),
  P('ui-num-tile-pressed', 'ui', 'num-tile-pressed.svg', 'numTile', 128, 128, 'Number tile, pressed', { state: 'pressed' }),
  P('ui-num-tile-disabled', 'ui', 'num-tile-disabled.svg', 'numTile', 128, 128, 'Number tile, disabled', { state: 'disabled' }),
  P('ui-num-tile-complete', 'ui', 'num-tile-complete.svg', 'numTile', 128, 128, 'Number tile, complete', { state: 'complete' }),
  P('ui-ability-tile', 'ui', 'ability-tile.svg', 'abilityTile', 128, 128, 'Ability tile frame'),
  P('ui-btn-primary-normal', 'ui', 'btn-primary-normal.svg', 'button', 320, 88, 'Primary button normal', { kind: 'primary', state: 'normal' }),
  P('ui-btn-primary-pressed', 'ui', 'btn-primary-pressed.svg', 'button', 320, 88, 'Primary button pressed', { kind: 'primary', state: 'pressed' }),
  P('ui-btn-primary-disabled', 'ui', 'btn-primary-disabled.svg', 'button', 320, 88, 'Primary button disabled', { kind: 'primary', state: 'disabled' }),
  P('ui-btn-secondary-normal', 'ui', 'btn-secondary-normal.svg', 'button', 320, 88, 'Secondary button normal', { kind: 'secondary', state: 'normal' }),
  P('ui-btn-secondary-pressed', 'ui', 'btn-secondary-pressed.svg', 'button', 320, 88, 'Secondary button pressed', { kind: 'secondary', state: 'pressed' }),
  P('ui-btn-secondary-disabled', 'ui', 'btn-secondary-disabled.svg', 'button', 320, 88, 'Secondary button disabled', { kind: 'secondary', state: 'disabled' }),
  P('ui-panel-parchment', 'ui', 'panel-parchment.svg', 'panelParchment', 480, 320, '9-slice parchment panel'),
  P('ui-frame-brass', 'ui', 'frame-brass.svg', 'frameBrass', 480, 320, '9-slice brass frame'),
  P('ui-divider-1', 'ui', 'divider-1.svg', 'divider', 320, 24, 'Divider ornament 1', { variant: 0 }),
  P('ui-divider-2', 'ui', 'divider-2.svg', 'divider', 320, 24, 'Divider ornament 2', { variant: 1 }),
  P('ui-divider-3', 'ui', 'divider-3.svg', 'divider', 320, 24, 'Divider ornament 3', { variant: 2 }),
  P('ui-divider-4', 'ui', 'divider-4.svg', 'divider', 320, 24, 'Divider ornament 4', { variant: 3 }),
  P('ui-divider-5', 'ui', 'divider-5.svg', 'divider', 320, 24, 'Divider ornament 5', { variant: 4 }),
  P('ui-corner-1', 'ui', 'corner-1.svg', 'uiCorner', 96, 96, 'Corner flourish 1', { variant: 0 }),
  P('ui-corner-2', 'ui', 'corner-2.svg', 'uiCorner', 96, 96, 'Corner flourish 2', { variant: 1 }),
  P('ui-corner-3', 'ui', 'corner-3.svg', 'uiCorner', 96, 96, 'Corner flourish 3', { variant: 2 }),
  P('ui-corner-4', 'ui', 'corner-4.svg', 'uiCorner', 96, 96, 'Corner flourish 4', { variant: 3 }),
  P('ui-medallion', 'ui', 'medallion.svg', 'medallion', 128, 128, 'Roman numeral medallion frame'),
  P('ui-tab-ribbon', 'ui', 'tab-ribbon.svg', 'tabRibbon', 512, 112, 'Bottom tab ribbon'),
  P('ui-toggle', 'ui', 'toggle.svg', 'toggle', 128, 72, 'Toggle switch, off and on states shown'),
  P('ui-slider', 'ui', 'slider.svg', 'slider', 320, 72, 'Slider track and thumb'),
  P('ui-modal-sheet', 'ui', 'modal-sheet.svg', 'modalSheet', 480, 640, 'Modal parchment sheet'),
  P('ui-toast', 'ui', 'toast.svg', 'toast', 480, 96, 'Toast banner'),
  P('ui-pip', 'ranks', 'pip.svg', 'divisionPip', 64, 64, 'Division pip (filled and empty halves in one file)'),
  // rank emblems (8)
  ...['scrivener', 'clerk', 'notary', 'advocate', 'magistrate', 'high-magistrate', 'justiciar', 'lord-of-the-assize'].map((r, i) =>
    P(`rank-${r}`, 'ranks', `rank-${r}.svg`, 'rankEmblem', 192, 192, `Rank emblem: ${r}`, { rank: i })),
  // currency icons
  P('icon-ink-drop', 'icons', 'ink-drop.svg', 'inkDrop', 128, 128, 'Ink drop currency icon'),
  P('icon-sigil-coin', 'icons', 'sigil-coin.svg', 'sigilCoin', 128, 128, 'Sigil coin currency icon'),
  // achievements (24) — see docs/BALANCE.md for criteria; icon = engraved emblem
  ...ACHIEVEMENT_ICONS.map((a) => P(`achievement-${a[0]}`, 'achievements', `achievement-${a[0]}.svg`, 'achievementIcon', 128, 128, `Achievement icon: ${a[1]}`, { motif: a[2] })),
  // reliquary
  P('reliquary-chest-closed', 'reliquary', 'chest-closed.svg', 'chest', 256, 256, 'Reliquary chest closed', { state: 0 }),
  ...[1, 2, 3, 4, 5, 6].map((s) => P(`reliquary-chest-opening-${s}`, 'reliquary', `chest-opening-${s}.svg`, 'chest', 256, 256, 'Reliquary chest opening frame', { state: s })),
  P('reliquary-chest-open', 'reliquary', 'chest-open.svg', 'chest', 256, 256, 'Reliquary chest open', { state: 7 }),
  P('reliquary-candle-unlit', 'reliquary', 'candle-unlit.svg', 'candle', 128, 128, 'Streak candle unlit', { state: 'unlit' }),
  P('reliquary-candle-lit', 'reliquary', 'candle-lit.svg', 'candle', 128, 128, 'Streak candle lit', { state: 'lit' }),
  P('reliquary-candle-gutter', 'reliquary', 'candle-gutter.svg', 'candle', 128, 128, 'Streak candle guttering', { state: 'gutter' }),
  // brand procedural
  P('brand-wordmark', 'brand', 'wordmark.svg', 'wordmark', 640, 200, 'ASSIZE wordmark, engraved caps with rule and seal'),
  P('brand-favicon', 'brand', 'favicon.svg', 'faviconSvg', 64, 64, 'Favicon: oxblood seal with fleur'),
];

export const ALL = [...RASTER, ...PROCEDURAL];

// ---------------------------------------------------------------- write manifest
if (import.meta.main) {
  const manifestPath = path.join(ROOT, 'assets/manifest.json');
  const prev = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { generated: null, assets: [] };
  const prevById = Object.fromEntries((prev.assets || []).map((a) => [a.id, a]));
  const assets = ALL.map((a) => {
    const p = prevById[a.id] || {};
    return {
      id: a.id,
      path: `/assets/${a.dir}/${a.out[0].file}`,
      status: p.status || 'pending',
      pipeline: a.pipeline,
      prompt: a.prompt,
      width: a.out[0].width,
      height: a.out[0].height,
      bytes: p.bytes || null,
      generatedAt: p.generatedAt || null,
    };
  });
  fs.writeFileSync(manifestPath, JSON.stringify({ generated: prev.generated, assets }, null, 2));
  console.log(`manifest: ${assets.length} assets (${assets.filter((a) => a.pipeline === 'imagegen').length} imagegen, ${assets.filter((a) => a.pipeline === 'procedural').length} procedural)`);
}
