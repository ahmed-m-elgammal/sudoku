# TODO

Every unfinished or stubbed item, per spec R3. Sorted by priority. Each ID is marked `TODO(<ID>)` in code.

---

## P1 — should land before a public launch

### T1 · area: tests (spec §6)
- **Missing:** Playwright smoke tests (full tutorial duel + Shade duel) and CI script parity (`pnpm test` here = `bun run test`).
- **Why:** Playwright browser binaries could not be downloaded reliably in the sandbox within budget.
- **Stands in for:** end-to-end coverage done manually via agent-browser (boot → tutorial → placements → claims → victory → result → hub → folios → cabinet → ledger → daily → settings were driven in a real browser, see worklog); engine coverage is real Vitest (35 tests, all passing).
- **Steps to finish:** `bun add -d playwright && agent-browser install chromium` (or `npx playwright install`), port the agent-browser drive script in `scripts/verify.mjs` into `tests/smoke.spec.ts`, add `test:e2e` script, run in CI.
- **Effort:** ~2 h.

### T2 · area: networking — S08 disconnect modal — ✅ DONE (this iteration)
- **Shipped:** server emits `peer_disconnected {seat, graceS, name}`, `reconnect_grace {s}` at 1 s cadence, and `peer_reconnected`; `ServerDuel` mirrors the countdown (`disconnect`) plus self-offline detection (`selfOffline` → banner + automatic re-join via `join_duel`); `DuelScreen` renders the S08 `alertdialog` with a draining oxblood ring and the live seconds.
- **Verified end-to-end in a real browser:** two tabs queue → human match → one tab closes → S08 modal with the peer's name and ticking countdown → forfeit `end` → result screen. Socket-level flow covered 6/6 by `scripts/pvp-disconnect-test.mjs` (drop → ticks → rejoin snapshot → `peer_reconnected` → forfeit).
- **Fixed along the way:** matchmaking interval crash (stale splice index) that silently killed queue + tick timers in Bun; ghost queue entries (client now sends `leave_queue`, server skips dead sockets, client fallback waits 500 ms past the server's); guest identities are now registered via `/api/auth` before `join_queue` (PvP matching previously could never pair two real clients); `/socket.io/` trailing-slash preserved through Next rewrites with `skipTrailingSlashRedirect`; polling-first transport.

### T5 · area: monetization (spec §11)
- **Missing:** Stripe Checkout integration and a rewarded-ad SDK for "Offer a Candle".
- **Why:** third-party accounts/keys are out of scope for this sandbox; spec §11 explicitly allows a mock provider.
- **Stands in for:** `MonetizationProvider`-shaped flow: the full sell → own → equip loop works with Ink/Sigil prices; the Patron's Pouch button is stubbed (`TODO(T5)` in `CabinetScreen.tsx`); candles are free-limited to 3/day client-side.
- **Steps to finish:** add `stripe` on the server, `POST /api/checkout` → session URL, webhook → `purchases` column; pick an ad SDK, gate `showRewardedAd()` behind `MonetizationProvider` with the daily cap.
- **Effort:** ~6 h.

### T9 · area: performance
- **Missing:** brand PNG compression (`og-image.png` is 1.7 MB) and automatic WebP variants for the portrait/plate PNGs (WebP versions are generated for all raster art; the OG/PNG masters are heavy).
- **Why:** budget.
- **Stands in for:** all UI-referenced raster art is already WebP; heavy files are only fetched on share/embed.
- **Steps to finish:** `sharp(...).png({ quality: 80, palette: true })` pass over `public/assets/brand` + `portraits/*.png` + `plates/*.png`; record new bytes in the manifest.
- **Effort:** ~0.5 h.

### T13 · area: economy authority
- **Missing:** server-side Ink ledger. Ink/Reliquary/Season progress are client-owned (IndexedDB) per spec §6 "Storage: IndexedDB for saves"; the server owns Standing, daily results, streaks, recovery, purchases. A determined client can inflate its own Ink (cosmetic-only currency).
- **Why:** spec deliberately splits authority (rating server-side §2, saves IndexedDB §6); full server-side economy was cut for budget.
- **Stands in for:** honest client + server-owned ranked currency; purchases (Sigils) are server-synced via `/api/purchases`.
- **Steps to finish:** add `ink_ledger` column; client posts claim/win deltas with duel id; server verifies against its duel log; recovery already restores the server-known parts.
- **Effort:** ~2 h.

## P2 — polish and completeness

### T3 · area: tutorial M0 scripting — ✅ DONE (this iteration)
- **Shipped:** `shared/tutorial.ts` — a pure, seeded, deterministic controller: the Shade holds its hand until the Clerk's first true digit, races at 4.2–6.8 s/digit, slips (plausible wrong digit) after every third placement, takes at most ONE teaching claim, caps its correct ink at 22 (can never fill the Tablet or win the race), falters into slips-only after the cap, and never casts a rite.
- **Wired:** `LocalDuel` tutorial mode uses `tutorialAct` with its own `scriptRng`; the free Augur is now actually granted the moment its margin note shows; the render-notification bug in `LocalDuel.bump()` (listeners were never invoked) is fixed and throttled to ~15 fps.
- **Verified:** 7 new Vitest tests in `shared/__tests__/tutorial.test.ts` (holds hand, never casts, ≤1 claim, ink cap, always loses by Seals on 4 seeds, determinism, the Clerk can still lose by their own hand); live-browser run finished VICTORY by Seals.

### T4 · area: campaign — Orsolo's adaptive swap — ✅ DONE (this iteration)
- **Shipped:** `swapOrder()` in the engine (one atomic mid-duel Order change: runtimes rebuilt fresh with the 50% first-use factor, incoming passive unworn, outgoing Reckoning/Ward/Mirror windows lapsed, everything earned or suffered preserved) + `ADAPTIVE_COUNTER` / `adaptiveSwapTarget()` in `shared/orders.ts` (Scholar→Apothecary, Executioner→Warden, Apothecary→Executioner, Warden→Scholar; if the Ninth already wears the counter he rotates one step — he has worn them all).
- **Runtime:** `LocalDuel.checkAdaptive()` on the frame loop — one swap per duel, never after the duel ends, triggers the instant `foe.seals <= CONFIG.seals.adaptiveSwapAtSeals (4)` from any damage source; `foe.adaptive` flows through `DuelSessionSpec` for Folio IX duel III only; PvP never adapts (`ServerDuel.swapBanner()` parity stub).
- **Presentation:** non-blocking brass callout ("He adapts." + old→new portraits with glow, ~4.2 s, pointer-events:none), new WebAudio `orderSwap()` sting (bowed fall + wax crack + floor boom), haptics, Ticker line with both Order names, HUD portrait flips automatically.
- **Verified:** 9 new Vitest tests (`shared/__tests__/adaptive.test.ts`); live campaign duel transcript shows Orsolo Scholar 8→6→4 → swaps to Apothecary (counter of my Scholar) → 2 → 0; banner + ticker captured in a real browser at 390×844.

### T6 · area: campaign — ending choice — ✅ DONE (this iteration)
- **Shipped:** the finale flow — first clear of Folio IX duel III routes straight past the result screen into the Orsolo reveal plate (`story.orsoloReveal`, previously unused), then to the new **S19 EndingChoice** screen: two engraved verdict panels (Balance in brass / Burn in oxblood, each with its plate art), keyboard 1/2 + Enter + Esc, and a confirm modal ("This choice is remembered. It cannot be un-written.").
- **Persistence:** the verdict writes `save.campaign.ending` ('balance' | 'burn'), then the chosen ending plate plays as a StoryCard (`story.endings.*`) and closes into the Endless Assize (Antechamber). Replays of the final duel skip the beat (first-clear guard) and show the normal result screen.
- **Also fixed while in the finish path:** the Marginalia achievements existed in copy but were never awarded — `first-blood`, `folio-first`, `folio-fifth`, `folio-ninth` are now granted by `unlockAchievement` (idempotent on replays); the Antechamber Folios card reads "The Ledger is {Balanced|Burned}. The Endless Assize continues." once the campaign is settled.
- **Verified E2E in a real browser:** seeded save at (8,2) → won the duel → reveal → chose Burn (confirm) → ending plate → hub shows "The Ledger is Burned."; repeated with Balance; IDB save shows `ending` + `folio-ninth` on both paths.

### T15 · area: interlude auto-trigger — ✅ DONE (this iteration)
- **Shipped:** first clear of (folio 2, duel 2) routes to `story.interlude1` + `plate-interlude-1`, first clear of (folio 5, duel 2) to `story.interlude2` + `plate-interlude-2`, then continues to the Folio map at the next folio. First-clear guard: replays go straight to the result screen.

### T7 · area: Shades (spec §7) — DONE
- **Shipped:** full replay-Shades ("Shade Echoes"). `shared/replay.ts`: validated `DuelReplay` format (fail-closed `validateReplay` — never throws, never leaks by reference, rejects 24 hostile payload shapes), capped recorder (4000 actions, sealed at duel end, integer-ms engine-clock timestamps), clock-driven `ReplayDriver` (pause-safe). `LocalDuel` records human actions in practice/daily/Shade/replay modes and drives mode `'replay'` foes from a stored echo (refused actions fizzle — the ink-echo stutters where the ink was disturbed); invalid echoes degrade visibly (`replayDegraded`) to the calibrated Shade. `src/game/echoes.ts`: `duels` IDB store ring buffer (newest 12, validate-on-write, corrupt rows skipped on read). `EchoesScreen`: the Antechamber shelf — list, describe, and duel any echo. Determinism proven (byte-identical `serializeDuel` for identical echo + scripted opponent); 23 tests in `shared/__tests__/replay.test.ts` incl. the R23 fractional-clock regression the browser E2E caught.
- **Left for later:** cross-Clerk echo sharing (export codes / anonymous server pools) — needs a privacy pass on recorded names; PvP replays are not recorded (server-authoritative states would need an action log too).

### T8 · area: privacy/telemetry
- **Missing:** the Settings telemetry opt-out is honored client-side; the server-side telemetry endpoint does not yet receive/sync the preference.
- **Why:** budget.
- **Stands in for:** client-side gating (spec's minimal first-party events only fire when enabled).
- **Steps to finish:** include `telemetry` flag in `/api/auth`; server drops rows for opted-out accounts.
- **Effort:** ~1 h.

### T10 · area: PWA audit
- **Missing:** a Lighthouse run (PWA ≥ 90 target).
- **Why:** no Lighthouse-capable Chrome in the sandbox.
- **Stands in for:** manifest + service worker (precache shell/fonts/brand, cache-first assets, network-first API) implemented and registered; installability metadata complete.
- **Steps to finish:** run `npx lighthouse http://localhost:3000 --preset=desktop` in a Chrome-capable environment; fix flagged items.
- **Effort:** ~1 h.

### T11 · area: legal (spec §7)
- **Missing:** legal review of the plain-language privacy page and the guest-identity/recovery mechanics.
- **Why:** requires counsel; spec explicitly asks for this TODO.
- **Stands in for:** the privacy note in Settings (S18) written in plain language.
- **Steps to finish:** counsel review; adjust copy; confirm data-retention claims match the SQLite/IndexedDB reality.
- **Effort:** external (counsel).

### T12 · area: UI polish — Mirror strip claim marks — ✅ DONE (this iteration)
- **Shipped:** `stampPos()` in `HudBits.tsx` — rows stamp the right-edge cell of their row, columns the bottom cell of their column, boxes the centre cell of the box; stamps are 7 px round seals centred with `translate(-50%,-50%)` and a dark halo.

### T14 · area: i18n structure
- **Missing:** the i18n *runtime* (locale switching) — all copy is centralized in `src/i18n/en.json` + `story.json` and Settings exposes "Language: EN" per spec ("EN, with an i18n structure ready").
- **Why:** only EN ships per spec; structure-ready means copy lives in one dictionary.
- **Stands in for:** `t()`-less direct imports; swapping the import switches the language.
- **Steps to finish:** add `next-intl` (already installed) with the `en` namespace as the first message catalog.
- **Effort:** ~2 h.
