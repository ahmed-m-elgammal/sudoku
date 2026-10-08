# Phase 6 — Ship Gates (specs/17)

Recorded 2026-10-09, at the commit that carries this file. This is the work-order's
final phase: every gate from `specs/17-screen-map.md` Phase 6, with its evidence, and
the two items that structurally require a phone in hand.

## Gate results

| Gate | Result | Evidence |
|---|---|---|
| `npx expo export` clean | **PASS** (iOS + Android; `--platform all` needs `react-native-web`, which is deliberately not in this stack — the PWA is the separate root Next.js build. Adding it would break the no-new-deps law; recorded as a deviation, not silently ducked.) | iOS hbc **3.8 MB** (`index-48eb7547…`), Android hbc **3.8 MB** (`index-9f3417f4…`); **173 assets** each; all **24 audio files** embedded (verified by RIFF/WAVE magic bytes in the export). `dist/` sizes ≈ 15 MB per platform. |
| `npx tsc --noEmit` | **PASS** — mobile **and** root | zero errors in both workspaces |
| `npx eslint .` | **PASS** — mobile **and** root | **0 errors, 0 warnings** after fixing the 5 pre-existing root warnings (`shared/__tests__/echoShare.test.ts` dead cast + stale disable, `src/app/game/ResultScreen.tsx` ternary-as-statement, `tests/pngCompression.test.ts` bare expression, `tools/generate-assets.mjs` ternary-as-statement) — per the standing rule: fix even what isn't yours |
| `npx vitest run` | **PASS** — mobile **and** root | mobile **751/751** (52 files, +33 this phase), root **493/493** |
| Every screen walked on a phone, in order | **ON-DEVICE REMAINING** | all 22 screens are ported and route through the real store (`GameShell`'s switch, verified by render tests); the walk itself needs Expo Go on hardware — checklist below |
| Android hardware back → `ui.goBack()` | **PASS (code path)** | `GameShell` registers `BackHandler` once, pops `goBack()`, no-ops at a root screen so the OS closes the app; the subscription law is exercised by the test double |
| Reduced-motion + high-contrast + 3 text sizes | **ON-DEVICE REMAINING** | the four display switches write the save and cascade immediately (`DisplaySettingsProvider` + App-level effects), pinned by `SettingsScreen.test.tsx` (7 tests); the hardware walk remains |
| Offline: duel modes play with no network | **PASS (code path)** | the engine runs locally (`shared/` via `LocalDuel`); matchmaking degrades to the labelled Shade fallback (R7) when the server is unreachable — the web's own server-down path; `OfflineScreen` polls and recovers |
| Bundle size recorded | **PASS** | see the export row; JS bundle 3.8 MB per platform |
| Store config: icons, splash, `bundleIdentifier`, privacy manifest (specs/13) | **PASS** (see the store table below) | |

## What this phase changed

### 1. Music — the last stub is gone (`specs/07` settled decision)

`src/platform/audio.ts` was the Phase A silent baseline. It is now the real
18-method `AudioBackend` over `expo-audio`, with the sounds **pre-rendered to
assets** — the decision specs/07 settled after deprioritizing runtime synthesis:

- `tools/render-audio.mjs` renders the web build's synth graph offline (Node, no
  deps, RBJ biquads, exponential envelopes, the drone's filter LFO, the J4
  leaky-integrated murmur) into **24 files** in `mobile/assets/audio/` — 21
  one-shots (place, wrong, pencil, error, uiTap, pageTurn, stamp, claimWon,
  claimLost, statusApplied, statusEnded, padlock, orderSwap, cast-0…3, victory,
  defeat, draw, reliquary) and **3 seamless loops** (the 20 s courtroom drone, the
  26 s bowed tension layer, the 8 s gallery murmur — loop-crossfade-baked so
  `loop=true` never seams).
