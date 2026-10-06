# 11 — Build, Release & CI/CD

## Toolchain
- **EAS Build**: cloud builds, no local Xcode/Android SDK requirement for routine CI.
- **EAS Submit**: one command to App Store Connect + Google Play Console.
- **EAS Update (OTA)**: ship JS-bundle fixes mid-submission-cycle — the classic mobile advantage. Constraint: OTA cannot change native code (new Expo modules need a full rebuild), so design the store binary to be OTA-friendly.
- **Expo dev client** (`expo-dev-client`) for local debugging against the real app rather than Expo Go.

## CI pipeline (GitHub Actions)
```
push → lint (eslint) → typecheck (tsc) → vitest (bun run test)
     → EAS Build (staging profile) on main
     → Detox E2E on emulator (main, nightly)
     → EAS Submit (release profile) on tagged release
```

## Versioning
- Semantic: app version `1.0.0`, engine contract version in `shared/index.ts` (echo/replay format `ASSIZE1-` must stay compatible — echo codes from v1.x must still decode in v1.y).
- Build numbers auto-increment via EAS.
- Web PWA can keep shipping from the same `shared/` tree during the transition; mark the PWA "legacy" once v1.0 of the native app is live.

## Environments
- `staging` (separate socket server + Postgres DB) for E2E and store review builds.
- `production` for store releases.
