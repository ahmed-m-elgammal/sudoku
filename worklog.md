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
