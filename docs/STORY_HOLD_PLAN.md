# ASSIZE — Story Hold Plan

*Companion to `docs/STORY.md` (the canon) and `docs/TUTORIAL_OPTIMIZATION_PLAN.md` (the lesson). This plan is about the STORY layer only: making sure the narrative holds together, holds the player, and holds up under the code that ships it. The tutorial defects (G-series) and the TODO/bugs registers are solved and are deliberately out of scope here.*

---

## 0. TL;DR

The story **content** is strong and the delivery plumbing is mostly wired — every beat except two prologue lines already renders on mobile. What does not hold yet is the story **as the player experiences it**:

1. Two prologue lines (the actual setting) are still dead copy — players meet "Clerk, Assize, Seals" with zero framing.
2. When you finally beat a Magistrate, they say **nothing** — the defeat lines and taunts are readable in FolioDetail beforehand but never fire in the moment. The fiction's loudest instrument (opponents who talk) is unused mid-duel.
3. Fiction vocabulary has no in-app dictionary — "Chain", "Miasma", "Reckoning", "Standing" are taught once in the tutorial and assumed forever after.
4. Nothing records what happened — story screens are one-shot by design, so a returning player has no way to re-read the plot.
5. The canon copy exists in **two hand-copied files** (web + mobile) with no drift guard — `en.json` has *already* drifted by one key. This is the process risk under everything else.

The plan is 4 phases, 12 work items, each with the exact files to edit, the acceptance test, and the risk. Phases 1 and 4 are process guardrails (they make every later edit safe); Phase 2 ships the dead beats; Phase 3 stitches story to mechanics at the seams where they already touch.

---

## 1. What "the story holds" means

Plain English first. A story "holds" in a game when four things are true at once:

- **It frames.** Before the first mechanic hits you, you know who you are, where you are, and why a Sudoku is a courtroom. (Currently: half-shipped — see W1.)
- **It responds.** The world talks back when you do something. Win a duel, the Magistrate speaks. Break a Seal, the court notices. (Currently: the event log speaks in template sentences, but no *character* ever speaks in the moment — see W2, W3.)
- **It can be re-read.** Anything important the player was told stays reachable. One-shot screens are fine for drama, poison for comprehension. (Currently: no recap exists — see W4.)
- **It cannot silently rot.** The words live in data files; data files drift. If there is no test, drift is not a risk, it is a schedule. (Currently: already drifting — see W7.)

The mechanics do not need to change for the story to hold. The logic spine — authoritative server, shared pure engine, one-canon copy loader — is sound and verified. Every work item below is additive: new screens, new renderings of *existing* canon lines, new tests. No canon text is reworded.

---

## 2. Fresh analysis — how the story ships today (verified against the working tree at commit `4ef1c89`)

### 2.1 The pipeline

```
docs/STORY.md (editor's canon, 106 lines)
      ↓ hand-synced
{src, mobile/src}/i18n/story.json  ← THE canon data (byte-identical today: prologue[4],
      ↓ import                       tutorial[3], folios[9×2], mag[9×4], interlude1/2[3],
mobile/src/i18n/index.ts  t()        orsoloReveal[3], endings.balance[4]/burn[5])
      ↓
Screens: PrologueCards (tutorial) · StoryCard (interludes/reveal/endings) ·
         FolioDetail (challenge/defeat/taunt/folio card) · EndingChoice ·
         FolioMap / Versus / Hub (titles, subs, ending-aware hub line)
```

### 2.2 What already holds (evidence)

| # | Fact | Evidence |
|---|---|---|
| A1 | All nine Magistrates' challenge/defeat/taunt/folio-card copy ships and renders in FolioDetail | `mobile/src/ui/screens/FolioDetail.tsx:41` (`magCopy`) |
| A2 | Interlude 1 after Folio III duel 3, Interlude 2 after Folio VI duel 3, Orsolo reveal → EndingChoice — indices correct, wiring present | `mobile/src/ui/duel/DuelScreen.tsx:234–360` |
| A3 | Web asset paths (`/assets/plates/...`) resolve to bundled files on mobile, degrading to a frame — never a crash | `mobile/src/theme/assets.ts` header, `imageForPath`; `StoryCard.tsx:72` |
| A4 | The ending is persisted and the hub acknowledges it in fiction ("The Ledger is {ending}") | `mobile/src/state/save.ts:24` (`campaign.ending`), `i18n.hub.foliosSettled` |
| A5 | Orsolo's fiction ("I have worn nine Orders") is mechanically true — his boss script swaps Orders mid-duel, dispatched fail-closed | `shared/phaseScript.ts` (T20 `swapTo`), `docs/STORY.md` Folio IX |
| A6 | The Endless Assize ladder has story framing, and bots are honestly labelled Shades (spec R7) | `i18n.endless.title/sub/law`; `Versus.tsx` ash-tinted Shade cards |
| A7 | Story beats cannot be replay-exploited; they are dead-end nav destinations | `mobile/src/state/ui.ts` `DEAD_ENDS` |

