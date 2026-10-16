# ASSIZE — Apple App Store Assets (`apple-assets/`)

Upload-ready App Store creative assets and metadata for **ASSIZE: Gothic Sudoku Duel** (`com.assize.game`). Every asset is **generated brand artwork** in the game's engraved-grimoire style (ink black · parchment · brass · oxblood wax), typeset in the game's own fonts (IM Fell English SC / IM Fell DW Pica / Libre Caslon), and rendered at **exact App Store Connect dimensions**. All 140 files were dimension-audited programmatically — every file matches its folder name to the pixel.

> Specs verified against current App Store Connect requirements (developer.apple.com, October 2026):
> the **required** base sets are the 6.9″ iPhone (portrait 1320 × 2868) and 13″ iPad (2064 × 2752).
> Apple auto-scales those to every other display group. The user-specified display groups below
> (6.1″/6.3″, additional group, 12.9″/13″ iPad, Apple Watch) are delivered in full alongside the
> required 6.9″ set.

---

## Directory map

```
apple-assets/
├── metadata/                        ← paste-ready listing copy
│   ├── app-store-metadata.json        machine-readable: name, subtitle, keywords, promo,
│   │                                  description, events, CPPs (all char-counts verified)
│   ├── app-store-metadata.md          the same copy with full ASO rationale + strategy
│   └── keyword-field.txt              exact 100-byte hidden keyword field (95 B used)
├── headers/                         ← Header marketing assets
│   ├── 5244x2950/header.jpg
│   └── 3840x1646/header.jpg
├── search-results/                  ← Search-results marketing assets
│   ├── 5244x2950/search.jpg
│   ├── 3840x2560/search.jpg
│   └── 1920x1280/search.jpg
├── iphone-6.9-required/             ← ★ REQUIRED base set (auto-scales to all iPhones)
│   ├── portrait/1320x2868/  10 designs (.jpg)
│   └── landscape/2868x1320/  5 designs
├── iphone-6.1-6.3/                  ← 6.1″/6.3″ display group
│   ├── portrait/1179x2556/ + portrait/1206x2622/   10 designs each
│   └── landscape/2556x1179/ + landscape/2622x1206/ 5 designs each
├── iphone-additional/               ← additional iPhone display group
│   ├── portrait/1398x2034/ + portrait/2007x2853/   10 designs each
│   └── landscape/2034x1398/ + landscape/2853x2007/ 5 designs each
├── ipad-12.9-13/                    ← 12.9″/13″ iPad (REQUIRED for supportsTablet=true)
│   ├── portrait/2048x2732/ + portrait/2064x2752/   10 designs each
│   └── landscape/2732x2048/ + landscape/2752x2064/ 5 designs each
├── apple-watch/                     ← all six listed watch sizes
│   ├── 410x502/ 422x514/ 416x496/ 396x484/ 368x448/ 312x390/  5 designs each (.png)
├── brand/
│   ├── app-icon-1024.png            ← 1024×1024 RGB, alpha-free (ASC marketing icon spec)
│   └── wordmark.svg                 ← vector wordmark from the game source
└── source-art/                      ← the 11 generated artworks (reusable masters)
```

## The 10-design screenshot series (portrait) and 5-design landscape set

| # | File | Hook | Visual |
|---|---|---|---|
| 01 | `01-duel` | **Sudoku, with enemies.** | Candlelit duel scene across the parchment Tablet |
| 02 | `02-tablet` | **One Tablet. Two minds.** | Designed vector board: claimed row, wax Seals, struck false ink, both players' Seal HUD |
| 03 | `03-claims` | **Claim a row. Break a Seal.** | Parchment Tablet macro + cracked wax-seal inset |
| 04 | `04-orders` | **Four Orders. Twelve Rites.** | Quill · Axe · Lantern · Vial brass medallions |
| 05 | `05-shade` | **It solves like you. It errs like you.** | The Shade — an ink-echo raised from your own duels |
| 06 | `06-campaign` | **Nine Magistrates. Twenty-seven duels.** | The plague-walled city of Novem |
| 07 | `07-daily` | **One Tablet. One day.** | Daily writ candle + unbroken-days chip |
| 08 | `08-ranked` | **Rise in Standing.** | Laurel medallion + Elo Standing |
| 09 | `09-ending` | **Balance the truth. Or burn it.** | The Ledger and the scales — the one permanent choice |
| 10 | `10-enter` | **Enter the Assize.** | App icon, seal row, FREE · NO ACCOUNTS · NO TRACKERS |

