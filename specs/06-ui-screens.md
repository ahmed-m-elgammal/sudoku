# 06 — UI / Screens Port

> **Corrected 2026-10-06.** The *Navigation* section below originally specified Expo Router
> (file-based). That recommendation was **wrong for this codebase** and is replaced — see
> `14-deep-codebase-analysis.md` §2 Finding A. Verified against source:
> `src/state/ui.ts:6-13` declares the `Screen` union and `src/app/game/GameShell.tsx` is a
> literal `switch` over it. Everything else in this document stands.

## Navigation — KEEP THE ZUSTAND SCREEN MACHINE

**There is no router in the web build, and the port must not add one.**

`src/state/ui.ts` holds `screen: Screen` (24 variants) plus `go(screen, payload)`.
`GameShell.tsx` is a `switch (screen) { case 'boot': return <BootScreen/>; ... }` over 22
branches (`'duel'` and `'tutorial'` share one branch). `src/app/page.tsx` is 7 lines that
render the shell. There is no URL, no route segment, no file-based routing for the game.

**Decision: port `ui.ts` + the switch (~100 lines).** This reproduces navigation behaviour
*exactly*, including three things a router cannot give us for free:

- `prev` + `direction` — the page-turn variant that alternates on every `go()`. `direction * -1`
  is what the Ribbon/StoryCard turn animation reads.
- the **story-payload channel** — `StoryPayload { lines, plate, then, campaignIndex, ending }`
  carries the *next* screen inside the payload, so a story beat and its successor are one atomic
  `go()` rather than two navigations a router would race.
- the boot rule — `boot()` lands **directly in the tutorial duel** (spec R1), no menu, no splash.

Adding Expo Router/React Navigation would introduce navigation state, deep-link handling and
back-button semantics the game does not have today — pure cost.

### The 24 `Screen` variants

```
boot · duel · tutorial · antechamber · orders · matchmaking · versus · result
reliquary · folioMap · folioDetail · daily · cabinet · season · ledger · settings
offline · story · purse · friend · endingChoice · echoes · endless · weekly
```

Port target: `src/ui/screens/*.tsx` — plain components that read `useUi()` and call
`ui.go('antechamber')`.

### One new behaviour: Android hardware back

The web build never needed this. Wire the Android hardware back button to `ui.goBack()` in
`GameShell` (already done in `mobile/src/ui/GameShell.tsx`).

## The board (the hard part)
- `Board.tsx` → a `9×9` RN `View` grid (or one `<svg>` via react-native-svg). SVG is recommended: the tablet art is SVG/texture-heavy, strokes are crisp on all densities, and overlays (smudge/miasma/quarantine/chain SVGs) already ship as assets.
- `NumPad.tsx` → 44 px+ touch targets (spec already demands this); long-press = note mode or modal-less toggle.
- Input: tap cell → tap numeral (current law); **hardware keyboard** support via RN's `useHardwareKeyboard` (iPad) — keyboard parity is a nice accessibility story.
- Gestures: keep it simple and fast — tap-only like the web build. Swipe is rejected for digit entry (accidental placements and Seal damage).

## Animation parity (J1–J4, the juice track)
Web: CSS keyframes + custom properties in `Duel.module.css`, reduced-motion kill-list, `transform`/`opacity`/`background-color` only.
RN: **Reanimated 4** equivalents (`react-native-reanimated` 4.5.1 + **mandatory** `react-native-worklets` 0.10.1 — Reanimated 4 will not run without it, and the babel plugin must be wired):
- Ink flood (J1): per-cell opacity/background worklet driven by `cellsOfFlood` cascade.
- Screen shake (J2): `useAnimatedStyle` + `withRepeat`/`withSequence` on board wrap.
- Hit-stop (J3): ` Easing` + a 100 ms input gate (a `inputLocked` boolean fed by `Cue` in `src/game/fx.ts` — the pure fx laws port as-is, just swap the sink).
- Heat (J4): `--heat` becomes a shared value driving a `useDerivedValue` for vignette opacity + warm border color via `interpolateColor`.
- Reduced-motion: read `AccessibilityInfo.isReduceMotionEnabled` on boot and set the same `data-motion='reduced'` equivalent — the CSS kill-list becomes a Reanimated guard clause.

