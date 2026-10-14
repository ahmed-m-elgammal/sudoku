# ASSIZE — Mobile-Only Tweak Plan (Port Fidelity Focus)

## 0) Mission and constraints
- **Goal:** Make the mobile port behave *exactly* like the approved web build — pixel-true UI, same rules, same timings — while fixing mobile-specific robustness and lifecycle issues without redesigning anything.
- **Hard constraint:** Follow `mobile/AGENTS.md`:
  - Never edit `../shared/`.
  - Never change copy, balance, timings, mechanics, color, or layout.
  - Never add new screens, tabs, buttons, hints, badges, tooltips, or “improved” labels.
  - All platform needs go through `src/platform/*`.
  - Platform translation only (RN equivalents), not design changes.
- **Scope:** mobile only. Upstream server fixes (P0 protocol bugs) are prerequisites, not work done in this repo.

## 1) Baseline and visibility (no product changes)
### 1.1 Freeze baseline
- Record current passing gates:
  - `npm run gate` = typecheck + lint + test
  - `npx jest` for owned components
- Record runtime baseline:
  - Boot time on a mid-range Android device
  - First playable (tutorial) latency
  - Duels finished without manual intervention on weak network

### 1.2 Add lightweight, privacy-safe diagnostics
- Use existing telemetry channel rather than inventing a new one.
- Add only counters already conceptually supported:
  - duel start / finish / forfeit
  - disconnect attempts and reconnect success
  - audio degraded flag
  - background `AppState` transitions
  - frame stalls if measurable through existing instrumentation hooks
- Gate behind `useDisplaySettings()` / telemetry preference if available.
- **No analytics SDKs that carry new identifiers without review.**

### Success criteria
- A dashboard exists internally for “did mobile sessions actually complete duels?”.
- No behavioral change yet at implementation time.

## 2) P0: Runtime lifecycle and networking coupling (highest impact)
These are not game-design tweaks; they address why mobile matches may fail.

### 2.1 Duel lifecycle guards
- Ensure `ServerDuel.applyEnd`, `applyYou`, and `applyYou` dispatch updates without duplicate notification.
- Confirm the `notifiedVersion` snapshot law correctly handles `null` duel and mid-swap re-initialization in `useDuelSession`.
- Re-check `lastSeqRef` reset flows, especially:
  - rematch
  - campaign transition
  - tutorial re-entry
  - backgrounding during a duel

### 2.2 Networking resilience
- Verify every client call uses the same canonical fields:
  - `join_queue`
  - `join_duel`
  - `reconnect`
  - `leave_queue`
  - `ready` if present
- Keep `selfOffline`/`disconnect` state transitions matched to server events:
  - `peer_disconnected`
  - `reconnect_grace`
  - `peer_reconnected`
- Ensure countdown UI does not freeze when app returns from background mid-countdown.
- Ensure `socket` subscription `unsubs` are always disposed exactly once.

### 2.3 Background and timers
- Keep `LocalDuel` `SHADE_HOLD_MS` semantics when `AppState` changes.
- Ensure `setTimeout` calls used in Shade cadence have stable ownership.
- Confirm no stray timers persist on dashboard or duel destroy.
- On background:
  - pause audio beds
  - stop mixer
  - hold Shade
  - keep UI countdown honest (not frozen or artificially lengthened)
- On foreground:
  - restore audio
  - re-evaluate timer state
  - resume rAF only if duel still live

### Exit criteria for Phase 2
- A perturbed-network session:
  - drops a socket
  - reconnects
  - finishes or forfeits cleanly
- No stuck shake/flood/heat state
- No unhandled exceptions in expo-audio
- Duels no longer finish in a “silent stuck room” state

## 3) Mobile input, feedback, and correctness (no gameplay changes)
### 3.1 Touch fidelity
- Audit `Board.tsx`, `Cell.tsx` only against the port fidelity contract:
  - same hit targets
  - same selected/frozen behavior
  - same keyboard fallback only for iPad where allowed
  - same aria labels
- Confirm:
  - `sameDigit` is gated by the user setting on all paths
  - pencil marks and notes join correctly
  - accidental double-tap/ghost taps do not create double actions
- Ensure audio/haptic success only occurs after engine-confirmed placement, not speculative UI tap.

### 3.2 Reduced-motion and accessibility
- Ensure every ported mobile effect respects both:
  - `AccessibilityInfo.isReduceMotionEnabled()`
  - `useMotionReduced()` / settings
