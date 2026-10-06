# 04 — Local Storage & Save (client DB)

> **Corrected 2026-10-06.** The MMKV + `expo-sqlite` split below is **confirmed**, but one
> requirement was missing and is now binding: **`react-native-mmkv` v4 is a Nitro module, so the
> storage seam must be an interface, never a direct import** (`14-deep-codebase-analysis.md` §5
> version trap + §7 risk R5). Also corrected: the `Crypto.randomUUID()` claim is wrong for RN.

## Today
- `src/state/save.ts` — Zustand store persisted via `idb.ts` (IndexedDB, versioned): campaign progress + ending, economy (Ink, candles), echoes shelf ring buffer (12), achievements, settings (motion/contrast/text size), pending Ink ledger.
- `src/state/identity.ts` — guest identity + recovery hash in IDB; `crypto.subtle` hashing.
- `src/state/inkLedger.ts` — deduped pending entries flushed offline-safe.
- `src/game/echoes.ts` — `duels` IDB store, validate-on-write, newest-12 ring.

## Decision: MMKV for hot state + expo-sqlite for the echo ring

**Why:**
- **react-native-mmkv** is synchronous, ~10× faster than AsyncStorage, encrypted, and the right size for the save blob (campaign/economy/settings/identity is a single JSON document — the current IDB usage is effectively a key-value store).
- Echoes (replay payloads up to ~4000 actions) are the only list-shaped data → **expo-sqlite** with a `duels` table (id, payload JSON, outcome, created_at) mirrors the IndexedDB ring with a simple `DELETE … OFFSET 12` trim.
- Keeps the same shape as the web code, so `save.ts` ports almost line-for-line: swap `idbGet/idbSet` for `MMKV.getString/set`, echoes swap to SQL rows.

### MANDATORY: the storage seam is an interface

`react-native-mmkv` **v4.3.2 is Nitro-based** (needs `react-native-nitro-modules` 0.37.1). If its
Expo config plugin misbehaves, the fallback is `@react-native-async-storage/async-storage`.
That fallback is only cheap if nothing imports MMKV directly — so:

- Define `PlatformStorage` in `src/platform/types.ts`.
- Implement it **once** in `src/platform/storage.ts`.
- Every store (`save`, `identity`, `echoes`, `inkLedger`) imports the **seam**, never MMKV.
- Swapping the backend is then a one-file edit.

`@react-native-async-storage/async-storage` is already in `mobile/package.json` for exactly this.

### What replaces the browser storage APIs

The web build touches three browser-only stores; all three collapse behind the seam:

| Web | Mobile |
|---|---|
| `idb.ts` (64 lines, IndexedDB, 4-function shape) | **rewritten** as `platform/storage.ts` — same 4-function shape, MMKV/SQLite behind it |
| `localStorage` — friend code (`FriendScreen`), matchmaking (`Matchmaking`), `ServerDuel:66,101` (`assize-secret`) | MMKV via the seam |
| `echoes.ts` — `duels` IDB store, validate-on-write, newest-12 ring, skip corrupt rows | expo-sqlite `duels` table; **keep `validateReplay` + ring-trim logic from `shared/replay` unchanged** — that logic is the contract, only the substrate moves |

`structuredClone` (`save.ts:110`) is available in Hermes under the New Architecture — verify, and
polyfill only if absent.

## Alternatives

| Option | Verdict |
|---|---|
| AsyncStorage | Works, and is the MMKV-failure fallback behind the seam; but async-everything and slower boots as a *primary*. |
| Realm/WatermelonDB | Overkill: the data model is one blob + 12 echo rows. |
| expo-secure-store only | Too small (2 KB limit) for blobs; but **use it for the identity secret + recovery hash** (it backs onto iOS Keychain / Android Keystore). |
| Keep IndexedDB via WebView shim | No. |

## Save migration
- On first mobile boot, no web save exists (new device) — fine. Provide **"Restore from Recovery Code"** (already a first-class flow) as the canonical cross-device path; it restores server-known Ink/standing/purchases.
- For web→mobile continuity of the *local* save, add a one-time **export/import JSON** from the PWA Settings (a "Ledger Export") → imported via share sheet into the app. Nice-to-have, ship in phase 2.

## Identity & crypto
- `expo-crypto` provides SHA-256 for recovery hashes; the 5-word recovery-code format and its validation law port unchanged.
- **`Crypto.randomUUID()` is NOT available on RN** — `expo-crypto` does not provide it. `identity.ts:48-49` uses it, so it needs a shim built over `getRandomValues` (`src/platform/crypto.ts`).
- `crypto.subtle` is likewise unavailable — `expo-crypto` `digestSHA256Async` replaces it.
- Secret lives in `expo-secure-store` (Keychain/Keystore), never in MMKV plaintext.

## Ink ledger
- `recordInk()` (deduped, capped 200) + `flushInkLedger()` port unchanged — they only need `fetch` and a queue; MMKV holds the pending list.
- The verdict law itself is `shared/inkLedger.ts` and is **mirrored server-side** (`/api/ink`). Mobile changes nothing about it.
- **The pending queue must survive app kills** exactly as it survived tab closes on the web. This
  is a contract, not a nice-to-have: award Ink is minted locally then flushed, so losing the
  queue loses the player's Ink.
