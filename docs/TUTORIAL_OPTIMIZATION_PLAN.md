# ASSIZE Mobile — Tutorial Optimization Plan

**Status:** Proposal for owner review · **Scope:** `mobile/` (primary), `shared/` (script v2, spec'd change), `src/` (web parity, follow-up) · **Author:** tutorial analysis pass, 2026-10-08

---

## 0. TL;DR

The tutorial's problems are not cosmetic. The code contains **hard bugs that make the teaching notes literally glitch on screen**, and the pedagogy underneath them was built for players who already know both sudoku and the game's fiction. A child opening ASSIZE today is dropped into a full competitive duel — Roman-numeral clock, wax Seal pips, an opponent racing them at 4.2–6.8 s per digit — with nothing but seven one-line archaic sentences floating over the board. The single most important rule of sudoku (**each digit 1–9 appears once per row, column, and box**) is **never taught at all**.

This plan ships in three milestones:

| Milestone | What | Effort | Outcome |
|---|---|---|---|
| **M1 — Hotfix** | Kill the 8 glitches (note flash, note regression, overlays over the board, skip/loss traps, Q/W/E on touch, ticker truncation) + make the tutorial impossible to lose | ~2 dev-days | Tutorial stops feeling broken *today* |
| **M2 — Rebuild** | Phased, gated, spotlight-driven interactive lessons; sudoku basics taught first; Shade script v2 (pausable race, no unfair damage, safe-to-fail); plain-language copy layer; replay entry points | ~8–10 dev-days | A 7-year-old can finish it unaided |
| **M3 — Polish & measure** | Demo animations ("ghost hand"), assist options, telemetry hooks, full device QA matrix, web parity port | ~3–4 dev-days | Shippable, measurable, consistent on both platforms |

Full rationale, code-level root causes, phase-by-phase design spec, file-by-file change list, test matrix, and risks follow.

---

## 1. Inputs & constraints

**What we were told:** the tutorial is unclear for any user, glitches a lot, and does not explain how the game plays. It must become clear **even for kids**. Deliverable: this plan (MD).

**What governs the work (from `mobile/AGENTS.md` and the repo layout):**

1. **The fidelity contract is amended by this document, deliberately.** AGENTS.md forbids "improvements" because the mobile app is a port of a signed-off web build — but it also says *"If you believe the web UI has a genuine defect, report it — do not fix it. Defects are a separate decision."* This plan **is that decision**, made by the owner. Tutorial clarity defects are documented here as canon, and the same changes should be back-ported to `src/` (web) in M3 so the two builds reconverge.
2. **`shared/` discipline.** The engine and the tutorial controller (`shared/tutorial.ts`, pinned by `shared/__tests__/tutorial.test.ts`) are consumed by both platforms. Script changes land as a **new, additive module + tests** (v2), never an in-place silent edit; the old script stays available behind a flag for A/B and rollback.
3. **No router.** Navigation stays the zustand screen machine (`mobile/src/state/ui.ts`). New tutorial surfaces are new `Screen` union members or overlays inside `DuelScreen` — not a navigator.
4. **No god files.** Everything stays ≤ ~300 lines, one responsibility per file, composition only in `DuelScreen.tsx`.
5. **Tokens, seams, i18n.** No hardcoded colours; new copy goes into `src/i18n/en.json` as a **new `tutorialV2` namespace** (the port deliberately did not mutate frozen keys; we extend, not edit); haptics/audio through `@/platform/*`; reduced-motion law respected by every new animation.
6. **Assets:** reuse the existing 222-file art set (`assets/game/**`) first; any new pointer/hand icon must be generated in the same engraved style (`tools/generate-assets.mjs`).

---

## 2. How the tutorial works today (verified trace)

For a first-time player:

```
App start
  └─ BootScreen (black splash, auto-advances in 1.2 s)         mobile/src/ui/screens/BootScreen.tsx:27-31
      └─ screen:'tutorial', duelMode:'tutorial'                mobile/src/state/ui.ts:94
          └─ DuelScreen renders the FULL competitive room      mobile/src/ui/duel/DuelScreen.tsx
              ├─ HudHeader: portraits, Roman-numeral medallion clock (minutes only),
              │   7 wax Seal pips per side, status chips       mobile/src/ui/duel/HudHeader.tsx
              ├─ MirrorStrip: foe's 9×9 dot matrix (unexplained) mobile/src/ui/duel/MirrorStrip.tsx
              ├─ Ticker: ONE line, italic, 1-line clamp        mobile/src/ui/duel/Ticker.tsx:38-40
              ├─ Board 9×9 (Easy tier, 36–40 givens)           useDuelSession.ts:230-236
              ├─ Toolbar: Pencil / Erase / Mute / Pause
              ├─ NumPad 1–9 + remaining counts
              ├─ AbilityBar: 3 rites with Q/W/E key hints      mobile/src/ui/duel/AbilityBar.tsx:89-91
              ├─ floating "margin note" (the whole tutorial)   DuelScreen.tsx:460-468
              └─ "Skip the tutorial" chip over the HUD         DuelScreen.tsx:444-459
```

**The teaching model** is a single passive text banner whose content is re-derived from live game state on every render, via a fixed priority chain (`mobile/src/game/localDuel.ts:434-444`):

```
progress === 0                        → 'select'   "Tap an empty cell. The brass edge marks your hand."
progress === 1                        → 'place'    "Now tap a numeral below. Correct ink is final…"
mistakes > 0 && !freeAugurGranted     → 'mistake'  "A false hand errs. You lost one wax Seal…"
!pencilUsedOnce                       → 'pencil'   "Toggle the quill to pencil candidates…"
!claimedOnce                          → 'claim'    "Complete a row, column, or box to claim it…"
!freeAugurGranted                     → 'augur'    "The Eye reveals the true digit…"
else                                  → 'end'      "Break my Seals, or fill the Tablet first. Begin, Clerk."
```

**The opponent** is a deterministic scripted loser (`shared/tutorial.ts`): it waits for the player's first correct placement, then places a true digit every 4.2–6.8 s, slips a wrong digit after every third placement, takes exactly one "teaching claim" (which deals 1 Seal damage to the player), caps its own correct ink at 22, and never casts rites.

**The stakes:** each wrong digit costs 1 Seal (`shared/config.ts` `placement.wrongSealCost: 1`); at 0 Seals the duel ends in defeat (`shared/engine.ts:244`). The tutorial is winnable **and losable**. `tutorialDone` is only written on a **win** (`DuelScreen.tsx:164-172`), and once written, the tutorial is **unreachable forever** on mobile — the Antechamber, Settings and OfflineScreen offer no replay entry (verified by grep).

---

## 3. Root-cause analysis

### 3.1 Glitch & bug inventory (why it *feels* broken)

Severity: 🔴 breaks comprehension · 🟠 confuses · 🟡 polish

| ID | Symptom the player sees | Root cause (file:line) | Sev |
|---|---|---|---|
| **G1** | The "augur" note ("The Eye reveals the true digit…") flashes for a single frame and vanishes before it can be read; a free ability is silently granted with no explanation and no visual cue on the ability tile | `LocalDuel.grantFreeAugur()` sets `freeAugurGranted = true` (`localDuel.ts:446-451`), which instantly flips `tutorialNote()` off `'augur'` → `'end'`; the effect fires on the note's first appearance (`DuelScreen.tsx:333-338`) | 🔴 |
| **G2** | Notes jump *backwards* mid-lesson: after doing the pencil and claim steps, the player's first mistake yanks the banner back to "You lost one wax Seal", then forward again — text visibly flickers between states | `tutorialNote()` is a pure function of live state with the mistake clause ranked above pencil/claim (`localDuel.ts:439`); there is no "already seen" latch per note | 🔴 |
| **G3** | The margin note paints **over the lower rows of the board**; taps pass through it (`pointerEvents="none"`), so players tap invisible-target cells "through" the text — reads as input glitching | Absolute overlay at `bottom: min(318, max(238, h·0.34))`, `zIndex 10` (`DuelScreen.tsx:65, 541, 460-468`). On a 667 pt phone that band lands on the board's bottom third; in landscape (h≈390) 238 px is the board's dead centre | 🔴 |
| **G4** | "Skip the tutorial" chip sits on top of the HUD's right cluster (Shade's pips/chips) — mis-taps quit the tutorial accidentally | `top: insets.top + 3, right: 8` overlapping `HudHeader` content (`DuelScreen.tsx:456`, `HudHeader.tsx:37-58`) | 🟠 |
| **G5** | Ticker sentences truncate mid-word ("Row IV claimed by You. Shad…"); Roman numerals (IV, VII) are unreadable for kids | `numberOfLines={1}` + 13 px italic (`Ticker.tsx:38-40`); `unitName()` renders `Row ${ROMAN}` (`Ticker.tsx:111-117`) | 🟠 |
| **G6** | Every ability tile shows a Q/W/E keyboard hint — on a phone | Web-parity leftover, `AbilityBar.tsx:89-91` (`styles.key`) | 🟠 |
| **G7** | The clock medallion shows "0" for the first minute, then Roman minutes only; no seconds; the 10:00 "Sudden Judgment" end is never surfaced anywhere | `HudHeader.tsx:23,33-34` (`ROMAN_MIN`, minutes floor) | 🟠 |
| **G8** | The claim note says *"I am… not hurrying"* **while the Shade is visibly racing** — the ticker literally prints "Shade sets a digit." seconds later | Copy written for a slower script; `shared/tutorial.ts` races at 4.2–6.8 s/digit after placement #1 | 🔴 |
| **G9** | The Shade's one "teaching claim" deals 1 Seal damage **before claims have been explained**, with hit-stop dim + shake + stamp SFX — the kid's first experience of "learning" is being damaged by something they don't understand yet | `shared/tutorial.ts` `demoClaimsLeft = 1` + `config.claims.damage = 1`; note priority means the claim note may not even be showing yet | 🔴 |
| **G10** | **Losing the tutorial shows a full DEFEAT screen** (oxblood banner, seals-collapsing sparkline), and its "Rematch" button routes into a **real calibrated Shade duel** (`duelMode: 'shade'`), not the tutorial | `ResultScreen.tsx:79-89`; `tutorialDone` only on `winner === 0` (`DuelScreen.tsx:164-172`) | 🔴 |
| **G11** | Skipping the tutorial grants **+100 Ink and then a DEFEAT banner** — the two most confusing feedback signals the game can send a child, delivered together | Skip handler concedes after paying the graduation reward (`DuelScreen.tsx:444-459`) | 🟠 |
| **G12** | Notes lag ~1 frame behind actions (banner text swaps trail the tap), compounding the "glitchy" feel | Notes derived in render from throttled store (~66 ms notify, `localDuel.ts:149-157`) with no per-note latch; combined with G1/G2 the banner reads unstable | 🟡 |
| **G13** | After finishing (either way) the tutorial can never be seen again on mobile — no replay entry anywhere | No `tutorial` route from Antechamber/Settings/OfflineScreen (grep-verified); web has one only in OfflineScreen | 🟠 |

