# ASSIZE

A 1v1 sudoku duel in a plague-walled medieval city where law is settled by solving. Race the same sealed Tablet against a Shade, claim rows, columns and boxes to crack each other's wax Seals, and cast engraved rites — Chains, Smudges, Hushes, Miasmas, Quarantines — to hinder one another. Adult, grim, restrained: an engraved grimoire, not a kids' game.

```
The Tablet does not forgive. Neither, I find, do I.
```

## What this is

A complete, playable, web-first implementation of the ASSIZE design document:

- **M0 Tutorial duel** — boots straight into a live board against the Shade of Orsolo (no login, no menu — spec R1), with margin-note teaching and a free Augur.
- **M1 Campaign** — the Nine Folios: 9 Magistrates × 3 duels = 27 duels, Easy → Expert, Magistrates with 8 Seals, story cards, prologue, two interludes, the Orsolo reveal, both endings (all text in `docs/STORY.md`).
- **M2 Ranked duel** — authoritative server matchmaking (socket.io over WebSocket) with widening Standing windows and a Shade fallback at 4 s.
- **M3 Daily Assize** — one seeded puzzle per UTC day, +10 s per mistake, global top-100 leaderboard, server-tracked "Unbroken Days" streaks.
- **M4 Friend Duel** — create a code/link, both parties queue with it, unrated.
- **M5 Practice** — any difficulty, hints allowed, small daily Ink cap.
- **4 Orders / 12 abilities / 5 statuses** with the exact anti-frustration rules; Momentum, Clean claims, Flinch; all four win conditions in the specified order.
- **Economy & meta** — Ink, Sigils, Reliquaries (every 3rd win), Season Ledger (30 tiers), Cabinet with 26 cosmetics across 6 tabs, profile with Standing graph, 24 achievements ("Marginalia"), Recovery Code, export/import.
- **PWA** — installable, offline-capable (service worker precaches the shell; M0/M1/M5/Shade duels run on the local engine).
- **Accessibility** — per-cell aria-labels, full keyboard play (1-9, arrows, Backspace, N, Q/W/E, Esc), 44 px touch targets, shape marks alongside colour, reduced-motion and high-contrast modes, text scaling.

## How to run

```bash
bun install            # or npm install
bun run db:push        # prisma schema (scaffold requirement; game data lives in SQLite/IndexedDB)
bun run dev            # Next.js client on :3000 (auto-started in this sandbox)
```

The authoritative duel/API server is a mini-service:

```bash
cd mini-services/assize-server && bun install && bun run dev   # REST + socket.io on :3030
```

Then open the preview URL (port 3000). Fresh load lands on the tutorial duel within ~2 s.

**Tests:** `bun run test` (Vitest, 35 engine tests: puzzle uniqueness and tier bands, claims/damage/Clean, Momentum, all 12 abilities, all 5 statuses + anti-frustration, win-condition order, determinism, serialization, Shade legality, campaign structure).

## Environment

No env vars are required. Optional: none. The SQLite database file is created at `db/assize.db` on first server start. No third-party calls at runtime (fonts self-hosted, sounds synthesized, art local).

## Architecture

```
shared/                 pure deterministic engine (spec R6) — used by BOTH client and server
  config.ts             every tunable number (mirrored in docs/BALANCE.md)
  rng.ts                seeded mulberry32
  sudoku.ts             generator + uniqueness counter + L1–L4 technique grader
  engine.ts             duel state machine: placement, claims, statuses, abilities, win order
  orders.ts             Orders, abilities, campaign definitions (9 folios × 3 duels)
  shade.ts              Shade AI (placement skill, mistake rate, ability cadence by Standing)
src/                    the client (Next.js 16, React 19, Zustand, CSS Modules + design tokens)
  app/game/             19 screens (S01–S20 minus none) + duel runtime wiring
  game/localDuel.ts     local engine harness (tutorial/campaign/daily/practice/Shade)
  game/serverDuel.ts    client mirror for authoritative duels (predict + reconcile)
  audio/synth.ts        every sound synthesized in WebAudio + generative drone/bowed/tension music
  state/                IndexedDB (versioned, migrations), guest identity, recovery codes, save store
  i18n/                 en.json (every UI string) + story.json (all narrative text)
mini-services/assize-server/   Fastify REST + socket.io; SQLite (bun:sqlite); matchmaking,
                               Shade fallback, duel rooms with server-side validation,
                               Elo, daily results/streaks, recovery, anticheat, telemetry
tools/                  asset pipeline (manifest of 173 assets, generators)
public/assets/          34 AI-generated raster assets + 139 procedural engraved SVGs
docs/                   STORY.md, BALANCE.md
assets/                 manifest.json (id/path/size/prompt/status per asset), style-prefix.txt, prompts.md
```