- `src/platform/gainLaw.ts` holds the mixer's maths pure: the web's exact constants
  (drone 0.16, tension ×0.5 tc 1.5 s, murmur ×0.07 tc 0.9 s), the one-pole behind
  `setTargetAtTime`, the bus/mute multiplication.
- `src/platform/audio.ts` owns the machinery: unlock on first gesture, three looping
  beds, a 100 ms mixer timer, instant mute/volume (the web's 0.05 s bus law),
  background pause via `AppState`, `playsInSilentMode: false` + `mixWithOthers`
  (specs/07's politeness rules), and the contract's never-throw/no-op-before-unlock
  law (pinned by 28 new tests — including a test that FAILED before the fix and
  forced the one-shot guard into existence).
- App.tsx already pushed `settings.music`/`settings.fx` into the backend and DuelScreen
  already called `unlock()` — no call site changed; the stub's promise ("every synth
  call site already routes here") is what made this a drop-in.

### 2. Every asset loading in the right place

- `tools/audit-mobile-assets.mjs` walks every literal asset reference under
  `mobile/src` (191 references, 166 distinct files) plus app.json's six icon/splash
  entries and fails on any miss. **PASS.** The 80 files on disk that no source file
  names are the web build's PNG twins and PWA brand set — legitimate by design.
- **One fidelity defect found and fixed:** the web's `.quarantined` class paints
  `overlays/quarantine.svg` at `background-size: cover`; the mobile port had
  substituted `opacity: 0.45` and the asset never loaded. `Board.tsx` now renders the
  quarantine SVG under the claim stamps (box/row/col — the three sites the web
  styles), and `duelAssets.ts` registers the file.

### 3. No stub screens

Phases 0–5 replaced every screen stub; this phase audited the leftovers:

- the **audio baseline** (the last platform stub) — replaced (above);
- stale "Phase A stub" comments in `BootScreen.tsx` and `Ribbon.tsx` — corrected
  (comment-only; the code they described was finished in Phases 2.3/5.7);
- the Patron's Pouch (`TODO(T5)` payments) remains, exactly as specs/17 5.5
  instructs ("leave stubbed") — an owner scope decision recorded in the spec, with
  its honest in-game alert intact.

### 4. Store readiness — the audit's P0 blockers (docs/assize-store-readiness-audit.pdf)

| Blocker | Fix landed |
|---|---|
| P0-2.1 stub screens reachable from the hub | cleared by the Phase 4/5 ports (verified this phase; audit was pre-Phase-4) |
| P0-2.2 no privacy policy URL | **`docs/privacy-policy.md`** — console-ready plain-language policy matching specs/13 and the in-app copy; host it and register the URL in both consoles |
| P0-2.3 release build defaults to `http://localhost:3030` | **fail-closed law in `src/game/net/client.ts`**: configured origins must be `https://` (localhost/127.0.0.1/10.0.2.2 stay legal for development) or `serverOrigin()` throws loudly; `isServerConfigured()` exported for the build gate. Pinned by `netClient.test.ts` (5 tests) |
| P0-2.4 no build/signing pipeline | **`mobile/eas.json`** — production (`autoIncrement`, appVersionSource remote) / preview (internal distribution) / development profiles + submit block; inject the server origin with `eas env:create --name EXPO_PUBLIC_ASSIZE_SERVER --value https://…` before the first production build |

Plus the P2 hygiene from the audit's §5: explicit `ios.buildNumber: "1"` and
`android.versionCode: 1` in app.json, and the legacy `assetBundlePatterns: "**/*"`
removed (Expo bundles exactly the referenced assets; the pattern forced everything).

### 5. Small repairs outside the mobile workspace (per the standing fix rule)

The five root lint warnings listed in the gate table; `vitest.config.ts` learned
`assetsInclude: ['**/*.wav']` so the logic runner treats sound as assets the way Metro
does; `mobile/declarations.d.ts` types the `.wav` imports.

## Remaining on-device checklist (the boxes this sandbox cannot tick)

1. Walk all 22 screens once, in order, in Expo Go on a phone (Boot → tutorial duel →
   result → hub → every card → the ending), confirming the audio beds swell with the
   seal gap and heat.
2. Walk reduced-motion, high-contrast, and all three text sizes; Android hardware back
   on every screen.
3. Airplane-mode pass: tutorial/campaign/daily/endless/weekly play with no network;
   matchmaking lands the labelled Shade after ~4.5 s.
4. On the first EAS production build: confirm `targetSdkVersion` 36 / iOS 18 SDK, the
   merged permission set (zero dangerous), and Expo's default privacy manifest —
   then file the console forms from the audit's §3/§4/§6 (listing copy, screenshots,
   feature graphic, Data Safety / App Privacy / IARC).
5. Before screenshots: regenerate the five source-art assets with baked-in Chinese
   text (audit §3.3) — an image-pipeline decision at the source, shared with the web
   build; not closable from this workspace without re-authoring the art.

## Follow-up: the native art pipeline — raster twins (post ship-gate device findings)

On-device verification surfaced the three runtime findings this section closes.

**Findings.** (1) react-native-svg warned `Some SVG filters used in the app are not
implemented on native platforms` (FeTurbulence et al.) — 120 of the 140 engraved-kit
SVGs carry turbulence-based filters. (2) The Fabric renderer threw
`Text strings must be rendered within a <Text> component`. (3) UI/JS dropped to 0 fps
when iterating screens.

**Root cause (one, for all three).** Every kit asset was rendered through
`<SvgUri>`: a runtime `fetch` + XML-parse + React-tree build of each SVG on EVERY
mount. Native's SVG renderer implements none of the kit's filters (the warnings; the
grain never painted), the parse storm across the board's ~90 art nodes + every hub
screen's chrome was the frame collapse, and the `SvgAst` path renders dynamically
built children arrays — the one non-standard render path under Fabric whose failure
mode surfaces as raw-text throws.

**The fix — bake the filters at build time.**
- `tools/rasterize-game-art.mjs` (sharp/librsvg, which implements the full filter
  spec) rasterizes every `mobile/assets/game/**/*.svg` beside its source: palette
  PNG twins for marks/chrome, WebP q95 twins for the full-bleed noise (textures).
  Scale = 2× intrinsic, clamped [96, 1024]. Total +1.95 MB; the SVGs are no longer
  bundled (0 in the export; the twins take the 140 slots). A manifest
  (`raster-manifest.json`) pins the mapping and feeds the audit.
- `src/ui/Art.tsx` — the ONE render seam for bundled art: a native `<Image>`,
  `mode` defaulting to 'contain' (SVG `meet`), `mode="cover"` where the web said
  `slice`, null on empty uri (the registries' degrade law), `fadeDuration={0}`.
- All 130 registry requires now point at the twins; all 14 render sites render
  `<Art>`; `resolveUri`/`artUriFor`/`sigilArt`/`duelArt` keep the registry law with
  honest names. The AbilityBar cooldown ring lost its data-URI `<SvgUri>` (which
  native `<Image>` cannot paint at all) for an inline procedural `<Svg><Circle>` —
  the same two circles, Fabric-safe.
- `react-native-svg` stays for procedural geometry only (cooldown rings, Ledger
  spark, seat circles, the disconnect spinner).

**Proof.** `src/ui/__tests__/artSeam.test.ts` (3 laws: no .svg requires in src, no
SvgUri/SvgXml usage, manifest↔disk integrity) + the suites above; the asset audit
still PASSes (every reference resolves); `expo export` ios+android clean with
`{ttf: 6, wav: 24, webp: 38, png: 105}` — zero svgs.

**Fidelity note.** The art now shows the grain the web build always had — on device
the noise filters never painted, so this is a fidelity RESTORATION, not a change.
