# 00 — Current State Analysis (the web build)

## One-liner
**ASSIZE** is a complete, playable 1v1 sudoku-duel PWA: "law is settled by solving" — two pleaders race the same sealed 9×9 Tablet, claims crack wax Seals, and 12 engraved rites hinder the foe. Dark medieval-grimoire art direction, not a kids' game.

## Architecture today

```
[Next.js 16 PWA client]  ──REST──▶  [Fastify + socket.io duel server :3030]
        │                                │
        │ M0/M1/M5/Shade/Echo duels      │ bun:sqlite (db/assize.db)
        └─ run ENTIRELY on the local     │ accounts, duels, daily_results,
           pure-TS engine (shared/)      │ streaks, telemetry
        │ Echoes/Ink/save                │
        └─ Zustand + IndexedDB           │
```

### Engine (`shared/`, ~20 pure-TS modules, zero DOM deps)
- `engine.ts` — duel state machine, placement, claims, statuses, win law, `swapOrder()`, adversarial-hardened entry points (16 guards), byte-deterministic `serializeDuel`.
- `sudoku.ts` — deterministic puzzle generator (seeded).
- `orders.ts` — 4 Orders × (passive + 3 rites), counter-swap map.
- `shade.ts` — opponent AI: deduction ladder (4 tiers), site-sink tempo adaptation under a hard envelope (`PROFILE_ENVELOPE`/`clampProfile`).
- `phaseScript.ts` — boss arcs (monotonic phase ladders).
- `tutorial.ts` — fully scripted M0 lesson (deterministic, Shade always loses).
- `endless.ts`, `weekly.ts` — deterministic ladder / weekly-modifier duels.
- `replay.ts` — echo recorder/validator/driver; `echoShare.ts` — `ASSIZE1-` copy-paste codes, structural two-way name redaction.
- `personalShade.ts` — mines a ShadeProfile from a recorded echo.
- `inkLedger.ts` — server-verdict law (verified/bounded/dropped) for Ink awards.
- 14 Vitest suites, ~480 tests, all green; `tsconfig` clean for `shared/` + `src/`.

