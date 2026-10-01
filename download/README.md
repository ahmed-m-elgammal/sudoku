# ASSIZE

A 1v1 sudoku duel in a plague-walled medieval city where law is settled by solving. Race the same sealed Tablet against a Shade, claim rows, columns and boxes to crack each other's wax Seals, and cast engraved rites — Chains, Smudges, Hushes, Miasmas, Quarantines — to hinder one another. Adult, grim, restrained: an engraved grimoire, not a kids' game.

```
The Tablet does not forgive. Neither, I find, do I.
```

---

## The pitch, in one paragraph

You were Magister Orsolo's clerk when they hanged him for forging the Great Ledger. An ink-echo wearing his voice — a *Shade* — teaches you the Reckoning, and you climb the Nine Folios: nine Magistrates, twenty-seven duels, each settled on a sealed 9×9 Tablet. Both pleaders solve the same puzzle. Wrong ink cracks your own wax Seals; completing a row, column or box claims it and wounds your foe. Rites hinder, passives protect, and the first pleader to break the other's Seals — or fill the Tablet — prevails. At the top of the ledger waits a twist the interludes have been whispering about since Folio III, and after it, the only choice in the game that the Ledger remembers forever: **balance the truth, or burn it.**

---

## What this is

A complete, playable, web-first implementation of the ASSIZE design document:

- **M0 Tutorial duel** — boots straight into a live board against the Shade of Orsolo (no login, no menu — spec R1), margin-note teaching, a free Augur, and a **fully scripted, deterministic lesson** in which the Shade always loses (T3).
- **M1 Campaign** — the Nine Folios: 9 Magistrates × 3 duels = 27 duels, Easy → Expert, Magistrates with 8 Seals, prologue, story cards, two auto-triggered interludes (T15), the Orsolo reveal, **Orsolo's adaptive Order swap** (T4), and the **Balance / Burn ending choice** (T6). All narrative text: `docs/STORY.md`.
- **M2 Ranked duel** — authoritative server matchmaking (socket.io over WebSocket) with widening Standing windows, a Shade fallback at 4 s, server-side move validation, Elo (K=32, K=20 above 1600) and anticheat heuristics.
- **M3 Daily Assize** — one seeded puzzle per UTC day (same for every soul), +10 s per mistake, global top-100 leaderboard, server-tracked "Unbroken Days" streaks, Offer-a-Candle retries.
- **M4 Friend Duel** — create a code/link, both parties queue with it, unrated.
- **M5 Practice** — any difficulty, hints allowed, small daily Ink cap.
- **T7 Shade Echoes** — your human duels (practice, daily, Shade, echo duels) are recorded as compact, validated replay logs; the Antechamber's *Shade Echoes* shelf lets you duel the recorded ink of any past duel as an opponent. Echo validation is fail-closed; a corrupted echo degrades visibly to an ordinary Shade, never a crash.
- **4 Orders / 12 abilities / 5 statuses** with the exact anti-frustration rules; Momentum, Clean claims, Flinch; all four win conditions in the specified order.
- **Economy & meta** — Ink, Sigils, Reliquaries (every 3rd win), Season Ledger (30 tiers), Cabinet with 26 cosmetics across 6 tabs, Great Ledger profile with Standing graph, 24 achievements ("Marginalia"), Recovery Code, export/import.
- **PWA** — installable, offline-capable (service worker precaches the shell; M0/M1/M5/Shade duels run entirely on the local engine).
- **Accessibility** — per-cell aria-labels, full keyboard play (1-9, arrows, Backspace, N, Q/W/E, Esc), 44 px touch targets, shape marks alongside colour, reduced-motion and high-contrast modes, three text sizes.

### The duel, in thirty seconds

| Thing | Rule |
|---|---|
| Tablet | one shared 9×9 puzzle, separate boards; givens are permanent, correct ink is final |
| Placement | tap a cell, tap a numeral (or keyboard 1-9); a wrong digit costs **1 Seal** and "Flinches" your cooldowns for 3 s |
| Claims | complete a row/column/box to claim it: **1 Seal** damage, **2 if Clean** (no mistake of yours in that unit, never Augur-revealed) |
| Momentum | every correct placement shaves 0.5 s off all your cooldowns |
| Rites | 12 abilities across 4 Orders, each with its own cooldown; first cast of each starts at 50 % cooldown |
| Statuses | Chain (cell locked 8 s), Smudge (5 digits blurred 7 s), Hush (pad dead 2.5 s), Miasma (notes erased, pencil barred 10 s), Quarantine (unit unclaimable 12 s) |
| Anti-frustration | 4 s global gap between incoming statuses, 5 s per-type immunity after one ends, statuses banned in the final 10 s |
| Win | **Seal death** → **Reckoning** (fill the Tablet) → **Sudden Judgment** at 10:00 (Seals → claims → mistakes → draw) → **forfeit** |
| Disconnects | 20 s server-ticked grace with a live countdown modal; reconnect rejoins instantly (T2) |

