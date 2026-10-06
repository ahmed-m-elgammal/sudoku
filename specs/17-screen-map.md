# 17 — Screen Map: build order, phases, tasks

The port is **screen by screen**, in dependency order, and **a screen is finished end-to-end
before the next one starts**. This file is the work order. It supersedes nothing — it is the
schedule for `16-delegation-plan.md`, which says *who* owns each file.

## The rule

> One screen at a time. It is not done until you can enter it, see it, interact with it, leave it,
> and return to where you came from — with real data, on a phone, in Expo Go.

**A screen is NOT done because it renders.** It is done when all six boxes are true:

| # | Box |
|---|---|
| 1 | **Renders** — correct copy from `i18n/en.json`, correct assets, correct tokens |
| 2 | **Interactive** — every button does what the web build's does; back/hardware-back works |
| 3 | **Wired** — reached from where the web build reaches it, and returns the same place |
| 4 | **Data** — reads and writes real state (not fixtures); survives an app restart |
| 5 | **Legal** — `tsc` clean · `eslint` clean in owned files · `vitest` still green |
| 6 | **On device** — verified in Expo Go, not just in the terminal |

If a screen needs a screen that isn't built yet, that screen goes **first** — that is what fixes
the order. Never stub a screen to "unblock" a later one.

---

## Phase 0 — Unblock (no screen; nothing renders until this is done)

| # | Task | State | Why |
|---|---|---|---|
| 0.1 | **Storage fallback that works in Expo Go** | 🔴 **BLOCKER** | `storage.ts` probes MMKV → AsyncStorage. **Both are Nitro modules**, so both throw in Expo Go (`AsyncStorageError: Native module is null`). Nothing persists. Add a third, non-Nitro tier (or detect Nitro absence once and hold the save in memory for the session). |
| 0.2 | `platform/audio.ts` beyond the silent stub | 🟡 stub | Every `synth.*` call site already routes here. It must never throw. Can stay silent until A1. |
| 0.3 | Confirm `metro.config.js` + `babel.config.js` exist | ✅ done | Created 2026-10-06. Without the worklets Babel plugin, Reanimated dies silently at runtime. |

**Phase 0 exit:** app boots in Expo Go, opens `BootScreen`, and a save survives a reload.

---

## Phase 1 — The duel (the heart; nothing else matters until this works)

> These are **one atomic unit**. `Board`, `NumPad`, `AbilityBar`, `HudHeader`, `HudBits` and
> `useDuelSession` share one `DuelRuntime` — splitting them produces screens that cannot be
> finished end-to-end. Build them together, split into files, never into stubs.

### 1.1 `BootScreen` — 40 lines
**Source:** `src/app/game/BootScreen.tsx` · **Needs:** `ui.boot`, `save.tutorialDone`

- Black screen, one engraved italic line, `ASSIZE` wordmark, sub-line — **not a menu**
- Auto-advances after **1200 ms**; tap also advances
- `save.tutorialDone` → `antechamber`; else → `tutorial` with `duelMode: 'tutorial'`
  (spec **R1**: boot lands *directly* in the tutorial duel, no login, no menu)
- Copy: `i18n.boot.{line,sub}`. Assets: `assets/game/brand/wordmark.svg`
- `@expo-google-fonts/im-fell-english` + `libre-caslon` registered here (first screen, no prior load)

**Done when:** cold start shows the wordmark on black, and within 1.2 s you land in the tutorial duel.

### 1.2 `DuelScreen` + components — 1,213 lines
**Source:** `DuelScreen.tsx` (443) · `Board.tsx` (221) · `useDuelSession.ts` (260) ·
`NumPad.tsx` (64) · `AbilityBar.tsx` (64) · `HudHeader.tsx` (61) · `HudBits.tsx` (100)
**Needs:** `game/localDuel.ts` ✅ done · `game/fx.ts` ✅ verbatim · `game/duelRuntime.ts` ✅