### 3.2 Clarity failures (why kids can't learn from it)

1. **The core rule of sudoku is never taught.** Nothing anywhere says "each row, column and box must contain 1–9 exactly once." `'claim'` says "Complete a row, column, or box" — which presupposes the player knows what completing means, why it's possible, and why it matters. Every wrong-digit mistake a kid makes is unexplained noise.
2. **No goal, no stakes, no end-state.** Win conditions (break the foe's 7 Seals with claims, or fill the Tablet first), lose conditions (your own 7 Seals, 10-minute Sudden Judgment) appear at most in the *last* note (`'end'`), after pencil/claim/augur. The HUD's health metaphor (wax pips) is never introduced; 10 px dots don't read as "your life".
3. **Text-only teaching on a visual task.** The banner never points. No cell highlight, no pulsing digit, no arrow to the pencil button, no glow on the ability tile when the note talks about it. "The brass edge marks your hand" assumes you already know which edge that is.
4. **Jargon density.** Seals, pips, Tablet, quill, rite, Clerk, Ink, Order, Shade, marginalia, the Eye, Roman numerals. The fiction is a strength *for adults*; for kids it is a second language wrapped around a puzzle they're simultaneously learning.
5. **Cognitive overload at t=0.** The full competitive HUD, an opponent that starts racing after your very first placement, a ticker, a mirror, three ability tiles, and a sequential note chain all run at once. Kids read slowly; the game gives them no pause between concepts.
6. **No gates, no demos.** Every note can be ignored; nothing demonstrates pencil marks (the single most confusable interaction: pencil mode silently turns taps into notes), nothing demonstrates a claim with an animation before asking you to earn one.
7. **Punitive failure loop.** 7 mistakes = loss = DEFEAT screen + banishment to a real duel (G10). The exact population this tutorial must serve is the population most likely to make 7 mistakes.
8. **Dead story content.** `story.json` ships a 4-line prologue and 3 tutorial intro lines — never rendered on either platform (only `Ticker` uses `tutorial.shadeName`). The Shade never speaks at the start; the kid has no idea who the opponent is or why they're playing.

### 3.3 Copy audit (current → problem)

| Key | Current copy | Problem for a child |
|---|---|---|
| `select` | "Tap an empty cell. The brass edge marks your hand." | "Brass edge" undefined; no pointing |
| `place` | "Now tap a numeral below. Correct ink is final; it cannot be undone." | "Ink is final" is threatening and vague; doesn't say *how to choose* the digit |
| `mistake` | "A false hand errs. You lost one wax Seal — see the pips above." | "Pips" meaningless; 10 px dots unnoticeable; no reassurance or recovery hint |
| `pencil` | "Toggle the quill to pencil candidates. Notes never cost Seals." | "Toggle the quill"/"candidates" — two pieces of jargon in one line; doesn't say *when* you'd want this |
| `claim` | "Complete a row, column, or box to claim it and wound your foe. I am… not hurrying." | Teaches nothing about *how* to complete a unit; the last sentence is factually false (G8) |
| `augur` | "The Eye reveals the true digit in a chosen cell. One use, freely given." | Flash bug (G1) means most players never see it; "the Eye" = Augur mapping unstated |
| `end` | "Break my Seals, or fill the Tablet first. Begin, Clerk." | The only goal statement in the whole tutorial — and it arrives last |

---

## 4. Design goals & principles

**Goal:** a first-time player aged ~6+ completes the tutorial unaided, can state the goal ("fill rows, columns and boxes with 1–9 without repeats; claim them to break the foe's Seals before they break mine"), and wants to play again.

**Principles (in priority order):**

1. **Teach the puzzle before the duel.** Sudoku first (rows/columns/boxes, no repeats), battle second (Seals, claims, rites). A kid who can't solve a unit cannot learn what a claim is.
2. **One thing at a time.** Each lesson introduces exactly one concept, gates on it, and confirms it. Everything not yet taught is either hidden, dimmed, or simplified away.
3. **Show, then say, then do.** Every concept gets (a) a visual demo or spotlight, (b) one plain sentence + one flavor sentence, (c) a required action with success feedback. Text is the support, not the medium.
4. **Safe to fail.** The tutorial cannot be lost. Mistakes are free-flowing teaching moments (bounded), the race only exists after graduation, and every exit (skip, pause, back) lands somewhere kind.
5. **Keep the fiction as wrapping, not as carrier.** The Shade stays the narrator and the gothic tone stays — but every rule is stated in plain words first, flavor second. Pattern: **Plain line, then flavor line.** ("Each row needs the numbers 1 to 9, with no repeats. *The Assize tolerates no double entries, Clerk.*")
6. **Respect the architecture.** Everything below is implementable inside the existing screen machine, tokens, seams and file-size law.

---

## 5. The redesigned tutorial (spec)

### 5.1 Flow overview

The tutorial becomes a **state machine owned by the runtime** (not derived from live game state), driving **phased lessons** with UI spotlights. Screen machine stays; the duel screen grows a `TutorialCoach` overlay layer and a per-phase "director".

```
Boot (1.2 s) ──► T0 Prologue (2 skippable cards, NEW) ──► Duel screen in 'tutorial' mode,
                                                            tutorialPhase state machine:

T1 WELCOME        board only + spotlight          "This is the Tablet. 81 cells."
T2 THE ONE RULE   animated demo (ghost hand)      rows/cols/boxes, 1–9, no repeats   ← NEW, the missing foundation
T3 SELECT         spotlight a specific empty cell gate: tap THAT cell
T4 PLACE          spotlight the correct digit     gate: place the hinted digit (hint pip, not auto-solve)
T5 MISTAKES       scripted safe mistake           seal cracks ONCE, big callout, "you have 7; the first is free"
T6 PENCIL         spotlight pencil btn + demo     gate: toggle pencil, place 2 notes, erase one
T7 CLAIMS         animated claim demo on a row    gate: complete the prepared near-full row → flood + stamp
T8 AUGUR          spotlight ability tile (pulse)  gate: cast free augur on the prepared cell
T9 THE RACE       Shade wakes, slow (8–12 s/digit) real mini-duel; notes now ambient
T10 GRADUATION    win → graduation card (story.json tutorial lines finally used) → Antechamber
```

Exit hatches at every phase: **Skip** (proper confirm, below), **Pause** (engine + Shade both freeze), Android back (confirm).

### 5.2 Phase specs

Every phase defines: **UI state**, **gate** (what advances), **coach** (spotlight/banner), **copy**, **Shade behaviour**.

| # | Name | UI state | Gate to advance | Shade |
|---|---|---|---|---|
| T0 | Prologue | 2 full-screen story cards (existing `plate-prologue` art + `story.json.prologue[3..4]` condensed), tappable, skippable, "Tap to continue" | tap / skip | — |
| T1 | Welcome | Duel room visible; **NumPad, AbilityBar, MirrorStrip, clock hidden or dimmed to 40 %**; board centered larger; banner bottom-docked (never overlapping board — §5.3) | tap "Continue" on banner | frozen |
| T2 | The one rule | **Ghost-hand demo:** a scripted animation fills row 5 of an overlay board 1→9 with staggered ink (reuse flood tint), then a repeat-9 highlight pulses the rule; kid taps "Try it" | watch (5 s) or tap through | frozen |
| T3 | Select | Spotlight (dimmed cutout) on ONE prepared empty cell; banner: "Tap the glowing cell" | tap that cell | frozen |
| T4 | Place | Spotlight on the correct digit tile in the NumPad + a small hint pip in the target cell; wrong digits can be tapped but are gently rejected ("Not that one — look for the glowing 7") — **no Seal cost during T3–T7** | place correct digit | frozen |
| T5 | Mistakes | Scripted: the game *tells* the kid to tap a wrong digit on purpose in a sacrificial cell; strike overlay plays; **big** Seal callout ("You lost 1 of 7 Seals — the first is always free"); Scholar passive ("Marginalia") surfaces here as the built-in forgiveness | watch the mistake they made | frozen |
| T6 | Pencil | Spotlight pencil button; prepared cell; gate: toggle pencil + tap two digits (notes appear), then erase | notes placed + erased | frozen |
| T7 | Claims | Prepared near-complete row (8 filled); banner explains rows/cols/boxes are *territory*; gate: place the final digit → full claim presentation: flood + stamp + foe-Seal chip animation ("You took Row 5! The Shade loses 1 Seal") | claim resolves | frozen |
| T8 | Augur | Spotlight pulses the Augur tile; gate: cast it on the spotlighted cell → reveal animation; banner explains rites and long-press descriptions | ability cast | frozen |
| T9 | The race | All HUD elements restore; Shade wakes at 8–12 s/digit (≈2× slower than today), slips only after the player's 4th correct placement; **claim teaching note re-fires if player stalls >25 s**; banner becomes ambient | win (Seals or Tablet) | racing, gentle |
| T10 | Graduation | Win → engraved card using `story.tutorial[1..3]` + rewards summary (+100 Ink) → Antechamber. Loss is impossible (§5.5) | continue | — |

**Timing budget:** a focused kid finishes T0–T10 in ~4–6 minutes; an adult can speed-read it in ~90 s (tappable demos, no artificial waits).

### 5.3 Coach system (replaces the floating margin note)

New overlay component `mobile/src/ui/duel/tutorial/Coach.tsx` (own file; spotlight + banner + CTA):

- **Spotlight:** dimmed full-screen scrim with a punched-out highlight over the target region (board cell / toolbar button / ability tile / NumPad digit). Implemented as 4 dim rects around the target (no blur — art direction forbids glow); scrim taps are absorbed, target taps pass through. Respects `useMotionReduced()` (no pulse animation, steady outline instead).
- **Banner:** **docked below the board / above the toolbar in the layout flow** (not absolutely positioned), so it can never cover cells (fixes G3 permanently). Two-line max: plain sentence (15 pt) + optional italic flavor line (13 pt, existing italic family). Progress dots ("Step 4 of 9") for orientation.
- **CTA chip:** "Continue" / "Try it" inside the banner where a gate is not a board tap.
- **Trigger latching:** each note shows **once per phase** and is latched in the director state (fixes G2 regression and G12 flicker). No note is derived from raw live state anymore.
- **Skip:** moved to the banner row as a quiet text button + confirm sheet ("Skip the lesson? You'll keep your 100 Ink and go to the hall." → completes the tutorial **positively**, writes `tutorialDone`, no concede, no DEFEAT banner — fixes G4/G11).

### 5.4 Shade script v2 (`shared/tutorialV2.ts`, additive)

Keep `shared/tutorial.ts` untouched and pinned; add `shared/tutorialV2.ts` + `shared/__tests__/tutorialV2.test.ts`, selected by `opts.tutorialScript: 'v2'` from `specFromUi()`. Behaviour deltas:

| Parameter | v1 (today) | v2 |
|---|---|---|
| Start of race | after player's 1st correct placement | after **phase T9 begins** (director-driven), min 60 s of frozen teaching |
| Pace | 4.2–6.8 s/digit | 8–12 s/digit until player has 6 correct, then 5–8 s |
| Teaching claim | 1 claim, deals 1 damage, unannounced | **0 damage**: the demo claim in T7 is dealt BY the director as a presentation event; the Shade takes no claims before T9, and in T9 its claims are telegraphed ("The Shade eyes Row 3…") 2 s before landing |
| Slips | every 3rd placement from the start | none before the player's 4th correct placement; then every 4th |
| Ink cap / rites | 22, never casts | unchanged |
| Loss | possible (player's own 7 mistakes) | impossible: during T3–T8 wrong placements are rejected without Seal cost; during T9 player Seals floor at 1 ("The Shade stays its hand" — an explicit kind fiction line when the floor is hit) |

Determinism law is preserved: pure module, seeded `Rng`, engine-observable conditions only, same `ShadeAction` surface — the existing test suite's *invariants* (never casts, never completes the Tablet, always loses by Seals, determinism per seed) carry over with updated pacing assertions.

### 5.5 Safety nets & exits

1. **Cannot lose:** Seal floor at 1 during the whole tutorial (engine `RuleMods` already supports cost scaling; the floor is enforced in the v2 script + a `mods.wrongSealCost: 0`-equivalent for T3–T8 — exact mechanism in §6.2).
2. **Skip = positive completion:** confirm sheet → `tutorialDone: true` + Ink + straight to Antechamber (no concede path).
3. **Loss impossible ⇒ no defeat routing:** the `rematch()` tutorial-loss branch (`ResultScreen.tsx:88`) becomes dead code for tutorial, but is still hardened: any tutorial defeat routes to **re-play the tutorial**, not matchmaking (defense in depth).
4. **Replayability:** Antechamber gets a small "Relearn the Reckoning" row (Settings too — single dictionary key, both entries read `ui.go('tutorial', { duelMode: 'tutorial', tutorialReplay: true })`); replays grant no repeat +100 (graduation Ink is once-per-save, deduped like today).
5. **Pause teaches itself:** first time the kid opens pause, banner line "The Tablet waits for you. Tap Resume when ready." (Shade already freezes under pause — verified: `tutorialAct` gates on engine clock.)

### 5.6 Copy system

- New namespace `i18n.tutorialV2` with **plain-first, flavor-second** pairs and per-phase steps, e.g.:
  - `rule` plain: "Every row, every column, and every box needs the numbers 1 to 9 — no repeats." flavor: *"Nine digits to a unit. The Ledger abhors a duplicate."*
  - `seal` plain: "You have 7 wax Seals. A wrong number breaks one. Lose all 7 and you lose the duel." flavor: *"The false hand errs, and the wax remembers."*
  - `claim` plain: "Finish a row, column, or box and you claim it — the Shade loses a Seal!" flavor: *"Territory is taken, Clerk, one completed line at a time."*
- Names on screen stay plain for kids: HUD tooltips ("Seals = your life") available via a long-press **info chip** on the HUD; ticker strings switch to "Row 5" (Arabic numerals) in tutorial mode.
- All new keys added to **both** `mobile/src/i18n/en.json` and `src/i18n/en.json`; existing frozen keys untouched.

---

## 6. Engineering plan

### 6.1 Architecture decisions

1. **Director, not derivation.** New `mobile/src/game/tutorialDirector.ts`: a small finite state machine (`phase: 't0'|…|'t10'`, `seenNotes: Set`, `gates`, events `onPhaseEnter/Exit`, `advance(gateId)`), driven by duel events (placements, claims, ability casts) relayed from `LocalDuel` via the existing `opts.onEvent` seam. The runtime exposes `tutorialPhase()` and `tutorialGate()` on the `DuelRuntime` interface as **optional tutorial-only members** (`duelRuntime.ts` — additive, ServerDuel returns nulls).
2. **Script v2 in shared, spec'd:** `shared/tutorialV2.ts` (pure, seeded, test-pinned) + a `tutorialScript: 'v1'|'v2'` opt in `LocalDuelOpts`. `specFromUi()` picks v2; a save/settings flag can fall back to v1 for rollback/A-B.
3. **Seal-floor mechanism:** during T3–T8 the spec passes `mods` with a tutorial-only `wrongSealCost: 0` (engine `RuleMods` already flows through `createDuel`, T21-sanitized); during T9 the director sets a floor by forgiving mistakes via the existing `mistakeForgiven` path (Marginalia) — v2 script re-issues `wait` actions while `players[0].seals <= 1`, and the client clamps display. No engine edits.
4. **UI:** new files under `mobile/src/ui/duel/tutorial/` — `Coach.tsx` (spotlight+banner), `PrologueCards.tsx` (reuses `StoryCard` pattern), `GhostDemo.tsx` (T2/T7 scripted overlay animations), `GraduationCard.tsx`. `DuelScreen.tsx` composes `<TutorialCoach>` only when `duelMode === 'tutorial'`; hidden-element dimming is driven by a `stage` style prop so file ceilings hold.
5. **Screen machine:** no new route required — T0 can render as an overlay inside `DuelScreen` triggered by `tutorialPhase === 't0' && !save.tutorialDone`; (optional) a dedicated `'tutorialIntro'` Screen is the cleaner variant — flagged as an owner choice in §10.
6. **Web parity (M3):** identical changes ported to `src/app/game/*` after mobile sign-off; shared v2 script already lands on web for free.

### 6.2 File-by-file change list

| File | Change | Est. LOC |
|---|---|---|
| `shared/tutorialV2.ts` | NEW — v2 script (paced race, claim telegraphs, no early claims, floor-aware waits) | ~220 |
| `shared/__tests__/tutorialV2.test.ts` | NEW — invariants port + pacing/gating/floor tests (~10 cases) | ~200 |
| `mobile/src/game/tutorialDirector.ts` | NEW — phase FSM, gate latching, event relay | ~200 |
| `mobile/src/game/duelRuntime.ts` | additive optional tutorial surface (`tutorialPhase()`, `tutorialGate()`) | ~15 |
| `mobile/src/game/localDuel.ts` | wire director + v2 script selection + forgiven-mistake floor; **fix G1/G2 root** (notes no longer derived from raw state; latched) | ~60 |
| `mobile/src/ui/duel/DuelScreen.tsx` | compose Coach/Prologue/Graduation; banner docked in flow; remove absolute margin note; skip → confirm + positive completion | ~-40/+70 |
| `mobile/src/ui/duel/tutorial/Coach.tsx` | NEW — spotlight scrim, banner, CTA, progress dots, reduced-motion law | ~220 |
| `mobile/src/ui/duel/tutorial/PrologueCards.tsx` | NEW — 2-card intro from story.json | ~90 |
| `mobile/src/ui/duel/tutorial/GhostDemo.tsx` | NEW — T2 rule demo + T7 claim demo overlays | ~180 |
| `mobile/src/ui/duel/tutorial/GraduationCard.tsx` | NEW | ~70 |
| `mobile/src/ui/duel/AbilityBar.tsx` | hide Q/W/E on touch (`Platform.OS !== 'web'`), add `pulse` prop for spotlight | ~12 |
| `mobile/src/ui/duel/Ticker.tsx` | Arabic-numeral unit names in tutorial mode; 2-line clamp in tutorial | ~10 |
| `mobile/src/ui/duel/HudHeader.tsx` | optional stage-dimming prop; info chip (long-press) for Seals/clock in tutorial | ~40 |
| `mobile/src/ui/screens/ResultScreen.tsx` | tutorial-defeat → replay tutorial; hide rating row for tutorial | ~8 |
| `mobile/src/ui/screens/Antechamber.tsx`, `SettingsScreen.tsx` | replay-tutorial entries | ~20 |
| `mobile/src/i18n/en.json` (+ web twin) | `tutorialV2` namespace (~30 keys) | ~40 |
| `shared/config.ts` | tutorial v2 tunables block (paced delays, telegraph lead, floor) | ~12 |

All work stays inside the ownership table of AGENTS.md (`src/ui/duel/**`, `src/ui/screens/**`, plus the spec'd shared addition); gates (`tsc`, `eslint`, `vitest`, `jest`) run per milestone.

### 6.3 Test plan

- **Unit (vitest):** `tutorialV2.test.ts` — per-seed determinism; no Shade claims before T9; Shade pace bounds; Ink cap; always-loses-by-Seals; floor waits at player 1 Seal; telegraph precedes claim. `tutorialDirector` tests — gate latching (no note regression — pins G2), phase ordering, skip = positive completion, replay grants Ink once.
- **Component (jest):** Coach renders spotlight over target & absorbs scrim taps; banner never overlaps board (layout assertion on a small-phone frame, 667 pt, and landscape 390 pt — pins G3); skip confirm flow writes `tutorialDone` without `concede()`; AbilityBar hides Q/W/E on touch (pins G6).
- **Scripted E2E (device/manual probe in the `scripts/` tradition):** full fresh-install run: boot → T0 → T10 → Antechamber, zero errors, screenshot per phase (`scripts/shots/tut-t*.png`); replay path from Antechamber; skip path; pause during T9 (engine + Shade frozen); 12-mistake soak during T9 (Seals never below 1); reduced-motion pass (no spotlight pulse, no ghost animation, steady states).
- **QA matrix:** small Android (5.0" 720p), tall iPhone (Dynamic Island insets), iPad, landscape L/R, left-hand setting on, text-scale L, high-contrast on.

### 6.4 Performance & a11y guardrails

- Spotlight = 4 static dim views + (optional) 1 pulse `Animated.Value` — transform/opacity only; zero layout shift; the board's Cell memoisation untouched (Coach lives outside the board tree, spotlights a measured rect via `onLayout`, never re-renders cells).
- GhostDemo reuses `FloodWash` timing values (`floodDelayMs`, 30 ms/cell) so the demo teaches the *same* visual language the real claim will use.
- All new interactive elements ≥ 44 pt (`layout.touch`); every spotlight target exposes an `accessibilityLabel` already present (cells carry `cellAria`); banner is `accessibilityLiveRegion="polite"`; reduced-motion kills pulse/ghost per the kill-list law.

---

## 7. Milestones & acceptance criteria

**M1 — Hotfix (no design dependency, ships immediately)**
1. Augur note no longer self-destructs: latch notes in LocalDuel (`seenNotes`), grant the free Augur only after the note has been visible ≥ 2.5 s or on first Augur-tile tap (G1).
2. Note regression fixed (per-note latch, mistake note shows once) (G2).
3. Margin note docked in layout flow below the board; remove bottom-clamp absolute positioning (G3); skip chip relocated into banner row (G4).
4. Tutorial cannot be lost: `wrongSealCost: 0` mods for tutorial mode + Shade floor-wait at player 1 Seal; defeat routing for tutorial → replay (G9/G10).
5. Skip → confirm sheet → positive completion (keeps +100, no concede, no DEFEAT) (G11).
6. Q/W/E hidden on touch (G6); tutorial-mode ticker uses Arabic numerals + 2 lines (G5); false "I am… not hurrying" copy replaced (G8).
7. Antechamber + Settings replay entries (G13).
   *Accept: all four gates green; 12-mistake soak cannot lose; skip lands in Antechamber with Ink; replay works; no overlay covers any board cell on the 3 QA phones.*

**M2 — Rebuild (the kid-first tutorial)**
1. T0–T10 phases with spotlight coach, gated interactions, stage-dimmed UI per §5.2.
2. `shared/tutorialV2.ts` + tests; director wired; v1 reachable by flag.
3. `tutorialV2` copy namespace live; prologue cards using existing plate art.
   *Accept: a playtest script (or an adult simulating a 6-year-old: slow taps, wrong digits, ignore text) completes unaided; gates green; no file > 300 lines.*

**M3 — Polish, measure, converge**
1. Ghost-demo animations (T2/T7), HUD info chips, graduation card polish, haptic/audio passes (reuse existing 18-method audio surface: `pencil`, `stamp`, `claimWon`, `victory`).
2. Telemetry hooks (local-first, honoring `settings.telemetry`): phase reached, skips, mistakes per phase, time-to-first-placement, completion rate.
3. Web parity port of M1+M2 UI changes into `src/app/game/*`.
   *Accept: tutorial completion ≥ 80 % in playtesting; median time 4–6 min; zero crashes/blank screens in the QA matrix; web and mobile tutorial visually equivalent.*

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Fidelity-contract friction (AGENTS.md forbids exactly these changes) | This document is the owner's recorded decision; AGENTS.md gains a one-line pointer to it ("tutorial M2 rebuild excepted per docs/TUTORIAL_OPTIMIZATION_PLAN.md"); web parity restores convergence in M3 |
| `shared/` changes destabilize web | v2 is additive + flag-selected; v1 remains default until web flips; full invariant suite ported before merge |
| Scope creep into a full onboarding redesign | Hard boundary: tutorial mode only; no HUD redesign, no engine edits, no new economy; everything else is a dictionary key |
| Spotlight/overlay perf on low-end Android | Static rects, transform/opacity only, outside the Cell memo tree; verify on the 720p QA device |
| Kids still bounce at T9 (reading load during race) | Ambient-banner mode (single plain line), pause is one tap and freezes everything; T9 pace is 2× slower than v1; if metrics show drop-off, T9 gains a "race later" deferral to the first campaign duel |
| Note/ticker truncation on localized strings | All new keys ≤ 60 chars for banner line 1; clamp rules tested with the longest locale string |

---

## 9. Success metrics

- **Tutorial completion rate** (currently unmeasured; instrument in M3) — target ≥ 80 % of new installs.
- **Skip rate** — target < 15 %.
- **Time-to-first-correct-placement** — target < 20 s post-T3.
- **Mistakes per tutorial run** — target median ≤ 2 (today unbounded, loss at 7).
- **D1 return of tutorial finishers vs skippers** (if telemetry consented) — directional.
- **Zero** crash/blank-screen reports from the tutorial QA matrix.

---

## 10. Open questions for the owner

1. **T0 prologue screens:** new `Screen` union member (cleaner, matches StoryCard pattern) vs overlay inside DuelScreen (smaller diff)? Plan assumes overlay.
2. **Kid wording toggle:** ship plain+flavor always, or add a Settings switch ("Simple words") that hides flavor lines? Plan assumes always-paired (simpler, no divergence).
3. **v2 default timing:** keep the +100 Ink graduation reward on replay-plays (deduped), or grant only cosmetic celebration? Plan assumes deduped-once.
4. **Web timing:** back-port in M3 immediately, or hold until mobile metrics land? Plan assumes immediate.
5. **New art:** T2 ghost-hand demo reuses existing flood/stamp assets; if a dedicated "pointing hand" glyph is wanted, it must go through `tools/generate-assets.mjs` in the engraved style — confirm or accept asset-free spotlights.

---

## Appendix A — Jargon → kid-language glossary (for copy + HUD info chips)

| Game term | Plain words |
|---|---|
| Tablet | the puzzle board |
| Seals / pips | your 7 lives (wax stamps) |
| Ink | your correct numbers |
| Claim | take over a finished row/column/box |
| Rite / Order / abilities | your 3 special powers / your character class |
| Shade | the ghost you're playing against |
| Augur / the Eye | the "reveal a number" power |
| Marginalia | "your first mistake is free" |
| Sudden Judgment | the 10-minute timer |
| Clerk | you (the player) |
| Row IV / Column VII | Row 4 / Column 7 |

## Appendix B — Current note machine vs proposed director

| | Today (`tutorialNote()`) | Proposed (`tutorialDirector`) |
|---|---|---|
| Source of truth | derived from live engine state every render | explicit FSM, advanced by gates/events |
| Regression possible | yes (mistake clause outranks later steps) | no — monotonic phases, latched notes |
| Self-cancelling notes | yes (augur, G1) | no — note visible ≥ 2.5 s or until acknowledged |
| Race start | player's 1st placement | director-entered T9, ≥ 60 s in |
| Loss possible | yes (7 mistakes) | no — floor + zero-cost teaching phase |
| UI occlusion risk | absolute overlay over board | docked banner in layout flow |
| Replayable | no | yes (Antechamber/Settings) |
