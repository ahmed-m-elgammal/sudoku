# ASSIZE — ready-to-run prompts for painted replacements

Prepend STYLE_PREFIX to every prompt (spec §9 pipeline C). These cover every `procedural` asset in manifest.json; run them through any image model, crop to the listed size, and drop the file at the listed path, then flip the manifest status to `generated`.

## STYLE_PREFIX

```
Linocut and woodcut engraving, hand-inked cross-hatching, aged paper grain, restrained palette of charcoal black, parchment, muted brass and a single oxblood red accent, matte flat lighting, mature dark-fantasy, no glow, no gradients, no neon, no 3D render, no cartoon, no text or numerals in the image.
```

- **texture-parchment-aged-vellum** → `/assets/textures/parchment-aged-vellum.svg` (1024x1024)
  Seamless engraved parchment texture, theme aged-vellum
- **texture-parchment-bone** → `/assets/textures/parchment-bone.svg` (1024x1024)
  Seamless engraved parchment texture, theme bone
- **texture-parchment-slate** → `/assets/textures/parchment-slate.svg` (1024x1024)
  Seamless engraved parchment texture, theme slate
- **texture-parchment-plague-linen** → `/assets/textures/parchment-plague-linen.svg` (1024x1024)
  Seamless engraved parchment texture, theme plague-linen
- **texture-parchment-tallow** → `/assets/textures/parchment-tallow.svg` (1024x1024)
  Seamless engraved parchment texture, theme tallow
- **texture-parchment-cathedral-rubric** → `/assets/textures/parchment-cathedral-rubric.svg` (1024x1024)
  Seamless engraved parchment texture, theme cathedral-rubric
- **texture-charcoal-paper** → `/assets/textures/charcoal-paper.svg` (1024x1024)
  Seamless charcoal paper texture
- **texture-brass-plate** → `/assets/textures/brass-plate.svg` (1024x1024)
  Seamless engraved brass plate texture
- **texture-worn-leather** → `/assets/textures/worn-leather.svg` (1024x1024)
  Seamless worn leather texture
- **board-grid-line** → `/assets/board/grid-line.svg` (64x64)
  Ink line brush tile for grid
- **board-box-line** → `/assets/board/box-line.svg` (64x64)
  Thick box ink line brush tile
- **board-corner-ne** → `/assets/board/corner-ne.svg` (96x96)
  Corner ornament
- **board-corner-nw** → `/assets/board/corner-nw.svg` (96x96)
  Corner ornament
- **board-corner-se** → `/assets/board/corner-se.svg` (96x96)
  Corner ornament
- **board-corner-sw** → `/assets/board/corner-sw.svg` (96x96)
  Corner ornament
- **board-gutter-strip** → `/assets/board/gutter-strip.svg` (48x512)
  Margin gutter strip for claim stamps
- **seal-oxblood-intact** → `/assets/seals/seal-oxblood-intact.svg` (128x128)
  Wax seal oxblood intact
- **seal-oxblood-cracked** → `/assets/seals/seal-oxblood-cracked.svg` (128x128)
  Wax seal oxblood cracked
- **seal-oxblood-broken** → `/assets/seals/seal-oxblood-broken.svg` (128x128)
  Wax seal oxblood broken
- **seal-black-intact** → `/assets/seals/seal-black-intact.svg` (128x128)
  Wax seal black intact
- **seal-black-cracked** → `/assets/seals/seal-black-cracked.svg` (128x128)
  Wax seal black cracked
- **seal-black-broken** → `/assets/seals/seal-black-broken.svg` (128x128)
  Wax seal black broken
- **seal-verdigris-intact** → `/assets/seals/seal-verdigris-intact.svg` (128x128)
  Wax seal verdigris intact
- **seal-verdigris-cracked** → `/assets/seals/seal-verdigris-cracked.svg` (128x128)
  Wax seal verdigris cracked
- **seal-verdigris-broken** → `/assets/seals/seal-verdigris-broken.svg` (128x128)
  Wax seal verdigris broken
- **seal-gilt-intact** → `/assets/seals/seal-gilt-intact.svg` (128x128)
  Wax seal gilt intact
- **seal-gilt-cracked** → `/assets/seals/seal-gilt-cracked.svg` (128x128)
  Wax seal gilt cracked
- **seal-gilt-broken** → `/assets/seals/seal-gilt-broken.svg` (128x128)
  Wax seal gilt broken
- **seal-ash-intact** → `/assets/seals/seal-ash-intact.svg` (128x128)
  Wax seal ash intact
- **seal-ash-cracked** → `/assets/seals/seal-ash-cracked.svg` (128x128)
  Wax seal ash cracked