### The four Orders

| Order | Passive | Rites |
|---|---|---|
| **Scholar** (Quill) | Marginalia — first mistake forgiven | Augur (reveal a digit) · Unseal (clear statuses + 6 s immunity) · Fair Copy (auto-candidates for a box) |
| **Executioner** (Axe) | Last Rites — claims +1 when foe ≤ 3 Seals | Sever (chain their tightest unit) · Hush (pad dead 2.5 s) · Reckoning (next claim +1) |
| **Apothecary** (Vial) | Distiller — your statuses last +2 s | Smudge (blur 5 digits) · Tincture (+1 Seal, ×2 per duel) · Miasma (erase notes 10 s) |
| **Warden** (Lantern) | Bulwark — first incoming status negated | Ward (negate next 15 s) · Mirror (reflect next 10 s) · Quarantine (deny a unit 12 s) |

All four are free via play: Apothecary unlocks after Folio II, Warden after Folio IV.

---

## What landed in this iteration (T4 + T6, plus the small things around them)

### T4 — Orsolo's adaptive swap (Folio IX, duel III)

The final duel is no longer a fixed loadout. **When Magistrate Orsolo falls to 4 Seals, he sets his Order aside and takes up the one that answers yours** — *"I have worn nine Orders waiting for you."*

- **Engine:** `swapOrder()` in `shared/engine.ts` — one atomic mid-duel change. Ability runtimes are rebuilt fresh (first casts start at the 50 % factor), the incoming Order's passive arrives unworn, outgoing Reckoning/Ward/Mirror windows lapse, and everything earned or suffered — Seals, claims, board, statuses, immunity — is preserved exactly.
- **The counter map** (`shared/orders.ts`): Scholar → Apothecary (smoke buries an information Order), Executioner → Warden (bulwark eats and reflects burst), Apothecary → Executioner (reckoning races the vial), Warden → Scholar (information out-tempos a wall). If Orsolo already wears the counter, he rotates one step further — deterministic, no rng.
- **Trigger:** `LocalDuel.checkAdaptive()` runs on the frame loop, so it catches Seal loss from *any* source the instant it lands (claims, Reckoning bonus, Last Rites). One swap per duel, never after the duel ends. PvP never adapts.
- **Presentation:** a non-blocking brass callout over the board — "HE ADAPTS." with the old portrait → arrow → glowing new portrait, ~4.2 s, `pointer-events: none` so play never stops — a synthesized sting (bowed fall, wax crack, floor boom), haptics, a Ticker line naming both Orders, and the HUD portrait flips automatically.
- **Tests:** 9 new Vitest cases (`shared/__tests__/adaptive.test.ts`) covering the counter map's totality/determinism, runtimes rebuilt, passives unworn, windows lapsed, state preserved, and no-op refusal.

### T6 — the Balance / Burn ending choice

The campaign now **ends the way the story bible always said it would**. First clear of Folio IX duel III routes straight past the result screen:

1. **The Orsolo reveal** — the full-screen plate that shipped unused until now ("They hanged a body shaped like me…"), tap-through like every story card.
2. **S19 EndingChoice** — two engraved verdict panels: **Balance the Ledger** (brass, scales) and **Burn the Ledger** (oxblood, fire), each with its painted plate, a one-line price, keyboard 1/2 + Enter + Esc, and a confirm modal: *"The choice is remembered in your save. It cannot be un-written."*
3. **The chosen ending** plays as a full StoryCard (`story.endings.*` — "THE LEDGER IS BALANCED." / "THE LEDGER IS BURNED.") and closes into the **Endless Assize** (ranked play continues).
4. The verdict is written to `save.campaign.ending` (`'balance' | 'burn'`); the Antechamber Folios card thereafter reads *"The Ledger is Balanced/Burned. The Endless Assize continues."* Replaying the final duel skips the beat (first-clear guard) and shows the normal result screen.

