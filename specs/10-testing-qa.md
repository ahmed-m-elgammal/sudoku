# 10 — Testing & QA

## Strategy: keep the Vitest net, add Detox for device

| Layer | Tool | What runs |
|---|---|---|
| Engine/logic | **Vitest** (existing) | The ~480 `shared/__tests__` + `tests/` suites. CI gate: `bun run test` must be green before any mobile build. |
| Pure fx laws | Vitest (existing) | `tests/juice.test.ts` etc. port unchanged. |
| Component/unit (RN) | **jest-expo** | Screen-level render + interaction smoke (board placement, numpad, settings toggles). |
| E2E on device | **Detox** (iOS sim + Android emu) | Tutorial duel end-to-end (boot → duel → claim → result), daily, echo duel, disconnect grace modal, recovery-code restore, OTA update flow. |
| Server protocol | Existing node scripts | `scripts/pvp-disconnect-test.mjs`, `t13_wire_e2e.py` adapted to the Postgres-backed server. |

**Why:** the engine determinism suite is the thing that makes the port safe at all — it is the regression net. Detox catches gesture/tap-target/animation-timing bugs on real devices; jest-expo covers wiring.

**Alternatives:** Maestro (simpler YAML E2E, less control); Appium (heavy); Playwright on the PWA (doesn't cover the native shell).

## Device matrix
- iPhone SE (375×667) — the constraint device, board must stay legible.
- iPhone 15 Pro / Pixel 8 class — the target device.
- iPad (landscape + portrait) — keyboard play, larger board.
- Small Android (360×800) — Tailwind-style layout law from web (grid = `min(100vw, 100vh)`) must hold in RN flex.

## Performance gates
- 60 fps on the Ink flood cascade (J1) and screen shake (J2) — profile with Flipper/Reanimated profiler.
- Cold start < 3 s to antechamber; echo ring load < 200 ms.
- OTA update < 5 s on Wi-Fi.

## Accessibility gates
- VoiceOver/TalkBack labels on every cell (the web build already writes per-cell aria-labels — port them to `accessibilityLabel`).
- Reduce Motion honored (same `data-motion` law).
- Dynamic type / text-size setting (S18) ported.