- **seal-ash-broken** → `/assets/seals/seal-ash-broken.svg` (128x128)
  Wax seal ash broken
- **stamp-fleur** → `/assets/seals/stamps/stamp-fleur.svg` (128x128)
  Claim stamp fleur
- **stamp-tau** → `/assets/seals/stamps/stamp-tau.svg` (128x128)
  Claim stamp tau
- **stamp-laurel** → `/assets/seals/stamps/stamp-laurel.svg` (128x128)
  Claim stamp laurel
- **stamp-crown** → `/assets/seals/stamps/stamp-crown.svg` (128x128)
  Claim stamp crown
- **stamp-tower** → `/assets/seals/stamps/stamp-tower.svg` (128x128)
  Claim stamp tower
- **stamp-scale** → `/assets/seals/stamps/stamp-scale.svg` (128x128)
  Claim stamp scale
- **overlay-strike-1** → `/assets/overlays/strike-1.svg` (256x256)
  Red brush strike variant 1
- **overlay-strike-2** → `/assets/overlays/strike-2.svg` (256x256)
  Red brush strike variant 2
- **overlay-strike-3** → `/assets/overlays/strike-3.svg` (256x256)
  Red brush strike variant 3
- **overlay-chain** → `/assets/overlays/chain.svg` (256x256)
  Brass padlock and chain overlay
- **overlay-smudge** → `/assets/overlays/smudge.svg` (256x256)
  Ink smudge blot overlay
- **overlay-hush** → `/assets/overlays/hush.svg` (256x256)
  Wax finger-seal overlay for Hush
- **overlay-miasma** → `/assets/overlays/miasma.svg` (256x256)
  Censer smoke hatching overlay
- **overlay-quarantine** → `/assets/overlays/quarantine.svg` (256x64)
  Hazard gutter stripe for Quarantine
- **overlay-hush-icon** → `/assets/overlays/hush-icon.svg` (128x128)
  Hush status icon
- **sigil-eye** → `/assets/sigils/sigil-eye.svg` (128x128)
  Engraved ability sigil: eye
- **sigil-key** → `/assets/sigils/sigil-key.svg` (128x128)
  Engraved ability sigil: key
- **sigil-quill** → `/assets/sigils/sigil-quill.svg` (128x128)
  Engraved ability sigil: quill
- **sigil-dagger** → `/assets/sigils/sigil-dagger.svg` (128x128)
  Engraved ability sigil: dagger
- **sigil-hourglass** → `/assets/sigils/sigil-hourglass.svg` (128x128)
  Engraved ability sigil: hourglass
- **sigil-axe** → `/assets/sigils/sigil-axe.svg` (128x128)
  Engraved ability sigil: axe
- **sigil-vial** → `/assets/sigils/sigil-vial.svg` (128x128)
  Engraved ability sigil: vial
- **sigil-cup** → `/assets/sigils/sigil-cup.svg` (128x128)
  Engraved ability sigil: cup
- **sigil-censer** → `/assets/sigils/sigil-censer.svg` (128x128)
  Engraved ability sigil: censer
- **sigil-shield** → `/assets/sigils/sigil-shield.svg` (128x128)
  Engraved ability sigil: shield
- **sigil-lantern** → `/assets/sigils/sigil-lantern.svg` (128x128)
  Engraved ability sigil: lantern
- **sigil-bar** → `/assets/sigils/sigil-bar.svg` (128x128)
  Engraved ability sigil: bar
- **status-chain** → `/assets/statuses/status-chain.svg` (128x128)
  Status icon: chain
- **status-smudge** → `/assets/statuses/status-smudge.svg` (128x128)
  Status icon: smudge
- **status-hush** → `/assets/statuses/status-hush.svg` (128x128)
  Status icon: hush
- **status-miasma** → `/assets/statuses/status-miasma.svg` (128x128)
  Status icon: miasma
- **status-quarantine** → `/assets/statuses/status-quarantine.svg` (128x128)
  Status icon: quarantine
- **ui-num-tile-normal** → `/assets/ui/num-tile-normal.svg` (128x128)
  Number tile, normal
- **ui-num-tile-pressed** → `/assets/ui/num-tile-pressed.svg` (128x128)
  Number tile, pressed
- **ui-num-tile-disabled** → `/assets/ui/num-tile-disabled.svg` (128x128)
  Number tile, disabled
- **ui-num-tile-complete** → `/assets/ui/num-tile-complete.svg` (128x128)
  Number tile, complete
- **ui-ability-tile** → `/assets/ui/ability-tile.svg` (128x128)
  Ability tile frame
