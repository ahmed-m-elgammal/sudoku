# ASSIZE — App Store Metadata (Ready to Paste)

Prepared under the ASO skill's **Challenger** brand tier: zero ratings, zero install base, every indexed character must earn its place. All counts are computed, not estimated. Apple indexes each word once — no word repeats across name / subtitle / keyword field.

---

## 1. App Name — 26/30

```
ASSIZE: Gothic Sudoku Duel
```

**Why:** Brand stays first (recognition + wordmark consistency in every creative). `Sudoku` is the only head term this app can honestly own and carries real, persistent volume. `Gothic` differentiates instantly against a wall of flat minimalist sudoku listings, and `Duel` names the mechanic in one word. Google Play variant (title case, Play forbids all-caps titles for unregistered marks): `Assize: Gothic Sudoku Duel`.

Rejected alternatives: `ASSIZE` (6/30 — wastes 24 indexed characters nobody will search), `ASSIZE — Sudoku Battles` (battles duplicated in keyword field; colon form indexes cleaner).

## 2. Subtitle — 30/30

```
Dark puzzle PvP in plague city
```

**Why:** Five fresh indexed terms — `dark`, `puzzle`, `pvp`, `plague`, `city` — with zero overlap into the title. `PvP` is the single strongest competitive modifier the app can claim; `dark` owns the aesthetic angle; `plague city` is atmospheric long tail. This is the one field that should be revisited after 90 days of SearchAds data.

Alternate (if a softer tone tests better): `Dark 1v1 puzzle duels, Novem` (28/30).

## 3. Keywords — 95/100 bytes

Paste exactly (commas, no spaces):

```
battle,versus,vs,multiplayer,logic,brain,number,daily,campaign,medieval,ranked,friends,grimoire
```

| Term | Why it's here |
|---|---|
| `battle` | `sudoku battle` is the strongest commercial query this niche owns |
| `versus`,`vs` | cheap byte coverage of `sudoku versus` intent |
| `multiplayer` | the top modifier for the duel concept |
| `logic`,`brain` | the two biggest puzzle-intent modifiers |
| `number` | `number game/puzzle` long tail; singular survives Apple's light stemming |
| `daily` | `daily sudoku` is a top-5 sudoku modifier; a true Daily mode ships |
| `campaign` | separates the app from utility sudoku; matches the 27-duel spine |
| `medieval` | low-competition setting keyword; pre-frames the art |
| `ranked` | competitive intent; matches the Elo ladder |
| `friends` | `sudoku with friends` intent; matches Friend Duel |
| `grimoire` | on-brand atmosphere long tail, near-zero competition |

Deliberately excluded: `free` (2.3.7 risk + zero ranking value), competitor names, `gothic/sudoku/duel/puzzle/pvp` (already indexed in name/subtitle — repeats are wasted bytes), `math` (dishonest: sudoku has no arithmetic), `halloween` (seasonal, off-brand).

Byte math: 92 chars + 3 (`,vs`) = **95/100 bytes**. All ASCII, 1 byte/char.

## 4. Categories

| Slot | Choice | Why |
|---|---|---|
| Primary | **Games › Puzzle** | Where sudoku intent and browse traffic live |
| Secondary | **Games › Board** | The turn-based 1v1 angle; stands out sharply in Board's browse chart |

## 5. Promotional Text — 162/170 (not indexed; updatable without a build)

```
The Tablet does not forgive. Duel a Shade that learns your pace, claim rows to break wax Seals, and settle the plague-walled city of Novem - one puzzle at a time.
```

## 6. Description — conversion copy (not indexed by Apple)

Full text in `app-store-metadata.json` → `metadata.description.value` (~3.4k chars of the 4,000 budget). Structure:

1. **First 3 lines carry the hook** — the hanging, the ink-echo, the plague city (these lines show before the "more" fold).
2. THE DUEL — core loop in three paragraphs, no jargon unexplained.
3. FOUR ORDERS / THE NINE FOLIOS / A SHADE THAT LEARNS / EVERY DAY, ONE TABLET / RANKED DUELS — scannable feature blocks, each opened by a story-flavored line, closed with a concrete mechanic.
4. THE HOUSE RULES — no accounts, no trackers, no pay-to-win, offline play, accessibility. Privacy-clean is a conversion asset for this audience; say it plainly.
5. Final CTA in brand voice: "Take up your pen, Clerk. The Tablet does not forgive."

Apple ignores description keywords; it is written for conversion only — but kept naturally keyword-consistent (~2%) so the identical text can seed the Google Play listing (where description IS indexed) without rewrites.

## 7. What's New (v1.0)

```
First sitting of the Assize. The Nine Folios campaign, ranked duels, the Daily and Weekly Assize, the Endless circuit, and a Shade that learns your ink - all in one Tablet.
```

## 8. In-App Events (launch week)

| Badge | Name (30) | Short (50) |
|---|---|---|
| Special Event | The Ninth Seal | Face Magistrate Orsolo and settle the Great Ledger. |
| Challenge | The Weekly Assize | Two writs, one sitting. Every Clerk the same duel. |
| Competition | The Endless Circuit | The Nine ride again. Climb as far as ink carries. |

Events are indexed and surface in Search — run 2–4 active per month (benchmark: +15–20% impressions from editorial/browse).

## 9. Custom Product Pages (launch set)

| CPP | Target keywords | Screenshot order |
|---|---|---|
| PvP / competitive | sudoku battle, multiplayer sudoku | 01-duel, 02-tablet, 03-claims, 04-orders, 08-ranked |
| Story / gothic | gothic puzzle, dark sudoku | 06-campaign, 09-ending, 05-shade, 01-duel, 10-enter |
| Daily ritual | daily sudoku challenge | 07-daily, 08-ranked, 02-tablet, 10-enter |

Only 26% of games use CPPs; each CPP can rank its own keyword combos in organic search (avg +3.5% CVR lift for games).

## 10. Age Rating

Expected **9+** with honest questionnaire answers: gothic dread framing, no gore, no realistic violence, no gambling, no user-generated content, no adult themes. Do not inflate — the store page art already communicates tone.

## 11. Build-note before submission

- The description names ranked matchmaking and friend duels. If v1.0 ships with the Versus entry gated (store-readiness audit §2.1), trim `RANKED DUELS` to one line and keep Friend Duel wording conditional — metadata must match the shipping binary (guideline 2.3.1).
- Validate keyword volumes in a paid tool (AppTweak / Sensor Tower / MobileAction) before locking the field; the set above is competition-priced by hand, not volume-scored.
- Localization: the i18n surface ships en-only. Add `en-GB` first (zero cost, same copy), then de/fr — gothic aesthetic over-performs in DACH.