- Audit:
  - flood
  - shake tiers
  - hit-stop and verdict slow-ink
  - heat vignette
  - same-digit highlights
  - wrong-ink feedback
- Verify `cold` desaturation path on mobile with heat changes and no forced repaint loops.

### 3.3 Audio behavior
- Confirm expo-audio unlock happens exactly on the first true user gesture and never before.
- Confirm settings mute/volume propagate instantly without stale closures.
- Confirm app background pause + foreground resume does not:
  - leave loop players frozen
  - create duplicate loop players
  - miss one-shots due to system audio interruption
- Confirm mute switch behavior is intentional (silent mode no audio) and documented in settings/UI copy? (Port: copy unchanged; ensure no misleading expectation.)

### Exit criteria
- No accidental double-entry in real-play testing
- Reduced motion output identical in *states* to the web build (animation classes present, `display:none` equivalents for Splash etc.)
- Audio does not crash and degrades gracefully even if asset fails

## 4) Performance and memory (mobile-specific)
### 4.1 Frame and memory health
- Profile `DuelScreen` render count on 81-cell board updates.
- Keep one callback identity for cell selection (already present).
- Avoid inline anonymous components.
- Keep `Cell` memoization and dependency arrays clean.
- Confirm `lastWrongClearAt` and `wrongVariant` resets without unnecessary rerenders.

### 4.2 Animation and effect tuning only for platform safety
- Keep all lengths unchanged (30 ms flood, T2 480 ms, T3 700 ms, hit-stop 100 ms, slow ink 300 ms).
- On low-end hardware, avoid multiple simultaneous heavy effects through existing state consolidations:
  - fuse flood + hit stop as they already share acceptance law
  - check `Animated` + Reanimated coupling doesn’t duplicate work
- Verify cleanup of:
  - shake Cue
  - flood Cue
  - hit stop Cue
  - slow ink Cue
  - audio mixer intervals

### 4.3 Assets and bundle
- Keep raster twin strategy for engraved kit (do not import `react-native-svg` for kit art).
- Check `assets/game` resolution and `metro.config` compatibility.
- Ensure no runtime XML parsing path occurs.

### Exit criteria
- No stuck overlays over 1,000 synthetic events
- No obvious FPS regressions during real duel
- Memory stays bounded in repeated campaign progression testing

## 5) Network resilience and offline edge cases (mobile-specific)
### 5.1 Server/network regression checks using code contract
- Cross-check mobile client field use against server expectations without changing shared code:
  - `join_queue`
  - `join_duel`
  - `reconnect`
  - `leave_queue`
  - `ready` if present
- Confirm seeded test scenarios for:
  - guest identity registration before queue
  - stale socket leaves queue
  - room starts after matchmaking
  - socket teardown on screen switch
  - Countdown remains server-ticked
- Add a smoke check for “background then foreground before deadline” rejoin.

### 5.2 Offline UX
- Ensure `OfflineScreen`:
  - is reachable when socket cannot connect
  - doesn’t duplicate modals/duel state
  - supports return to reachable screens
- Verify daily campaign replay state degrades clearly if offline and retries later.

### Exit criteria
- Manual network test matrix passes on Android emulator + one device if available.
- Reconnect/manual forfeit state waits are understandable.

## 6) Game comprehension and first play (mobile-specific, fidelity-preserving)
No new screens or hints. Only use existing surfaces appropriately.

### 6.1 Onboarding flow parity
- Validate tutorial V2 sequence from code paths:
  - free Augur grant timing
  - note machine sequence
  - tutorial script cadence
- Ensure spectator/error states report clearly if something breaks.
- Avoid Adding any labels beyond existing i18n keys.

### 6.2 Hub cognitive load
- Evaluate whether the existing mobile hub hides some important paths behind nested transition and cost of taps, without adding screens.
- Use existing screen state ordering exactly:
  - campaign path clarity
  - practice/daily/weekly discoverability
  - ranked queue visibility
- Suggest:
  - improve existing labels only if copy changes are globally approved? Under port law, do **not** change copy. File a separate product decision.
- Plan outcome here: if UX friction seems inherent, escalate to product rather than “optimize” labels in port.

### 6.3 Economy and persistence clarity
- Ensure `economy.pending` flush behavior and recovery code application are secure and idempotent.
- Keep local/client-side values client-only and server-side accurate according to design.
- Ensure no silent discrepancy between displayed Ink and persisted state.