**Logic completion found while wiring this:** the achievement system existed but `unlockAchievement` was never called anywhere — *First Verdict*, *The First Folio*, *Halfway Hanged* and *The Ninth Seal Broken* are now actually awarded at the right moments (idempotently, so replays stay clean).

---

## What landed in this iteration (T7 + the engine hardened under real adversarial testing)

This iteration had two equal halves: the **T7 Replay Shades** feature, and a **testing pass with one rule — write the tests that break it, not the tests that pass.** The second half changed the engine as much as the first.

### T7 — Replay Shades (the ink-echo shelf)

Per spec §7, "a Shade is an ink-echo that duels on someone's behalf." Every recordable human duel now leaves one behind:

- **Recording** (`shared/replay.ts` + `LocalDuel`): your placements (mistakes included — an echo must stutter like you did), abilities and resign are logged as `{t, kind, …}` with engine-clock timestamps. The log is capped at 4000 actions, sealed at duel end, and self-validated on assembly (`buildReplay` returns `null` rather than emit a poisoned echo).
- **Validation is fail-closed**: `validateReplay()` never throws, never returns the payload by reference (fresh objects only — `__proto__` smuggling dies there), and rejects wrong versions, bad seeds/tiers/orders, out-of-range cells/digits/units/timestamps, decreasing timestamps, unknown ability ids, oversized logs and hostile outcome blocks. 24 rejection cases pinned in `shared/__tests__/replay.test.ts`.
- **Playback** is clock-driven, not wall-clock driven: `ReplayDriver.due(state)` releases recorded actions when the *engine* clock reaches them, so pausing the duel pauses the echo with it. Replayed actions run through the same shared engine on the echo's own tablet — refused actions (the live duel's statuses differ from the original's) simply fizzle: *an ink-echo stutters where the ink was disturbed.*
- **Degradation is visible**: a replay that fails validation sets `replayDegraded` and the foe falls back to the calibrated Shade — the duel always runs.
- **The shelf** (`EchoesScreen`): the Antechamber card lists stored echoes ("Shade of ⟨name⟩ · Tier · N ink · won/lost/unfinished"); tapping one enters a replay duel. Storage is the (previously unused) `duels` IndexedDB store with a newest-12 ring buffer; every row is re-validated on read, and a corrupted row is skipped, not shown.
- **Determinism proof**: the same echo against the same scripted opponent produces byte-identical final state (`serializeDuel` equality), and the echo's tablet carries exactly the recorded ink.

### The adversarial pass — probes first, then tests that fail, then fixes

A throwaway probe script (`scripts/probe-engine.ts`) attacked the engine like a hostile client would. **It found 4 crashes and 4 semantic holes in the shipping engine** — the exact "fake green" the previous suite could never reveal:

| Attack | Old behaviour |
|---|---|
| `place(st, 2, …)` / `useAbility(st, -1, …)` / `cellFlags(st, 9)` | **TypeError crash** (no seat validation) |
| `place(st, 0, cell, 2.5)` and `digit = NaN` | **accepted as a mistake, burned a Seal** (`NaN < 1` is false) |
| `tick(st, NaN)` | **permanent soft-lock** — clock stuck at NaN, nothing ever expires |
| `tick(st, -5000)` | **time travel** — statuses re-arm, immunity extends |
| `fairCopy` with `cell = NaN` | **TypeError crash** on `UNIT_CELLS["bNaN"]` |
| `swapOrder(st, 0, "blast")` | **TypeError crash** on `ORDER_ABILITIES[bad].map` |
| `applyStatus(…, 'curse')` | **NaN-lived status** pushed into state |
| `createDuel({ seals: [-5, 100] })` | silent duels with dead/immortal players |

All sixteen entry points are now hardened (seat validation everywhere, integer digit/cell/unit/type validation, finite-and-positive clock deltas, RangeError on impossible Seals at construction, shape-validated snapshots with a precise `malformed duel snapshot: …` error, uint32 rng state in the serialization contract) — and every fix is pinned by a test that *used to fail*, so the hardening cannot silently regress.

**The shipped suite also had a luck-pass**: "every ability casts from a fresh board" only passed because the foe's seeded placements happened to drop Seals below Tincture's cap first. The new A1 test builds every precondition explicitly — no test here passes for a reason it doesn't name.

