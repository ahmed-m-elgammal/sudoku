# ASSIZE — Store Assets (Google Play + App Store)

Paste-ready ASO metadata and generated art, built from the game's own brand kit
(`mobile/assets/game/*` — parchment, wax seals, engraved portraits, IM Fell type).

```
store-assets/
├── google-play/
│   ├── title.txt                     (26/30)
│   ├── short-description.txt         (77/80)
│   ├── full-description.txt          (2174/4000)
│   ├── icon-512.png                  Play Store icon, full-bleed square
│   ├── feature-graphic-1024x500.png  required for any listing with video/promo
│   └── screenshots-phone/            8 × 1080×2400 framed marketing plates
└── app-store/
    ├── name.txt                      (26/30)
    ├── subtitle.txt                  (28/30)
    ├── keywords.txt                  (92/100 — no words repeated from name/subtitle)
    ├── promotional-text.txt          (154/170 — editable any time, no review)
    ├── description.txt               (2174/4000)
    ├── whats-new.txt                 1.0 release notes
    ├── icon-1024.png                 App Store icon, RGB, no alpha
    ├── screenshots-6.9/              8 × 1290×2796 (iPhone 16 Pro / required)
    └── screenshots-6.5/              8 × 1242×2688 (fallback set, still accepted)
```

## Upload checklist — Google Play Console

- [ ] **App name** ← `title.txt` (30-char limit)
- [ ] **Short description** ← `short-description.txt` (80)
- [ ] **Full description** ← `full-description.txt` (4000)
- [ ] **App icon** ← `icon-512.png` (512×512, 32-bit PNG; adaptive icon already ships via `app.json`)
- [ ] **Feature graphic** ← `feature-graphic-1024x500.png` (1024×500; required if you attach a YouTube trailer — recommended)
- [ ] **Phone screenshots** ← `screenshots-phone/` (2–8; upload all 8 in numbered order — order is the conversion funnel: brand → duel → story → seals → rites → foes → daily → ranked)
- [ ] 7"/10" tablet screenshots: reuse the same plates — they are 1080×2400 and pass the 7" minimum; dedicated tablet captures can follow post-launch
- [ ] Category: **Puzzle** · Tags: sudoku, logic, versus/competitive
- [ ] Content rating questionnaire: fantasy violence (mild — "wax seals crack, ink spills"), no gore, no gambling → expect **PEGI 12 / USK 12 / ESRB E10+–T**
- [ ] Data safety: the server stores account id/secret, duel logs, Elo, streaks — declare "Data collected, not shared", no ads SDKs to declare at 1.0

## Upload checklist — App Store Connect

- [ ] **App name** ← `name.txt`
- [ ] **Subtitle** ← `subtitle.txt` (30)
- [ ] **Keywords** ← `keywords.txt` (100, comma-separated, **no spaces**, no duplicates of name/subtitle — Apple already indexes those)
- [ ] **Promotional text** ← `promotional-text.txt` (170; updatable without review)
- [ ] **Description** ← `description.txt`
- [ ] **What's New** ← `whats-new.txt`
- [ ] **App icon** ← `icon-1024.png` (1024×1024, **no alpha** — already flattened to RGB)
- [ ] **iPhone 6.9" screenshots** ← `screenshots-6.9/` (required; 3 previews max if you add video)
- [ ] **iPhone 6.5" screenshots** ← `screenshots-6.5/` (required only if targeting iOS 12/13-era devices or older builds; upload anyway, harmless)
- [ ] iPad: `supportsTablet: true` in `app.json` — iPad 13" screenshots (2064×2752) will be **required**; either capture on a simulator or ship an iPad build later and uncheck iPad support at 1.0
- [ ] Age rating: violence — cartoon/fantasy, mild → expect **12+** (horror themes answered honestly; "infrequent/mild" is the right row)
- [ ] Privacy: declare account identifiers + gameplay data, no tracking, no ads

## ASO strategy (why this copy)

- **Title**: `sudoku` + `duel` + `gothic` — the category keyword with the differentiator. "ASSIZE" alone is unsearchable; the suffix carries discovery. Kept to 26 chars so localizations have headroom.
- **Subtitle (iOS)** deliberately avoids title words (`dark 1v1 puzzle vs the shade`) — Apple indexes title+subtitle+keywords as one field; repeats are wasted characters.
- **Keywords (iOS)**: zero repeats of title/subtitle; covers `pvp daily classic logic brain number grid medieval grimoire horror rated streak offline free`. Single words only (phrases waste commas).
- **Short description (Play)**: keyword-dense first line — Google Play weights the short description most after the title.
- **Full description**: first 3 lines visible before the fold = the pitch (hook → genre sentence → duel law); body repeats natural phrases (`sudoku duel`, `1v1`, `daily`, `ranked`, `offline`) for Play indexing without stuffing.
- **Screenshot order** mirrors the decision funnel: identity → core loop → narrative → mechanics depth → progression → retention.

## Screenshots — production note

The 8 plates are **generated marketing frames** (headline + subline + real game art from
`mobile/assets/game/`), the standard ASO pattern for puzzle titles. Regenerate after any
art change:

```bash
python3 /home/z/my-project/scripts/gen_store_art.py        # images
python3 /home/z/my-project/scripts/gen_store_metadata.py   # copy + char gates
```

If you want raw in-game captures later (recommended for plates 2 and 4 — the live board
and the seals UI read even better than the brand art), run the app in a simulator at
1290×2796 and 1080×2400, capture clean screens, and re-run the framing scripts with the
captures swapped in as the art layer.

## Localization headroom

Title/subtitle are ≤26/28 chars — room for German/Spanish/French variants later
(e.g. `ASSIZE: Gothic-Sudoku-Duell`). Ship English-only at 1.0; add `de-DE`, `fr-FR`,
`es-ES` listing variants in week 2–4 once keyword data exists.