### Exit criteria
- First-time play smoke test finishes naturally
- Economy balance matches expected test fixtures after reconnect/recovery scenarios.

## 7) QA, tests, and gates (mobile-only)
### 7.1 Port tests to run each iteration
- `npx tsc --noEmit`
- `npx eslint <owned paths>`
- `npm test` (shared suites + mobile suites)
- `npx jest <owned paths>`
- Read test failures in:
  - `src/game/__tests__/serverDuel.test.ts`
  - Duel screen tests
  - motionLaw tests
  - fx law parity tests
- Address only errors in owned files per AGENTS ownership mapping.

### 7.2 Smoke E2E scenarios
We have no Playwright path; use incremental mobile smoke scripts / device captures:
- Tutorial complete
- Practice win/lose
- Campaign first folio duel
- Daily
- Endless rung 0 and return
- Weekly
- Friend duel create and join
- Recover code flow
- Ranked matchmaking into dispatch
- Sealed chit seal/break
- Echo dueling (normal and degraded)
- Reduced motion toggle
- Background + foreground in duel

### 7.3 Regression bug class checklist for this port
- Touch tap twice
- Display dims
- App in app switcher
- Orientation change if supported
- Reconnect due to flight mode
- Audio session interrupt
- Asset failure

## 8) Success metrics and release readiness
### Function and stability metrics
- Duel completion rate
- Reconnect success vs forfeiture
- Crash-free sessions (audio, rendering)
- Sustained FPS during dialogue and duel
- Memory slope per long sessions
- Server-seeded timeout rate

### UX metrics
- Tutorial completion persistence
- Drop-off by screen
- Daily Retention (D1/D7)
- Weekly participation
- Endless continued ascension
- Weekly completion percentage

### Release readiness requirements
- all required gates pass
- no unowned code changes
- no escalation beyond permitted diffs
- confirmed platform parity checklist
- confirmed account network path stable on at least:
  - Wi-Fi
  - 4G/5G
  - flight mode toggled mid-duel

## 9) Non-goals (explicit)
- No new game mechanics
- No pacing changes to shared engine balances
- No new onboarding screens
- No copy changes or relabeling in port scope
- No UI restyling based on platform convention
- No mobile-only “improvements”
- No balance tweaks
- No shared-directory edits

## 10) Ownership and workflow rules
- Respect code ownership table.
- Report defects to upstream, don’t alter `shared/`.
- Keep diffs minimal and single-purpose.
- Use feature branches per phase:
  - `mobile/runtime-lifecycle`
  - `mobile/input-platform-safety`
  - `mobile/performance-memory`
  - `mobile/network-offline`
  - `mobile/juice-audit`
- Merge only after local/owned gate passes
- Avoid large cross-cutting changes that introduce hidden regressions.

## 11) Recommended execution order
1. **Phase 2 (P0 runtime/network lifecycle)** because this single-handedly can fix playability.
2. **Phase 3 (touch/reduced-motion/audio)** to preserve silent failure and platform safety.
3. **Phase 4 (performance/memory)** to make it feel responsive on mobile hardware.
4. **Phase 5 (network/offline)** to harden real-world connections.
5. **Phase 0 and Phase 6 already started and continuous** (baselines, smoke runs).
6. **Phase 1 UX clarity only after metrics show need**, and only if it respects fidelity law (report, don’t silently fix).

## 12) Full definition of done
1. `npm run gate` passes on clean checkout.
2. `npx jest` passes for owned paths.
3. `tsc` is clean with no ownership errors introduced.
4. Mobile duels:
   - network drop/reconnect runs end correctly
   - background/foreground runs preserve logic
   - audio degrade is safe and non-crashing
   - no stuck state overlays after stress run
   - offline has a recoverable screen
5. Remote/network lifecycle shared defects have been at least reported/collaborated on, not in-situ patched as shortcuts in mobile.
6. Playtest matrix and notes exist for battery/weak-network contexts.

## Final note
The biggest mobile issue is **not game design** in itself; it’s that port fidelity plus reliable lifecycle/network handling can make the game feel world-class. Optimize this in phases: move stabilization before polish, and add no new player-facing surface. If you want a separate doc-only plan for the server-side P0 blockers (so those don’t stall this plan), split them into a “Mobile-Only Release Blockers: Upstream Dependencies” artifact without touching anything else.
