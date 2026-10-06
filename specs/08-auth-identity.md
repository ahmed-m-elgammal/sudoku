# 08 — Auth & Identity

## Today
Guest identity: client-minted UUID + secret, name generated (`Gaunt Notary 4821` style), 4-word recovery code + 2-digit checksum, SHA-256 (`crypto.subtle`) for the stored hash, `accounts` row on the server keyed by secret hash. Recovery restores server-known Ink/purchases/standing. No email, no password, no third-party account. Antechamber boot with no login (spec R1).

## Decision: keep guest identity as the primary, add Sign in with Apple (iOS) + Google Play Games auth for backup

**Why:**
- Guest-first is the game's identity: it boots straight into a duel. Preserving it preserves the product.
- **Recovery codes already are the backup mechanism** — this is the canonical cross-device path and must remain prominent in Settings.
- iOS may require "Sign in with Apple" if you add *any* third-party login (and it's good practice anyway for players who lose devices); Android equivalent is Google Play Games sign-in. These map onto the same `accounts` row: link a social id to the existing guest row on first sign-in.

**Alternatives:**
- Full email/password auth (Supabase Auth etc.): rejected — higher friction, more PII, and recovery codes already solve the problem.
- Anonymous Firebase Auth: works but adds a vendor for no gain over the existing scheme.

## Changes on mobile
- `expo-crypto` for `crypto.subtle`-equivalent SHA-256; `Crypto.randomUUID()`.
- Identity secret + recovery hash in **expo-secure-store** (Keychain/Keystore), not MMKV.
- Sign-in-with-Apple / Google linkage: `expo-apple-authentication` / Play Games services; server verifies the Apple `identityToken` (JWT) once, then issues the same guest-style session secret.
- Keep `/api/auth` contract identical; on token linkage, return the same account payload (+ new `linked` flag).

## Moderation & safety
- Keep `flagged`/`shadow` on `accounts`; a "report player" affordance in Friend duel end screen writes to `telemetry`-adjacent moderation log (phase 2).
