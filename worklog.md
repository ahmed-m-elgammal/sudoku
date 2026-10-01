---
Task ID: 1-2
Agent: main
Task: Asset pipeline + shared deterministic engine (spec build order 1)

Work Log:
- Created assets/style-prefix.txt, tools/asset-data.mjs (173 assets: 34 imagegen, 139 procedural), tools/svg-lib.mjs, tools/svg-factories.mjs, tools/generate-assets.mjs
- Raster generation (16 portraits, 15 story plates, folio map, OG, app icon) running in background via z-ai image gen
- 139 procedural engraved SVGs written to public/assets/
- shared/config.ts (exact spec numbers), rng.ts (mulberry32), sudoku.ts (generator + L1-L4 grader), engine.ts (pure duel state machine), orders.ts, shade.ts
- 35 vitest engine tests passing (uniqueness, tiers, claims, Clean, momentum, 12 abilities, 5 statuses + anti-frustration, 4 win conditions, determinism, Shade AI)

Stage Summary:
- Engine complete and green: `bunx vitest run` = 35/35
- Key decisions: progress win-check fixed to board completeness; quarantined claims deferred until quarantine ends; mirror reflect re-targets caster; first-use cooldowns at 50%
- Next: client foundation (fonts, tokens, i18n, audio, stores)
---
Task ID: 3-6
Agent: main
Task: Client foundation + duel screen + hub screens (spec build order 2-6)

Work Log:
- Self-hosted fonts downloaded (IM Fell English SC/DW Pica, Libre Caslon Text) to public/fonts
- Design tokens + global CSS (palette, page turns, 44px targets, reduced motion, contrast modes)
- src/i18n/en.json (full UI copy: 24 loading lines, 24 achievements, statuses, logs, settings) + src/i18n/story.json (prologue, 9 magistrates with challenge/defeat/taunt/folio cards, 2 interludes, both endings)
- WebAudio synth (all sfx + generative drone/bowed/tension music)
- IndexedDB v2 schema + migrations, guest identity, recovery codes (4 words + checksum)
- Zustand save store + UI screen router; GameShell with 19 screens; DuelScreen S05/S05b (board, claims, statuses, abilities, numpad, mirror strip, ticker, keyboard)
- LocalDuel runtime (engine + Shade loop + tutorial pacing); tutorial margin notes
- Fixed: @shared tsconfig alias, ssr:false client component, sigil asset paths
- Assets complete: 34 imagegen + 139 procedural = 173/173, manifest reconciled, 0 pending/placeholder

Stage Summary:
- App compiles and serves 200; tutorial duel is the boot screen
- Next: assize-server mini-service (matchmaking, duels, daily, recovery, anticheat)
---
Task ID: 7-12
Agent: main
Task: Authoritative server, campaign, daily, economy screens, PWA, docs, verification

Work Log:
- mini-services/assize-server: Fastify REST + socket.io (default engine path via XTransformPort gateway) + bun:sqlite; accounts, duels, daily_results, streaks, telemetry tables
- Matchmaking with widening windows + Shade fallback at 4s; server-side duel rooms with solution-private validation, Elo (K=32/20@1600), 20s disconnect grace, anticheat (fast-place drop, uniform-timing shadow queue, daily sanity)
- ServerDuel client mirror (predict+reconcile) wired into useDuelSession/Matchmaking/FriendScreen; REST daily results + server-tracked streaks
- Screens verified in real browser (agent-browser, 390x844): boot->tutorial, placements, claims (r0/r1/b0 Clean), seals win, VICTORY result, Antechamber hub, Folio map + Folio I detail (generated Magistrate art + challenge text), Cabinet tabs, Great Ledger, Daily (Tier Hard rotation + countdown + leaderboard), Settings
- Fixed: board grid explicit positions + thick 3x3 lines, hero-card contrast, sigil asset paths, ssr:false client component, @shared alias, wordmark rendering (live DOM text)
- PWA: manifest.webmanifest, sw.js (precache shell/fonts/brand, cache-first assets, network-first API), icons 192/512/maskable, splash; registration in GameShell
- Deliverables: README.md, TODO.md (15 honest items T1-T15), docs/STORY.md, docs/BALANCE.md, assets/prompts.md (139 painted-replacement prompts)
- Final state: 35/35 vitest green; page 200; assize-server healthy; 173/173 assets (34 generated + 139 procedural, 0 pending)

