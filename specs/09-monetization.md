# 09 — Monetization

## Today
- Ink (soft currency) earned through play, capped daily per-mode (practice cap, daily win bonus, tutorial +100, endless/weekly bonuses, Reliquary duplicates, season claims).
- Cabinet: 26 cosmetics across 6 tabs, priced in Ink/Sigils, sell/own/equip loop works.
- "Offer a Candle" (rewarded-ad retry for Daily) is a free client-side 3/day cap.
- Patron's Pouch (T5) is a stub — no Stripe, no ad SDK.

## Decision: RevenueCat (react-native-purchases) as the IAP layer

**Why:**
- iOS requires StoreKit 2, Android requires Google Play Billing, and they have *different* receipt-validation and restore semantics. RevenueCat normalizes receipts, products, entitlements, and writes a webhook we can point at `assize-server` (`POST /api/purchases` is the existing pattern — today it stores a JSON array of cosmetic ids on `accounts`).
- Receipt validation server-side via RevenueCat webhook → append to `accounts.purchases` → the client unlocks.
- Free cross-store upgrade path: if you later ship the same cosmetics on the web storefront, keep one entitlement registry.

**Alternatives:**
- Raw StoreKit 2 + Play Billing directly: maximum control, double the work, and you must build the webhook + receipt validation yourself.
- Web Stripe checkout opened in a browser: violates App Store/Google Play rules when the purchase unlocks mobile content — rejected.
- Ads (admob rewarded for Candle): kept as the *same* daily-capped free offering via **AdMob rewarded** (`react-native-google-mobile-ads`), which is the natural mobile equivalent of the current stub. Gift the cap and the cap-counting law stay identical.

## Pricing/entitlements sketch
- **Cosmetics:** individual products (one-time, 90-day sale cadence) — e.g. seal skins, plate frames, board tints. List price banding per region via store consoles.
- **Candles:** consumable packs (3/10/25) substituting the daily free cap when out.
- **Patron tier (optional):** one-time unlock of the "Patron's Pouch" cosmetic set + a monthly candle refill; a judgment call — ship behind a config flag.
- **No pay-to-win:** no product may affect Seals, claims, damage, cooldowns, or deduction tiers. This is the house rule from the web build; it must be in the store review notes.

## Accounting parity
- `POST /api/purchases` gets a real implementation: verify RevenueCat webhook signature, append product ids, idempotent on `purchase_token`.
- Keep the Ink ledger law (`inkLedger.ts`) exactly as the spend path for Ink-priced cosmetics.
