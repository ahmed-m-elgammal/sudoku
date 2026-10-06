# 14 — Deep Codebase Analysis (verified by reading, not inferring)

Everything here was confirmed by reading the source, not by trusting the README/TODO.
Line counts are `Measure-Object -Line` on the actual files.

## 1. Measured inventory

| Layer | Lines | Files | Verdict |
|---|---|---|---|
| `shared/` (engine + all modes) | **2,866** | 15 `.ts` (+14 test files) | **zero DOM references** → port verbatim |
| `src/app/game/` (UI) | **4,122** | 33 (32 `.tsx` = 3,500 + 622-line `Duel.module.css`) | rewrite in RN |
| `src/game/` + `src/state/` + `src/net/` + `src/audio/` | **1,616** | 11 | shim + rewrite |
| `mini-services/assize-server/` | **555** | 2 | keep (server-side, untouched by RN) |
| Tests | 16 files, **345 `it()/test()` call sites** → **473 executed** | 16 | reusable as-is |
| **Dead shadcn/Tailwind scaffolding** | **5,104** | **52** | **delete — zero imports, see §9** |
| Assets | `public/assets/` **210 files, 17.67 MB** (140 svg, 38 png, 32 webp) | — | reusable |

Total app code to port: **~5,700 lines**. Engine to not touch: 2,866 lines + 473 executed tests.

> **Test counts, reconciled (measured 2026-10-06).** Four numbers circulate and they are not
> interchangeable:
> - **345** — literal `it()`/`test()` *call sites* across the 16 source test files. A code
>   metric: the fuzz sweeps and hostile matrices inside `adversarial`/`juice` generate extra
>   cases in loops, so executed tests exceed call sites.
> - **473** — engine + fx tests that actually execute: 14 `shared/` suites (424) + `juice` (49).
> - **478** — what **mobile** runs today: 473 + the 5 `platform/__tests__/baseline.test.tsx`
>   cases. `npx vitest run` in `mobile/`: 478/478 green across 16 files.
> - **484** — the **web build's** full count: 473 + the 11 `pngCompression` tests. Mobile
>   excludes those 11 by design (they assert on `sharp` compressing `public/assets/**` — a PWA
>   build-time concern with no bearing on the native bundle).

Use **478** when talking about the mobile gate. Full per-suite breakdown: `16` §Status.

