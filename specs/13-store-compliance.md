# 13 — Store Compliance

## iOS
- `PrivacyInfo.xcprivacy` — declare no tracking, no third-party analytics unless opted in; NSPrivacyCollectedDataTypes for anything the server stores (account name, duel results, daily times).
- Sign in with Apple required once you offer any third-party sign-in (we do, optionally) — spec'd in `08`.
- Rewarded ads / IAP must be clearly labelled and cannot alter competitive fairness — house rule: no pay-to-win.
- Minimum iOS 15+, portrait lock optional; support iPad multitasking if keyboard play ships.
- Export compliance: no custom encryption (HTTPS only) → declare `ITSAppUsesNonExemptEncryption = false`.

## Android
- Play Console data safety form: matches the privacy page (guest identity, server-held Standing/Ink/purchases, no advertising ID beyond AdMob, recovery code is the sole credential).
- `SCHEDULE_EXACT_ALARM`, `POST_NOTIFICATIONS` (Android 13+) runtime prompt for daily reminders.
- Target API 35; Play App Signing with App Bundle (`.aab`).

## Both
- Age rating: 4+ / Everyone (no real-money gambling; candles are cosmetic-adjacent retries only).
- Content: occult-ish theme ("Shades", "wax seals") is restrained and non-violent — no changes needed for a standard rating.
- Plain-language privacy page in Settings; counsel review before public launch (T11 follow-up).
- No "Offer a Candle" daily cap bypass via multiple accounts: server-side daily stamps per account id, same as today.