- **ui-btn-primary-normal** → `/assets/ui/btn-primary-normal.svg` (320x88)
  Primary button normal
- **ui-btn-primary-pressed** → `/assets/ui/btn-primary-pressed.svg` (320x88)
  Primary button pressed
- **ui-btn-primary-disabled** → `/assets/ui/btn-primary-disabled.svg` (320x88)
  Primary button disabled
- **ui-btn-secondary-normal** → `/assets/ui/btn-secondary-normal.svg` (320x88)
  Secondary button normal
- **ui-btn-secondary-pressed** → `/assets/ui/btn-secondary-pressed.svg` (320x88)
  Secondary button pressed
- **ui-btn-secondary-disabled** → `/assets/ui/btn-secondary-disabled.svg` (320x88)
  Secondary button disabled
- **ui-panel-parchment** → `/assets/ui/panel-parchment.svg` (480x320)
  9-slice parchment panel
- **ui-frame-brass** → `/assets/ui/frame-brass.svg` (480x320)
  9-slice brass frame
- **ui-divider-1** → `/assets/ui/divider-1.svg` (320x24)
  Divider ornament 1
- **ui-divider-2** → `/assets/ui/divider-2.svg` (320x24)
  Divider ornament 2
- **ui-divider-3** → `/assets/ui/divider-3.svg` (320x24)
  Divider ornament 3
- **ui-divider-4** → `/assets/ui/divider-4.svg` (320x24)
  Divider ornament 4
- **ui-divider-5** → `/assets/ui/divider-5.svg` (320x24)
  Divider ornament 5
- **ui-corner-1** → `/assets/ui/corner-1.svg` (96x96)
  Corner flourish 1
- **ui-corner-2** → `/assets/ui/corner-2.svg` (96x96)
  Corner flourish 2
- **ui-corner-3** → `/assets/ui/corner-3.svg` (96x96)
  Corner flourish 3
- **ui-corner-4** → `/assets/ui/corner-4.svg` (96x96)
  Corner flourish 4
- **ui-medallion** → `/assets/ui/medallion.svg` (128x128)
  Roman numeral medallion frame
- **ui-tab-ribbon** → `/assets/ui/tab-ribbon.svg` (512x112)
  Bottom tab ribbon
- **ui-toggle** → `/assets/ui/toggle.svg` (128x72)
  Toggle switch, off and on states shown
- **ui-slider** → `/assets/ui/slider.svg` (320x72)
  Slider track and thumb
- **ui-modal-sheet** → `/assets/ui/modal-sheet.svg` (480x640)
  Modal parchment sheet
- **ui-toast** → `/assets/ui/toast.svg` (480x96)
  Toast banner
- **ui-pip** → `/assets/ranks/pip.svg` (64x64)
  Division pip (filled and empty halves in one file)
- **rank-scrivener** → `/assets/ranks/rank-scrivener.svg` (192x192)
  Rank emblem: scrivener
- **rank-clerk** → `/assets/ranks/rank-clerk.svg` (192x192)
  Rank emblem: clerk
- **rank-notary** → `/assets/ranks/rank-notary.svg` (192x192)
  Rank emblem: notary
- **rank-advocate** → `/assets/ranks/rank-advocate.svg` (192x192)
  Rank emblem: advocate
- **rank-magistrate** → `/assets/ranks/rank-magistrate.svg` (192x192)
  Rank emblem: magistrate
- **rank-high-magistrate** → `/assets/ranks/rank-high-magistrate.svg` (192x192)
  Rank emblem: high-magistrate
- **rank-justiciar** → `/assets/ranks/rank-justiciar.svg` (192x192)
  Rank emblem: justiciar
- **rank-lord-of-the-assize** → `/assets/ranks/rank-lord-of-the-assize.svg` (192x192)
  Rank emblem: lord-of-the-assize
- **icon-ink-drop** → `/assets/icons/ink-drop.svg` (128x128)
  Ink drop currency icon
- **icon-sigil-coin** → `/assets/icons/sigil-coin.svg` (128x128)
  Sigil coin currency icon
- **achievement-first-blood** → `/assets/achievements/achievement-first-blood.svg` (128x128)
  Achievement icon: First Verdict
- **achievement-clean-hand** → `/assets/achievements/achievement-clean-hand.svg` (128x128)
  Achievement icon: A Clean Hand
- **achievement-seal-breaker** → `/assets/achievements/achievement-seal-breaker.svg` (128x128)
  Achievement icon: Seal-Breaker
- **achievement-row-lord** → `/assets/achievements/achievement-row-lord.svg` (128x128)
  Achievement icon: Lord of Rows
