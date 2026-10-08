# ASSIZE — mobile app (React Native / Expo)

This is the **native port of ASSIZE**, a 1v1 sudoku-duel game. The full analysis of the
web build and the port strategy live in `../specs/`. Read these before writing code:

- `../specs/14-deep-codebase-analysis.md` — measured inventory, the 18 platform
  dependencies, the toolchain reality.
- `../specs/15-port-surface-map.md` — file-by-file verdict (VERBATIM / SHIM / REWRITE).
- `../specs/16-delegation-plan.md` — the ownership rules for parallel work.

## THE ONE RULE: this is a PORT, not a redesign

**Reproduce the web build's UI exactly. Nothing more, nothing less.**

You are not designing a mobile game. You are transliterating `../src/app/game/*.tsx`
into React Native, pixel-for-pixel, and your only licence is the platform translation
table below.

### Fidelity contract — do not deviate

| Must be identical | Why it is not yours to change |
|---|---|
| Every screen, in the same order, reachable the same way | the screen machine IS the navigation |
| Every piece of copy, from `src/i18n/en.json` / `story.json` | it is the game's voice; the story text is canon |
| Layout, spacing, order of elements, alignment, hierarchy | the visual design is signed off |
| Every asset, from the 222 real files in `assets/game/**` | same art, same crops |
| Every colour, from `src/theme/tokens.ts` (ported 1:1 from `tokens.css`) | the style bible is explicit |
| Every interaction, cooldown number, status duration, damage rule | the engine is in `shared/` and is not yours |
| Every animation's *timing and feel* (flood cascade 30 ms/cell, shake tiers 480/700 ms, hit-stop 100 ms, slow ink 300 ms, heat curve) | pinned by `../tests/juice.test.ts` |
| The seat law: **you = oxblood, foe = ash** | established by the Mirror strip |

### Forbidden "improvements"

- Do not add a screen, a tab, a button, a setting, a badge, a tooltip or a hint.
- Do not remove or merge anything, even if it looks redundant.
- Do not rename a label, "fix" awkward copy, or modernise the wording.
- Do not restyle a component because you think it looks better, or because a
  Material/iOS convention would differ.
- Do not swap an illustrated plate for a placeholder, or a portrait for an initial.
- Do not change game balance, fx timings, or the Ink/economy numbers.

### The ONLY permitted adaptations (platform translation, not design)

| Web | RN | Scope of the change |
|---|---|---|
| CSS Modules / `Duel.module.css` | `StyleSheet.create` + tokens | same values, same selectors' intent |
| CSS custom properties (`--heat`, `--flood-i`, `--shake-amp`) | Reanimated shared values | same driving values |
| `data-motion='reduced'` kill-list | `useMotionReduced()` guard | same settled state |
| CSS grid (`gridRow`/`gridColumn`) | flexbox or one `<svg>` at the same geometry | same pixel positions |
| `<button role="gridcell">` | `Pressable` + `accessibilityLabel` | same labels (port `cellAria` verbatim) |
| `window.addEventListener('keydown')` | iPad hardware-key handler only | phone play is tap-only, as on the web's touch path |
| `<a download>` / `execCommand('copy')` | share sheet / `expo-clipboard` | same user-visible outcome |
| `document.documentElement.dataset` | `useDisplaySettings()` | same three switches |
| `serviceWorker.register` | nothing | RN has no SW; offline play is inherent |
| Android hardware back | `ui.goBack()` | new only because a phone needs it |

If you believe the web UI has a genuine defect, **report it — do not fix it**. The
port's job is fidelity; defects are a separate decision.

## The three architecture rules that matter most

### 1. `shared/` is the engine and it is NOT yours to touch
`../shared/` is 2,866 lines of pure, deterministic, adversarially-hardened TypeScript with
345 passing tests. It is imported via the path alias `@shared/*` → `../shared/*`.

- **Never copy `shared/` into this project.** There is exactly one engine.
- **Never edit a file in `../shared/`.** If you believe the engine has a bug, report it;
  do not patch it. The web PWA consumes the same files.
- The engine suites run in this project's `npm test` (vitest) — including four suites
  (`crossOrder`, `echoShare`, `phaseScript`, `replay`) that are redirected to drive the
  **mobile** `LocalDuel`. Those four are the acceptance test for the runtime port.

