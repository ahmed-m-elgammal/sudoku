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

### T2 · area: networking — S08 disconnect modal
- **Missing:** the client-side 20 s reconnect-countdown modal driven by the server's disconnect events for PvP.
- **Why:** the ServerDuel mirror reconciles state; the *grace countdown UX* was cut for budget.
- **Stands in for:** the server still enforces the full 20 s grace and forfeits correctly; reconnect works via `reconnect_ok` (`ServerDuel`).
- **Steps to finish:** server emits `reconnect_grace {s}` every second to the remaining seat and `peer_disconnected`; client renders `S08` with the countdown and cancels on `reconnect_ok`.
- **Effort:** ~3 h.

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

### T3 · area: tutorial M0 scripting
- **Missing:** a fully deterministic hand-loses-the-race script for the Shade of Orsolo (it currently uses the slow standard profile + pacing margin notes + granted free Augur).
- **Why:** budget; the shipped version already teaches every step and is reliably winnable.
- **Stands in for:** `LocalDuel` tutorial mode with `tutorialNote()` pacing and `TODO(T3)` in `localDuel.ts`.
- **Steps to finish:** replace the Shade loop in tutorial mode with a scripted action table keyed to player progress.
- **Effort:** ~2 h.

### T4 · area: campaign — Orsolo's adaptive swap
- **Missing:** the mid-duel Order swap at 4 Seals for Magistrate Orsolo (Folio IX, duel 3).
- **Why:** budget; the flag (`adaptive: true`) and data exist, the runtime trigger was cut.
- **Stands in for:** a fixed strong loadout for the final duel; `TODO(T4)` in `DuelScreen.tsx` finish path.
- **Steps to finish:** in the campaign runtime, when `foe.adaptive && foe.seals === 4`, swap `foe.order` + rebuild ability runtimes + emit `orderSwap` (the event kind and log line already exist).
- **Effort:** ~1.5 h.

### T6 · area: campaign — ending choice
- **Missing:** the explicit "Balance or Burn" choice screen after the Orsolo reveal plate; both endings are fully written with plates (`story.endings.*`, `plate-ending-*.webp`).
- **Why:** budget.
- **Stands in for:** the campaign completion sets `ended` and the reveal plate ships; `TODO(T6)` in the campaign finish path.
- **Steps to finish:** add a 2-button plate after `plate-orsolo-reveal`; set `save.campaign.ending`; route to `StoryCard` with the chosen ending lines; continue to the Endless Assize.
- **Effort:** ~2 h.

### T7 · area: Shades (spec §7)
- **Missing:** replay-Shades built from stored anonymized human duels (move log with timestamps).
- **Why:** requires a replay corpus; the synthetic bot with human-like timing is shipped.
- **Stands in for:** `shadeAct` bot calibrated to Standing; `TODO(T7)` in `shared/shade.ts`.
- **Steps to finish:** persist finished duel action logs (server already stores duels), add a replay mode to `Shade` that paces stored placements.
- **Effort:** ~4 h.

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

### T12 · area: UI polish — Mirror strip claim marks
- **Missing:** exact unit→position mapping for the claim stamps inside the 54 px mirror matrix (marks render in a corner cluster).
- **Why:** budget.
- **Stands in for:** dots (filled cells) are accurate; stamps indicate that claims exist.
- **Steps to finish:** compute stamp grid positions from `unitOwner` keys (row n → right edge of row n, etc.).
- **Effort:** ~1 h.

### T14 · area: i18n structure
- **Missing:** the i18n *runtime* (locale switching) — all copy is centralized in `src/i18n/en.json` + `story.json` and Settings exposes "Language: EN" per spec ("EN, with an i18n structure ready").
- **Why:** only EN ships per spec; structure-ready means copy lives in one dictionary.
- **Stands in for:** `t()`-less direct imports; swapping the import switches the language.
- **Steps to finish:** add `next-intl` (already installed) with the `en` namespace as the first message catalog.
- **Effort:** ~2 h.

### T15 · area: interlude auto-trigger
- **Missing:** automatic routing to the two interlude plates after Folio III and VI wins (cards + text exist; the router hook was cut).
- **Why:** budget.
- **Stands in for:** interlude plates viewable via the story system; `TODO(T15)` in the campaign finish path.
- **Steps to finish:** in the campaign win branch, when `(folio, duel)` is (2,2) or (5,2), route to `story` with the interlude payload before the folio card.
- **Effort:** ~1 h.
