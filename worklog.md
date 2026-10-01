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
