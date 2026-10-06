# 07 — Audio & Haptics

> **Corrected 2026-10-06.** The *Decision* section below originally recommended
> `react-native-audio-api` as the primary runtime-synth path. That is **deprioritized** by
> `14-deep-codebase-analysis.md` §2 Finding C and §8: it is a runtime WebAudio clone, i.e. a
> native-module risk we cannot validate without a device toolchain. **The decision is now
> settled: implement the 18-method `AudioBackend` over `expo-audio` + pre-rendered assets.**
> Haptics and background sections stand.

## Today
`src/audio/synth.ts` — a WebAudio synthesized soundtrack/SFX engine: ambient courtroom drone, tension layer tied to seals gap, J4 heat-driven murmur bed (lowpass noise), wax-stamp claims, order-swap sting, Flinch, and per-status cues. Mute/musicVol through `musicBus`. Browsers require the first-gesture unlock (`pointerdown` on GameShell).

## Decision: pre-rendered assets + `expo-audio` gain ramps. **SETTLED.**

**Why:** RN has no `AudioContext`. Three approaches were considered:

| Approach | Verdict |
|---|---|
| **Pre-render** every sting/drone bed to compressed files (render the WebAudio graph offline in a Node script to `.m4a`/`.wav`), play via `expo-audio` | **Adopted.** Loses true dynamic synthesis but is the only path we can fully validate in a sandbox with no Xcode/Android SDK. |
| **Runtime synth** via `react-native-audio-api` (software WebAudio-compatible implementation) | **Deprioritized.** Would let `synth.ts` port behind a small adapter, but it is a native-module risk we cannot test here. Revisit only if the game feels wrong with pre-rendered loops on a real device. |
| **Runtime synth** via a Tone.js/howler port | Rejected: a WebAudio bridge adding bloat for zero gain over the above. |

**What we do NOT port:** the WebAudio graph code. `synth.ts` (290 lines) is **deleted, not
transliterated** — it is rewritten as a narrow interface over `expo-audio`.

### The audio surface is exactly 18 methods

Enumerated by grep across all of `src/`. Anything richer is scope creep:

```
cast · claimWon · defeat · draw · error · orderSwap · padlock · pageTurn · pencil
place · setHeat · stamp · statusApplied · statusEnded · tickMusic · uiTap · victory · wrong
```

plus `unlock()` and `setMuted(bool)`. This is the whole `AudioBackend` contract
(`src/platform/types.ts`). Call sites were already written against exactly these names, so the
interface is a drop-in.

### Contract rules
- **Never throws** when audio is unavailable; every call is a no-op until `unlock()`.
- The game must be **fully playable silent** — audio failure degrades to silence, never to a
  broken duel.
- Dynamics that must survive: `tickMusic(tension)` and `setHeat(0..1)` drive the J4 murmur bed
  (risk R6). Implement with pre-rendered loops + `expo-audio` gain ramps
  (`setTargetAtTime`-style smoothing). Mute/music volume ride the same bus so `setMuted` inherits.
- `unlock()` fires on first user interaction (the web build's `pointerdown` on `GameShell`).

## Haptics
`expo-haptics`:
- placement tick → `ImpactFeedbackStyle.Light`
- claim slam → `Medium` + a second `Medium` for Clean
- Flinch → `NotificationFeedbackStyle.Error` (or `Heavy` impact)
- victory/defeat verdict → `Success` / `Error`
- boss phase entry (T3/J2) → `Heavy` impact
Honor the existing `reduceMotion`/settings toggles and iOS's Reduce Motion accessibility flag.

The web build called `navigator.vibrate` in 6 sites (`localDuel` ×3, `useDuelSession` ×3). All six
become `haptics.*` calls through the `src/platform/haptics.ts` seam — never a global.

## Background behavior
- App background → pause ambient + timer layers (AppState), keep haptics patterns tied to user action only.
- Audio session: `expo-audio` `AUDIO_MODE_IOS_ACTIVATE`, `mixWithOthers` for polite backgrounding; `playsInSilentModeIOS: false` (don't fight the mute switch).
