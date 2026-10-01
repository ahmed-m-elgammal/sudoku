# ASSIZE — Balance Sheet

Every tunable number, its source (spec section) and the reasoning where the spec left latitude. All values live in `shared/config.ts` and are exposed to both client and server.

## Duels

| Number | Value | Source / reasoning |
|---|---|---|
| Duel duration | 600 s (10:00) | spec §2 win condition 3 — Sudden Judgment at 10:00 |
| Seals (HP) | 7 (8 for Magistrates) | spec §2 SEALS, §1 (Magistrates have 8) |
| Wrong placement | −1 Seal, digit clears after 1.0 s, cooldowns pause 3 s ("Flinch") | spec §2 PLACING A DIGIT |
| Momentum | −0.5 s on all your cooldowns per correct placement | spec §2 MOMENTUM |
| Claim damage | 1 Seal; 2 when Clean (zero mistakes in that unit + no Augur reveal in it) | spec §2 CLAIMS |
| Re-claim of a claimed unit | Ink only (3), no damage | spec §2 CLAIMS |
| Win-check order | 1) foe at 0 Seals → 2) full Tablet "by Reckoning" → 3) Sudden Judgment (more Seals → more claims → fewer mistakes → draw) → 4) forfeit/disconnect | spec §2, enforced in this order in `engine.tick`/`place` |
| Disconnect grace | 20 s then forfeit | spec §2 win condition 4, §7 |

## Statuses (and anti-frustration)

| Status | Duration | Effect | Notes |
|---|---|---|---|
| CHAIN | 8 s | one empty cell uneditable | chosen from the foe's most nearly complete unit (ties: seeded rng) |
| SMUDGE | 7 s | 5 of the foe's placed non-given digits unreadable | never givens; still count as placed |
| HUSH | 2.5 s | number pad dead; cells stay selectable | |
| MIASMA | 10 s | notes erased; pencil disabled | engine emits the event; the client wipes local notes |
| QUARANTINE | 12 s | a unit cannot be claimed by the target | completing it during quarantine defers the claim until the quarantine ends — "cannot be claimed for 12 s", not "lost forever" (documented interpretation) |

Anti-frustration (spec §2): one active status per type; 4 s global gap between incoming statuses; 5 s immunity per type after it ends; statuses never apply in the final 10 s; every status shows a timer ring. Resolution precedence when a status arrives: **Mirror reflect → Bulwark (first of the duel) → Ward (armed window) → anti-frustration gates**.

Apothecary passive **Distiller**: statuses the Apothecary applies last +2 s (SMUDGE → 9 s, MIASMA → 12 s). Verified in tests.

## Abilities

First use of each ability in a duel starts at **50 % cooldown** — read as: the first use incurs half its normal cooldown (the friendliest reading that keeps the first-use advantage; the alternative reading, "begins pre-charged at 50 %", would let Executioner open with Sever at 12.5 s instead of 25 s and was rejected as too swingy).

| Order | Ability | CD | Effect |
|---|---|---|---|
| Scholar | Augur | 40 s | reveal the correct digit in the selected empty cell; voids Clean for all 3 units touching that cell |
| Scholar | Unseal | 30 s | clear own statuses + 6 s immunity to all types |
| Scholar | Fair Copy | 20 s | auto-fill rule-valid pencil candidates for the selected box |
| Executioner | Sever | 25 s | CHAIN 8 s in the foe's most nearly complete unit |
| Executioner | Hush | 35 s | pad dead 2.5 s |
| Executioner | Reckoning | 45 s | next claim within 20 s deals +1 (stacks with Clean and Last Rites; documented stacking) |
| Apothecary | Smudge | 24 s | 5 digits, 7 s (+2 Distiller) |
| Apothecary | Tincture | 60 s, 2 uses | restore 1 Seal, cap 7 |
| Apothecary | Miasma | 28 s | 10 s (+2 Distiller) |
| Warden | Ward | 40 s | negate next incoming within 15 s |
| Warden | Mirror | 45 s | reflect next incoming within 10 s (cell/unit re-chosen against the caster) |
| Warden | Quarantine | 35 s | unit unclaimable by the foe 12 s |

Passives: Scholar **Marginalia** (first mistake free) · Executioner **Last Rites** (+1 per claim while foe ≤ 3 Seals) · Apothecary **Distiller** (+2 s) · Warden **Bulwark** (first incoming status negated).

## Economy

Ink: win 30 / draw 15 / loss 10, +3 per claim, +2 clean-claim bonus, +50 daily first win, tutorial completion +100 and one free Reliquary. Reliquary: every 3rd win; drop rates Common 60 % / Rare 30 % / Fabled 10 % (shown in-game); duplicates refund 40 Ink. Sigils: premium, cosmetics only (spec R8); earned on Season tiers 5/12/20/28 in small amounts.

Practice: Ink capped at 50/day client-side (TODO T13 moves economy server-side).

## Rating

Standing starts at 1000; Elo K = 32, K = 20 above 1600; bot/Shade duels give no rating. Ranks every 250 Standing from 800: Scrivener → Clerk → Notary → Advocate → Magistrate → High Magistrate → Justiciar → Lord of the Assize, 3 divisions each except the last.

## Puzzles

| Tier | Givens | Required techniques (grader) |
|---|---|---|
| Easy | 36–40 | singles only (grade ≤ 1) |
| Medium | 30–35 | any up to pairs (grade ≤ 2) |
| Hard | 26–29 | pairs and pointing (grade ≥ 2) |
| Expert | 22–25 | X-wing and chains (grade ≥ 3) |

Grader levels: 1 = naked/hidden singles · 2 = naked/hidden pairs + pointing/claiming · 3 = X-wing · 4 = chains (backtrack). Generation removes cells while preserving uniqueness, then grades; if the band's technique condition isn't met after 40 attempts, the closest puzzle by givens count ships with its actual grade recorded (documented tolerance — true Expert-grade X-wing-forcing puzzles are not reliably generable in budget). Tests assert Easy ≤ grade 1 and Expert ≥ grade 3.

Daily Assize: one puzzle per UTC day, seed `assize-daily-<YYYY-MM-DD>`; tier rotates Mon..Sun = Medium, Easy, Medium, Hard, Medium, Expert, Hard; +10 s per mistake.

## Matchmaking

Queue by Standing; window widens every 2 s (+75); Shade fallback at 4 s (configurable in one constant). Anticheat: placements under 120 ms apart are dropped; ≥ 20 placements with timing CV < 0.02 shadow-queue the account; daily times under 25 s rejected; all checks logged to the telemetry table. Solver-app assistance cannot be fully prevented — stated honestly (spec §6).

## Season Ledger

30 tiers; tier *n* requires *n* × 100 cumulative Season Ink (escalating, smooth curve — tier 30 ≈ 46 500 Ink across an 8-week season, roughly 280/duel-day at realistic play); free track grants the listed rewards, the Patron track (purchase, TODO T5) multiplies Season Ink ×1.5.