Split by the **no-god-files** rule (`AGENTS.md`, ~300-line ceiling, one export per file):

| File | Lines | Owns |
|---|---|---|
| `ui/duel/useDuelSession.ts` | ~260 | subscription, 66 ms `bump()` throttle, fx Cue wiring, `specFromUi()` |
| `ui/duel/DuelScreen.tsx` | ~200 | **composition only** — the three layout zones, modals, verdicts |
| `ui/duel/Board.tsx` | ~220 | the 9×9 grid, `cellAria` → `accessibilityLabel`, notes, pencil, same-digit, selected/flagged |
| `ui/duel/Cell.tsx` | ~90 | one memoised cell (`React.memo` — 81 cells × 15 fps, risk R4) |
| `ui/duel/NumPad.tsx` | ~64 | 44 pt targets, digits 1–9 |
| `ui/duel/AbilityBar.tsx` | ~64 | the 3 rites, cooldown rings |
| `ui/duel/HudHeader.tsx` | ~61 | seals, clock, both portraits |
| `ui/duel/HudBits.tsx` | ~100 | Mirror strip (`stampPos`), Ticker, seals |
| `ui/duel/Overlays.tsx` | ~120 | chain / smudge / hush / miasma / quarantine, flood tint, vignette |
| `ui/duel/Modals.tsx` | ~90 | pause, concede, S08 disconnect `alertdialog`, `worldDim` |

**Tasks:**
- Render the `DuelRuntime` surface — **never** import `@shared/engine|sudoku|rng|replay|personalShade` (lint-enforced)
- Apply the fx law, don't re-derive it: `Flood`, `Shake`, `HitStop`, `Heat` → Reanimated shared values
- `Cue<T>` owns expiry — do not write new timers for shake/flood/hit-stop
- Animate `transform`/`opacity`/`backgroundColor` only — **zero layout shift**
- Seat law: **you = oxblood, foe = ash** (from the Mirror strip, not the wax stamp)
- Tap cell → tap numeral; long-press = note mode; **tap-only for digits** (swipe is rejected — accidental placements cost Seals)
- Honour `settings.reducedMotion` + `AccessibilityInfo.isReduceMotionEnabled()`
- `accessibilityLabel` on every cell via the ported `cellAria`

**Done when — all of these, on device:**
1. Tutorial duel boots; the Shade places real ink
2. Wrong digit costs a Seal and Flinches cooldowns
3. A claim fires → **9 cells flood in a 30 ms cascade**, T2 shake, hit-stop, then a permanent territory tint
4. A status lands → its overlay renders on the affected cells
5. `--heat` rises with the seal gap; the vignette + warm brass frame follow
6. **Seal death → Reckoning → Sudden Judgment at 10:00** — in that order
7. Reduced motion: flood/shake/push all disabled, tint instant
8. 60 fps on an 81-cell board (no jank on placement)

---

## Phase 2 — Duel outcome + the hub

### 2.1 `ResultScreen` — 86 lines
**Needs:** 1.2 · **Routes to:** `antechamber`, `endless`, `matchmaking`, `weekly`

- Winner/loser, reason, claims, mistakes, abilities, time, rating delta, Ink earned
- **Mint exactly one Ink entry per duel** (`recordInk`, deduped) — the ledger law is in `shared/inkLedger.ts`; do not change it
- Reliquary progress (every 3rd win) · achievement unlocks (`unlockAchievement` — idempotent)
- Rematch routes by **mode**: ranked→`matchmaking`, endless→`endless`, weekly→`weekly`, else `antechamber`
- Verdicts (VICTORY/DEFEAT/DRAW), first-clear guard for story beats

**Done when:** win a duel by Seals → Ink is awarded **and survives an app restart** → rematch returns you to the right screen.