- **achievement-column-saint** → `/assets/achievements/achievement-column-saint.svg` (128x128)
  Achievement icon: Saint of Columns
- **achievement-box-wright** → `/assets/achievements/achievement-box-wright.svg` (128x128)
  Achievement icon: Box-Wright
- **achievement-flinchless** → `/assets/achievements/achievement-flinchless.svg` (128x128)
  Achievement icon: Unflinching
- **achievement-tide-turner** → `/assets/achievements/achievement-tide-turner.svg` (128x128)
  Achievement icon: Tide-Turner
- **achievement-hush-proof** → `/assets/achievements/achievement-hush-proof.svg` (128x128)
  Achievement icon: Unspoken
- **achievement-unchained** → `/assets/achievements/achievement-unchained.svg` (128x128)
  Achievement icon: Unchained
- **achievement-miasma-walker** → `/assets/achievements/achievement-miasma-walker.svg` (128x128)
  Achievement icon: Miasma-Walker
- **achievement-smudge-reader** → `/assets/achievements/achievement-smudge-reader.svg` (128x128)
  Achievement icon: Reader of Blots
- **achievement-augur-faithful** → `/assets/achievements/achievement-augur-faithful.svg` (128x128)
  Achievement icon: Augur-Faithful
- **achievement-reckoning-dealt** → `/assets/achievements/achievement-reckoning-dealt.svg` (128x128)
  Achievement icon: Reckoning Dealt
- **achievement-warden-sworn** → `/assets/achievements/achievement-warden-sworn.svg` (128x128)
  Achievement icon: Sworn to the Lantern
- **achievement-scholar-sworn** → `/assets/achievements/achievement-scholar-sworn.svg` (128x128)
  Achievement icon: Sworn to the Quill
- **achievement-executioner-sworn** → `/assets/achievements/achievement-executioner-sworn.svg` (128x128)
  Achievement icon: Sworn to the Axe
- **achievement-apothecary-sworn** → `/assets/achievements/achievement-apothecary-sworn.svg` (128x128)
  Achievement icon: Sworn to the Vial
- **achievement-folio-first** → `/assets/achievements/achievement-folio-first.svg` (128x128)
  Achievement icon: The First Folio
- **achievement-folio-fifth** → `/assets/achievements/achievement-folio-fifth.svg` (128x128)
  Achievement icon: Halfway Hanged
- **achievement-folio-ninth** → `/assets/achievements/achievement-folio-ninth.svg` (128x128)
  Achievement icon: The Ninth Seal Broken
- **achievement-daily-ember** → `/assets/achievements/achievement-daily-ember.svg` (128x128)
  Achievement icon: Daily Ember
- **achievement-streak-seven** → `/assets/achievements/achievement-streak-seven.svg` (128x128)
  Achievement icon: Seven Unbroken
- **achievement-ledger-keeper** → `/assets/achievements/achievement-ledger-keeper.svg` (128x128)
  Achievement icon: Keeper of the Ledger
- **reliquary-chest-closed** → `/assets/reliquary/chest-closed.svg` (256x256)
  Reliquary chest closed
- **reliquary-chest-opening-1** → `/assets/reliquary/chest-opening-1.svg` (256x256)
  Reliquary chest opening frame
- **reliquary-chest-opening-2** → `/assets/reliquary/chest-opening-2.svg` (256x256)
  Reliquary chest opening frame
- **reliquary-chest-opening-3** → `/assets/reliquary/chest-opening-3.svg` (256x256)
  Reliquary chest opening frame
- **reliquary-chest-opening-4** → `/assets/reliquary/chest-opening-4.svg` (256x256)
  Reliquary chest opening frame
- **reliquary-chest-opening-5** → `/assets/reliquary/chest-opening-5.svg` (256x256)
  Reliquary chest opening frame
- **reliquary-chest-opening-6** → `/assets/reliquary/chest-opening-6.svg` (256x256)
  Reliquary chest opening frame
- **reliquary-chest-open** → `/assets/reliquary/chest-open.svg` (256x256)
  Reliquary chest open
- **reliquary-candle-unlit** → `/assets/reliquary/candle-unlit.svg` (128x128)
  Streak candle unlit
- **reliquary-candle-lit** → `/assets/reliquary/candle-lit.svg` (128x128)
  Streak candle lit
- **reliquary-candle-gutter** → `/assets/reliquary/candle-gutter.svg` (128x128)
  Streak candle guttering
- **brand-wordmark** → `/assets/brand/wordmark.svg` (640x200)
  ASSIZE wordmark, engraved caps with rule and seal
- **brand-favicon** → `/assets/brand/favicon.svg` (64x64)
  Favicon: oxblood seal with fleur