**Do not re-derive any animation logic.** `src/game/fx.ts` is a verbatim copy of the web build's
pure law — engine events in, plain data out (`Flood`, `Shake`, `HitStop`, `Heat`), no React, no
DOM, no CSS, pinned by `../tests/juice.test.ts`. The port only *applies* those four values to
Reanimated shared values. `Cue<T>` owns expiry; do not reimplement timers.

**Version risk (R3 in `14` §7):** if Reanimated 4 + worklets misconfigures, the fallback is RN's
built-in `Animated`. Pin versions and verify with `npx expo export --platform all` at the
integration gate.

## tokens.css → token module
Port `src/styles/tokens.css` into `src/theme/tokens.ts` (colors, font sizes, spacing). All 600+ style usages reference these; a single tokens module keeps the port mechanical.

**Hard rule:** no hex / `rgb()` / `rgba()` / `hsl()` literal anywhere in `mobile/src/**`
outside `src/theme/` — this is ESLint-enforced. If a colour is missing, add it to `tokens.ts`
first, then use it.

## Fonts & assets
- **Decision (settled):** the 6 `.woff2` files are **not** converted. RN needs `.ttf`/`.otf`,
  and converting them is pure risk for zero design benefit when the exact families are already
  on Google Fonts. Use `@expo-google-fonts/im-fell-english` + `@expo-google-fonts/libre-caslon`
  (same families: IM Fell English SC, IM Fell DW Pica, Libre Caslon Text — all OFL).
  The `.woff2` originals remain in `mobile/assets/fonts/` as the record of what was shipped.
- **Asset inventory: `public/assets/` = 210 files, 17.67 MB** (140 `.svg`, 38 `.png`, 32 `.webp`).
  Plus `public/fonts/` (6) and 4 PWA files at the `public/` root = **220 files** in `public/`.
  Already copied byte-identical to `mobile/assets/game/` (210 files, 17.67 MB) — do not re-copy.
- `assets/manifest.json` has **173 entries** — the asset *slots* the pipeline declares, which is
  a different number from the 210 files on disk. `tools/asset-data.mjs` describes each; reuse it.
- **React Native cannot `require()` an `.svg`.** All SVG chrome (seals, sigils, board furniture,
  status overlays) must render through `react-native-svg` (`SvgXml` with file content, or `SvgUri`).
  PNG/WebP go through `require()` via `src/theme/assets.ts`.
- The map (`folio-map.webp` 1.15 MB) and plates are heavy — keep the WebP twins and lazy-load.

## Web-only surfaces to replace
- **Modals: the web build does NOT use shadcn/ui.** Verified — zero imports of `components/ui/*`
  from `src/app/game/**`. The 48-file shadcn kit is dead scaffolding. Every modal is hand-rolled:
  a local `Modal` component plus `<div className="modal-backdrop" role="dialog" aria-modal="true">`
  (`DuelScreen.tsx:449`, `CabinetScreen.tsx:155`, `EchoesScreen.tsx:197,222`, `EndingChoice.tsx:140`)
  and `<div role="alertdialog">` for the S08 disconnect countdown (`DuelScreen.tsx:378`).
  RN: plain `Modal` + the same ARIA roles as `accessibilityRole`/`accessibilityViewIsModal`.
  Same backdrop, same dismissal law, same a11y semantics.
- `OfflineScreen` → expo-network listener.
- Export/import (ledger, echo chits, settings) → `expo-file-system` + `expo-sharing` + `expo-clipboard`.
- Service worker precache → EAS assets + `expo-updates` OTA (the "offline play" requirement is satisfied by the engine being local).
- **Tailwind is not used by the game** — verified: zero utility classes in any game screen.
  `tailwind.config.ts` points at `./pages/**`, `./components/**`, `./app/**` while the real code is
  `src/app/**`, so it scans nothing. `Duel.module.css` + `src/styles/*.css` are the entire
  styling system. Do not port a Tailwind/NativeWind layer.

## Story content
`docs/STORY.md`, `src/i18n/story.json`, `en.json` port untouched — they're data.