**Protocol** (spec §6): client → server `{join_queue, join_duel, place, ability, pencil, concede, reconnect}`; server → client `{matched, you (state_delta), end, reconnect_ok}`. The solution never leaves the server in PvP; placements are validated server-side; clients reconcile from 250 ms authoritative pushes.

## Decisions made (and why)

1. **Next.js 16 instead of Vite, bun instead of pnpm, socket.io instead of raw `ws`, bun:sqlite instead of better-sqlite3.** The delivery sandbox mandates the Next.js app on port 3000 as the only externally visible route, with one exposed port and a gateway that forwards via `XTransformPort`; socket.io is the sanctioned WebSocket transport and `bun:sqlite` is the same SQLite engine without a native build. The spec's architecture (monorepo layout, `/shared` engine used by both sides, authoritative server, IndexedDB saves, SQLite on the server) is preserved exactly; only the build tooling differs. `pnpm` users: any package manager works — the workspaces are plain relative imports.
2. **Asset pipeline A + C mixed, per asset, recorded in the manifest** (spec §9): the 16 portraits, 15 story plates, folio map, OG image and app icon are AI-generated from `assets/style-prefix.txt` + per-asset prompts (`status: generated`); the entire UI kit, sigils, seals, stamps, overlays, rank emblems, achievement icons, reliquary frames and textures are **procedural engraved SVG** (`status: procedural`) — seeded, deterministic, crisp at any DPI, zero licensing risk. Every one of the 173 manifest slots exists; there are no placeholders.
3. **First-use cooldown read as "the first use incurs 50 % cooldown"** (spec §2). The alternative reading ("abilities begin 50 % charged") would let an Executioner open with Sever after 12.5 s; the chosen reading is the more conservative and keeps first-use symmetric.
4. **Quarantine defers rather than cancels a claim** (spec §2 "cannot be claimed by them for 12 s"): completing a quarantined unit queues the claim, which resolves when the quarantine ends. Cancelling outright would read as "unclaimable for 12 s and forfeited after".
5. **Mirror/bulwark/ward precedence**: reflect > negation > anti-frustration gates, so a reflected status can land even inside the 4 s gap (it is a new incoming status from the reflector's side and respects the gates).
6. **Campaign Shades are honest** (spec R7): every non-human opponent is labelled *Shade* with an ink-echo mark and never counts for Standing.
7. **Difficulty tiers are enforced by givens band + technique grade with a documented tolerance** — a true "must require X-wing" Expert puzzle is not reliably generable in budget, so Expert accepts grade ≥ 3 and records the actual grade (see BALANCE.md).

## Known limits

- PvP needs a second browser (any second tab on the same deployment works — matchmaking is queue-based, so one human + one tab → the 4 s Shade fallback fires; two tabs with a friend code → real PvP).
- The client owns Ink/Season progress (IndexedDB) by design; the server owns Standing, dailies, streaks, recovery and purchases. A determined user can inflate cosmetic currency — TODO T13.
- Payments and rewarded ads are stubbed (TODO T5). No real money moves.
- Solver-app assistance cannot be fully prevented (honest, per spec §6): the server applies speed/uniformity sanity checks and shadow-queues, but a solver feeding moves at human pace is undetectable.
- See `TODO.md` for the full honest list (15 items, T1–T15).

## Credits

Design document: supplied brief (spec §0–§14). Typefaces: IM Fell English SC, IM Fell DW Pica (The Scriptorium via Google Fonts, OFL), Libre Caslon Text (Impallari Type, OFL). All art, audio, text and code generated for this build.
