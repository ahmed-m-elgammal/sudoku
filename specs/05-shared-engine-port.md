# 05 — Shared Engine Port

## The good news
`shared/` is the product. Twenty modules of pure TypeScript: deterministic engine, puzzle generation, Orders, Statuses, Shade AI with deduction ladder, boss PhaseScripts, tutorial script, weekly/endless, replay echoes with validation, personal-Shade mining, echo share codes, Ink ledger verdicts. ~480 Vitest tests pin the behavior.

## What changes for RN
- **Zero code changes expected** for `engine.ts`, `sudoku.ts`, `orders.ts`, `shade.ts`, `phaseScript.ts`, `tutorial.ts`, `endless.ts`, `weekly.ts`, `replay.ts`, `personalShade.ts`, `inkLedger.ts`, `rng.ts`, `config.ts`, `phaseScript.ts`. They are `.ts` with no imports beyond relative modules and each other — import them directly from the RN app's Metro bundler.
- **`echoShare.ts`** uses pure-TS base64url (no Buffer/btoa traps) already — ports as-is.
- **`LocalDuel`** lives in `src/app/game/useDuelSession.ts` (React hook) — this is the piece that touches timers (`setInterval`/`requestAnimationFrame`) and the DOM-ish `window` globals. Rewrite the host wrapper only: keep `LocalDuel`'s frame-loop logic, swap timers for `setInterval` (the engine is clock-driven, so ticks are safe) and replace the render-notification bugfix's `window` usage with the hook's subscription model. The 16 adversarial-hardening guardrails remain, unchanged, inside the pure engine.

## Wiring pattern
```
RN screens (Expo Router)
   └─ GameShell (zustand ui store)
        └─ DuelScreen
             └─ useDuelSession( LocalDuel | ServerDuel | ReplayDriver )
                  └─ shared/*   ← identical modules, identical tests
```
- `GameDuel`/SessionSpec types from `shared/index.ts` are reused; `specFromUi` branches (practice/daily/shade/replay/endless/weekly/campaign/pvp) port verbatim.
- `src/game/localDuel.ts` (LocalDuel) references `setInterval` and the engine clock — already platform-neutral except any `document`/`window` refs; audit and shim.
- The 400-test determinism suite becomes a CI gate for the mobile repo: **`npm test` must stay green byte-for-byte** before any RN shell ships (`bun` is not installed in the porting sandbox — use npm). That is the regression net for the port.

## What does NOT come over
- `src/components/ui/*` (shadcn) — verified **zero imports from any game screen**; it is dead scaffolding, not a port surface. Delete it. See `14` §9.
- The whole dead 5,104-line shadcn/Tailwind layer — `src/hooks/**`, `src/lib/db.ts`, `src/lib/utils.ts`, `prisma/`, `tailwind.config.ts`, `components.json`, `src/app/globals.css`.
- `Duel.module.css` keyframes — re-implemented in Reanimated 4 + worklets (see `06`, `07`). Its *values* must stay identical.
- `synth.ts` — the WebAudio graph is **deleted, not ported**; re-implement the 18-method `AudioBackend` over `expo-audio` (see `07`).
- The `examples/`, `mini-services/`, `scripts/` baseline type errors — leave behind with the Next.js tree. (`skills/` is gitignored and no longer exists.)
- `src/i18n/en.json` — keep the file; load it in RN via a tiny `t()` shim or i18next (`expo-localization`).

## Why this is the plan (and alternatives)
- **Rewrite the engine in Swift/Kotlin**: rejected — destroys the test net, doubles maintenance.
- **Keep the PWA and wrap it**: rejected as primary (see `01`).
- **Port `shared/` to a published npm package consumed by a bare RN app**: the same thing; managed Expo with a path alias (`@shared/*`) is simpler.