Landscape set: 01, 02, 03, 04, 09 (the strongest mechanical hooks). Upload order recommendation: **01 → 02 → 04 → 03 → 05 → 06 → 07 → 08 → 09 → 10** — the first three decide ~90% of search-listing conversion (users rarely scroll past the third).

## Metadata quick reference

| Field | Value | Count |
|---|---|---|
| App Name | `ASSIZE: Gothic Sudoku Duel` | 26/30 |
| Subtitle | `Dark puzzle PvP in plague city` | 30/30 |
| Keywords | `battle,versus,vs,multiplayer,logic,brain,number,daily,campaign,medieval,ranked,friends,grimoire` | 95/100 B |
| Promotional Text | "The Tablet does not forgive. Duel a Shade that learns your pace…" | 162/170 |
| Categories | Games › Puzzle (primary) · Games › Board (secondary) | — |
| Age rating | expect 9+, answer honestly | — |

## How the assets were produced

1. **11 brand artworks generated** (duel scene, Shade, Tablet macro, plague city, cracked seal, Orders medallions, Ledger, candle, clerk, medallion, pocket watch) in the game's exact palette and matte style — saved in `source-art/`.
2. **Composed in code** (HTML/CSS design system + the game's own WOFF2 fonts, rendered headless at each master size, then Lanczos-exact-resized to every target). The sudoku Tablet on `02-tablet` is a designed vector board, not a screenshot.
3. **Every file dimension-verified** against its folder name; JPEG (q92) for large assets, PNG for watch.

## What still needs manual work

| Item | Why | Suggestion |
|---|---|---|
| **App Preview videos** (up to 3, 15–30 s, 886×1920 / 1920×886) | Motion capture of real play can't be faked honestly — Apple guideline 2.3.3/2.3.4 requires app-in-use footage | Record the scripted tutorial duel + a Practice duel in the web build at portrait viewport; cut to 20 s, add no audio (previews autoplay muted) |
| **Watch screenshots only ship with a watchOS app** | This build has no watchOS companion target — ASC only shows the Watch tab when a watch binary is attached | Keep `apple-watch/` for when the companion ships, or drop the Watch track for v1.0 |
| **Keyword volume validation** | Exact search volumes need paid tooling | Validate the 13-term field in AppTweak/Sensor Tower before locking |
| **Five portraits with baked-in Chinese text** | Flagged in the store-readiness audit (§3.3) — they appear in-game, not in these marketing assets | Regenerate at source before any future screenshot-based store assets |
| **Privacy policy URL + App Privacy answers** | Console hard requirements (audit §2.2/§4) | Host `docs/privacy-policy.md`, declare "Data Not Collected" for v1.0 |

## Submission checklist

- [ ] Upload 6.9″ iPhone set (required) — `iphone-6.9-required/`
- [ ] Upload 13″ iPad set (required, `supportsTablet=true`) — `ipad-12.9-13/portrait/2064x2752/`
- [ ] Add the 6.1″/6.3″ + additional iPhone sets (extra device coverage)
- [ ] Paste metadata from `metadata/app-store-metadata.json`
- [ ] Configure the three CPPs (section 9 of the metadata doc)
- [ ] Schedule the three in-app events for launch week
- [ ] Attach preview videos (manual work item above)
