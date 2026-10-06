# 02 — Database & Backend

## Today
`mini-services/assize-server` (Bun + Fastify + socket.io, port 3030) with **bun:sqlite** at `db/assize.db`:
- `accounts` (id, secret_hash, name, standing, recovery_hash, purchases JSON, flagged, shadow, ink, ink_ledger JSON, created_at)
- `duels` (id, mode, p0, p1, seed, tier, winner, reason, rating0, rating1, created_at)
- `daily_results` (date_key, account_id, name, time_ms, mistakes, created_at) PK (date_key, account_id)
- `streaks` (account_id, last_date, streak, best)
- `telemetry` (id, event, at)

Auth: guest UUID + secret, Standing Elo, recovery codes (SHA-256 word-codes), purchases list, Ink ledger verdicts, flagged/shadow moderation flags. Prisma exists but is unused template cruft.

## Decision: Postgres (managed), keep the Fastify+socket.io service

**Why Postgres:**
- The current SQLite file locks to one machine — you cannot horizontally scale matchmaking, and WAL over a laptop-style file is not a production PvP backend.
- Postgres gives concurrent writes, JSON columns (kept for `purchases`/`ink_ledger`), proper indexes for daily leaderboards, pg_partman-friendly retention for telemetry, and managed backups (daily snapshots + PITR).
- The schema is small (5 tables) — migration is mechanical; the SQL in `mini-services/assize-server/db.ts` maps ~1:1 (`?` params → `$1..$n`, `INSERT OR REPLACE` → `ON CONFLICT`).
- Managed options remove ops burden: **Neon** (serverless Postgres, branching for preview envs) or **Supabase Postgres** (bundles auth/storage/realtime you may want later), or **Railway/Render Postgres** (simplest lift-and-shift).

**Alternatives:**

| Option | Verdict |
|---|---|
| Keep bun:sqlite on one VPS (Fly.io persistent volume) | Works to ~hundreds of concurrent duels; single point of failure; WAL file on a volume. Acceptable as a **v1 stopgap** if you re-promote the box daily-backed-up. Not the target. |
| Supabase (Postgres + Auth + Realtime) | Good if you also want Supabase Auth to replace guest auth; adds platform lock-in. |
| Firebase/Firestore | Rejected: document model fits matchmaking poorly, realtime fanout costs, and the existing SQL is already written. |
| PlanetScale/MySQL | No advantage over Postgres here. |
| SQLite + Litestream replication to S3 | Clever self-host tier; still single-writer; fine hobby tier, not recommended past a few thousand DAU. |

## Hosting the service
- Keep `assize-server` (Bun + Fastify + socket.io). **Fly.io / Railway / Render** all run it directly; a single always-on box is right for PvP (you want low-latency WebSocket fanout and in-memory matchmaking queues).
- Scale-out later = one `assize-server` + **Redis adapter for socket.io** + sticky sessions; don't build this before you need it.
- Keep the Next.js rewrites pattern in the mobile world by pointing the app at `https://api.assize.{tld}/` directly — no Next proxy needed anymore.

## Schema migration plan
1. Stand up Postgres, run a translated DDL (same 5 tables, `TEXT PRIMARY KEY` ids kept, `created_at` → `timestamptz`, JSON → `jsonb`, indexes as-is plus one on `duels(created_at)`).
2. Add `accounts.ink_ledger`/`ink` columns up front (no ALTER dance — that was for legacy SQLite files).
3. One-shot data migration script: `sqlite → postgres` (small data, `pgloader` or a 50-line Bun script).
4. Retire Prisma: delete the dep and the template schema (or replace it with the real schema if you adopt `drizzle`/`prisma` for queries later — see below).
5. Query layer: **Drizzle ORM** (light, Bun-friendly, SQL-like) or raw `postgres` (postgres.js) prepared statements. Avoid Prisma's heavy client in the hot matchmaking path.

**Alternative:** adopt Prisma properly (generate typed client on the real schema). Simpler mental model, heavier runtime. Pick Drizzle for the server.

## Ink economy & purchases
- Keep the `inkLedger.ts` verdict law (verified/bounded/dropped) **client-side**, and re-enforce **server-side** in `POST /api/ink` exactly as today — mobile changes nothing about that contract.
- `purchases` JSONB array on `accounts` becomes the source of truth for owned cosmetics once IAP lands (RevenueCat webhook writes rows here in T09).

## Telemetry
- Keep the opt-out flag; batch events client-side, POST every N minutes / on foreground-to-background. Retention job: delete `telemetry` rows > 90 days old.

## Backups & environments
- Managed Postgres nightly snapshots + WAL PITR on; manual export before every client release.
- Two environments only: `staging` (separate DB + separate socket server) and `prod`. Preview envs via Neon branches if cheap.