**Asset inventory:** **210 asset files, 17.67 MB** under `public/assets/` (140 `.svg`, 38 `.png`, 32 `.webp`) — plates, portraits, seals, sigils, UI chrome, map, reliquary; **220 files / 17.90 MB** for all of `public/` once you add `public/fonts/` (6 `.woff2`) and the 4 PWA root files; `assets/manifest.json` separately declares **173 asset *slots*** (the pipeline's slot register, a different quantity from the file count). Plus 6 woff2 fonts (IM Fell English SC, IM Fell DW Pica, Libre Caslon Text), PWA manifest + service worker, compressed PNGs (T9: 35.6 MB saved), React 19 + Zustand + **CSS Modules + `src/styles/tokens.css`** (the game does *not* use Tailwind — see `14` §9), WebAudio synth (`src/audio/synth.ts`).

### Server (`mini-services/assize-server/`, Bun + Fastify + socket.io)
- Guest auth (`/api/auth`): name + secret hash, Standing (Elo K=32/20), recovery codes, purchases, Ink balance + ledger, flagged/shadow.
- Ranked matchmaking (widening windows, 4 s Shade fallback), friend codes, daily leaderboard + streaks, recovery, Ink settlement (`/api/ink` with verdict law), telemetry.
- Disconnect: 20 s ticked grace, reconnect rejoin, rematch parity. PvP never adapts (parity by construction).
- Persistence: **bun:sqlite** WAL at `db/assize.db` — `accounts`, `duels`, `daily_results`, `streaks`, `telemetry`. (Prisma is present but its schema is the untouched User/Post template — effectively unused.)
- Next.js rewrites proxy `/socket.io/*` and `/api/*` to :3030 (see `next.config.ts`).

### Client mapping (relevant screens)
`BootScreen → Antechamber (hub) → DuelScreen`; `Board/NumPad/AbilityBar/HudHeader/Ribbon/Versus/Matchmaking`; `ResultScreen, DailyScreen, WeeklyScreen, EndlessScreen, EchoesScreen, CabinetScreen, LedgerProfile, PurseScreen, SeasonLedger, ReliquaryScreen, SettingsScreen, OrderSelect, FolioMap/FolioDetail, EndingChoice, FriendScreen, OfflineScreen, StoryCard, GameShell`.

### State
- `save.ts` — Zustand + IndexedDB (`idb.ts`): campaign progress, ending, economy, echoes ring (12), achievements, settings.
- `identity.ts` — guest identity (name gen, recovery code, SHA-256 hash), stored in IDB.
- `inkLedger.ts` — pending Ink entries flushed to `/api/ink`, offline-safe.

### Known gaps / bugs carried from web (fix in mobile, not paper over)
- `crypto.subtle` for recovery hashing — needs `expo-crypto` on mobile. **`crypto.randomUUID` (`identity.ts:48-49`) needs a shim over `getRandomValues`** — `expo-crypto` does not provide it.
- `idb.ts`, `echoes.ts`, `identity.ts` touch IndexedDB directly — needs a storage shim.
- `synth.ts` needs `window.AudioContext` — no RN equivalent; see `07` (pre-rendered + `expo-audio`, not a WebAudio clone).
- Clipboard/share: `document.execCommand` fallbacks in EchoesScreen — replace with `expo-clipboard`/`expo-sharing`.
- Download/export flows use `<a download>` — replace with `expo-file-system` + share sheet.
- `localStorage` reads/writes (friend code, matchmaking, `assize-secret`) — replace with MMKV.
- `structuredClone` (`save.ts:110`) — present in Hermes under the New Architecture; verify, polyfill only if absent.
- `next.config.ts` sets `typescript.ignoreBuildErrors: true` — **the web build never type-checked at build time.** Baseline tsc errors remain in `examples/`, `mini-services/`, `scripts/` — untouched by design. (`skills/` is referenced in older notes but does not exist; it is gitignored.)
- T1: Playwright smoke tests never landed; T5: monetization is a stub (`MonetizationProvider` shape, candles free-capped 3/day).

### Dead weight in the web repo (verified zero imports — safe to delete, see `14` §9)
- **5,104 lines across 52 files**, none of it part of the game:
  - `src/components/ui/**` — the entire **48-file shadcn/ui kit** (4,911 lines). Verified: **no screen in `src/app/game/` imports any of it**; the only importers are other shadcn files.
  - `src/hooks/use-toast.ts`, `src/hooks/use-mobile.ts` (178 lines) — imported *only* by the dead `sidebar.tsx` / `toaster.tsx`.
  - `src/lib/db.ts` + `prisma/schema.prisma` — **Prisma is a dead dependency chain.** `db.ts` instantiates `PrismaClient`, but nothing imports `db.ts`; the schema is the untouched `User`/`Post` template; the real DB is `bun:sqlite` with handwritten queries in `mini-services/assize-server/db.ts`.
  - `src/lib/utils.ts` (`cn()`) — consumed only by the dead shadcn files.
  - `src/app/api/route.ts` — a 4-line `"Hello, world!"` stub.
- **Dead build tooling:** `tailwind.config.ts` (content globs point at `./pages/**`, `./components/**`, `./app/**` while the real code is `src/app/**` — it scans nothing), `components.json`, `postcss.config.mjs`, `src/app/globals.css` (~200 lines of shadcn HSL vars). Verified **zero Tailwind utility classes in any game screen.** Removing `globals.css` requires a one-line edit to `src/app/layout.tsx:2`.
- **~50 dead npm dependencies** — all 3 `@dnd-kit/*`, `@hookform/resolvers`, `@mdxeditor/editor`, `@reactuses/core`, both `@tanstack/*`, `date-fns`, `framer-motion`, `next-auth`, `next-intl`, `react-markdown`, `react-syntax-highlighter`, `recharts`, `uuid`, `z-ai-web-dev-sdk`, `zod`, `tailwindcss-animate`, and ~30 `@radix-ui/*` (used only by the dead shadcn kit). ⚠️ `react-dom` greps as unused but is **required by Next.js** — do not remove.
- **Sandbox/agent scratch (~102 MB), never part of the game:** a bare **98 MB tar archive of `.git/` accidentally committed as the 0-extension file `sudokou game`**; `tool-results/` (18 dumps); `scripts/shots/` (27 E2E PNGs); `.zscripts/`; `examples/`; `download/`; `upload/`; and `db/assize.db_mode=ro` — a 0-byte artifact of an unquoted shell redirect (`db/assize.db?mode=ro`).

## Verdict
The engine is **mobile-ready by accident**: pure TypeScript, deterministic, fully tested, no DOM. The work is (a) shell: UI port to RN, (b) shell: platform storage/audio/haptics, (c) server port to a real Postgres-backed host, (d) store compliance. The engine and all assets carry over.

Do **not** port the 5,104 lines of shadcn/Tailwind scaffolding — it is not part of the game.