### 2. There is no router. Navigation is a zustand state machine.
The web build has no URL routing for the game: `src/state/ui.ts` holds `screen: Screen`
(24 variants) and `GameShell` is a `switch` over it. **Keep that architecture.**

- Do **not** add Expo Router, React Navigation, or any navigator.
- Screens are plain components in `src/ui/screens/`. They read `useUi()` and call
  `ui.go('antechamber')`.
- Android hardware back is wired to `ui.goBack()` in `GameShell` — already done.
- (The create-expo-app template's stock AGENTS.md mandated Expo Router. That instruction
  is void here.)

### 3. Presentation law is already pure and tested. Do not re-derive it.
`src/game/fx.ts` is a verbatim copy of the web build's pure fx law: engine events in,
plain data out (`Flood`, `Shake`, `HitStop`, `Heat`). No React, no DOM, no CSS.

- Your job is to **apply** those values (Reanimated shared values), never to recompute them.
- `Cue<T>` owns expiry. Do not reimplement timers for shake/flood/hit-stop.
- Zero layout shift: animate `transform`, `opacity`, and `backgroundColor` only.
- Four web suites (`crossOrder`, `echoShare`, `phaseScript`, `replay`) already validate
  the runtime port. Do not edit them.

## Layout & style law

### No god files

A port that collapses into one 800-line screen is a failed port — it is unreviewable and
it cannot be split between agents. Rules:

- **One file, one responsibility.** A file named `DuelScreen.tsx` composes; it does not
  contain a cell renderer, a cooldown ring, an overlay and a verdict panel inline.
- **Ceiling: ~300 lines.** Past that, extract a named subcomponent into its own file in
  the same directory. Past ~450 is a review finding, not a style note.
- **No anonymous inline components** for anything with state or fx. A subcomponent with
  its own `useAnimatedStyle` gets its own file.
- **One export per file** unless the file is genuinely a type/barrel module.
- Composition happens in `DuelScreen.tsx` / `GameShell.tsx` and nowhere else.

The web build's 622-line `Duel.module.css` is the model to *avoid*: it is one stylesheet
for the whole duel. Split it by concern (`board.ts`, `hud.ts`, `overlays.ts`) or express
it as per-component `StyleSheet`s — the values must stay identical either way.

### No hardcoded colours or theme values

**Every** colour, font size, spacing value, radius and duration comes from
`@/theme/tokens`. This is lint-enforced: a hex (`#7b1a1f`), `rgb()`, `rgba()` or `hsl()`
literal anywhere in `src/**` outside `src/theme/` is an ESLint error. It will fail your
gate. Use instead:

- `palette.*` — the raw pigments (oxblood, ash, brass, parchment, …)
- `themeFor(settings)` — semantic colours incl. the high-contrast variant and the J4
  `cold` flood tints
- `seat.you` / `seat.foe` — the oxblood/ash law
- `type(scale)` — the type scale, which already multiplies by the player's text setting
- `layout.*` — hubMax, ribbonH, radius, radiusLg, touch (44), gutter, boardMin
- `motion.*` — fast/med/page durations

Same rule for the SVG assets: no `fill="#..."` inline — pull the colour from `palette`.

If a colour you need is not in `tokens.ts`, **add it to `tokens.ts` first**, then use it.
That is the only sanctioned way to grow the palette, and it keeps the addition visible
in review.

### The rest of the layout law
- Use **`StyleSheet.create`**. No NativeWind, no Tailwind, no inline style objects with
  literal values.
- No gradients, no glow, no shadows-as-glow — the art direction forbids them (see the
  "style bible" comments in the web build). Matte ink on parchment.
- Screens must not import the engine's internals (`@shared/engine`, `sudoku`, `rng`,
  `replay`, `personalShade`) — that is lint-enforced too. A screen renders the
  `DuelRuntime` surface and reads `@/game/fx` for presentation law.
- Honour the accessibility settings from `useSave().settings`: `reducedMotion`,
  `contrast`, `text` size, `leftHand`. Read `AccessibilityInfo.isReduceMotionEnabled()`
  at boot and treat it as an additional reduced-motion source.
- Touch targets ≥ 44 pt (`layout.touch`). Every board cell carries an
  `accessibilityLabel` (the web build already produces the strings — port `cellAria`
  from `Board.tsx`).
