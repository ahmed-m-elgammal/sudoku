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

---
Task ID: 16
Agent: main
Task: T16 (Shade technique ladder + tempo adaptation) + T17 ("Your Shade" — personal Shade mined from echoes), built test-first with adversarial suites

Work Log:
- TODO.md: T16/T17 written as P1 specs BEFORE implementation (per user instruction), then marked DONE after verification
- T16 shared/shade.ts: techniques tier (0-3) on ShadeProfile; candidateMasks bit-scan; applyPairEliminations (naked+hidden pairs, tier 2); applyPointing (tier 3); deducedPlacements(board, tier) = eliminations then naked+hidden single scans; nakedSingles export as test oracle; tier-0 ≡ shipped bot (pinned); tier>=2 rite targeting (augur→own most-nearly-complete unit, quarantine→foe's); profileForStanding techniques curve 0->3; tieredTechniques(base, shadeKind) minor-1/lieutenant±0/boss+1; adaptProfile (ADAPT_GAP=3: lean-in x0.78 pace +0.12 skill -15% mistakes +0.1 aggression when losing, coast when crushing) pure+RNG-free; PROFILE_ENVELOPE + clampProfile single normalization point (band ordering normalized — inverted [hi,lo] inputs sorted)
- REAL BUG caught by shipped replay pins (R14/R15) mid-iteration: early envelope draft floored aggression 0.05/singlesSkill 0.3 -> practice/daily "Tablet does not play" inert profiles (all-zeros + 99999ms) got resurrected into slow active players that solved Easy tablets and ended duels early. Root fix: envelope floors are ZERO (caps monsters, never resurrects statues); active-Shade guarantees live in profileForStanding's curve and the T17 miner's own floors
- T17 shared/personalShade.ts: minePersonalShade(echo) -> {profile, telemetry}; reconstructs the exact tablet via generatePuzzle(seed, tier) so wrong-ink is MEASURED not estimated; median gap pace (burst floor 250ms, idle cap 30s); MIN_INK=8 else null; wrongRate>0.5 -> null (unreliable reconstruction); PACE_FLOOR 1500/2400; castRate->aggression (0.35 base +2.2/cast, clamped 0.15-0.85); outcome+cleanliness->singlesSkill [0.45,0.95]; tier+flawless win->techniques [1,3]; placeCadenceMs = median gap (fair-floored, 12s cap) — the echo's real ink rhythm becomes the Shade's post-placement cadence
- Round-trip test exposed a DESIGN FLAW: placeDelayMs only governs stuck-thinking waits; post-placement cadence was hardcoded 900ms in LocalDuel — mined tempo could never reproduce the human's rhythm. Fix: optional ShadeProfile.placeCadenceMs (absent = shipped 900ms, zero behavior change for calibrated/campaign/practice profiles; mined profiles set it); LocalDuel.shadeWake reschedules post-action at Math.max(400, prof.placeCadenceMs ?? 900)
- UI wiring: ui.ts pendingPersonalShade {replay, profile}; specFromUi 'shade' branch (fresh seed `your-shade-<ts>`, echo's tier, foe = mined profile); campaign branch now tiered via tieredTechniques; EchoesScreen "Your Shade" card (mined from newest echo, stats line pace/errors/rites, fail-closed faint-ink note -> calibrated Shade wears the echo's name); i18n en.json echoes.yourShade* strings
- Tests RED-first: shadeLadder.test.ts 24 (clampProfile hostile normalization + band ordering RED -> clampBand fix; solve-contract initially mis-pinned as reckoning, corrected to claims-based proof after honest analysis: vs idle 7-seal pleader a solving Shade wins BY SEALS at ~16 true placements); personalShade.test.ts 18 (exact pins; degenerates; 200-payload mixed fuzz half solution-true/half garbage; purity/no-mutation; validator-hostile deferral; round-trip cadence 0.6x-1.6x; slow-vs-fast cadence ordering). Test-side bugs fixed honestly along the way (fuzz winner:-1, casts-per-placement semantics, 9x400s exceeding validator duration ceiling)
- tsc fix: tieredTechniques number->union narrowing (shade.ts:112)
- Browser E2E (agent-browser 390x844): tutorial skip -> hub -> practice routed through server matchmaking (ServerDuel, no echo by design) -> conceded -> Daily (LocalDuel Hard) -> solved via __assizeDuel hook -> VICTORY by seals 17 ink -> echo on shelf -> "Your Shade" card renders "Shade of You · 1.5s per digit · 0% burned ink · 0 rites" (scripted instant placements -> pace floored to fair floor, honest) -> Duel your Shade -> mode 'shade', foe "Shade of You", scholar order, Hard tier, cadence 1500, techniques 3, skill 0.86, 6 true placements by clock 8.1s; console clean (only pre-existing metadataBase warning); screenshots scripts/shots/t17-your-shade-shelf.png + t17-your-shade-duel.png
- Docs: README.md rewritten for this iteration (new "T16+T17 — Shades that solve, and YOUR Shade" section, 4th+5th test suites, counts 300/300, structure + known-limits + verification updates), copied to download/README.md; TODO.md T16/T17 marked DONE

Stage Summary:
- 300/300 vitest across 8 suites (+42 this iteration); tsc clean for shared/+src/
- T16: Shades now genuinely solve (tier 3 wins 5/5 Easy seeds with real claims); difficulty climbs with Standing and campaign role; tempo adapts within a hard envelope; determinism preserved
- T17: "Duel your Shade" ships — your own ink, mined fail-closed, pacing ink at your tempo, feeding itself with new echoes
- Two real defects found by tests and fixed at root (envelope resurrecting inert profiles; cadence not honoring mined tempo) — the adversarial workflow did exactly what it exists for
- Key decisions: envelope floors zero (inert profiles are a feature); placeCadenceMs opt-in (no silent feel change for shipped modes); solve-proof = claims completed, not placement counts; mined wrongRate gate 0.5 (Seals die before that in any real duel)
- Next candidates: echo sharing (privacy pass on names), T18 PhaseScript bosses + Endless ladder, T1 Playwright smoke suite

---
Task ID: 17
Agent: main
Task: T18 (PhaseScript bosses + Endless Assize ladder) + T19 (echo sharing behind the privacy pass), built TODO-first with adversarial suites alongside

Work Log:
- TODO.md: T18/T19 written as P1 specs BEFORE implementation (per standing user instruction), flipped to DONE after verification
- T18 shared/phaseScript.ts: BossScript = monotonic ladder of PhaseRules (when: clockAfterMs/ownSealsBelow/foeSealsBelow/ownClaimsAtLeast/ownInkAtLeast ANDed; a rule with no finite condition NEVER matches — garbage scripts degrade to base Shade, never a god-phase); patch = RELATIVE deltas (paceFactor ×, mistake/skill/aggression +) merged onto the duel's base profile through clampProfile (envelope holds under ~500 hostile patches); signature = one-shot rites dispatched on the first wake they are LEGAL (own Order, off cooldown, uses left) — pending rite never stalls the boss; advancePhase never regresses and never skips a rung (PS11 caught my test trying to skip rung 2 — ladder refused, correctly); bossAct delegates to shadeAct with the phase-patched profile; all nine Magistrates carry named arcs (the-grip/the-drip/the-peal/the-lantern/the-map/the-forgery/the-ledger/the-exhumation/the-ninth); FoeDef.script? + specFromUi campaign branch passes BOSS_SCRIPTS[foe.script]; shade.ts exports mostCompleteUnit for signature targeting
- T18 shared/endless.ts: rung r → foe from two pure facts (r, per-save salt): magistrate r%9, cycle roman numerals (II from the second circuit), tier Easy→Expert over the first circuit, every 3rd rung boss (8 Seals + its arc), curves monotonic in r (pace/mistake/skill/aggression/techniques), seed endless-{salt}-{rung}; ladder law endlessOnWin/OnLoss (best permanent) + sanitizeEndless (NaN/Infinity → foot of the stair, never a corruption teleport to rung 1e6) + endlessInkBonus (capped); save.endless {current,best,salt} with salt PERSISTED on migration (a re-minted salt would silently rewrite every rung's tablet); new EndlessScreen (rung/best/foe/queue/Ascend) + Antechamber card + ui.endlessRung + Result rematch routes endless → stair + achievement endless-ten + 'endless' recorded as echo-able mode
- REAL DESIGN FLAW caught by the EN6 property sweep (r 0..40 monotonicity): boss-rung techniques +1 made the rung AFTER the boss a gentler duel (2→1 at r=5→6, 3→2 at r=8→9). Fixed at the root: techniques is purely the rung curve min(3, floor((r+2)/5)); bosses keep their teeth in the 8 Seals + the PhaseScript arc
- T19 shared/echoShare.ts: ASSIZE1- + unpadded base64url (pure TS bytesToBase64Url/base64UrlToBytes — no Buffer, no btoa-unicode traps, dangling 6-bit lengths rejected) of fixed-key-order JSON of the validated replay — deterministic, never throws; decodeEchoCode fail-closed (prefix/size 400k/alphabet/fatal-UTF-8/JSON/validateReplay); PRIVACY PASS both directions: redactEcho replaces both seats with "a wandering Clerk"/"an ink-echo" at EXPORT (sliding-window pins: no ≥5-char fragment of any original name anywhere in the code) and import force-redacts AGAIN (hand-crafted name-smuggling chit lands scrubbed); no server — copy-paste chits; EchoesScreen: per-echo "Seal a chit" (clipboard + execCommand fallback, modal), "Break a chit" import modal, imported badge; saveEcho carries imported flag through IDB
- Tests RED-first, failures analyzed honestly: phaseScript 25 (of which 4 initial failures were TEST-contract errors: hush-action counting caught natural-path casts — now counts signature dispatches via the pending head; PS11 tried to skip a ladder rung; PS12's idle human got legitimately killed by the boss mid-probe — clean crossing claims deal up to 6 Seals in one placement, scaffold floors raised; PS16's too-strong human outpaced the arc — clock-driven probe arc now pins runtime wiring), endless 12 (3 initial failures: Infinity-expectations contradicted the fail-closed design — tests fixed; EN6 techniques dip was REAL — module fixed), echoShare 27 (1: pollution payload riding a VALID replay decodes scrubbed per the T7 contract, pinned as CH7b). Full suite 364/364; tsc clean for shared/+src/
- Browser E2E (agent-browser 390×844): hub Endless card → stair → Ascend → rung 0 duel (seed endless-prvg4zsx-0, foe actively solving, 45 ink by clock 24s) → concede → DEFEAT → Rematch routes to the stair, IDB current 0/best 0 → hook-win rung 0 → VICTORY, current 1/best 1, mode 'endless' in stats → rung 1 won → rung 2 = Magistrate duel (seals [7,8], scriptId the-peal, Easy) — the Magistrate legitimately DEFEATED the slow Clerk (the ladder has teeth) → shelf: sealed a real echo → 1388-char chit, zero name leakage → broke the same chit → shelf grew with "from a chit" badge reading "Shade of a wandering Clerk" → imported echo duels (mode replay, correct tablet, not degraded); console clean; screenshots t18-endless-screen.png, t19-chit-shelf.png, t19-imported-echo-duel.png
- Docs: TODO.md T18/T19 marked DONE with verification; README.md rewritten (new T18+T19 iteration section, 64-test suite descriptions, counts 364 across eleven suites, architecture + verification + known-limits updated, echo-pool future idea), copied to download/README.md

Stage Summary:
- 364/364 vitest across 11 suites (+64 this iteration); tsc clean for shared/+src/
- T18: campaign Magistrates duel with named arcs (phase patches + signature rites through real engine legality); the Endless Assize is a deterministic place, not a slot machine — wins ascend, losses reset, best forever
- T19: echoes travel as sealed chits; the privacy pass is structural and two-directional — a chit carries the ink of a duel, never a name
- Three honest catches this iteration: the endless techniques dip (module fixed), the fail-closed Infinity semantics (tests corrected to match the design), and boss lethality in probes (scaffolds fixed, behavior kept)
- Next candidates: T1 Playwright smoke suite, anonymous server echo pool (rides the T19 primitives), deeper arcs (cross-Order phases / weekly modifiers), T5 Stripe mock

---
Task ID: 18
Agent: main
Task: T20 (deeper arcs — cross-Order boss phases) + T21 (deeper arcs — the Weekly Assize, weekly modifiers), TODO-first with adversarial suites alongside

Work Log:
- TODO.md: T20/T21 written as P1 specs BEFORE any code (per standing user instruction), flipped to DONE after verification
- T20 shared/phaseScript.ts: PhaseRule gains swapTo?: OrderId — a cross-Order phase; BossScriptState gains pendingSwap (optional — shipped test literals stay lawful); advancePhase arms it ONLY for phases ENTERED via the monotonic scan (entry-phase swapTo ignored — a Magistrate arrives as announced), hostile swapTo dropped at arm time (isOrder gate against ORDER_ABILITIES); bossAct dispatches the swap BEFORE signatures as ShadeAction {kind:'swap', to} (new union member in shade.ts; shadeAct never returns it), and DROPS it if the boss already wears the target (never a refused action); signatures then resolve against the NEW Order's rites — the old Order's rites stay dormant (shipped foreign-rite skip). Engine swapOrder does the mutation (T4-proven atomic primitive). LocalDuel.shadeWake handles 'swap' by calling swapOrder + reusing the T4 brass callout/sting/haptics verbatim
- Deeper arcs: three Magistrates gained a fourth desperation phase — the-ledger (Marchetti, executioner→warden: buys protection), the-forgery (Quill, scholar→apothecary: destroys the evidence), the-drip (Vael, apothecary→executioner: the poison fails, the axe answers); ADDITIVE entries only (triggers/patches/signatures of shipped phases byte-unchanged); Orsolo's the-ninth stays T4-only
- PS13 contract extended to the phase's EFFECTIVE Order (base or swapTo); the cast-legality assert moved INTO the shared stepFoe drive (every arc drive + determinism run now fails loudly on a foreign cast); stepFoe applies swap actions through engine swapOrder so pure-module drives exercise the runtime path
- T21 engine.ts: RuleMods {wrongSealCost, claimDamage, cleanBonus, statusScale, cdScale, statusGapScale, durationMs} + sanitizeRuleMods (fail-closed: non-finite dropped, unknown keys never copied, clamps 1–3 / 0–3 / [0.5,2] / [0.25,2] / [60s,20min]) run at createDuel AND deserializeDuel (hostile snapshots cannot corrupt a rule read); DuelState.rules? + rulesOf() read helper; the seven engine read sites converted (place wrong-cost, claim damage + clean bonus, status duration, cooldown full, status gap; durationMs at state creation); mods absent ≡ shipped constants byte-identically — PvP/tutorial/campaign untouched
- T21 shared/weekly.ts (pure): weekIndexFor Monday 00:00 UTC (floor((utcDays+3)/7)), weekStartMs/weekEndsAtMs, WEEK_MODS pool of 8 named writs (Fragile Seals is duel-shape via seals [6,6], overlay empty), weeklyForWeek picks 2 DISTINCT writs + one of the eight non-finale Magistrate arcs + fixed set-piece Shade profile + seed assize-week-{w}; weeklyInkBonus 120; weeklyModDefs display helper; barrel export
- T21 UI: ui.duelMode 'weekly' + Screen 'weekly' + GameShell route; save.weekly {lastWeek} with hostile migration; useDuelSession 'weekly' branch (deterministic spec incl. mods); LocalDuel mode 'weekly' + opts.mods → createDuel; DuelScreen finish() — one completion per week (any result), +120 Ink on the FIRST WIN only, achievement weekly-sat (+ new SVG + i18n), 'weekly' added to echo-recordable modes; WeeklyScreen (writs, presiding foe, turnover countdown, law line); Antechamber hub card with the live writ names; Result rematch routes weekly → writs; en.json hub.weekly/weekly.* keys
- Tests RED-first, failures analyzed honestly: crossOrder 14 (2 initial failures were TEST bugs — CO2 forgot the ladder never skips a rung; CO13 read `constructor` through the prototype chain, own-property check now correct); weekly 22 (12 initial failures — one root cause: CONFIG imported from the wrong module, plus Marginalia forgiveness eating the WA3 mistake, sever cast from the wrong seat, applyStatus returns {applied} not {ok}, and WA11's two seeds producing different tablets); shadeLadder/personalShade narrowing updated for the new ShadeAction member (shadeAct must never swap — pinned); PS13/PS14 contract extension as designed. Full suite 400/400 across 13 suites; tsc clean for shared/+src/
- Browser E2E (agent-browser 390×844): hub Weekly card (live writ names Gilded Claims + Fragile Seals) → WeeklyScreen (writs + Shade of Vael · Medium · 6 Seals · the-drip + countdown + law) → Sit → live duel seed assize-week-2961 with 6/6 Seals and rules {cleanBonus:2}; desperation probe → apothecary→executioner mid-duel, banner {from,to} truthy, orderSwap event on the wire, rites rebuilt to sever/hush/reckoning, HUD portrait flipped, brass "HE ADAPTS." callout + ticker captured on screenshot; the writs cut BOTH ways — Vael legitimately DEFEATED the probe (5-Seal clean claim ×2: 1+2 gilded+1 Reckoning+1 Last Rites); loss sealed the week (lastWeek 2961) with loss-Ink only, no achievement; unseal → re-sit → hook-win → VICTORY with economy +153 exactly (30+3+120), weekly-sat awarded; Rematch routes to the writs; console clean; screenshots t20-swap-banner2.png, t21-weekly-screen.png, t21-weekly-win.png
- Docs: TODO.md T20/T21 marked DONE with verification; README.md test ledger updated (400 across thirteen suites)

Stage Summary:
- 400/400 vitest across 13 suites (+36 this iteration); tsc clean for shared/+src/
- T20: a Magistrate can now SET ASIDE an Order mid-duel by arc — same atomic swap T4 proved, same brass moment; three arcs are deeper, all shipped phases byte-unchanged
- T21: the Weekly Assize is the Daily's week-long sibling — two writs read over the court, identical for every Clerk, engine-true rules with fail-closed sanitization both directions
- Five honest catches this iteration: two test bugs (ladder rung-skip, prototype-chain constructor), one import-root-cause test batch, Marginalia eating the probe's mistake, and the writs' symmetric lethality (behavior kept — it is the design working)
- Standing constraints honored: reset untouched; layouts stay single-DOM responsive; no assertion weakened to pass
- Next candidates: T1 Playwright smoke suite, anonymous server echo pool (rides T19 primitives), Sudden Judgment overtime, puzzle variants

---
Task ID: J0
Agent: Super Z (main)
Task: Brainstorm juice (game-feel) ideas — user request, no build yet

Work Log:
- Inventoried existing juice: ~20 synth SFX (synth.ts) + drone/tension music, haptics (useDuelSession/localDuel), CSS anims (ink-settle, brush-shake, brass-edge-flash, readyFlash, severPulse, swapGlow, versus slams), claim stamps in gutters/box corners (Board.tsx unitOwner), strike-1..3 wrong variants, status overlays (chain/smudge/miasma/quarantine), Reliquary chest frames, story plates
- Confirmed gaps via grep: no particle/VFX layer, no global screen shake, no on-board ink flood for claimed units, no hit-stop/slow-mo, no streak/heat visual escalation (music has tension layer; visuals do not), no replay theater treatment
- Pitched ranked J1-J10 juice track in chat: J1 ink flood on claim, J2 tiered screen shake, J3 hit-stop + verdict slow-mo, J4 heat escalation via --heat CSS var, J5 digit-entry tactility, J6 ambient courtroom particles, J7 boss phase court-reacts stinger, J8 replay theater (follow-spot + scrubber markers), J9 ceremony bookends (verdict scroll / ink drain), J10 per-status signature VFX + Hush audio ducking

Stage Summary:
- No code written; awaiting user greenlight on any subset, then TODO-first build per standing order
- All juice pitches are presentation-layer only (shared/ engine untouched, replay determinism unaffected); guardrails: prefers-reduced-motion, particle budget + auto-degrade, transform/opacity-only (no layout shift), settings toggle reusing settingsHaptics pattern

---
Task ID: J1-J2
Agent: Super Z (main)
Task: Build the greenlit juice pair — J1 ink flood on claim resolution + J2 tiered screen shake (J3–J10 parked in TODO)

Work Log:
- TODO.md written FIRST per standing order: J1/J2 as P1 specs, then flipped to ✅ DONE with verification; J3–J10 recorded under a new "Parked — juice track (awaiting greenlight)" section
- Recon grounded the design in shipped systems: claim events carry {player, unit, clean, damage}; Mirror strip owner law is you=oxblood / foe=ash (both wax stamps are oxblood); ServerDuel populates the same state.events; reduced motion is the save-driven :root[data-motion='reduced'] attribute; style bible forbids gradients/glow
- NEW src/game/fx.ts — pure presentation law, shared/ untouched: floodFromEvent (fail-closed: deferred claims, hostile units/players/seqs flood nothing), cellsOfFlood (copy, cascade order), centroidOfUnit (fractions of the 9x9 cell area, gutters excluded), ownerOfCell (box > row > col precedence), tierForEvent (claim=2; orderSwap/end=3; deferred=0; garbage=0), Cue<T> (self-cleaning timed state: restart-on-set, timer is the only cleaner), FLOOD_*/SHAKE_MS constants
- NEW tests/juice.test.ts (28 tests): hostile matrices, geometry pins, precedence pins, Cue contract + 1000-event fuzz (one honest test bug en route: asserted the seen-array length AFTER advancing past expiry — the Cue's 1001 entries were correct; assertion order fixed, implementation unchanged), constants law
- useDuelSession: fx state fed by Cues; hookEvent extended (same deduped stream); fireShake sink; LocalDuel wired with onPhase → T3; cue dispose + state clear on unmount; FIXED a latent bug en route — lastSeqRef never reset between duels, so a rematch's first ~N events (sounds AND fx) were silently swallowed; now reset to -1 on every new duel
- localDuel: LocalDuelOpts.onPhase (presentation-only); shadeWake diffs bossState.phaseIdx around bossAct and fires onPhase on advancement (no new engine events, event streams byte-identical)
- Board: ownedYou/ownedFoe permanent tint from st.unitOwner; flood cascade classes + --flood-i/--flood-strong/--flood-settle inline vars; matte InkSplash SVG (droplet ellipses, currentColor, aria-hidden, pointer-events none) anchored via calc((100% - 20px) * cx); boardWrap shake class via nonce-parity A/B
- Duel.module.css: inkFlood cascade (30ms stagger via --flood-i), inkBurst splash (matte, ends invisible), shakeT2/shakeT3 keyframes (--shake-amp 3px/6px, T3 with slow settle), reduced-motion kill-list extended + inkSplash display:none
- Full suite 428/428 across 14 suites (was 400/13); tsc clean for shared/+src/ (two NEW errors found and fixed during the run: CSS custom props need the `as CSSProperties` cast; the test event helper needed a looser param; baseline errors in examples/mini-services/scripts/skills untouched)
- Browser E2E (real duels, production path): forced-but-real placement through duel.place() → row claim → 9 cells flooding with --flood-i 0..8, splash at centroid, shakeT2 on boardWrap (screenshot j1-flood-mid.png); 1.3s later all self-cleaned, computed cell bg exactly rgba(123,26,31,0.09) (screenshot j1-flood-settled.png); reduced motion → flood classes present, computed animation-name none, splash display none, tint instant; the tutorial probe's second claim proved LETHAL (winner 0 → verdict → result — end path exercised incidentally); T3 observed live on the Weekly (Vael dropped to 1 Seal → arc advanced 0→1 → shakeT3 appeared and self-cleaned with ZERO orderSwap events, proving the onPhase path); console clean (only the pre-existing metadataBase dev warning)
- Honest limits recorded in TODO: PvP fx parity is by construction (ServerDuel populates the same events; no second client in the sandbox), not driven live

Stage Summary:
- 428/428 vitest across 14 suites (+28); tsc clean for shared/+src/; J1+J2 shipped, J3–J10 parked in TODO for greenlight by ID
- J1: the Tablet becomes territory — cascade + splash + permanent tint, oxblood/ash per the Mirror's law
- J2: the room has weight — T2 on claims, T3 on He-adapts / phase entry / the verdict, self-cleaning, reduced-motion safe
- One latent bug fixed (rematch event swallowing); zero shared/ changes — replays byte-true
- Standing constraints honored: reset untouched; single-DOM responsive layouts untouched (background-color/transform/opacity only); no assertion weakened to pass

---
Task ID: J3-J4
Agent: Super Z (main)
Task: Build the second greenlit juice pair — J3 hit-stop + verdict slow-mo + J4 heat escalation (J5–J10 remain parked in TODO)

Work Log:
- TODO.md FIRST per standing order: J3/J4 moved from the Parked section into P1 as in-build specs with verbatim scope + concrete hooks; flipped to ✅ DONE with full verification after the run; J5–J10 remain parked for greenlight by ID
- Recon grounded the pair in shipped systems: every resolved claim breaks ≥1 Seal (damage 1, Clean 2 per config) so "seal-crossing" = any resolved claim; seals live on st.players[i].seals (public); onEnd fires synchronously inside LocalDuel.finish() one frame BEFORE the events effect — the verdict-delay interception point had to be DuelScreen's onEnd wiring; reduced motion is the :root[data-motion='reduced'] kill-list (no global nuke exists); z-map: board internals ≤5, skipTutorial 31, banners 90–120, global modal backdrop 100 → worldDim z80, heatVignette z60 (over the room, under every modal/veil)
- fx.ts: hitStopFromEvent (the flood's acceptance law + damage > 0 — push ⊆ flood by construction), HIT_STOP_MS/SLOW_INK_MS/FLOOD_SLOW constants; heatFromState (0.15/Seal of |gap| cap 5 + 0.0625/run claim cap 4, clamp 0..1, fail-closed) + COLD_GAP 3 + advanceRuns (run extends while a seat claims, any other seat's claim resets) — all pure, shared/ untouched, replays byte-true
- useDuelSession: hitStop + slowInk + heat state on the fuzz-proven Cues; runs fed by the same validated claim events; heat re-derived from public state on every push with compare-and-set (clock ticks with no events never re-render); synth.setHeat rides the same law; per-duel resets (runs/lastClaimer/heat) + cue disposes
- Board: hitStop push cells with per-cell transform-origin at the unit centroid ((cx·9 − col)·100 %, (cy·9 − row)·100 %), nonce-parity A/B, cold --flood-strong/--flood-settle variants, --flood-slow on boardWrap during the verdict beat, frozen click gate
- DuelScreen: frozen = hitStop || slowInk mirrored into the keyboard gate (Escape stays live); onEnd → cleanup-tracked setTimeout(SLOW_INK_MS) → finish() (endedRef still guards doubles); worldDim/worldDimDeep overlay; heatVignette; --heat + data-cold on the duel root
- NumPad: frozen gate on digits/erase + numPadWarm overlay
- synth.ts: gallery murmur — looping pinkish noise (leaky-integrated white) → lowpass 480 → LFO wobble on a SERIES gain (the bed moves, the target doesn't — heat 0 is silent) → murmurGain (target = heat × 0.07, setTargetAtTime 0.9 s) → musicBus; setHeat clamps and buffers pre-unlock
- CSS: unitPush composes with inkFlood as ONE animation list (:is(.floodCellA,.floodCellB).pushCellA/B; the flood delay formula gained × var(--flood-slow, 1) in BOTH rules so the retained animation never recomputes when the push class drops); worldDim hard-cut (no animation to kill); heatVignette inset-shadow opacity var; numPadWarm; boardWrap brass color-mix under @supports (55 % cap, plain fallback); data-cold desaturated owned tint; kill-list + transition:none extended
- tests/juice.test.ts +21 tests (49 in the suite): hitStop law incl. the 896-combo acceptance-parity matrix vs floodFromEvent (the push can never fire without its flood); three-Cue 1000-claim fuzz (exactly one expiry each, nothing sticks); heat law (calm room, monotonic gap/run with caps, max exactly 1, COLD_GAP pins incl. Magistrate 8-Seals, 10-pair hostile matrix, garbage runs, parity/comeback pins); advanceRuns (extension/reset/hostile-proofing); beat-layering constants (HIT_STOP < SLOW_INK < FLOOD_CLEAR)
- One honest test correction: the first draft pinned HIT_STOP_MS < FLOOD_CELL_MS × 3 (100 < 90 — false); the constraint was invented, not real (the push is transform-only and concurrent with the crawl) — replaced with the true layering law; no assertion weakened, a wrong one corrected
- Full suite 449/449 across 14 suites (+21); tsc clean for shared/+src/+tests/ (baseline errors in examples/, mini-services/, scripts/, skills/ untouched)
- Browser E2E (real tutorial duels, production path, agent-browser): hit-stop verified live (worldDim + 9 pushCells within one 16 ms sampler tick, self-cleaned t=117→199); verdict beat verified live (worldDimDeep + --flood-slow 2.5 + 9 pushCells at t=613, beat held at t=699, result screen at t=870 ≈ 300 ms, VICTORY, no double finish); the end path also ran organically (the tutorial clock expired into Sudden Judgment mid-probe — a seal-reset probe had equalized Seals 7-7 — and navigated cleanly); heat verified live (--heat 0.3625 exactly after a Clean claim, vignette opacity == var, pad == 0.6×var, brass border captured color(srgb 0.2349 0.1809 0.1018) mid-blend); cold verified live (data-cold='y' at 4-vs-7, heat 0.5125, owned tint transitioning toward the desaturated target, snap-back on restore); reduced motion verified (classes applied, computed animation-name none, transitions 0 s); screenshot scripts/shots/j4-heat-settled.png; console clean
- Honest limits on the record: PvP parity by construction (no second client in the sandbox); the murmur was not heard (headless audio) — gain law code-pinned; the input freeze is verified by wiring + Cue fuzz, not a timed click-swallow; the cold probe drove public state directly rather than waiting for a real foe comeback

Stage Summary:
- 449/449 vitest across 14 suites (+21); tsc clean for shared/+src/+tests/; J3+J4 shipped, J5–J10 parked in TODO for greenlight by ID
- J3: impact has weight — the world holds 100 ms on every Seal break and buys 300 ms of slow ink before the verdict; timing is presentation-only, the engine clock and every replay stay byte-true
- J4: the room stakes itself — one --heat var from public state alone drives vignette, brass warmth, pad warmth and the gallery murmur; behind by 3 Seals your ink desaturates and a comeback snaps it back; replay/PvP parity by construction
- Standing constraints honored: shared/ untouched (zero engine changes); the reset feature untouched; single-DOM responsive layouts untouched (opacity/background-color/transform/border-color only); no assertion weakened to pass — one wrong pin was corrected instead

---
Task ID: T9-T13
Agent: Super Z (main)
Task: Build the greenlit pair — T9 (performance: PNG compression pass) + T13 (economy authority: server-side Ink ledger), TODO-first with adversarial suites alongside

Work Log:
- TODO.md FIRST per standing order: both entries rewritten as in-build specs with verbatim scope + concrete hooks; flipped to DONE with full verification after the run
- Recon grounded both: `duels` table already logs every PvP end (winner/mode/seats) and `daily_results` logs daily completions — the verification substrate; `purchases` JSON column is the storage pattern; Ink award sites enumerated (DuelScreen.finish generic + endless/weekly/tutorial bonuses, tutorial skip, Reliquary +40, Season n*10, Cabinet −price); sw.js is cache-first on /assets so its VERSION must bump; folio-map.png (4.4 MB) is the heaviest PNG in the tree (map dir added to the spec's dir list, same asset class)
- T9 tools/compress-png.mjs: exported compressPngs() + CLI guard; sharp png({quality:80, palette:true}) over brand/portraits/plates/map; overwrite ONLY when smaller; per-file {orig,bytes,at} records in manifest.pngCompression; primary-path manifest bytes updated; no-op runs write nothing; idempotent by size-matching (regenerated art auto-recompresses); --force rebuilds records (may shrink further, never grow). Run: 38 PNGs, 35.6 MB saved (og-image 1.70M->468K, app-icon-master 2.25M->635K, folio-map 4.4M->1.15M, splash -84%); sw VERSION -> assize-v2-t9t13; filenames unchanged so layout/manifest.webmanifest untouched
- T9 tests tests/pngCompression.test.ts (11): pure laws + fixture passes on sharp-built synthetic roots + repo-state pins (record.bytes === disk, bytes <= orig, protocol dimensions intact); og-image visual spot-check clean at 256 colors; TWO honest test bugs fixed (fixture wrote raw noise as .png; --force equality pin -> <=)
- T13 shared/inkLedger.ts (pure, engine untouched): sanitizeInkEntries (batch 50, shape law, fail-closed), settleInkEntries (verified = real server proof: duels row involving account with outcome-consistent magnitude win 111/draw 96/loss 91, or daily_results row for calendar-shaped date from the duel id; bounded = per-mode caps practice-family 111, endless 316, weekly 231, tutorial 250, reliquary 40, season 300, spend -2000..-1; dropped = fabricated pvp ids, replayed duel ids (re-post idempotent incl. same batch), malformed, delta 0, positive spends), parseLedgerColumn fail-closed
- T13 server: guarded ALTER TABLE migration (ink INTEGER, ink_ledger TEXT) on the PRE-EXISTING db (CREATE IF NOT EXISTS never amends); getDuel/updateInk/updateInkLedger queries; POST /api/ink (auth-gated, per-entry verdicts, balance echo); /api/auth returns ink; /api/recovery restores donor ink (SET + audit row mode 'recovery') and returns it
- T13 client: save.economy.pending (migrated hostile-proofed, cap 200); src/state/inkLedger.ts recordInk (dedup, oldest-evicted) + flushInkLedger (bootstraps auth FIRST — an honest gap the E2E caught: a never-authed identity had no account for /api/ink to land on; batches 50 x 6 passes; offline-safe failures keep pending); GameShell boot flush; next.config /api/ink rewrite; net.ink()/widened types; wired at every award site (ranked/friend carry the server duelId joining the duel log; daily/weekly/endless mint per-attempt ids so re-sits stay bounded; tutorial +100 folded into the duel entry); LedgerProfile "The server's ledger knows N ink" + recovery applies ink via max(local, server)
- T13 tests shared/__tests__/inkLedger.test.ts (24): hostile matrices, PvP proof matrix (both seats, shade-fallback p1 null, foreign accounts), daily law, every cap pinned, spend negativity, replay dedup, eviction, balance floor, never-throws fuzz; suite caught THREE real law bugs at draft (positive spend would GRANT ink; non-array entries threw; capFor missing hostile default) + one test bug (seat-1 winner polarity) — fixed at root, no assertion weakened
- Wire E2E 22/22 (scripts/t13_wire_e2e.py) vs live server: 401 gates, migration on existing db, verdicts over the wire, replay idempotence, spend floor to 0, flood cap, recovery with real codes (321 donor -> recipient, code consumed), auth ink echo. Two probe bugs found and fixed en route (results contain dropped entries with applied 0; 321 needs 3 legal entries — the practice cap held even against my own probe)
- Browser E2E (production path): tutorial won with 14 real placements (4 clean claims x 2 = 8 >= 7 Seals) -> exact award 142 (30 + 4x3 + 100) minted as ONE per-attempt entry, held in pending through a dev-server restart (offline-safe law working), flushed on next boot, DB row `tutorial | 142 | bounded`, LedgerProfile rendered the 142 line, real recovery code through the UI lifted local ink to the donor's 321 via max(). Console clean
- Full suite 484/484 across 16 suites (+35: 24 inkLedger + 11 pngCompression); tsc clean for shared/+src/+tests/ (one new error fixed: sharp type import)
- Standing constraints honored: shared/engine untouched (determinism suite green); reset untouched; single-DOM responsive layouts untouched; no client award numbers changed (bounded, not re-balanced)

Stage Summary:
- 484/484 vitest across 16 suites; tsc clean; T9+T13 shipped, verified, TODO flipped with honest limits on record
- T9: every heavy PNG master shrank ~72-84% (35.6 MB total), the pass is repeatable and self-recorded, and the SW cache bumps so clients actually get the bytes
- T13: the server keeps an honest, bounded, replay-proof mirror of Ink — verified where the duel log proves it, capped where it cannot, dropped when replayed — and recovery now restores it; Ink stays cosmetic and offline-safe by design
- Next candidates: T1 Playwright smoke suite, T5 Stripe mock, T8 telemetry sync, anonymous echo pool, parked juice J5-J10