Stage Summary:
- ASSIZE is complete and playable per spec build order; TODO(T1-T15) recorded in TODO.md with matching code markers
- Browser-verified: R1 instant play, tutorial loop, claims/damage/win, result->hub, campaign detail, cabinet/ledger/daily/settings

---
Task ID: 13
Agent: main
Task: T2 (disconnect countdown modal) + T3 (scripted tutorial loss) + UI responsiveness polish + logic hardening

Work Log:
- T3: new pure module shared/tutorial.ts (seeded scripted Shade: holds until Clerk's first true digit, races 4.2-6.8s/digit, slips every 3rd placement, max ONE teaching claim, correct-ink cap 22, falters to slips-only, never casts); 7 vitest tests (shared/__tests__/tutorial.test.ts) incl. 4-seed always-loses + determinism
- T3 wiring: LocalDuel uses tutorialAct via scriptRng in tutorial mode; free Augur now granted when its note shows (DuelScreen effect); FIXED LocalDuel.bump() never calling listeners (throttled to ~15fps)
- T2 server: peer_disconnected {seat,graceS,name} on drop, reconnect_grace {s} at 1s cadence to the remaining seat, peer_reconnected + instant reconnect_ok snapshot on join_duel/reconnect; stale seat ids deleted on disconnect
- T2 client: ServerDuel.disconnect {secondsLeft,graceS,who} + selfOffline; net:online auto-re-joins the duel; LocalDuel carries union-parity nulls; DuelScreen renders S08 alertdialog (oxblood ring + live seconds) and the self-offline reconnect banner
- S08 verified E2E in browser: 2 tabs -> human match -> close one -> S08 with peer name + ticking ring -> forfeit end -> result screen; socket flow 6/6 via scripts/pvp-disconnect-test.mjs
- Logic fixes found while testing: (1) matchmaking interval crashed on stale splice index and silently killed queue/tick timers in Bun - fixed + try/catch armor on both loops; (2) ghost queue entries after client fallback - client sends leave_queue, server skips dead sockets, client fallback now waits server-time+500ms; (3) guest identities were never registered server-side so human PvP could never pair - Matchmaking/FriendScreen now auth() before join_queue (+ standing sync for fresh saves); (4) Next rewrites for /api/* + /socket.io/ with skipTrailingSlashRedirect + polling-first transport so the duel server is reachable on plain localhost too; (5) Ticker no longer says "Shade of Orsolo waits" in every mode (new i18n duel.log.waiting)
- UI responsiveness overhaul (Duel.module.css rewritten): layout zones .duelMain > .duelLeft/.boardArea/.controls (display:contents portrait; side columns landscape+desktop); board sized by container-query units min(100cqw,100cqh,560px) with vh fallback; landscape phones (max-height 560) get board-left/controls-right with compact HUD; desktop >=1100 keeps the shell a column with board centered between mirror/ticker column and controls column (fixes old overflow that cut the ability bar on laptops); fluid clamps for HUD/portraits/pips/numpad/abilities; 44px coarse-pointer targets; press/active feedback; margin note centered via left/right+margin (page-turn animation was overriding translateX); skip-tutorial chip legible over HUD; T12 mirror claim stamps mapped to exact cell positions; modal-backdrop grid-centered + blur; SW cache version bumped to assize-v2-t2t3
- Type hygiene: PlaceResult gains invalidTarget; type imports moved to @shared/config (localDuel/serverDuel/assize-server); AnyDuel union for all duel screens' props; fixed pre-existing tsc errors in DuelScreen (recent entry + campaignDuel narrowing), save.ts season.claimed string[], idb oldVersion via IDBVersionChangeEvent, Antechamber double-go
- Verified: 42/42 vitest; tsc clean for touched files; no browser console errors; screenshots at 390x844, 360x740, 844x390, 768x1024, 1280x800

Stage Summary:
- T2, T3, T12 marked DONE in TODO.md; app + assize-server running with all fixes
- Key decisions: server shade fallback stays the source of truth (client waits 500ms past it); tutorial Shade never claims twice and caps ink so it can only lose; S08 countdown is server-ticked, client merely renders
- Next candidates: T4 Orsolo adaptive swap, T6 ending choice, T15 interlude auto-trigger (all small), T5 Stripe mock

---
Task ID: 14
Agent: main
Task: T4 (Orsolo's adaptive swap) + T6 (Balance/Burn ending choice) + T15 (interludes) + achievement fix + comprehensive README

Work Log:
- T4 engine: swapOrder() in shared/engine.ts (atomic Order change: fresh ability runtimes w/ 50% first-use factor, incoming passive unworn, outgoing Reckoning/Ward/Mirror windows lapsed, Seals/claims/board/statuses preserved, one orderSwap event); CONFIG.seals.adaptiveSwapAtSeals = 4; ADAPTIVE_COUNTER + adaptiveSwapTarget(player, foeCurrent) in shared/orders.ts (scholar->apothecary, executioner->warden, apothecary->executioner, warden->scholar; rotates one step if the counter is already worn)
- T4 runtime: LocalDuel.checkAdaptive() on the rAF loop (one swap/duel, never post-end, catches Seal loss from any source); opts.adaptive through DuelSessionSpec/specFromUi (Folio IX duel III only); ServerDuel.swapBanner() parity stub; synth.orderSwap() sting (bowed fall + wax crack + floor boom); hookEvent sfx + haptics
- T4 UI: non-blocking .swapBanner callout in DuelScreen (HE ADAPTS. + old->new portraits w/ glow, 4.2s, pointer-events:none, reduced-motion safe), Ticker formatEvent orderSwap case with Order names, HUD portrait auto-flips via orderMeta(foe.order)
- T6: 'endingChoice' Screen + EndingChoice.tsx (S19: Balance brass / Burn oxblood verdict panels with plates, keyboard 1/2/Enter/Esc, confirm modal); DuelScreen.finish() finale: first clear of (8,2) -> Orsolo reveal StoryCard (story.orsoloReveal + plate-orsolo-reveal, previously unused) -> EndingChoice -> save.campaign.ending -> ending StoryCard -> antechamber; first-clear guard skips beat on replays; Antechamber Folios card reads "The Ledger is Balanced/Burned."
- T15 (bonus, same path): first clear of (2,2)/(5,2) routes to interlude plates 1/2 then folioMap at next folio
- Logic completion: unlockAchievement was never called anywhere in the app - first-blood, folio-first, folio-fifth, folio-ninth now awarded in the campaign finish path (idempotent)
- Tests: shared/__tests__/adaptive.test.ts (9: counter map total/self-free/deterministic, rotation fallback, runtimes rebuilt, state preserved, bulwark works after swap, windows lapsed, no-op refusal, ended-phase refusal)
- Fixed during build: Rng import dropped from localDuel during edit (tsc caught), i18n.orders cast needed unknown bridge, unused eslint-disable in EndingChoice
- Verified: 51/51 vitest; tsc clean for src/+shared/; agent-browser E2E at 390x844+1280x800: forced trigger banner screenshot; seeded campaign (8,2) -> win (transcript: Scholar 8-6-4 -> SWAP to apothecary -> 2-0) -> reveal -> Burn (confirm modal) -> ending plate -> hub "The Ledger is Burned." -> IDB ending=burn + folio-ninth; full rerun with Balance -> ending=balance; replay of (8,2) correctly shows normal result screen (first-clear guard); console clean
- README.md rewritten (~215 lines): pitch, full feature tour, duel rules table, Orders table, T4/T6/T15/T2/T3 deep-dives, run+test instructions (51 tests), architecture incl. EndingChoice, responsive construction, 11 design decisions (+3 new for swap/finale/ending), verification status, known limits, future work (9-item TODO table + 6 design ideas), credits; copied to download/README.md; TODO.md T4/T6/T15 marked DONE

Stage Summary:
- T4, T6, T15 shipped and verified E2E; achievement system actually functional now
- Key decisions: swap policy in runtime (engine stays pure/reusable), counter picked vs player's CURRENT order, finale replaces result screen on first clear only, ending is cosmetic not mechanical
- Remaining TODOs: T1 (playwright), T5 (stripe), T7 (replay shades), T8, T9, T10, T11, T13, T14

---
Task ID: 15
Agent: main
Task: T7 (Replay Shades) + deep adversarial engine testing ("tests that break it, not tests that pass")

Work Log:
- Baseline suspicion confirmed: shipped 51/51 green in 673ms; wrote scripts/probe-engine.ts (18 hostile probes) — found 4 crash classes (invalid seat index in place/useAbility/cellFlags; fairCopy cell=NaN -> UNIT_CELLS["bNaN"]; swapOrder unknown id -> ORDER_ABILITIES[bad].map; via fuzz also applyStatus unknown type -> NaN-lived status) and 4 semantic holes (fractional/NaN digits accepted as Seal-burning mistakes; tick(NaN) permanent soft-lock; tick(-x) time travel; createDuel accepted seals [-5,100]); also proved the shipped "every ability casts" test passes only by seeded luck (tincture at seals=7=cap -> invalidTarget).
- Wrote shared/__tests__/adversarial.test.ts (168 tests): H1-H16 hostile-input contracts; 120 seeded fuzz duels x 240 steps with ~20 invariants checked after EVERY step + byte-identical double-run determinism; full status matrix (bulwark>ward precedence, mirror reflection incl. self-bulwark edge, gap-only-on-success, immunity from expiry tick, final-10s ban, Distiller +2s exact); clock/momentum/flinch/sudden-judgment boundaries; 12 ability contracts with explicit preconditions (A1 replaces the luck-pass); swap invariants; serialization roundtrips (incl. quarantine pendingClaim). Ran RED (106 failures), fixed engine, ran GREEN.
- Engine hardening (shared/engine.ts): seat validation on all mutation entry points; integer digit/cell/unit/type validation; tick rejects non-finite/negative dt; createDuel throws RangeError on seals outside [1,8]; deserializeDuel shape-validates ("malformed duel snapshot: ..."); cellFlags safe for invalid seats; applyStatus validates type/cells/cell/unit. shared/rng.ts: state getter coerces uint32 (serialization contract).
- Wrote shared/__tests__/generators.test.ts (16): 24+ puzzle fuzz (uniqueness, givens subset of solution, metadata honesty, countSolutions purity, grader termination on degenerate/contradictory grids, daily rotation pinned to 2024-01-01 anchor, malformed daily keys now throw RangeError — fixed tierForDailyDate which previously indexed DAILY_TIERS[NaN]); Rng 50k bounds/permutation/state-resume/uint32 contracts; 30 seeded Shade legality runs; tutorial script vs worst-case Clerk (G13 initially asserted the wrong contract — the Shade wins by seals from the Clerk's own hand, which IS the shipped T3 spec; corrected to pin the real contract).
- T7 Replay Shades shipped: shared/replay.ts (DuelReplay v1, fail-closed validateReplay — 24 hostile shapes rejected, never throws, never leaks by reference, __proto__-safe; recorder capped 4000 + sealed; ReplayDriver clock-driven/pause-safe; echo-storage pure helpers); LocalDuel mode 'replay' + recorder wiring + replayDegraded fallback; src/game/echoes.ts (duels IDB store, validate-on-write, newest-12 ring, corrupt rows skipped); EchoesScreen + Antechamber card + GameShell route + ui store (screen 'echoes', mode 'replay', pendingEcho) + specFromUi replay branch + DuelScreen finish() echo save for practice/daily/shade/replay; i18n strings.
- shared/__tests__/replay.test.ts (23): validation matrix, prototype pollution, recorder/driver semantics, headless record->replay determinism (byte-identical serializeDuel; echo board == recorded board), corrupt-echo degradation, echo resign, past-buzzer actions never land. R23 = regression for the fractional-clock bug.
- Browser E2E (agent-browser 390x844, fresh session): boot -> tutorial won live -> result -> hub -> practice -> OrderSelect -> duel won -> result; browser pass exposed the one bug the integer-tick harness could not: rAF clock is fractional (t=31722.700000001496) and the validator rightly demands integer ms, so echoes silently failed to save. Fixed at the recorder boundary (Math.round) + R23 pins it. Browser session later went unreliable (stale hydration after HMR); stopped it per protocol rather than trust ghost output; remaining shelf happy-path is covered headlessly.
- Final state: 258/258 vitest green across 6 suites (35 engine + 7 tutorial + 9 adaptive + 168 adversarial + 16 generators + 23 replay); tsc clean for shared/+src/; original probe re-run: all attacks now rejected (RangeError on impossible seals is the intended fail-fast); README.md rewritten for this iteration (T7 + hardening story + 3 test layers + honest verification/known-limits), TODO.md T7 marked DONE, README copied to download/.

Stage Summary:
- T7 shipped and hardened; the engine now survives a hostile client (16 entry points validated) and determinism is asserted, not assumed
- Key decisions: validator fail-closed (null, never throw); echoes re-validated on read; integer-ms clock at the recorder boundary; lucky test replaced with explicit preconditions; "the Shade may only win by the Clerk's own hand" pinned as the T3 contract
- Honest gap: echo shelf happy path verified headlessly + wiring grep-verified on disk; browser walk of the shelf interrupted by flaky tooling (left for T1 Playwright)