> **Asset count — the one true number.** `public/assets/` holds **210 files / 17.67 MB**
> (140 `.svg`, 38 `.png`, 32 `.webp`). Add `public/fonts/` (6 `.woff2`) and the 4 PWA files at
> the `public/` root (`logo.svg`, `manifest.webmanifest`, `robots.txt`, `sw.js`) → **220 files /
> 17.90 MB** in `public/`. Separately, `assets/manifest.json` declares **173 asset *slots*** —
> a different quantity from either file count; it is the pipeline's slot register, not a
> directory listing. Use 210 for "assets", 220 for "everything under public/", 173 only when
> talking about the manifest. (An earlier draft of `00-current-state-analysis.md` said "~250
> SVG/PNG" — that number was wrong and has been corrected.)

## 2. The architecture is better than the docs claim — three findings that change the plan

### Finding A — there is no router. `GameShell` is a zustand switch.
`src/state/ui.ts` holds `screen: Screen` (24 variants) plus `go(screen, payload)`. `GameShell.tsx:73-98` is a literal `switch (screen) { case 'boot': return <BootScreen/>; ... }`. There is **no URL, no Next.js route segment, no file-based routing** for the game — `src/app/page.tsx` is 7 lines that render the shell.

**Consequence:** my earlier `specs/06` recommendation (Expo Router, one file per screen) is **wrong for this codebase**. Porting `ui.ts` + the switch costs ~100 lines and reproduces navigation behaviour *exactly*, including `prev`/`direction` (page-turn variants) and the story-payload channel. Routing would add navigation state, deep-link handling and back-button semantics that the game does not have today. **Decision: keep the state machine.** This also means Android hardware back must be mapped to `ui.go(prev)` explicitly — a new behaviour the web build never needed.

### Finding B — the presentation layer is already a pure, tested law.
`src/game/fx.ts` is 162 lines, has **no React, no DOM, no CSS** — only `DuelEvent` in, plain data out (`floodFromEvent`, `cellsOfFlood`, `centroidOfUnit`, `ownerOfCell`, `tierForEvent`, `hitStopFromEvent`, `heatFromState`, `advanceRuns`, `Cue`). It is pinned by `tests/juice.test.ts` (352 lines).

**Consequence:** the Reanimated port does **not re-derive any animation logic**. It only *applies* `Flood`/`Shake`/`HitStop`/`Heat`. The risk profile of the flashiest workstream collapses from "reimplement and re-verify" to "wire 4 values into shared values". This file ports 100% verbatim.

### Finding C — the audio surface is exactly 18 methods.
Enumerated by grep across all of `src/`: `cast, claimWon, defeat, draw, error, orderSwap, padlock, pageTurn, pencil, place, setHeat, stamp, statusApplied, statusEnded, tickMusic, uiTap, victory, wrong`.

**Consequence:** `synth` becomes a narrow interface. We do **not** port WebAudio graph code; we implement 18 methods against `expo-audio`. Anything richer is scope creep.

## 3. Exhaustive platform-dependency inventory (the real port surface)

Grepped every `.ts/.tsx` in `shared/` + `src/`. There are exactly **18 distinct browser dependencies**, in 20 files:

| # | API | RN status | Sites | Resolution |
|---|---|---|---|---|
| 1 | `requestAnimationFrame` / `cancelAnimationFrame` | ✅ global in RN | `localDuel` | keep |
| 2 | `performance.now()` | ✅ Hermes | `localDuel`, `server` | keep |
| 3 | `setTimeout/setInterval/clearTimeout` | ✅ | many | keep |
| 4 | `Uint8Array` | ✅ | engine | keep |
| 5 | `fetch` | ✅ | `net/client` | keep |
| 6 | `socket.io-client` | ✅ same package | `net/client` | keep |
| 7 | `structuredClone` (`save.ts:110`) | ⚠️ Hermes (new arch: yes) | 1 | verify, polyfill if absent |
| 8 | `crypto.getRandomValues` (`identity.ts:16`) | ⚠️ via expo-crypto | 1 | `expo-crypto` |
| 9 | **`crypto.randomUUID`** (`identity.ts:48-49`) | ❌ | 1 | shim over `getRandomValues` |
| 10 | **`crypto.subtle.digest`** (`identity.ts:31`) | ❌ | 1 | `expo-crypto` SHA-256 |
| 11 | **`indexedDB`** | ❌ | `idb.ts` (73), `echoes.ts` (68) | MMKV + expo-sqlite |
| 12 | **`localStorage`** | ❌ | `FriendScreen:27,90`, `Matchmaking:40`, `ServerDuel:66,101` | MMKV |
| 13 | **`navigator.vibrate`** | ❌ | `localDuel:171,235,347`, `useDuelSession:133,136,139` (6) | `expo-haptics` |
| 14 | **`window.AudioContext`** | ❌ | `synth.ts:25` + whole file | `expo-audio` |
| 15 | **`document.createElement` / `execCommand('copy')`** | ❌ | `EchoesScreen:30-37`, `LedgerProfile:176`, `ResultScreen:45`, `SettingsScreen:91` | `expo-clipboard`, `expo-sharing`, `expo-file-system` |
| 16 | **`document.documentElement.dataset`** (text/contrast/motion) | ❌ | `GameShell:49-52` | React settings context |
| 17 | **`window.addEventListener('keydown')`** | ❌ (no HW keyboard) | `DuelScreen:307`, `EndingChoice:58` | optional iPad key handler |
| 18 | **CSS modules + CSS custom properties** (`--heat`, `--flood-i`, `--shake-amp`, `data-motion` kill-list) | ❌ | `Duel.module.css` (622 lines) | `StyleSheet` + Reanimated shared values |

**Only 9 of 18 are actually missing in a way that requires design decisions** (#9, #10, #11, #12, #13, #14, #15, #16, #18). Five of those nine — #11 `indexedDB`, #12 `localStorage`, #13 `navigator.vibrate`, #14 `AudioContext`, #15 `document`/`execCommand` — are one-line adapter swaps behind an existing interface seam. The remaining four (#9 `crypto.randomUUID`, #10 `crypto.subtle.digest`, #16 `documentElement.dataset`, #18 CSS modules + custom properties) need a small design decision. The other 9 APIs (#1–#8) are present in RN/Hermes as-is.

## 4. Contract seams the port must preserve (found in code, not docs)

1. **`LocalDuel` ⇄ `ServerDuel` must stay structurally identical.** `useDuelSession.ts:40` declares `AnyDuel = LocalDuel | ServerDuel` and `DuelScreen` renders either through one JSX tree. Every screen touches: `state`, `notes`, `selected`, `pencil`, `lastWrong*`, `wrongVariant`, `flags()`, `place()`, `ability()`, `setNotes()`, `toggleNote()`, `concede()`, `subscribe()`, `getSnapshot()`, `bumpPublic()`, `tutorialNote()`, `grantFreeAugur()`, `swapBanner()`, `disconnect`, `selfOffline`, `paused`, `ended`. **A shared `DuelRuntime` interface must be extracted and both classes must satisfy it** — otherwise the single JSX tree forks.
2. **`useSyncExternalStore` subscription model** (`useDuelSession.ts:98-102`) with a `bump()` throttled to ~66 ms (`localDuel.ts:113-120`). This is the render driver. RN's reconciler is slower than the DOM's; the 15 fps cap is a *feature* here, but cells must be memoized or 81 cells × 15 fps will jank.
3. **`Cue<T>`** (`fx.ts:155`) is timer-only self-cleaning; the fuzz test pins "no stuck shake after 1000 events". Reanimated must not reimplement expiry — keep `Cue`, feed Reanimated from it.
4. **Echo/replay format is a versioned wire contract** (`ASSIZE1-` prefix, `validateReplay`, 4000-action cap, integer-ms engine-clock timestamps). Any web echo must decode in the app and vice versa. `shared/replay.ts` + `echoShare.ts` are pure → port verbatim and both platforms stay compatible.
5. **Ink ledger verdict law** (`shared/inkLedger.ts`) is mirrored server-side (`/api/ink`). Mobile changes nothing; the pending queue must survive app kills (MMKV) exactly as it survived tab closes (IDB).
6. **`serializeDuel` byte-determinism** is pinned by tests; `deserializeDuel` is the hostile-snapshot gate. Mobile must keep both — the server sends PvP snapshots.

## 5. Toolchain reality (verified in this environment, 2026-10-02)

| Fact | Value |
|---|---|
| npm registry reachable | ✅ (`npm view expo version` → 57.0.26) |
| `bun` | ❌ **not installed** — the repo's `bun.lock` / `bun run test` cannot be used; use **npm** |
| `node_modules` | ❌ absent — nothing is installed yet |
| node | v22.16.0, npm 10.9.2 |
| expo | 57.0.26 |
| react-native | 0.87.1 |
| react-native-reanimated | **4.7.0** — peer: RN `0.86–0.88` + **`react-native-worklets` 0.13.x** (mandatory extra dep) |
| react-native-svg | 15.15.5 |
| react-native-mmkv | 4.3.2 (Nitro-based → needs `react-native-nitro-modules` 0.37.1) |
| jest-expo / expo-sqlite / expo-audio / expo-haptics | 57.0.5 / 57.0.3 / 57.0.5 / 57.0.3 |

**Version trap:** Reanimated 4 will not run without `react-native-worklets` installed and the babel plugin wired. MMKV 4 is a Nitro module — if its Expo config plugin misbehaves, fall back to `@react-native-async-storage/async-storage` behind the same `PlatformStorage` interface (this is why the storage seam must be an interface, not a direct import).

## 6. What "build + test + typecheck + lint" can actually mean in this sandbox

There is **no iOS Simulator, no Android emulator, no Xcode, no Android SDK** here. So the honest gate ladder is:

| Gate | Command | Proves |
|---|---|---|
| typecheck | `npx tsc --noEmit` | types across shared + mobile |
| lint | `npx eslint .` | style + import hygiene |
| logic tests | `npx vitest run` | the 473 existing engine/fx tests still pass **unchanged** against the same `shared/` |
| new unit tests | `npx jest` (jest-expo preset) | platform shims, stores, components |
| **bundle** | **`npx expo export --platform all`** | **Metro resolves every import, babel plugins run, worklets compile — this is the real "build" gate** |

`expo export` is the decisive one: it is a genuine production bundle for native without a device toolchain. Detox/emulator E2E is **deferred to a machine with Xcode/Android SDK** and is out of scope for this pass.

## 7. Risk register (ranked)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Parallel agents editing the same file → silent merge damage | **critical** | I write all shared contracts + toolchain first; each agent owns a disjoint directory and may not touch another's |
| R2 | Concurrent `npm install` / Metro cache corruption | high | single serial install in scaffold phase; agents never install |
| R3 | Reanimated 4 + worklets misconfiguration | high | pin versions; verify with `expo export` in the integration gate; fallback = RN `Animated` |
| R4 | 81-cell board re-render jank on RN | medium | `React.memo` per cell; keep the 66 ms throttle; move cooldown rings to Reanimated shared values |
| R5 | MMKV Nitro plugin failure | medium | interface-first storage; AsyncStorage fallback |
| R6 | Audio adapter cannot express `tickMusic(tension)` / `setHeat` dynamics | medium | pre-rendered loops + `expo-audio` gain ramps; degrade gracefully (game is fully playable silent) |
| R7 | Over-eager port of the 24 meta screens before the duel loop works | medium | phase order: duel loop first, meta screens second |
| R8 | Copying `shared/` into `mobile/` and letting the two drift | high | **path alias `@shared/*` → `../shared/*`**; never copy |

## 8. Corrected decisions vs. the earlier specs

These were corrected **in place** on 2026-10-06 — specs `01`, `04`, `06`, and `07` now carry the
decision themselves, each with a `Corrected` banner naming this document as the authority. This
table remains the index of what changed and why.

| Earlier spec said | Now | Where corrected |
|---|---|---|
| `specs/06` said Expo Router (file-based) | **rejected** — keep the zustand screen machine (Finding A) | `06-ui-screens.md` |
| `specs/01` said "NativeWind v4 or plain StyleSheet" | **plain `StyleSheet` + a token module.** Tailwind adds a Metro transform to port **zero** utility classes — verified, the game uses CSS Modules + `tokens.css` only | `01-tech-stack-decision.md` |
| `specs/01` said Expo Router in the UI-kit list | **rejected** — same as `06` | `01-tech-stack-decision.md` |
| `specs/01` said "Bun-managed monorepo" | **not a monorepo, and bun is not installed here.** Shared by path alias `@shared/*`; mobile uses **npm** | `01-tech-stack-decision.md` |
| `specs/04` said MMKV + expo-sqlite | **confirmed**, but MMKV v4 is Nitro-based, so the **interface seam is mandatory** (R5) | `04-local-storage-save.md` |
| `specs/04` said `expo-crypto` provides `Crypto.randomUUID()` | **it does not** — needs a shim over `getRandomValues` | `04-local-storage-save.md` |
| `specs/07` said react-native-audio-api as primary | **deprioritized** — `expo-audio` + pre-rendered assets (R6); a runtime WebAudio clone is a native-module risk we cannot validate without a device | `07-audio-haptics.md` |
| `specs/06` said Reanimated 3, and that shadcn supplies the dialogs | **Reanimated 4 + mandatory `react-native-worklets`**; and the game uses **no shadcn at all** — modals are hand-rolled `.modal-backdrop` divs | `06-ui-screens.md` |
| `specs/06` said convert `.woff2` → `.ttf` | **settled: use `@expo-google-fonts/*`** — same families, zero conversion risk | `06-ui-screens.md` |
| `specs/00` said "~250 SVG/PNG assets" | **210 files / 17.67 MB** in `public/assets/` (see the note in §1) | `00-current-state-analysis.md` |

## 9. Dead scaffolding — 5,104 lines that are not part of the game

Verified by grep across `src/`, `shared/`, `tests/`, `scripts/`, `mini-services/`: **zero imports
from any game code**. No screen in `src/app/game/` imports a single shadcn component.

| Path | Lines | Files | Why it is dead |
|---|---|---|---|
| `src/components/ui/**` | **4,911** | 48 | The entire shadcn/ui kit. Self-referential imports only. |
| `src/hooks/{use-toast,use-mobile}.ts` | 178 | 2 | Imported only by the dead `sidebar.tsx` / `toaster.tsx`. |
| `src/lib/db.ts` | 13 | 1 | Instantiates `PrismaClient`; **nothing imports `db.ts`**. |
| `src/lib/utils.ts` (`cn()`) | 2 | 1 | Consumed only by dead shadcn files. |
| `prisma/schema.prisma` | ~30 | 1 | Untouched `User`/`Post` template. Real DB is `bun:sqlite` + handwritten queries. |
| `src/app/api/route.ts` | 4 | 1 | `"Hello, world!"` stub. |

**Dead build tooling:** `tailwind.config.ts` (content globs point at `./pages/**`, `./components/**`,
`./app/**` — the real code is `src/app/**`, so it scans nothing), `components.json`,
`postcss.config.mjs`, `src/app/globals.css` (~200 lines of shadcn HSL vars; removing it needs a
one-line edit to `src/app/layout.tsx:2`).

**Dead npm dependencies (~50):** all 3 `@dnd-kit/*`, `@hookform/resolvers`, `@mdxeditor/editor`,
`@reactuses/core`, both `@tanstack/*`, `date-fns`, `framer-motion`, `next-auth`, `next-intl`,
`react-markdown`, `react-syntax-highlighter`, `recharts`, `uuid`, `z-ai-web-dev-sdk`, `zod`,
`tailwindcss-animate`, and ~30 `@radix-ui/*` (used only by the dead shadcn kit).
⚠️ `react-dom` greps as unused but is **required by Next.js** — do not remove.

**Sandbox/agent scratch (~102 MB), never part of the game:** a bare **98 MB tar archive of
`.git/` accidentally committed as the 0-extension file `sudokou game`**; `tool-results/`;
`scripts/shots/`; `.zscripts/`; `examples/`; `download/`; `upload/`; and `db/assize.db_mode=ro`
— a 0-byte artifact of an unquoted shell redirect (`db/assize.db?mode=ro`). Note also that
`db/` is git-tracked **including `assize.db`, `-wal` and `-shm`** — runtime database state in
version control.

**None of this is in the port surface.** `15-port-surface-map.md` is the authority on what to
port; this section is the authority on what to *discard*.
