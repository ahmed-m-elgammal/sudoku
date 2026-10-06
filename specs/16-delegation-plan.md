# 16 — Multi-Agent Delegation Plan

## Status — measured 2026-10-06

### Gate status: all three green

| Gate | Command | Result |
|---|---|---|
| typecheck | `npx tsc --noEmit` | ✅ **0 errors** |
| lint | `npx eslint .` | ✅ **0 errors**, 12 style warnings (7 auto-fixable) |
| logic + component tests | `npx vitest run` | ✅ **478 tests / 16 files, all passing** |

### Phase A — ✅ COMPLETE (19 files)

| Deliverable | Files |
|---|---|
| Platform seams | `platform/{types,storage,crypto,haptics,clipboard,display}.ts` |
| Presentation law | `game/fx.ts` (**verbatim** from the web build) |
| Runtime interface | `game/duelRuntime.ts` |
| Stores | `state/{ui,save,identity,inkLedger}.ts` |
| Design system | `theme/{tokens,assets}.ts` |
| Copy | `i18n/{index.ts,en.json,story.json}` |
| Shell | `ui/GameShell.tsx` — **the 22-branch switch already matches the web build exactly**, including Android back → `ui.goBack()` |

### Phase B — not started (24 stub files)

| Agent | Deliverables | State |
|---|---|---|
| **A1** audio | `platform/audio.ts` | ⬜ **STUB** — silent baseline; the 18 methods are unimplemented |
| **A2** duel UI | `ui/duel/**` (`Board`, `NumPad`, `AbilityBar`, `HudHeader`, `HudBits`, `DuelScreen`, `useDuelSession`) | ⬜ **STUB** — `DuelScreen.tsx` is 0.9 KB of placeholder. **Critical path** |
| **A3** runtimes | `game/{localDuel,serverDuel,net/client,echoes}.ts` | 🟡 **PARTIAL** — `localDuel.ts` (17.5 KB) and `net/client.ts` (8.1 KB) done; **`serverDuel.ts` and `echoes.ts` DO NOT EXIST YET** |
| **A4** shell + campaign + modes | 16 screens | ⬜ **STUB** — all 0.9 KB |
| **A5** result + economy | 8 screens | ⬜ **STUB** — all 0.9 KB |

> **A3 is the hidden blocker.** PvP (`ServerDuel`) and the entire Shade-Echoes shelf
> (`EchoesScreen` + `echoes.ts`) cannot work until `serverDuel.ts` and `echoes.ts` are
> written. A2's duel UI can start now — `LocalDuel` already satisfies `DuelRuntime` — but
> `GameShell` will not render PvP or echo duels until A3 completes.

### Verified test inventory (478)

| Suite | Tests | | Suite | Tests |
|---|---|---|---|---|
| adversarial | 168 | | personalShade | 18 |
| juice (`../tests/juice.test.ts`) | 49 | | generators | 16 |
| engine | 35 | | crossOrder | 14 |
| echoShare | 27 | | endless | 12 |
| phaseScript | 25 | | adaptive | 9 |
| shadeLadder | 24 | | tutorial | 7 |
| inkLedger | 24 | | platform baseline (mobile) | 5 |
| replay | 23 | | weekly | 22 |
| | | | **TOTAL** | **478** |

**The four test numbers that look alike, reconciled:**

- **345** — literal `it()`/`test()` *call sites* across the 16 source test files. A code metric,
  not a run count: the fuzz sweeps and hostile matrices in `adversarial`/`juice` generate extra
  cases inside loops.
- **473** — engine + fx tests that actually execute (14 `shared/` suites + `juice`).
- **478** — what mobile runs today (473 + the 5 `platform/__tests__/baseline.test.tsx` cases).
- **484** — the **web build's** full count (473 + 11 `pngCompression` tests). Mobile excludes
  those 11 by design: they assert on `sharp` compressing `public/assets/**`, a PWA build-time
  concern with no bearing on the native bundle.

### Toolchain notes found while measuring
- `react-native`'s entry point is **Flow-typed** and neither vitest's rolldown transform nor
  jest-expo (under Node 22) can parse it. `vitest.setup.ts` now carries an honest
  **host-component double** for `react-native`, so component tests can mount a tree. The
  render assertion proves the tree mounts and its text lands — it does not assert RN internals.
- Test files import `describe`/`it`/`expect` explicitly from `vitest` (house convention — all
  16 suites do). `globals: true` is deliberately **not** set.
- `eslint.config.js` declares jest's globals for `jest.setup.js` / `jest.config.js` only.
  Those files stay wired for `npm run test:component` the day the Flow transform is fixed;
  vitest remains the gate.

---

## Why a serial Phase A is mandatory before any parallel agent

Five agents editing one repo will collide on `package.json`, `tsconfig.json`, lockfiles and
Metro caches, and will fail each other's `tsc` runs with half-written files. So:

- **Phase A (me, serial):** toolchain + every shared contract + all "leaf" primitives that
  other code imports *directly*. This is ~700 lines of glue. Until it lands, no agent starts.
- **Phase B (5 agents, parallel):** disjoint file ownership only. No agent may create, edit or
  delete a file outside its own list. No agent runs `npm install`.