### 2.3 Where it wobbles (each becomes a work item)

| # | Wobble | Evidence | Player-facing symptom |
|---|---|---|---|
| W1 | Prologue lines 0–1 (plague, sealed city, Orsolo's execution) never render; only lines 2–3 show | `mobile/src/ui/duel/tutorial/PrologueCards.tsx:24` — `CARD_LINES = [prologue[2], prologue[3]]` | First duelist meets "Clerk / Assize / Seals" with no idea of the world |
| W2 | Defeat lines (9 × 2) and folio completion cards fire nowhere — ResultScreen shows generic banner copy only | `mobile/src/ui/screens/ResultScreen.tsx:70` (`i18n.result.victory/defeat`) | Beating a Magistrate lands exactly as hard as losing a daily |
| W3 | Taunts (9 × 2) are pre-reading in FolioDetail, never spoken mid-duel | grep `taunt` → FolioDetail only | The court never reacts while you play; opponents feel mute |
| W4 | No recap: interludes/reveal are one-shot; nothing stores "beats seen" | `ui.ts` story payload consumed once; no save field | A returning player cannot recover the plot |
| W5 | No in-app lexicon; status copy is one word ("Chained", "Smudged") | `i18n.duel.status.*` | Tutorial-taught vocabulary decays; ranked newcomers re-guess |
| W6 | The Clerk is never voiced at the reveal/ending (stylistic, but the biggest beat is silent where a voice would land) | `storyJson.orsoloReveal`, endings — all magistrate-voiced | Optional improvement, owner decision |
| W7 | Canon exists twice by hand; `en.json` web vs mobile already differ (mobile has `errorBoundary`, web does not) | `diff` of the two trees | Future edits will desync voice; nothing fails when it happens |
| W8 | No test ties `docs/STORY.md` to `story.json`, and no dead-copy detector | no such test exists | Canon lines can silently stop shipping (this *already happened* to the prologue before T0) |

---

## 3. The plan

**Laws this plan obeys** (inherited from the tutorial plan §11 — they still apply):

1. Canon lines are **never reworded**. Presentation, ordering, and plain-language companions may change; the quoted fiction may not.
2. Plain-first: wherever a canon line shows, one plain sentence beside it carries the meaning (the PrologueCards pattern).
3. Additive only. No screen's existing behaviour is removed; new surfaces are new files plus small, enumerated edits.

Effort bands: **S** ≤ half a day · **M** 1–2 days · **L** 3+ days (solo dev, including tests).

---

### Phase 1 — One canon, guarded *(the safety net; do this first)*

#### P1.1 — Single-source the story copy · **M**

**Plain English.** Today the same story file lives twice (web and mobile), copied by hand. The day someone edits one and not the other, the platforms tell different stories — and nothing would complain. We make one file the original and prove at test time that both platforms carry it byte-for-byte.

**Technical edits.**
- Move the canon: `src/i18n/story.json` → `shared/i18n/story.json`.
  - Web: `src/i18n` imports re-point to `@shared/i18n/story.json` (metro/bundlers both resolve `@shared` already — `mobile/src/i18n/index.ts` and `src/i18n/index.ts` are the only import sites).
  - Mobile: keep `mobile/src/i18n/story.json` as the *build artifact*: add a small sync script `tools/sync-story.mjs` (same pattern as `tools/audit-mobile-assets.mjs`) that copies `shared/i18n/story.json` → `mobile/src/i18n/story.json` and exits non-zero on content drift when run in CI mode.
- **Do the same for `en.json`**, which has already drifted (mobile `errorBoundary` key). The sync script handles both files; the web's missing key is added so both are byte-identical (the key is additive and harmless on web).
- New test `shared/__tests__/storyCanon.test.ts`:
  1. reads both JSON trees, asserts deep-equality (fast failure message: the first differing key path);
  2. asserts every top-level group (`prologue, tutorial, folios, mag, interlude1, interlude2, orsoloReveal, endings`) is non-empty.

**Accept.** Editing one file and running the app on the other platform fails the canon test, not the player. `bun test shared/__tests__/storyCanon.test.ts` green.

**Risk.** Low. Pure data move; no runtime logic touches it.

#### P1.2 — Dead-copy detector · **S**

**Plain English.** The prologue sat dead in the build for weeks and nobody noticed — that failure mode needs a tripwire. A tiny audit script lists every story key and whether any source file references it. Dead keys become visible in every audit run.

**Technical edits.**
- New `tools/audit-story.mjs`: walks `storyJson.<key>` usages across `src/` and `mobile/src/` (regex over `.ts/.tsx`), emits a table `key → referencing files`, exits non-zero for keys with zero references *except* an explicit allowlist (e.g. `endings` consumed dynamically via computed keys, `mag.*.taunt` until P2.2 lands).
- Wire into `package.json` as `"audit:story"` alongside the existing asset audit.

**Accept.** Running it today reports exactly W1–W3 (prologue[0..1], `mag.*.defeat/taunt/folio` on mobile) — i.e. the script agrees with this plan's manual analysis. After Phase 2, the allowlist is empty.

**Risk.** None. Read-only tooling.

---

### Phase 2 — Ship the dead beats *(where the story starts to hold the player)*

#### P2.1 — The whole prologue · **S**

**Plain English.** Four prologue lines were written; two ship. The two missing lines are the *setting* — the plague, the sealed city, the watched execution. Without them the player learns the rules of the court but never the reason the court exists. We render all four, canon verbatim, each under one plain sentence (the established pattern).

**Technical edits.**
- `mobile/src/ui/duel/tutorial/PrologueCards.tsx`: `CARD_LINES` → all four `storyJson.prologue` entries; the per-card `title/plain` pairs become a 4-entry array.
- `mobile/src/i18n/en.json` + `src/i18n/en.json` (via P1.1): add `tutorialV2.prologue3Title/Plain`, `prologue4Title/Plain` (plain lines, owner-approved wording — drafts in §6).
- Update `mobile/src/ui/duel/__tests__/tutorialCoach.test.tsx` / PrologueCards expectations: 4 cards, tap-through, `onDone` still fires the director's `prologueDone` gate (no timing change — the cards are static, reduced-motion law unaffected).

**Accept.** First tutorial boot shows 4 cards; canon text byte-equal to `story.json.prologue`; tap-advance and skip behaviour unchanged.

**Risk.** Minimal — the T0 component was built for exactly this; the array is the only structural change.

#### P2.2 — Taunts in the duel (the court talks back) · **M**

**Plain English.** Every Magistrate has two taunt lines written and shipped — and they are never spoken. These are the fiction's best instrument: the opponent should *gloat when they claim your row* and *coolly note it when your Seal cracks*. We fire taunts through the Ticker (the one-line diegetic log above the board), styled as the Magistrate speaking, throttled so it flavours the duel instead of spamming it.

**Technical edits.**
- `shared/shade.ts` — `ShadeAction` gains an optional `taunt?: { key: MagistrateKey; idx: 0 | 1 }` field. The *bot* layer decides when a line is *allowed*; it never invents text (copy stays in `story.json`).
  - Trigger rules (pure, testable): taunt eligible when (a) the foe just claimed a unit, or (b) the Clerk just made a mistake, and (c) ≥ 45 s since the last taunt, (d) not two taunts in a row, (e) never in the final 30 s. Selection: seeded rng over the magistrate's unused taunt index.
- `shared/phaseScript.ts` — phase *entry* (a Magistrate changing composure) is a third, higher-priority trigger; it maps naturally onto the existing one-shot signature dispatch point.
- Mobile:
  - `mobile/src/ui/duel/Ticker.tsx`: if the latest event carries a taunt, render it in the display font with the Magistrate's name as speaker (`tf('common.theFoe')` pattern — dictionary key `duel.tauntPrefix`, e.g. "Halbrecht: "). The Ticker already renders only the last event, so no queue machinery is needed.
  - `mobile/src/ui/duel/DuelScreen.tsx`: pass the taunt through when consuming runtime events; campaign duels get `mag.<folioKey>.taunt`; ranked Shade duels get the generic Shade voice via one new `i18n.duel.shadeTaunt` pair (2 lines, owner-approved).
  - Campaign-only payloads resolve the magistrate key from `ui.campaignDuel.folio` — no new store fields.
- Web parity: `src/app/game/HudBits.tsx` (the Ticker's origin) gets the same conditional — one render branch.
- Tests: `mobile/src/ui/duel/__tests__/ticker.test.tsx` — taunt renders with speaker prefix; throttle law (pure function `eligibleTaunt(...)` in `shared/shade.ts`) unit-tested: 45 s gap, no back-to-back, final-30 s silence.

**Accept.** In a campaign duel, claiming the Clerk's row produces exactly one Magistrate line within a second of the claim event; rapid claims inside the cooldown window produce none; the final 30 s of any duel is taunt-silent.

**Risk.** Low–medium. Touches the shared event type (additive optional field) — both runtimes tolerate unknown/absent fields by construction (`duelRuntime` consumers read whitelisted keys). The Ticker's one-line clamp must be re-verified with the longest taunt line (M1's G5 lesson).

#### P2.3 — The Magistrate speaks at the result · **S**

**Plain English.** The highest-fiction moment in the campaign — finally beating a Magistrate — currently shows the same generic "VICTORY" banner as a practice win. Each Magistrate already has defeat lines and a ~60-word folio completion card. We show them on the result screen, verbatim, above the economy summary.

**Technical edits.**
- `mobile/src/ui/screens/ResultScreen.tsx`: when `duelMode === 'campaign'` and won, render `storyJson.mag.<folioKey>.defeat` (2 lines) and, on the third duel of a folio, `storyJson.mag.<folioKey>.folio` (the completion card). When lost, render `storyJson.mag.<folioKey>.challenge[0]` as the Magistrate's dismissal (the pre-duel challenge already taught the full text; one line here is a hook, not a spoiler).
- Data needed: `folioKey` — derive from `ui.campaignDuel.folio` via the existing `FOLIOS` table import (`mobile/src/ui/screens/FolioDetail.tsx` pattern); add `campaignFolioKey?: string` to `ui.lastResult` at the point where DuelScreen builds it (one field, set once).
- Style: reuse StoryCard's caption typography (`fonts.display` + `bodyItalic`), no plate image — the result screen stays fast.
- Tests: `ResultScreen.test` additions — campaign win shows defeat lines; campaign loss shows dismissal; non-campaign modes show none.

**Accept.** Beating Halbrecht's third duel shows his two defeat lines and the Headsman folio card before the Ink summary. Daily/ranked results are unchanged.

**Risk.** Low. Pure presentation over already-shipped copy; one additive store field.

#### P2.4 — The Chronicle (a re-readable Ledger of what happened) · **M**

**Plain English.** Story screens are one-shot by design — good drama, bad memory. A player who returns after three weeks, or who tapped through an interlude too fast, has no way to re-read anything. We add the Chronicle: a read-only screen that lists every story beat the player has *reached*, with its actual canon lines. Nothing new is written; the Ledger simply remembers.

**Technical edits.**
- `mobile/src/state/save.ts`: `campaign` gains `chronicleSeen: string[]` (append-only array of beat ids: `'prologue'`, `'interlude1'`, `'interlude2'`, `'reveal'`, `'ending:balance'`, `'ending:burn'`, `'folio:<key>'` on completion). Migration: absent → `[]` (same hostile-proofing pattern as `economy.pending`, save.ts:177).
- New `mobile/src/ui/screens/ChronicleScreen.tsx`: vertical list; each reached beat = its title (folio title / interlude heading), its canon lines, and the plate thumbnail via `imageForPath`. Unreached beats render as locked rows (title + "—"), so the list doubles as a progress map of the *story* (not the grind).
- Wiring: `ui.ts` `Screen` type + `GameShell.tsx` switch case + entry point — one "Chronicle" row on the FolioMap header (next to the folio progress) and one in Settings ("The story so far"). Back-nav: a reading screen, allowed as a back *destination* (not in `DEAD_ENDS`).
- Beat registration points (one `save.markChronicle(beatId)` call each, idempotent): PrologueCards `onDone`, DuelScreen's `storyBeat` dispatch (interlude1/2/reveal), EndingChoice confirm, ResultScreen on folio-completion.
- Web can adopt the same screen later; not in this phase.
- Tests: save migration (pre-chronicle save loads with `[]`); markChronicle idempotence; screen renders locked vs unlocked rows.

**Accept.** A fresh save shows all-locked Chronicle; after the reveal the interlude/reveal entries are readable forever; tapping through interludes too fast loses nothing.

**Risk.** Low. Additive screen; the only shared-file edits are enumerated (save field, Screen union, GameShell case).

#### P2.5 — The Clerk's Lexicon (in-app glossary) · **M**

**Plain English.** The game teaches its vocabulary once, in the tutorial, then uses it forever: Chain, Smudge, Hush, Miasma, Quarantine, Reckoning, Clean, Momentum, Ink, Standing, Shade, Folio. Anyone who plays a week later, or shares the phone, re-guesses from one-word banners. We add a single glossary screen — fiction term, one plain sentence, and the exact number where a number exists (sourced from `docs/BALANCE.md`, which is already the numbers' source of truth).

**Technical edits.**
- New `shared/lexicon.ts` — the data, so web and mobile share it:
  ```ts
  interface LexEntry { term: string; fiction: string; plain: string; value?: string; }
  // e.g. { term: 'chain', fiction: 'Chain', plain: 'One cell is locked for a few seconds.',
  //        value: '8 s' }
  ```
  Sections: The Court (Assize, Reckoning, Plea), The Tablet (Seal, given digit, claim, Clean, Ink), The Foe's Arts (5 statuses), The Orders (4 passives + 12 rites, one line each), The Ladder (Standing, rank, Shade). ~28 entries total; every number copied from BALANCE.md verbatim.
- Exhaustiveness test `shared/__tests__/lexicon.test.ts`: for every `AbilityId` and status id in `shared/config.ts`, a lexicon entry exists (compile-driven — adding a rite without a glossary line fails CI).
- New `mobile/src/ui/screens/LexiconScreen.tsx`: simple sections list, same typography laws as Chronicle; entries render `fiction` in display font, `plain` + `value` in body.
- Entry points: Settings row ("Lexicon"); the duel pause sheet ("Lexicon" — the moment a player most wants it); first-hit status toast (P3.3) deep-links here.
- `i18n` additions for screen chrome only (title/back); entry text lives in `lexicon.ts` (it is half-mechanics, half-voice — one source, shipped to both platforms).

**Accept.** Every status and rite the player can suffer or cast has a readable entry with its true duration/cooldown; screen reachable from pause in ≤ 2 taps.

**Risk.** Low. New module + screen; config-derived test keeps it honest forever.

---

### Phase 3 — Tie the story to the mechanics at the seams

#### P3.1 — The Endless Assize remembers the ending · **S**

**Plain English.** The hub already says "The Ledger is Balanced/Burned." The Endless ladder — where everyone lives after the campaign — does not react to which ending you chose. One sentence, one branch, and the post-game world acknowledges the verdict you sealed.

**Technical edits.**
- `i18n.en.json`: `endless.subBalanced` ("The Nine ride their circuit again, and the law you restored pays them wages." — owner-approved), `endless.subBurned` (equivalent for the lawless city); keep `endless.sub` for pre-ending saves.
- `mobile/src/ui/screens/EndlessScreen.tsx`: choose the sub from `save.campaign.ended && campaign.ending` (field verified at save.ts:24). Web parity in `src/app/game/EndlessScreen.tsx`.
- Test: `modeScreens.test.ts` addition — both endings render their line; un-ended save renders the original.

**Accept.** After "Burn", the ladder's subtitle says the city is lawless; after "Balance", that the court stands. Before the ending, nothing changes.

**Risk.** None. One conditional over an existing persisted field.

#### P3.2 — "I have worn nine Orders" stays true (reveal integrity test) · **S**

**Plain English.** Orsolo's challenge line promises he swaps Orders mid-fight, and the engine delivers (`swapTo` at 4 Seals). But nothing pins the *story promise* to the *mechanic*. If a future balance pass moves the swap threshold, the fiction becomes a lie and no test would notice. We add the pin.

**Technical edits.**
- Extend `shared/__tests__/phaseScript.test.ts`: locate the Orsolo `BossScript` (campaign config source — `shared/orders.ts` bosses table) and assert (a) at least one phase rule carries `swapTo`, (b) its `when.ownSealsBelow` equals 4, matching `docs/STORY.md` Folio IX and the tutorial plan's documented beat.
- A comment in the test names the canon line it protects, so the next editor meets the promise before they break it.

**Accept.** Changing the swap threshold or removing the swap fails CI with a message quoting the challenge line.

**Risk.** None. Test-only.

#### P3.3 — First-hit status explainer · **S**

**Plain English.** The tutorial explains the five statuses, but the first time a ranked player eats Miasma a month later, the word alone has to carry it. We add a one-time-per-status toast at the moment of first suffering in non-tutorial modes: "MIASMA — your notes are erased for 10 s. (Lexicon)". Once each, ever, dismissible, never in the final 10 s.

**Technical edits.**
- `save.ts`: `flags: { statusExplained?: string[] }` (hostile-proofed like `chronicleSeen`).
- `mobile/src/ui/duel/DuelScreen.tsx`: on consuming a `statusApplied` event targeting *me*, if id not in flags → show toast (existing toast chrome — `toast.svg` art already ships), write flag. Tutorial mode exempt (it teaches in place); final-10 s guard reuses the engine's existing rule so the toast never competes with Sudden Judgment.
- Toast body text from `shared/lexicon.ts` (P2.5) — one source, no duplicate copy.
- Tests: toast once per status id; tutorial exempt; flag persisted.

**Accept.** First-ever Miasma outside the tutorial explains itself once; second occurrence shows the plain one-word banner only.

**Risk.** Low. One new save flag, one render branch.

#### P3.4 — The Clerk's one voice line at the reveal (optional, owner decision) · **S**

**Plain English.** Every word of the reveal belongs to Orsolo; the Clerk — the player — stays silent through the biggest beat of the game. Deliberate stoicism can work, but one line of the Clerk's own, *after* Orsolo finishes and *before* the verdict choice, would hand the player the pen in fiction the way EndingChoice does in mechanics. Owner decision: this is the only item that adds new canon.

**Technical edits (if approved).**
- `story.json` gains `orsoloRevealReply: [line]` (one or two lines, Clerk-voiced, draft in §6) — both platforms via P1.1 sync.
- `mobile/src/ui/screens/StoryCard.tsx`: no change — the reveal payload already renders an arbitrary line array; DuelScreen:357 appends the reply lines to the payload array. Web `DuelScreen` parity.

**Accept.** The reveal reads: Orsolo's three lines, then the Clerk's reply, then the plate transition to EndingChoice. Skip behaviour unchanged.

**Risk.** Editorial, not technical. Ships only with owner sign-off on the wording.

---

### Phase 4 — Guardrails that keep it holding

#### P4.1 — Canon CI (assembled from P1.1 + P1.2) · **S**

The `bun test` lane runs `storyCanon.test.ts` (byte-equality web↔mobile, non-empty groups) and `lexicon.test.ts` (exhaustiveness). `audit:story` runs in CI (or as a pre-push script) with an empty allowlist after Phase 2 — meaning: every story key ships somewhere, or CI says so. `docs/STORY.md` gains a two-line footer pointing at the test names, so the editor's copy documents its own tripwire.

#### P4.2 — A one-page "story surfaces" map · **S**

Append to this file (§7) a table maintained by hand at first, then verified by `audit:story`: every story key group × where it renders (web/mobile) × when the player sees it. The purpose is onboarding: any future contributor can see in one page where narrative lives and which file guards it. (This is documentation of the system built above, not new work.)

---

## 4. What will NOT change (canon guarantees)

- **No canon text is reworded or re-ordered** except the four owner-approved new strings drafted in §6 (plain-language prologue companions, two ranked-Shade taunt lines, endless ending-branch subs, optional Clerk reply).
- The voice stays as `docs/STORY.md` defines it: terse, formal, dry, archaic, never jokey.
- One-shot story screens stay one-shot in the *flow* (no nav re-entry — the `DEAD_ENDS` law holds); re-reading happens only through the Chronicle.
- The tutorial's phase structure, graduation gate, and safety nets are untouched — this plan only renders more of the prologue inside the existing T0 slot.
- PvP logic, matchmaking, anticheat, economy: zero changes. The only shared-runtime edits are the additive optional `taunt` field (P2.2) and new pure modules (`lexicon.ts`).

## 5. Order of work & effort table

| # | Item | Phase | Effort | Unlocks |
|---|---|---|---|---|
| P1.1 | Single-source canon + drift test | 1 | M | everything (safe edits) |
| P1.2 | Dead-copy detector | 1 | S | P4.1 |
| P2.1 | Full prologue | 2 | S | — |
| P2.2 | Mid-duel taunts | 2 | M | — |
| P2.3 | Magistrate result lines | 2 | S | — |
| P2.4 | Chronicle screen | 2 | M | — |
| P2.5 | Lexicon screen | 2 | M | P3.3 |
| P3.1 | Ending-aware Endless sub | 3 | S | — |
| P3.2 | Reveal integrity test | 3 | S | — |
| P3.3 | First-hit status explainer | 3 | S | P2.5 |
| P3.4 | Clerk reply (optional) | 3 | S | owner decision |
| P4.1 | Canon CI assembly | 4 | S | — |
| P4.2 | Story surfaces map | 4 | S | — |

Recommended sequence: **P1.1 → P1.2 → P2.1 → P3.2** (one afternoon of guardrails and quick wins) → **P2.3 → P3.1 → P3.3 → P2.2 → P2.4 → P2.5** (the experience items, smallest first) → **P4.1/P4.2** (close the loop). P2.5 before P3.3 is a hard dependency (the toast reuses lexicon copy).

## 6. Owner-approval copy drafts (nothing below ships unchanged)

- `prologue3Plain` — "Before the first digit: remember why the court exists."
- `prologue4Plain` — "The Shade at your door was your master. The Assize took him from you twice."
- `shadeTaunt` (ranked, 2 lines) — "The Shade sets its digit and waits, politely, for yours." / "Another Seal cracks. Ink remembers."
- `endless.subBalanced` — "The Ledger is balanced; the Nine ride their circuit under the law you restored."
- `endless.subBurned` — "The Ledger is ash; the Nine ride a lawless circuit, and the strong write their own."
- `orsoloRevealReply` (optional P3.4) — "Then hear my plea, Magistrate: the folios are mine, and the pen is in my hand."

## 7. Story surfaces map (maintained under P4.2 — verified by `audit:story`)

| Key group | Mobile renders at | Web renders at | First seen |
|---|---|---|---|
| `prologue[0..3]` | PrologueCards, all four (P2.1) | tutorial | first boot |
| `tutorial` | TutorialLayer / GraduationCard | tutorial | first boot |
| `folios.*` | FolioMap / FolioDetail / Chronicle | FolioMap / FolioDetail | campaign |
| `mag.*.challenge` | FolioDetail (pre-duel) + ResultScreen dismissal (P2.3) | FolioDetail | campaign |
| `mag.*.taunt` | Ticker mid-duel via event `{key, idx}` (P2.2); generic Shade voice via `duel.shadeTaunt` | — | campaign |
| `mag.*.defeat` | ResultScreen `magVoiceFor` (P2.3) | — | campaign win |
| `mag.*.folio` | ResultScreen on third duels (P2.3) + Chronicle (P2.4) | — | folio completion |
| `interlude1/2` | StoryCard via DuelScreen + Chronicle (P2.4) | StoryCard | after Folios III/VI |
| `orsoloReveal` | StoryCard → EndingChoice + Chronicle (P2.4) | StoryCard | after Folio IX |
| `orsoloRevealReply` | DuelScreen reveal payload + Chronicle (P3.4) | — | after Folio IX |
| `endings.*` | StoryCard via EndingChoice + Chronicle (P2.4) | StoryCard | verdict |
| Ending acknowledgment | hub `foliosSettled` + `endlessSubFor` (P3.1) | hub only | post-game |
| Statuses / rites glossary | LexiconScreen + pause overlay via `shared/lexicon.ts` (P2.5) | — | any |
| Beats seen | ChronicleScreen via `chronicleSeen` (P2.4) | — | any |