### The three test layers now in place (258 tests total)

1. **Adversarial engine suite** (`shared/__tests__/adversarial.test.ts`, 168 tests): hostile-input rejection (H1–H16); a **fuzz harness** running 120 seeded random duels × 240 steps (valid + hostile placements, abilities, ticks, swaps, direct status applications) checking ~20 invariants after *every* step (boards ⊆ solution, givens immutable, progress bookkeeping, mistakes ledger, claims ↔ unitOwner bijection, seals bounds, cooldown floors, status well-formedness, event-seq integrity, phase/winner consistency) — and re-running every script twice to demand **byte-identical** serialization (determinism is asserted, not assumed); the full status interaction matrix (Bulwark/Ward/Mirror precedence, gap-only-on-success, per-type immunity from the expiry tick, final-10s ban, Distiller's exact +2 s); clock/boundary behaviour (Flinch freeze windows, Momentum floors, Sudden-Judgment precedence including seal-death-beats-reckoning on the same placement, idempotent endings); every ability's contract with explicit preconditions; swap invariants (passives return unworn — Marginalia forgives *again* after a swap cycle); serialization round-trips byte-identical on rich mid-duel states including a live quarantine deferred-claim.
2. **Generator / RNG / AI fuzz** (`shared/__tests__/generators.test.ts`, 16 tests): 24+ puzzles across tiers re-verified for uniqueness, givens ⊆ solution, metadata honesty; `countSolutions` purity; grader termination on degenerate and contradictory grids; daily tier rotation pinned to a known calendar; malformed daily keys throw `RangeError` (a garbage key used to index `DAILY_TIERS[NaN]`); 50k-draw `Rng` bounds, permutation and mid-stream state-resume contracts; 30 seeded Shade runs asserting every placement lands legally; the tutorial script under a worst-case Clerk (never casts, never wins by its own hand — only by yours, which is the T3 contract).
3. **Replay suite** (`shared/__tests__/replay.test.ts`, 23 tests): the full hostile-payload matrix, recorder cap/seal semantics, driver clock semantics, headless LocalDuel record → replay determinism, corrupt-echo degradation, echo resign, past-the-buzzer actions never landing — plus **R23**, a regression test for the one bug only the browser caught (see Verification status).

**Every red test led to either an engine fix or a test fix, and the reason for each is recorded in the assertion message. Nothing was left artificially green.**

### Shipped in earlier iterations (kept for the record)

- **T4/T6/T15** — Orsolo's adaptive swap, the Balance/Burn ending choice, the auto-triggered interludes (detailed in the section above and in `docs/STORY.md`).
- **T2 — disconnect countdown:** server emits `peer_disconnected` / 1 s `reconnect_grace` ticks / `peer_reconnected`; the S08 modal shows the peer's name, a draining oxblood ring and the live seconds; your own line-drop shows a reconnecting banner and auto-rejoins. Socket flow covered 6/6 by `scripts/pvp-disconnect-test.mjs`.
- **T3 — scripted tutorial loss:** `shared/tutorial.ts` is a pure, seeded controller — the Shade holds its hand until your first true digit, races at 4.2–6.8 s/digit, slips after every third placement, takes at most ONE teaching claim, caps its correct ink at 22, and never casts. Deterministic on every seed; its "can only lose by your own hand" contract is now *also* fuzz-tested (G13) against a worst-case Clerk.

---

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

**Tests:** `bun run test` (Vitest, **258 tests** across six suites: 35 engine — puzzle uniqueness and tier bands, claims/damage/Clean, Momentum, all 12 abilities, all 5 statuses + anti-frustration, win-condition order, determinism, serialization, Shade legality, campaign structure; 7 tutorial scripting; 9 adaptive-swap; **168 adversarial engine**; **16 generator/RNG/AI fuzz**; **23 replay/T7**).

## Environment

No env vars are required. The SQLite database file is created at `db/assize.db` on first server start. No third-party calls at runtime (fonts self-hosted, sounds synthesized, art local).

## Architecture

```
shared/                 pure deterministic engine (spec R6) — used by BOTH client and server
  config.ts             every tunable number (mirrored in docs/BALANCE.md)
  rng.ts                seeded mulberry32 (uint32 state contract)
  sudoku.ts             generator + uniqueness counter + L1–L4 technique grader
  engine.ts             duel state machine: placement, claims, statuses, abilities,
                        win order, swapOrder() (T4), hostile-input hardening
  orders.ts             Orders, abilities, campaign definitions, ADAPTIVE_COUNTER (T4)
  shade.ts              Shade AI (placement skill, mistake rate, ability cadence by Standing)
  tutorial.ts           the scripted tutorial Shade (T3)
  replay.ts             T7: validated duel replays (recorder, fail-closed validator,
                        clock-driven ReplayDriver, echo-storage helpers)
  __tests__/            258 Vitest tests (engine / tutorial / adaptive / adversarial /
                        generators / replay)
src/                    the client (Next.js 16, React 19, Zustand, CSS Modules + design tokens)
  app/game/             21 screens (S01–S19 + EndingChoice + EchoesScreen) + duel runtime wiring
  game/localDuel.ts     local engine harness (tutorial/campaign/daily/practice/Shade/replay)
                        + checkAdaptive() trigger + swapBanner() (T4) + echo recorder/driver (T7)
  game/echoes.ts        T7: IndexedDB echo storage (validate-on-write, ring buffer, corrupt-row skip)
  game/serverDuel.ts    client mirror for authoritative duels (predict + reconcile,
                        S08 disconnect state; swapBanner() parity stub)
  audio/synth.ts        every sound synthesized in WebAudio + generative drone/bowed/
                        tension music + orderSwap() sting
  state/                IndexedDB (versioned, migrations), guest identity, recovery
                        codes, save store (campaign.ending lives here — T6)
  i18n/                 en.json (every UI string) + story.json (all narrative text)
mini-services/assize-server/   Fastify REST + socket.io; SQLite (bun:sqlite); matchmaking,
                               Shade fallback, duel rooms with server-side validation,
                               Elo, daily results/streaks, recovery, anticheat, telemetry
tools/                  asset pipeline (manifest of 173 assets, generators)
public/assets/          34 AI-generated raster assets + 139 procedural engraved SVGs
docs/                   STORY.md (story bible), BALANCE.md (numbers + reasoning)
```

**Protocol** (spec §6): client → server `{join_queue, join_duel, place, ability, pencil, concede, reconnect}`; server → client `{matched, you (state_delta), peer_disconnected, reconnect_grace, peer_reconnected, end, reconnect_ok}`. The solution never leaves the server in PvP; placements are validated server-side; clients reconcile from 250 ms authoritative pushes.

## Responsive by construction

The duel screen is one DOM tree with three layout zones (`.duelMain > .duelLeft / .boardArea / .controls`):

- **Portrait phones** — zones collapse to `display: contents` (classic stacked layout); the board sizes to `min(100cqw, 100cqh, 560px)` with container queries and a vh fallback.
- **Landscape phones** (≤ 560 px tall) — mirror + ticker move to a left column, numpad/abilities to a right column, HUD compresses.
- **Desktop ≥ 1100 px** — board centred between engraved side panels; short laptops (≤ 760 px tall) tighten the header.
- **Foldables / tablets (640–1099 px)** and **≤ 360 px phones** get their own gap/type tuning. 44 px coarse-pointer targets everywhere; reduced-motion kills every decorative animation (including the T4 glow); EndingChoice reflows from side-by-side to stacked via `auto-fit/minmax`.

Saves, identity, cosmetics and achievements live in **IndexedDB** (versioned, migrating); Standing, dailies, streaks, purchases and recovery live **server-side**. A four-word Recovery Code restores the server-known parts on another device.

## Decisions made (and why)

1. **Next.js 16 instead of Vite, bun instead of pnpm, socket.io instead of raw `ws`, bun:sqlite instead of better-sqlite3.** The delivery sandbox mandates the Next.js app on port 3000 as the only externally visible route, with one exposed port and a gateway that forwards via `XTransformPort`; socket.io is the sanctioned WebSocket transport and `bun:sqlite` is the same SQLite engine without a native build. The spec's architecture (monorepo layout, `/shared` engine used by both sides, authoritative server, IndexedDB saves, SQLite on the server) is preserved exactly; only the build tooling differs. `pnpm` users: any package manager works — the workspaces are plain relative imports.
2. **Asset pipeline A + C mixed, per asset, recorded in the manifest** (spec §9): the 16 portraits, 15 story plates, folio map, OG image and app icon are AI-generated from `assets/style-prefix.txt` + per-asset prompts (`status: generated`); the entire UI kit, sigils, seals, stamps, overlays, rank emblems, achievement icons, reliquary frames and textures are **procedural engraved SVG** (`status: procedural`) — seeded, deterministic, crisp at any DPI, zero licensing risk. Every one of the 173 manifest slots exists; there are no placeholders.
3. **First-use cooldown read as "the first use incurs 50 % cooldown"** (spec §2). The alternative reading ("abilities begin 50 % charged") would let an Executioner open with Sever after 12.5 s; the chosen reading is the more conservative and keeps first-use symmetric.
4. **Quarantine defers rather than cancels a claim** (spec §2 "cannot be claimed by them for 12 s"): completing a quarantined unit queues the claim, which resolves when the quarantine ends. Cancelling outright would read as "unclaimable for 12 s and forfeited after".
5. **Mirror/bulwark/ward precedence**: reflect > negation > anti-frustration gates, so a reflected status can land even inside the 4 s gap (it is a new incoming status from the reflector's side and respects the gates).
6. **Campaign Shades are honest** (spec R7): every non-human opponent is labelled *Shade* with an ink-echo mark and never counts for Standing.
7. **Difficulty tiers are enforced by givens band + technique grade with a documented tolerance** — a true "must require X-wing" Expert puzzle is not reliably generable in budget, so Expert accepts grade ≥ 3 and records the actual grade (see BALANCE.md).
8. **The adaptive swap rebuilds runtimes instead of rebalancing mid-fight** (T4): a phase-2 boss should *feel* like a phase change — fresh first-use cooldowns and a returning passive create a short, readable power spike, while keeping Seals/board/statuses means nothing the player earned is taken away. The counter is chosen from the player's *current* Order (not their loadout history) so the counterplay — an Order swap of your own, or saving rites for the swap — stays legible.
9. **The swap trigger lives in the runtime, not the engine** (T4): the engine's `swapOrder()` is pure and reusable; the *policy* (once per duel, at 4 Seals, never after end, only when `foe.adaptive`) stays in `LocalDuel` where the frame loop can watch for Seal loss from any source. The server never needs it — PvP has no adaptive foes — so `ServerDuel` carries only a `swapBanner()` parity stub.
10. **The finale replaces the result screen, once** (T6/T15): story beats fire on *first clear only* (guard: the duel's stars were empty before this win). Replays get the normal result screen — no re-litigating an ending the Ledger already recorded. Rewards (Ink, Reliquary progress, stats) are written before the beat plays, so skipping the result screen loses nothing.
11. **The ending is cosmetic, not mechanical** (T6): `campaign.ending` changes the epilogue, the reveal, and hub copy — never Standing, matchmaking, or rewards. The Endless Assize continues identically after either verdict; "Balance or Burn" is a moral record, not a meta buff. (Deliberately conservative: a mechanical split would need server authority over endings to stay honest.)
12. **Echo validation is fail-closed, not fail-open** (T7): a stored replay is untrusted data coming back from IndexedDB. It is re-validated on write *and* on read; a bad echo degrades the duel visibly to an ordinary Shade instead of crashing or replaying nonsense. The validator rebuilds every object fresh so nothing from storage escapes by reference.
13. **The replay clock is integer milliseconds at the recorder boundary** (T7): the engine clock is continuous (rAF deltas), but the replay contract is integer ms — `LocalDuel` rounds at record time, and `validateReplay` rejects fractions. The browser E2E caught what the integer-tick test harness could not; the regression test now drives fractional ticks on purpose.

## Verification status

- **258/258 Vitest green** (`bun run test`): engine 35, tutorial scripting 7, adaptive swap 9, **adversarial 168, generators/RNG/AI 16, replay/T7 23**.
- **`tsc --noEmit` clean** for `src/` and `shared/` (remaining project-level notes are sandbox scaffolding outside the app).
- **Adversarial red → fix → green is on the record**: the probe script and the new suites failed 106 times against the unhardened engine (4 crash classes, 4 semantic holes, 1 luck-pass exposed); every failure was either fixed in the engine or corrected in the test with the reason named, and the suite now passes from a clean run.
- **Browser-verified end-to-end** (agent-browser, 390×844): boot → tutorial → **won live** (race script) → result → hub → Practice → OrderSelect → duel → won → result. The browser pass caught a real bug the headless harness could not — the rAF clock is fractional and the replay validator (correctly) demands integer ms, so echoes silently failed to save; fixed at the recorder boundary and pinned by test R23, which now drives fractional ticks deliberately.
- **Socket-level disconnect flow** 6/6 via `scripts/pvp-disconnect-test.mjs` (T2).

## Known limits

- PvP needs a second browser (any second tab on the same deployment works — matchmaking is queue-based, so one human + one tab → the 4 s Shade fallback fires; two tabs with a friend code → real PvP).
- The client owns Ink/Season progress (IndexedDB) by design; the server owns Standing, dailies, streaks, recovery and purchases. A determined user can inflate cosmetic currency — TODO T13.
- Payments and rewarded ads are stubbed (TODO T5). No real money moves.
- Solver-app assistance cannot be fully prevented (honest, per spec §6): the server applies speed/uniformity sanity checks and shadow-queues, but a solver feeding moves at human pace is undetectable.
- The adaptive swap exists only in local (campaign/Shade) duels; bringing it to server-authoritative duels would need the swap decision (and its counter map) mirrored server-side — deliberately out of scope while PvP has no magistrates.
- Echoes are local-only for now (your own duels on your own device); sharing echoes between Clerks (export codes, or server-side anonymous echo pools for the matchmaking Shade fallback) is the natural next step and needs a privacy pass on the recorded names first.
- The browser session used for the echo-shelf walk went unreliable partway (stale hydration after HMR); the shelf's full happy path is covered by the headless replay suite instead, and the one bug the browser did surface is pinned by R23.
- See `TODO.md` for the full honest list (T1–T15, with T2/T3/T4/T6/T7/T12/T15 marked DONE).

## Future work

### The remaining TODO list (P1 → P2, full detail in `TODO.md`)

| ID | Area | What's missing | Effort |
|---|---|---|---|
| T1 | Tests | Playwright smoke suite (full tutorial + Shade duel + echo shelf) ported from the agent-browser drive script; CI parity | ~2 h |
| T5 | Monetization | Stripe Checkout + rewarded-ad SDK behind a `MonetizationProvider` (sell→own→equip loop already works; Patron's Pouch stubbed) | ~6 h |
| T8 | Privacy | Server-side telemetry opt-out sync (`/api/auth` carries the flag; server drops rows) | ~1 h |
| T9 | Performance | PNG compression + automatic WebP for brand/portrait/plate masters | ~0.5 h |
| T10 | PWA | Lighthouse audit (≥ 90 target) in a Chrome-capable environment | ~1 h |
| T11 | Legal | Counsel review of the privacy page + guest-identity/recovery mechanics | external |
| T13 | Economy | Server-side Ink ledger (client posts deltas with duel id; server verifies against its duel log) | ~2 h |
| T14 | i18n | Locale-switching runtime via `next-intl` (all copy already centralized in one catalog) | ~2 h |

### Design ideas beyond the TODO

- **Post-campaign content:** the adaptive-swap pattern generalizes — "rematch" Magistrates with a second swap phase, or an Endless ladder of multi-phase Shades that swap at thresholds (the engine's `swapOrder()` + counter map already support it; it needs data and a ladder mode).
- **An Order of your own to counter-pick:** expose an Order-swap token (one per duel, earned at 3 Seals down) so human duels get the same phase-2 drama the Ninth has.
- **Ending echo:** thread `campaign.ending` into Duel-screen flavour (burned-ledger wax, balanced-ledger stamps) and into Shade taunts — the save field is already there.
- **Weekly seeded "Assize of Nine":** a 9-duel gauntlet on one seed, leaderboard by total time+mistakes; reuses the daily pipeline.
- **Replay viewer:** the T7 recorder already keeps the full action log; a scrubber over `DuelEvent[]` with the T12 stamp positions would make losses teach like the tutorial does. Echo *sharing* (export codes, anonymous server pools) builds directly on the same validated format.
- **Full server-authoritative solo mode** if the Ink economy ever becomes competitive: the local engine already serializes/deserializes whole duel state, so moving campaign validation server-side is a protocol task, not a rewrite.

## Credits

Design document: supplied brief (spec §0–§14). Typefaces: IM Fell English SC, IM Fell DW Pica (The Scriptorium via Google Fonts, OFL), Libre Caslon Text (Impallari Type, OFL). All art, audio, text and code generated for this build.
