# 01 — Tech Stack Decision (client)

> **Corrected 2026-10-06.** Two sections below originally left decisions open or stated them
> wrongly. Both are now **settled** by `14-deep-codebase-analysis.md` §2 Finding A and §8:
> **navigation is the zustand screen machine, not Expo Router** (see `06`), and **styling is
> plain `StyleSheet` + a token module, not NativeWind**. The rest of this document stands.

## The decision: React Native + Expo (managed, New Architecture)

**Why:**
1. The entire product logic is TypeScript and framework-agnostic. ~480 passing Vitest tests and a deterministic engine mean we can port the *game itself* with near-zero rewrites. This is the single strongest argument in the whole plan: no other path preserves both the engine and the test net.
2. The web UI is React 19 + **CSS Modules + a design-token stylesheet** (not Tailwind — see below); zustand stores transfer directly, and the components transliterate to `StyleSheet` with identical values.
3. Expo managed workflow gives EAS Build/Submit/OTA without ejecting, plus the exact native modules we need (haptics, audio, notifications, secure store, SQLite, clipboard, sharing).
4. One codebase ships iOS + Android; the art is resolution-independent SVG/webp that works on both.
5. The app is board-game shaped — flat grid, one finger, gestures (tap) — RN handles this easily. A 60 fps ink-flood animation is a Reanimated job, which is RN's strong suit.

**Alternatives considered:**

| Option | Why not |
|---|---|
| **Flutter / Dart** | Great engine candidate, but a full rewrite of ~20 TS modules and the 480-test net; loses the team's TypeScript/React fluency; new hire/maintenance surface. |
| **Native Swift + Kotlin** | Best raw performance and platform fidelity, but two codebases, two hires, engine rewrite ×2. Not justified for a turn-based puzzle game. |
| **Capacitor wrap the existing Next.js PWA** | Fastest path (~days), but it ships a web app in a WebView shell — no native feel, mediocre haptics/audio, App Store rejects thin wraps regularly, and the "mobile game" is fake. Rejected for v1; it is the fallback if schedule collapses. |
| **React Native CLI (bare)** | Same RN code, but you maintain the iOS/Android projects' Pods/Gradle yourself. Expo managed with a config plugin escape hatch covers everything here. |
| **PWA-only / TWA (Trusted Web Activity)** | Zero store revenue share, no haptics, no IAP, no App Store presence. Rejected as the primary. |
| **Kotlin Multiplatform + SwiftUI/Compose** | Engine ports to Kotlin nicely, but KMP's coroutines/env maturity and the duplicated UI keep it a risk; RN wins on ecosystem velocity. |

## UI kit
- **react-native-svg** for every SVG asset (seals, sigils, portraits are PNG/webp → `expo-image`).
- **Reanimated 4** for ink flood, screen shake, hit-stop, verdict slow-mo, chest/candle Reliquary animations (replacing CSS keyframes in `Duel.module.css`). Requires the mandatory extra dep `react-native-worklets` plus the babel plugin.
- **Gesture Handler** for taps/drag on the board and number pad; long-press for note mode.
- **Styling: plain `StyleSheet` + a token module. SETTLED — NativeWind is rejected.**
  The web build uses **CSS Modules + `src/styles/tokens.css`**, not Tailwind: verified zero
  Tailwind utility classes in any game screen, and `tailwind.config.ts` scans paths that do not
  exist. NativeWind would add a Metro transform to port **zero** utility classes. The 600+ style
  usages already resolve against a small set of game-specific tokens, so `src/theme/tokens.ts`
  (ported 1:1 from `tokens.css`) makes the port mechanical. Hard rule: no colour literal in
  `mobile/src/**` outside `src/theme/`; ESLint enforces it.
- **expo-image** for webp/png plates/portraits with caching.
- Navigation: **the zustand screen machine — keep `src/state/ui.ts` + the `GameShell` switch.**
  Do **not** add Expo Router or React Navigation. The web game has no URL routing; `screen` is
  one state field and the shell is a 22-branch `switch`. Porting that costs ~100 lines and
  preserves `prev`/`direction` (page-turn variants) and the story-payload channel exactly.
  Full reasoning and the 24 `Screen` variants: `06-ui-screens.md`.

## Audio/haptics
- **expo-audio** for the synth port — see `07`. `react-native-audio-api` is **deprioritized**
  (it is a runtime WebAudio clone, i.e. a native-module risk we cannot validate without a
  device toolchain in this sandbox).
- **expo-haptics** for placement ticks, claim slams, Flinch buzz, victory/defeat patterns (the web build used `navigator.vibrate` where available).

## Local persistence
- **react-native-mmkv** for the save/identity/settings hot path; **expo-sqlite** for echo ring-buffer and Ink ledger rows. See `04` — MMKV v4 is Nitro-based, so the storage seam is an **interface**, not a direct import.

## Networking
- **socket.io-client** works in RN unchanged — same protocol, same server. See `03`.

## Build
- **EAS Build + EAS Submit + EAS Update (OTA)** — see `11`.

## Language/versioning
- TypeScript strict. `shared/` remains the single source of truth, consumed by both the RN app
  and the legacy Next.js PWA.
- **Not a workspace monorepo, and not Bun-managed in this environment.** The engine is shared by
  **path alias**, not by package resolution: `@shared/*` → `../shared/*`. Never copy `shared/`
  into `mobile/` — one engine, two consumers, drift impossible.
- **Toolchain reality:** `bun` is **not installed** in the porting sandbox (`14` §5), so
  `bun.lock` / `bun run test` are unusable — the mobile app uses **npm** (`npm test`,
  `npx tsc`, `npx eslint`, `npx expo export`). The web build keeps its bun scripts for the
  legacy PWA only.
