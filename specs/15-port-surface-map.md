# 15 — Port Surface Map (file-by-file verdict)

Legend: **V** = verbatim copy · **S** = shim/adapter only · **R** = rewrite in RN

## `shared/` — 2,866 lines, the engine. **V for all 20 modules.**

| File | Lines | Verdict | Note |
|---|---|---|---|
| `engine.ts` | 652 | **V** | pure state machine; `Uint8Array`; hostile-input guards |
| `shade.ts` | 388 | **V** | deduction ladder + envelope |
| `sudoku.ts` | 309 | **V** | seeded generator |
| `phaseScript.ts` | 284 | **V** | boss arcs |
| `replay.ts` | 182 | **V** | echo wire contract |
| `inkLedger.ts` | 151 | **V** | server verdict law |
| `orders.ts` | 133 | **V** | 4 Orders + `FOLIOS` campaign data + counter map |
| `tutorial.ts` | 127 | **V** | scripted M0 |
| `endless.ts` | 128 | **V** | ladder |
| `weekly.ts` | 124 | **V** | weekly mods |
| `personalShade.ts` | 130 | **V** | echo mining |
| `echoShare.ts` | 120 | **V** | pure base64url, no Buffer/btoa |
| `config.ts` | 142 | **V** | every tunable |
| `rng.ts` | 37 | **V** | `Rng`, `todayUtcKey` |
| `index.ts` | 8 | **V** | barrel |
| (`endless`/`weekly`/`phaseScript`/`shade`/`orders` also export the campaign/foe data used by screens) | | | |

**Rule: never copy `shared/` into `mobile/`.** Alias `@shared/*` → `../shared/*`. One engine, two consumers (web PWA + mobile). Drift is impossible.

## `src/game/` — runtime

| File | Lines | Verdict | Work |
|---|---|---|---|
| `localDuel.ts` | 377 | **S** | drop `navigator.vibrate` ×3 → `haptics`; drop `'use client'`; `performance.now`/rAF keep; audio calls → `audio` interface |
| `serverDuel.ts` | 223 | **S** | `localStorage.getItem('assize-secret')` ×2 → `storage.getSecret()`; rest unchanged |
| `fx.ts` | 162 | **V** | pure law — the crown jewel of the port |
| `echoes.ts` | 68 | **S** | IDB → expo-sqlite table; logic (`validateReplay`, ring trim) stays in `shared/replay` |

## `src/state/`

| File | Lines | Verdict | Work |
|---|---|---|---|
| `save.ts` | 143 | **S** | `idbGet/idbSet` → storage interface; `structuredClone` verify; `migrate()` untouched |
| `inkLedger.ts` | 56 | **S** | imports only |
| `ui.ts` | 63 | **S** | `synth.pageTurn()` → `audio.pageTurn()`; **the screen machine itself is unchanged** |
| `identity.ts` | 50 | **S** | `crypto.subtle` → expo-crypto; `randomUUID` → shim; storage → secure store |
| `idb.ts` | 64 | **R** | becomes `platform/storage.ts` (MMKV/SQLite) — same 4-function shape |

## `src/net/client.ts` — 120 lines · **S**
Remove the `XTransformPort` sandbox hack (`?XTransformPort=3030`) → point at a real origin. Everything else identical.

## `src/audio/synth.ts` — 290 lines · **R**
18-method interface reimplemented over `expo-audio`. Graph code is deleted, not ported.

## `src/app/game/` — 4,122 lines · **R** (RN components)

| Group | Files | Lines | Notes |
|---|---|---|---|
| Duel core | `DuelScreen` 443, `Board` 221, `useDuelSession` 260, `NumPad` 64, `AbilityBar` 64, `HudHeader` 61, `HudBits` 100 | 1,213 | the critical path; `Duel.module.css` 622 lines → tokens + Reanimated |
| Shell/nav | `GameShell` 91, `BootScreen` 37, `OfflineScreen` 40, `Versus` 61, `Matchmaking` 100, `ResultScreen` 86 | 415 | switch statement ported as-is |
| Campaign | `FolioMap` 57, `FolioDetail` 73, `StoryCard` 52, `EndingChoice` 148, `Antechamber` 94, `Ribbon` 49, `OrderSelect` 80 | 553 | |
| Meta/economy | `CabinetScreen` 166, `LedgerProfile` 221, `SeasonLedger` 76, `PurseScreen` 37, `ReliquaryScreen` 92, `SettingsScreen` 118 | 710 | clipboard/share/`<a download>` sites live here (Finding 3 #15) |
| Modes | `DailyScreen` 107, `WeeklyScreen` 79, `EndlessScreen` 75, `EchoesScreen` 230, `FriendScreen` 105 | 596 | `EchoesScreen` + `FriendScreen` hold the clipboard/localStorage sites |
| util | `rank.ts` 13 | 13 | **V** |

## Data (no porting work)
`src/i18n/en.json` (24 KB) · `src/i18n/story.json` (12 KB) · `docs/STORY.md` · `public/assets/**` (**210 files, 17.67 MB** — already copied byte-identical to `mobile/assets/game/`, do not re-copy).

**Fonts — decision settled:** the 6 `.woff2` files are **not** converted to `.ttf`/`.otf`. RN
needs TTF/OTF and converting is pure risk for zero design benefit, since the exact families
(IM Fell English SC, IM Fell DW Pica, Libre Caslon Text — all OFL) are already on Google Fonts.
Use `@expo-google-fonts/im-fell-english` + `@expo-google-fonts/libre-caslon`. The `.woff2`
originals stay in `mobile/assets/fonts/` as the record of what shipped on the web.

## Server (`mini-services/assize-server/`) — 555 lines · **unchanged by the RN port**
It is Node/Bun code on its own host; it never enters the mobile bundle. Postgres migration is a *separate* workstream (`specs/02`), not part of this delegation.

## Explicitly out of scope for the mobile pass
- Web PWA (`src/app/**`, service worker, `manifest.webmanifest`, `robots.txt`) — stays as the legacy web build.
- **The dead 5,104-line shadcn/Tailwind scaffolding** (`src/components/ui/**`, `src/hooks/**`, `src/lib/db.ts`, `src/lib/utils.ts`, `prisma/schema.prisma`, `src/app/api/route.ts`, `tailwind.config.ts`, `components.json`, `postcss.config.mjs`, `src/app/globals.css`) — verified zero imports. See `14` §9. Note the game hand-rolls its modals (`.modal-backdrop` + `role="dialog"`), so **no shadcn component is ever ported.**
- `examples/`, `scripts/`, `tool-results/`, `.zscripts/`, `download/`, `upload/`, the 98 MB `sudokou game` tar-of-`.git` file, and `db/assize.db_mode=ro` — sandbox scratch (R5 risk: nothing here is game code). `skills/` no longer exists — it is gitignored.
- Baseline tsc errors in `examples/`, `mini-services/`, `scripts/`.
- Postgres migration, RevenueCat, Detox/emulator E2E, store submission (phases 1, 5, 6 of `specs/12`).