### 2.2 `Ribbon` — 51 lines
**Needs:** 2.1
- 4 fixed tabs: **Duel** `antechamber` · **Folios** `folioMap` · **Cabinet** `cabinet` · **Ledger** `ledger`
- Active state = brass underline + `aria-current="page"`; `antechamber` also lights when `screen === 'duel'`
- 52 pt min height, `safe-bottom` inset
- Asset: `assets/game/ui/tab-ribbon.svg`

**Done when:** it renders on every hub screen, all four tabs navigate, the active tab tracks `useUi().screen`.

### 2.3 `Antechamber` (the hub) — 94 lines
**Needs:** 2.1, 2.2 · **Reaches:** `matchmaking` `daily` `folioMap` `season` `friend` `orders` `echoes` `endless` `weekly` `settings`

- Hero card (→ `matchmaking`), then cards for Daily, Folios, Season, Friend, Practice, Echoes, Endless, Weekly
- Settings `?` button top-right
- **Every card shows the real save state** — Ink, Standing, streak, current/best rung, Folios cleared
- Copy: `i18n.hub.*`; assets: portraits, plates

**Done when:** every one of the ten cards navigates, and the values on them match the save after a restart.

**Phase 2 exit:** boot → tutorial duel → win → ResultScreen → Ink persisted → Antechamber shows correct numbers.

---

## Phase 3 — Campaign spine

| # | Screen | Lines | Needs | Done when |
|---|---|---|---|---|
| 3.1 | `StoryCard` | 52 | 2.1 | A story beat renders `lines` + its `plate`, then auto-advances to `then` (its successor is **inside the payload** — one atomic `go()`) |
| 3.2 | `OrderSelect` | 80 | 2.3 | Pick an Order → `duel` with `duelMode`; **Apothecary locked until Folio II, Warden until Folio IV** (read from save) |
| 3.3 | `FolioMap` | 57 | 3.2 | 9 folios show cleared/stars/state; tap → `folioDetail`. Asset: `folio-map.webp` (lazy-load) |
| 3.4 | `FolioDetail` | 73 | 3.3 | 3 duels per folio with per-duel stars; tap → `duel` with `campaignDuel {folio,duel}` |
| 3.5 | `EndingChoice` | 148 | 3.4 | **Balance** (brass) / **Burn** (oxblood) panels; confirm modal *"The choice is remembered in your save. It cannot be un-written."*; writes `save.campaign.ending`; first-clear guard so replays skip it; closes into `endless` |

**Phase 3 exit:** Folio I → IX playable start to finish; the ending persists; replaying Folio IX duel III skips the beat.

---

## Phase 4 — Repeatable modes

Each is the same shape: **pick mode → duel → result → back**. Reuse 1.2 and 2.1 verbatim — a mode screen is a launcher, not a reimplementation.

| # | Screen | Lines | Extra work | Done when |
|---|---|---|---|---|
| 4.1 | `DailyScreen` | 107 | seeded daily puzzle, +10 s per mistake, streak, top-100, Offer-a-Candle | today's duel runs and is identical on a second device |
| 4.2 | `WeeklyScreen` | 79 | the week's 2 writs, countdown to turnover | writs visibly change the duel (`shared/weekly.ts` — do not re-derive) |
| 4.3 | `EndlessScreen` | 75 | rung/best, waiting foe + next-three queue, Ascend; **salt persists** | win ascends, loss returns to the foot, `best` never decreases |
| 4.4 | `Matchmaking` + **`serverDuel.ts`** | 100 + 223 | 🔴 `serverDuel.ts` **does not exist yet**. Queue, widening Standing windows, 4 s Shade fallback | queues, falls back to a Shade at 4 s, and a real duel runs against the server |
| 4.5 | `Versus` | 61 | the pre-duel splash | plays then routes to `duel` |
| 4.6 | `FriendScreen` | 105 | create/join a code, unrated | two parties pair on the code |

> **4.4 is the hidden blocker.** PvP cannot run at all until `serverDuel.ts` exists. Build it with
> 4.4, not before — `LocalDuel` already satisfies `DuelRuntime`, so nothing else waits on it.

