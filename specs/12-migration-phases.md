# 12 — Migration Phases

Ordered by dependency, with exit criteria. Do not reorder.

## Phase 0 — Repo re-structure (1 week)
- New repo root: `apps/mobile` (Expo), `apps/web` (the current Next.js tree, frozen), `shared/` (unchanged, the single source of truth), `mini-services/assize-server`, `db/`, `assets/` (moved to a shared `public/`-style package or imported by path).
- Verify `bun run test` still passes for `shared/` from the new root.
- Exit: Vitest green, Next.js PWA still serves locally from `apps/web`.

## Phase 1 — Backend on Postgres (1–2 weeks)
- Translate DDL to Postgres (`02`), port `mini-services/assize-server/db.ts` to `postgres.js`/Drizzle, migrate the SQLite data, point staging server at it.
- Run `t13_wire_e2e.py` against staging.
- Exit: auth/matchmaking/daily/ink/recovery green against Postgres; SQLite retired.

## Phase 2 — RN shell, solo modes first (2–4 weeks)
- Expo Router shell with BootScreen → Antechamber → DuelScreen.
- Port `shared/` wiring (`LocalDuel`, `specFromUi`), MMKV save, identity with secure-store, echoes ring in expo-sqlite.
- Port the board as SVG + NumPad + ability bar; Reanimated for J1–J4 fx laws (pure fx in `src/game/fx.ts` ports as-is).
- Tutorial duel end-to-end in the sim; daily duel; practice; endless; weekly; campaign Folio I.
- Exit: a playable solo loop (boot → 27-folio campaign skeleton → endless) with Vitest still green.

## Phase 3 — Realtime (1–2 weeks)
- socket.io client against staging server; ranked queue; friend duel; disconnect-grace modal; rejoin flow.
- AppState background/resume handling.
- Exit: two-sim ranked duel with ServerDuel authority, forfeit-on-timeout, Shade fallback.

## Phase 4 — Content & polish (2–3 weeks)
- All 27 folios, story cards, interludes, ending choice, echoes shelf + sealed chits, Reliquary, season ledger, cabinet, ledger profile, settings (motion/contrast/text size/language), weekly/daily/endless screens.
- Audio: react-native-audio-api adapter for the dynamic layers + pre-rendered stings; haptics parity.
- Asset pipeline: woff2→ttf/otf, expo-image prefetch, map/plate lazy loading.
- Detox E2E suite green; device matrix run.

## Phase 5 — Store (1 week)
- EAS Submit; privacy manifest; IAP products live via RevenueCat webhook; screenshots; age rating (4+ / E10+ suggested); beta via TestFlight/Play internal.
- Exit: public TestFlight + Play internal link with no blockers.

## Phase 6 — Monetization & live ops (ongoing)
- Patron's Pouch, Candles consumables, ad rewards (AdMob), purchases webhook, webhook idempotency.
- Telemetry opt-out honored server-side.
- OTA for weekly content drops; server-side weekly rotation of the weekly writs (already deterministic by week index).

## Phase 7 — Decommission web (optional)
- Once native 1.x is stable, mark the PWA legacy or redirect it to the store listings; keep `shared/` as the only fork point.

## Rule for all phases
Every phase ships with (a) Vitest green, (b) `tsc` clean on the RN tree, (c) no new dependencies without a noted alternative in the spec that chose it.