- Assets: use `require()` through the art registries (`src/theme/assets.ts` for story
  plates/portraits, `duelArt.ts` / `cabinetArt.ts` / `ledgerArt.ts` for the engraved
  kit), which point at the 222 real files copied from `../public/assets`. The engraved
  kit's SVG sources carry `feTurbulence`/`feDisplacementMap` filters that
  `react-native-svg` does NOT implement, and runtime XML-parsing of the kit per mount
  was the measured source of unsupported-filter warnings and 0 fps stalls — so native
  renders the **raster twins** baked by `tools/rasterize-game-art.mjs` (sharp/librsvg
  implements the full filter spec) through `src/ui/Art.tsx` (a native `<Image>`).
  `SvgUri`/`SvgXml` are banned (pinned by `src/ui/__tests__/artSeam.test.ts`);
  `react-native-svg` remains ONLY for procedural geometry (cooldown rings, the Ledger
  spark, seat circles).

## Platform seams — always go through `src/platform/`

The port surface is exactly 18 browser APIs (see `../specs/14` §3). You must not reach for
a global. Import the seam instead:

| Need | Import |
|---|---|
| key/value + list storage | `storage` from `@/platform/storage` |
| SHA-256, UUID, random | `sha256Hex`, `randomUuid` from `@/platform/crypto` |
| haptics | `haptics` from `@/platform/haptics` |
| sound | `audio` from `@/platform/audio` (18-method interface) |
| clipboard / share / file | `clipboard`, `exportText` from `@/platform/clipboard` |
| text/contrast/motion settings | `useDisplaySettings` from `@/platform/display` |
| bundled images | `images`, `imageForPath` from `@/theme/assets` |
| design tokens | `@/theme/tokens` |

Forbidden in this project: `document`, `window`, `localStorage`, `indexedDB`,
`navigator.vibrate`, `AudioContext`, `crypto.subtle`, `crypto.randomUUID`,
`document.execCommand`, `<a download>`. `performance.now`, `requestAnimationFrame`,
`setTimeout`, `fetch` and `socket.io-client` are fine — RN has them.

## Audio

`src/platform/audio.ts` implements an 18-method interface that mirrors the web build's
`synth`. Call sites were written against exactly these names:
`cast, claimWon, defeat, draw, error, orderSwap, padlock, pageTurn, pencil, place,
setHeat, stamp, statusApplied, statusEnded, tickMusic, uiTap, victory, wrong`,
plus `unlock()`, `setMuted(bool)`. Currently a silent baseline — the audio agent is
replacing it. Never call a WebAudio API.

## The gates (all four must pass before you report done)

```bash
npx tsc --noEmit        # zero errors in the files YOU own
npx eslint <paths>      # clean
npm test                # vitest: the 14 shared engine suites + ../tests/juice.test.ts + src tests
npx jest <paths>        # your component tests
```

**If `npx tsc --noEmit` reports an error in a file you do not own, that is another
agent's in-flight work: report it, do not fix it.** Editing a file outside your ownership
is the one failure mode that breaks this port.

## Ownership (parallel work)

| Path | Owner |
|---|---|
| `src/platform/**` | platform/audio agent |
| `src/game/{serverDuel,echoes}.ts` | runtimes agent |
| `src/ui/duel/**` | duel-UI agent |
| `src/ui/screens/**` | screens agents |
| `src/state/**`, `src/theme/**`, `src/i18n/**`, `src/game/{fx,duelRuntime,localDuel}.ts`, config | already written — read, don't edit |

## Stack (already installed — do not add dependencies without asking)

Expo SDK 57 · React Native 0.86.3 (New Architecture) · React 19.2 · TypeScript 6 ·
Reanimated 4.5 + Worklets 0.10 · react-native-svg 15.15 · gesture-handler 2.32 ·
expo-{audio,crypto,haptics,clipboard,file-system,sharing,sqlite,secure-store} ·
react-native-mmkv 4 (Nitro) · zustand 5 · socket.io-client 4.

Fonts: the 6 `.woff2` files are in `assets/fonts/`. React Native needs `.ttf`/`.otf` —
prefer `@expo-google-fonts/im-fell-english` + `@expo-google-fonts/libre-caslon` (the same
families, already on Google Fonts) unless you convert the woff2 files yourself.

