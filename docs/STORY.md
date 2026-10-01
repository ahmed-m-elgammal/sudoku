# ASSIZE — Story Bible and Full Narrative Text

*Editor's copy. Every line below ships in the game via `src/i18n/story.json` and `src/i18n/en.json`. Voice: terse, formal, dry, a little archaic, never jokey.*

---

## Setting

The walled city of Novem, sealed against a plague. The Ninefold Assize, a court of nine Magistrates, settles every dispute by the Reckoning: two pleaders solve one sealed Tablet of nine by nine. The false hand errs, and the wax seals on the Tablet break. The Great Ledger of Novem records who owes what to whom, including who owes their life.

## Protagonist

**The Clerk** — an unnamed junior scribe. Their master, Magister Orsolo, was executed for forging the Great Ledger. The Clerk was spared and stripped of rank. The only way back into the Assize is to plead as a duelist and win a Folio (a page of the Ledger) from each Magistrate.

## Twist

**Orsolo is alive.** He is the Ninth Magistrate. He forged the Ledger to erase the Clerk's name from the plague-debt rolls and save their life. The "Shade of Orsolo" who teaches the tutorial is his ink-echo, sent to prepare the Clerk. In fiction, a **Shade** is an ink-echo of a person that duels on their behalf — which is also how the game honestly labels its computer opponents (spec R7) and replay ghosts.

## Endings

- **Balance the Ledger** — truth restored; Orsolo condemned again; the plague-debt falls on the Clerk.
- **Burn the Ledger** — the debts vanish; the Assize collapses; the city is lawless.

After either ending the Endless Assize (ranked ladder) continues.

---

## Prologue (tutorial, ~90 words)

> They say the plague came from the river, so the river-gates were chained, and after them every other gate, and then the mouths of gossips.
>
> You were Magister Orsolo's clerk when they took him for forging the Great Ledger. You watched from the third row. Your name was struck from the rolls the same hour, and your rank with it.
>
> The Ninefold Assize settled every quarrel in Novem by the Reckoning: two pleaders, one sealed Tablet, nine by nine. The false hand errs, and wax Seals break.
>
> This morning an ink-echo wearing your master's voice stood at your door and said: «They hanged a lie, Clerk. Take up your pen and win the truth back, folio by folio.»

## Tutorial lines (Shade of Orsolo)

> So. The Assize did not keep you away long.
> I am what ink remembers of Orsolo. Call me a Shade, and mind your Seals.
> Place your digits truer than I place mine, and this Tablet is yours.

Tutorial margin notes: see `i18n.tutorial.notes` (select, place, mistake, pencil, claim, augur, end).

---

## The Nine Folios (3 duels each — minor Shade, lieutenant, Magistrate; 27 duels total)

| Folio | Magistrate | Loadout | Teaches | Tier ramp (magistrate duel) |
|---|---|---|---|---|
| I | Halbrecht the Headsman | Executioner | claims, Chains | Medium |
| II | Mother Vael, the Apothecary | Apothecary | Smudge and healing | Medium |
| III | Cantor Ilse, the Bellringer | Executioner + Hush | input freeze | Hard |
| IV | Brother Anselm, Warden of the Lantern | Warden | defense, reflection | Hard |
| V | Dame Corvane, the Cartographer | Warden + Quarantine | claim denial | Hard |
| VI | Tobias Quill, the Forger | Scholar + Smudge | fakes certainty | Expert |
| VII | Lord Marchetti, the Moneylender | Executioner passive, hoards Reckoning | punishes low Seals | Expert |
| VIII | Old Nox, the Gravedigger | Apothecary + Miasma | erases your notes | Expert |
| IX | Magistrate Orsolo, the Ninth Seal | Adaptive; swaps Orders at 4 Seals | everything | Expert |

Magistrates have 8 Seals instead of 7.

### Folio subtitles

- I — *The Axe teaches first, and explains after.*
- II — *Her cures are legend. So are her debts.*
- III — *She counts in knells.*
- IV — *Nothing enters his light uncounted.*
- V — *She has measured every road out of Novem but never used one.*
- VI — *His certainty is beautifully made.*
- VII — *Everything is owed. Especially you.*
- VIII — *He buries what the Ledger no longer wants.*
- IX — *The seat is empty until you sit in it.*

### Challenges / defeat lines / victory taunts / folio cards

All 9 × (3-line challenge, 2-line defeat, 2-line taunt, ~60-word completion card) are in `src/i18n/story.json` under `mag`. Samples:

**Halbrecht** — challenge: *"The block is sanded smooth, Clerk. I sanded it. / Solve badly and you will learn how smooth. / Take your Order. I have taken heavier heads than yours."* Defeat: *"A clean cut. I have not felt one in years. / The folio is yours. My arm remembers it."* Taunt: *"You hold that pen like a knife you fear. / The row is mine. Your Seals crack so politely."*

**Orsolo** — challenge: *"Clerk. You came. Sit — no. Plead. / I have worn nine Orders waiting for you. / Take my Seals. I forged the Ledger; I can spare them."* Defeat: *"The Ninth Seal cracks. Truth is heavier than ink. / You unmade me properly. Do it again at the trial."* Taunt: *"You solve like a man reading his own sentence. / I taught your hand everything but mercy."*

Folio completion cards (one per Magistrate, ~60 words each) close every folio and foreshadow the Ninth's survival (Anselm: "The Ninth has walked these wards at night. He checks the locks." Marchetti: "Perhaps you will settle him.").

## Interludes (after Folios III and VI)

Two full-screen cards each (`story.interlude1`, `story.interlude2`). Interlude 2 plants the reveal: the Shade says *"…remember that I lied to you exactly once."*

## Orsolo reveal (after Folio IX, before the ending choice)

> The Ninth Seal lifts its mask. Your master's eyes are older, and dead in a way that has nothing to do with the grave they say he has.
>
> «They hanged a body shaped like me,» says Magistrate Orsolo, Ninth of the Nine. «I forged the Ledger to strike your name from the plague-debt rolls. Erased men do not hang. You were the only thing in Novem worth being a liar for.»
>
> «The remaining folios are the truth, Clerk, written small. Win them, and choose: balance the Ledger, or burn it.»

## Endings (full-screen plates, ~120 words each)

Both endings ship verbatim in `story.endings.balance` / `story.endings.burn`, closing on engraved title lines: **THE LEDGER IS BALANCED.** / **THE LEDGER IS BURNED.**

---

## Achievements ("Marginalia", 24)

First Verdict · A Clean Hand · Seal-Breaker · Lord of Rows · Saint of Columns · Box-Wright · Unflinching · Tide-Turner · Unspoken · Unchained · Miasma-Walker · Reader of Blots · Augur-Faithful · Reckoning Dealt · Sworn to the Lantern · Sworn to the Quill · Sworn to the Axe · Sworn to the Vial · The First Folio · Halfway Hanged · The Ninth Seal Broken · Daily Ember · Seven Unbroken · Keeper of the Ledger. Titles and descriptions live in `i18n.achievements`.
