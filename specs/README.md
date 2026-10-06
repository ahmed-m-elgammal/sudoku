# ASSIZE → Mobile: Specs Index

This folder documents the analysis of the existing web build (`ASSIZE`) and the plan to ship it as an iOS + Android game. Each file covers one layer of the stack, what changes, what carries over verbatim, why, and the alternatives we considered and rejected.

`14` is the measured, source-verified analysis and it **supersedes** four earlier files on specific
points. Those corrections have been applied in place (each carries a `Corrected` banner), but
**14/15/16/17 are the authority** — read them before trusting anything in 01–07.

| # | File | Topic |
|---|------|-------|
| 00 | `00-current-state-analysis.md` | What the web build is today: engine, server, DB, client, assets, tests — plus the dead scaffolding |
| 01 | `01-tech-stack-decision.md` | The big fork: native vs cross-platform; why React Native + Expo; alternatives |
| 02 | `02-database-backend.md` | SQLite → Postgres (+ alternatives), server hosting, schema migration |
| 03 | `03-realtime-pvp.md` | socket.io duel server: keep vs managed alternatives |
| 04 | `04-local-storage-save.md` | IndexedDB/zustand → MMKV + SQLite; save migration |
| 05 | `05-shared-engine-port.md` | The crown jewel: `shared/` pure-TS engine reused verbatim |
| 06 | `06-ui-screens.md` | Every screen mapped web → RN; navigation; board/input |
| 07 | `07-audio-haptics.md` | WebAudio synth → expo-audio; haptics parity |
| 08 | `08-auth-identity.md` | Guest identity, recovery codes, secure storage, Apple sign-in |
| 09 | `09-monetization.md` | Stripe/mock → StoreKit 2 / Play Billing via RevenueCat |
| 10 | `10-testing-qa.md` | Vitest reuse, Detox E2E, device matrix |
| 11 | `11-build-release-cicd.md` | EAS, OTA, store submission, versioning |
| 12 | `12-migration-phases.md` | Step-by-step phased plan with exit criteria |
| 13 | `13-store-compliance.md` | Privacy manifest, IAP rules, age rating |
| **14** | **`14-deep-codebase-analysis.md`** | **Measured inventory · the 18 platform dependencies · toolchain reality · risk register · dead scaffolding (verdict: what to discard)** |
| **15** | **`15-port-surface-map.md`** | **File-by-file verdict (VERBATIM / SHIM / REWRITE) for the entire port** |
| **16** | **`16-delegation-plan.md`** | **Ownership rules for the parallel Phase B agents; gate commands** |
| **17** | **`17-screen-map.md`** | **The work order: build order, phases, per-screen tasks, dependency graph** |

## Read order

**00 → 14 → 15 → 17 → 16 → 12**, then the rest as needed.

## Superseding decisions (14 is the authority)

Four earlier files originally specified decisions that `14` disproved by reading the source.
**All four are now corrected in place**, with banners naming `14` as the authority:

| Decision | Was | Now | Fixed in |
|---|---|---|---|
| Navigation | Expo Router (file-based) | **Keep the zustand screen machine** — the web game has no router at all | `06` |
| Styling | NativeWind v4 *or* StyleSheet | **Plain `StyleSheet` + token module.** The game uses **zero** Tailwind utility classes | `01` |
| Storage | MMKV + expo-sqlite | **Confirmed**, but the **interface seam is mandatory** (MMKV v4 is a Nitro module) | `04` |
| Audio | `react-native-audio-api` runtime synth | **`expo-audio` + pre-rendered assets** — a WebAudio clone is a native-module risk we cannot validate here | `07` |

Also corrected: Reanimated **4** (+ mandatory `react-native-worklets`), the **false shadcn
premise** (the game hand-rolls its modals), the **font decision** (`@expo-google-fonts/*`, no
woff2 conversion), `Crypto.randomUUID` (**not** available on RN), and the **asset count**
(210 files in `public/assets/`, not "~250").

## Three numbers that look alike but are different

- **210 files / 17.67 MB** — everything under `public/assets/`.
- **220 files / 17.90 MB** — all of `public/`, adding `fonts/` (6) and 4 PWA root files.
- **173 slots** — `assets/manifest.json` entries. The pipeline's slot register, *not* a
  directory listing. Use this number only when talking about the manifest.

## The three laws that survive every decision change

1. **`shared/` is the engine and is never touched, never copied.** 2,866 lines of pure
   deterministic TypeScript, 473 executed tests, zero DOM. Shared with the web build via the
   path alias `@shared/*` → `../shared/*`. One engine, two consumers — drift is impossible.
2. **This is a port, not a redesign.** Reproduce the web UI exactly. Defects get *reported*,
   not fixed.
3. **`src/game/fx.ts` is already a pure, tested law.** Never re-derive animation logic — apply
   the values it returns.

## Where the port stands (measured 2026-10-06)

All three gates are green: `tsc` 0 errors · `eslint` 0 errors · **`vitest` 478/478 across 16 files.**

- **Phase A ✅ complete** — platform seams, `fx.ts` (verbatim), `duelRuntime.ts`, all four stores,
  tokens, i18n, and `GameShell` (the 22-branch switch already matches the web build exactly).
- **Phase B ⬜ not started** — all 24 UI files are stubs: the audio backend, the entire duel UI,
  and all 22 screens.
- **⚠️ A3 is the hidden blocker** — `game/serverDuel.ts` and `game/echoes.ts` do not exist yet, so
  PvP and the whole Shade-Echoes shelf cannot run. `LocalDuel` already satisfies `DuelRuntime`,
  so the duel UI (A2) can start now.

Per-suite breakdown and the four test numbers reconciled: `16-delegation-plan.md` §Status.