- **Phase C (me, serial):** integration gate — `tsc`, `eslint`, `vitest`, `jest`, `expo export`.

## Phase A deliverables (the contracts every agent codes against)

| File | Why it must pre-exist |
|---|---|
| `src/platform/types.ts` | `DuelRuntime`, `PlatformStorage`, `AudioBackend`, `Haptics`, `Clipboard` interfaces — the seams that keep agents decoupled |
| `src/platform/storage.ts` | MMKV + expo-sqlite; imported *directly* by the save/identity/echo stores |
| `src/platform/crypto.ts` | expo-crypto SHA-256 + `randomUUID` shim |
| `src/platform/haptics.ts`, `clipboard.ts` | leaf utilities |
| `src/theme/tokens.ts` | port of `src/styles/tokens.css`; imported by every UI file |
| `src/game/fx.ts` | **verbatim** — the pure fx law both the duel-UI agent and tests need |
| `src/game/duelRuntime.ts` | the `DuelRuntime` **interface** — lets the UI agent render either runtime without importing the concrete classes |
| `src/state/{ui,save,identity,inkLedger}.ts` | stores imported by 4 of 5 agents |
| `src/i18n/index.ts` | copy loader for every screen |
| `tsconfig.json`, `eslint.config.js`, `jest.config.js`, `vitest.config.ts` | the gate commands |

## Phase B agent contracts

### A1 — Audio (`src/platform/audio.ts` + `src/platform/__tests__/audio.test.ts`)
Implements the 18-method `AudioBackend` over `expo-audio`: `cast, claimWon, defeat, draw,
error, orderSwap, padlock, pageTurn, pencil, place, setHeat, stamp, statusApplied,
statusEnded, tickMusic, uiTap, victory, wrong`.
Must expose `unlock()`, `setMuted(b)`, `setHeat(0..1)`, `tickMusic(tension)`, `pageTurn()`.
Rules: never throws when audio is unavailable; all calls no-op until `unlock()`; no WebAudio.
Gate: own-file `tsc` clean, own tests pass, `eslint` clean.

### A2 — Duel UI (`src/ui/duel/**`)
`Board, NumPad, AbilityBar, HudHeader, HudBits, DuelScreen, useDuelSession` + Reanimated
application of the fx law. Consumes `DuelRuntime` (interface), `fx.ts` (verbatim),
`useUi`/`useSave` (Phase A), `AudioBackend`/`Haptics` (interfaces).
Rules: render exactly the fx payloads (do not re-derive); keep the 66 ms `bump()` throttle;
`React.memo` every cell; port `cellAria` to `accessibilityLabel`; hit-stop freezes placement
surfaces only; honour reduced motion.
Gate: own-file `tsc` clean, own tests pass, `eslint` clean.

### A3 — Runtimes (`src/game/{localDuel,serverDuel,net/client,echoes}.ts` + tests)
`LocalDuel`/`ServerDuel` must both satisfy `DuelRuntime`. Replace `navigator.vibrate` with the
haptics interface; drop the `XTransformPort` sandbox query from `net/client.ts`; move
`localStorage.getItem('assize-secret')` to the storage interface; reimplement the echo ring on
expo-sqlite keeping `validateReplay` + `echoesToEvict` from `shared/replay`.
Rules: no DOM globals anywhere; `performance.now`/rAF allowed; never touch `shared/`.
Gate: own-file `tsc` clean, own tests pass, `eslint` clean.

### A4 — Shell + campaign + modes (`src/ui/screens/**` group 1)
`GameShell` (the 24-case switch), `BootScreen, Antechamber, Ribbon, OrderSelect, StoryCard,
FolioMap, FolioDetail, EndingChoice, Versus, Matchmaking, OfflineScreen, DailyScreen,
WeeklyScreen, EndlessScreen, FriendScreen`.
Rules: `GameShell` is a switch over `useUi().screen` — do **not** introduce a router; wire
Android hardware back to `ui.go(prev)`.
Gate: own-file `tsc` clean, own tests pass, `eslint` clean.

### A5 — Result + economy screens (`src/ui/screens/**` group 2)
`ResultScreen, EchoesScreen, CabinetScreen, LedgerProfile, SeasonLedger, PurseScreen,
ReliquaryScreen, SettingsScreen`.
Rules: replace `<a download>` / `execCommand('copy')` with the clipboard interface; the echo
sealed-chit modal must show the full `ASSIZE1-` code; settings writes through `useSave`.
Gate: own-file `tsc` clean, own tests pass, `eslint` clean.

## Gate commands (identical for every agent, run from `mobile/`)

```
npx tsc --noEmit          # must report ZERO errors in files you own
npx eslint <your files>   # must be clean
npx vitest run            # shared engine suite must stay green
npx jest <your tests>     # your own tests must pass
```

**Rule:** an agent that sees a `tsc` error in a file it does not own must **report it in its
final message and not touch it**. Silently "fixing" another agent's file is the one failure
mode that destroys this plan.

## Phase C — integration gate (run by me, blocking)

```
npx tsc --noEmit
npx eslint .
npx vitest run          # 473 engine/fx tests unchanged (+5 mobile platform = 478)
npx jest                # all agent tests
npx expo export --platform all   # the real build: Metro + babel + worklets must compile
```