---

## Phase 5 — Echoes + meta

| # | Screen | Lines | Extra work | Done when |
|---|---|---|---|---|
| 5.1 | **`echoes.ts`** + `EchoesScreen` | 230 | 🔴 `echoes.ts` **does not exist yet**. SQLite `duels` ring (newest 12, validate-on-write, skip corrupt rows); sealed-chit export/import with the **two-way privacy pass** | a real duel lands on the shelf, survives a restart, and the imported echo replays byte-identically |
| 5.2 | `ReliquaryScreen` | 92 | chest open sequence, candles, duplicate → +40 Ink | chest opens, reward is awarded once |
| 5.3 | `SeasonLedger` | 76 | 30 tiers, Ink claims | a claim is idempotent — claiming twice grants once |
| 5.4 | `CabinetScreen` | 166 | 26 cosmetics, 6 tabs, buy→own→equip via Ink | buy spends Ink, equip persists |
| 5.5 | `PurseScreen` | 37 | Ink/Sigils; Patron's Pouch is `TODO(T5)` — leave stubbed | balances match the save and the server |
| 5.6 | `LedgerProfile` | 221 | Standing graph, recovery code, export/import → `expo-file-system` + share | a recovery code moves Ink to another device |
| 5.7 | `SettingsScreen` | 118 | motion / contrast / text size / left-hand / telemetry / language | all four display switches change the app immediately |
| 5.8 | `OfflineScreen` | 40 | expo-network listener | fires on disconnect, recovers on reconnect |

---

## Phase 6 — Ship gates

- [ ] `npx expo export --platform all` clean
- [ ] `npx tsc --noEmit` · `npx eslint .` · `npx vitest run` all green
- [ ] Every screen walked once, **in order**, on a real phone in Expo Go
- [ ] Android hardware back reaches `ui.goBack()` from every screen
- [ ] Reduced-motion + high-contrast + all three text sizes walked
- [ ] Offline: duel modes play with no network
- [ ] Bundle size recorded (`expo export` output)
- [ ] Store config: icons, splash, `bundleIdentifier`, privacy manifest (`specs/13`)

---

## The dependency graph (why this order)

```
0.1 storage ──┐
0.2 audio ────┼──► 1.1 Boot ──► 1.2 DUEL ──► 2.1 Result ──► 2.2 Ribbon ──► 2.3 Hub
              │                ▲                                          │
              │                │                                          ├─► 3.1 Story ─► 3.2 Orders ─► 3.3 Map ─► 3.4 Detail ─► 3.5 Ending
              │                │                                          │
              │                │                                          ├─► 4.1 Daily    4.2 Weekly   4.3 Endless
              │                └──────────────────────────────────────────┤
              │                                                                   ├─► 4.4 Matchmaking (+serverDuel.ts) ─► 4.5 Versus ─► 4.6 Friend
              │                                                                   │
              └──────────────────────────────────────────────────► 5.1 Echoes (+echoes.ts)
                                                                          ├─► 5.2 Reliquary   5.3 Season   5.4 Cabinet
                                                                          └─► 5.5 Purse  5.6 Ledger  5.7 Settings  5.8 Offline
```

**1.2 is the critical path** — 8 of the 22 screens are unreachable without it, and its own
acceptance criteria (flood, shake, hit-stop, heat, four win conditions) is the largest single
chunk of acceptance in the port.

---

## Rules of engagement

1. **One screen at a time.** Finish all six boxes before opening the next file.
2. **Report defects, don't fix them.** This is a port. A web-build defect is a finding.
3. **Never touch `../shared/`.** If you believe the engine has a bug, write it down.
4. **Never copy `shared/` in.** Alias only.
5. **No god files.** ~300-line ceiling, one export per file, extract on sight.
6. **No colour literals** outside `src/theme/` — lint-enforced. Add to `tokens.ts` first.
7. **If `tsc` reports an error in a file you don't own, report it — do not fix it.**