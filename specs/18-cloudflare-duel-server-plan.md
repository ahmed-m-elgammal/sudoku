# 18 — Cloudflare duel-server migration plan (Hono + native WS + D1 + Durable Objects)

Goal: move the authoritative duel server (`mini-services/assize-server/`, Fastify +
socket.io + `bun:sqlite`, single Fly machine) to Cloudflare (Hono on Workers +
native WebSockets + D1 + Durable Objects) for ~$0 at indie scale with better
tail latency and surviving deploys. `shared/` engine is untouched throughout.

Status: PLAN ONLY. Fly server stays live until cutover. Nothing here deletes it.

---

## 1. Attack on the idea (read this before the plan)

The idea is sound, but "easy, free, 1–2 days" has five holes. Each becomes a
plan item below.

### Hole 1 — the current protocol blows the DO free tier on day one

DO free = **100,000 requests/day; every WS message in either direction and
every alarm counts as one request** (verified against current CF pricing docs).
The current server emits per live room, per second: 4× `state_delta` (dead —
no client subscribes) + 8× `you` (4 Hz × 2 seats) ≈ **10 billable messages/s**,
i.e. one 10-minute duel ≈ 6,000 requests. Free tier ≈ **~16 duels/day**.
"Free" is only true **after the protocol diet** (kill `state_delta`, snapshots
on-change + 1 Hz heartbeat): ≈ 1 msg/2 s/room → ~300 requests/duel → hundreds
of duels/day on free. The diet is worth doing on Fly anyway — do it first, and
the migration inherits it.

### Hole 2 — the 250 ms tick loop cannot exist under hibernation

There are no timers in a hibernated DO. `setInterval(250)` must become:
**message-driven ticks + a 1 s alarm passing elapsed dt** (`tick(st, dtMs)`
already accepts variable dt and is hardened). Consequences, all acceptable but
explicit: shade acts at 1 Hz not 4 Hz (tier-1 bot, fine), grace countdown was
already 1 s, `clockMs` advances in 1 s chunks (client already interpolates fx).
Do NOT try sub-second alarms — delivery is best-effort and will jitter. While
`phase==='live'` the DO wakes 1×/s/room; idle/ended rooms hibernate to ~zero
(this is the "empty rooms are free" claim, and it holds — but only with the
alarm design, not with a ported interval).

### Hole 3 — hibernation evicts memory: room state must persist per mutation

On evict, the constructor re-runs; anything only in RAM is gone. So every
state-changing event (place/ability/tick-end) persists via `serializeDuel`
(which conveniently exists, `engine.ts:601`) into DO embedded SQLite, and the
constructor rehydrates. Cost is local µs–ms. Upside that dwarfs the work: **this
also fixes "deploys kill live duels"** — rooms survive restarts, something Fly
can never do. Seat/socket bindings persist via `serializeAttachment()`.

### Hole 4 — D1 races that SQLite-never-had

Bun is single-threaded: two duels ending together serialize. On CF, two room
DOs can settle the same account concurrently: read-standings → compute → write
is a lost-update race, plus D1 reads can lag writes across replicas. Design
(this plan): standings/Ink writes go through **one Ledger path** — either D1
`batch()` + optimistic retry, or a single-writer Ledger DO. Do not port the
read-compute-write sequence verbatim. Write volume is trivially inside free
(~10 writes/duel → 10k duels/day on the 100k/day free budget; reads 5M/day).

### Hole 5 — "1–2 days" is the code, not the job

Rewriting `index.ts`/`db.ts` + two client transports is 1–2 days. The job —
protocol diet, tick remodel, D1 race design, ledger migration dry-run, load
test, staged cutover — is **3–5 eng-days**. The four P0s from the server audit
(unsettled natural ends, seat-1 inversion, duel hijack, self-play Ink farm)
must be fixed **in** the rewrite, never ported.

---

## 2. Target architecture

```
mobile / web --WSS/HTTPS--> Worker (Hono: REST + /duel WS upgrade + /match WS)
                                |                    |
                                v                    v
                         Matchmaker DO          Room DO per duelId
                         (queue, friend codes,  (DuelState in DO SQLite,
                          shade fallback,        1 s alarm + msg ticks,
                          Elo pairing)           hibernated WS seats)
                                |                    |
                                +------> D1 (accounts, duels, daily, streaks, telemetry)
                                         Ledger discipline: batched writes, single-writer
                                         for standings/Ink (see §5)
```

- One Worker routes everything (fetch + `Upgrade: websocket`). No separate
  processes, no sticky sessions — room identity is the duelId in the URL/frame.
- Matchmaker is a singleton DO (alarm only while queue non-empty; empty queue
  cancels its alarm → zero cost idle). Shard later if the queue ever exceeds
  comfortable single-DO throughput (thousands concurrent — not year one).
- Region: create room DOs with `locationHint` from the first player; edge
  terminates WS close to each player regardless (strictly better tails than one
  AMS box for non-EU players).

## 3. Protocol mapping (socket.io → native WS JSON)

Envelope, both directions: `{ "t": "<type>", "p": {…} }`. Types map 1:1 today:

| socket.io (now) | WS (target) | Notes |
|---|---|---|
| `join_queue` | same `t` | + server dedupes same-socket entries (fixes double-queue) |
| `matched` | same | winner ABSOLUTE on the wire (fixes seat-1 inversion; client maps once) |
| `you` | same | on-change + 1 Hz heartbeat only (diet; fixes §1-hole-1) |
| `state_delta` | **deleted** | no subscriber; do not port |
| `end` | same | emitted reliably (fixes unsettled-ends); client keeps `endedRef` guard |
| `place`/`ability`/`pencil`/`concede` | same `t` | per-socket token bucket (fixes flood) |
| `join_duel`/`reconnect` | merged: `join_duel` only | reject unknown accounts (fixes hijack); delete dead server `reconnect` |
| `reconnect_grace`/`peer_disconnected`/`peer_reconnected`/`reconnect_ok` | same | unchanged semantics |
| heartbeat | `ping`/`pong` 25 s | replaces socket.io ping; client backoff reconnect + `join_duel` resume |

Client transports rewritten: `mobile/src/game/net/client.ts`,
`src/net/client.ts` (+ `serverDuel` envelope types; `ServerStateDelta` dead type
deleted). Existing `serverDuel.test.ts` suites updated to the absolute-winner
contract. `shared/` untouched.

## 4. File-by-file rewrite map

| Now | Target | Notes |
|---|---|---|
| `index.ts` REST (auth/queue/friend/daily/result/recovery/ink/purchases/telemetry/health) | Hono routes in `worker/src/rest.ts` | 1:1, + `GET /api/daily` memoized per date key (Cache API; kills regen) |
| `index.ts` matchmaking loop | Matchmaker DO (`worker/src/matchmaker.ts`) | queue in DO storage; alarm iff queue non-empty; `joinedAt+4000` shade alarm per ranked entry; same-account pairing refused (fixes self-play) |
| `index.ts` tick loop + `Room` | Room DO (`worker/src/room.ts`) | state in DO SQLite via `serializeDuel`; 1 s alarm + message ticks; `p.loop`-style shade at 1 Hz; settle-before-guard (fixes unsettled-ends) |
| `index.ts` socket handlers | Room/Matchmaker `webSocketMessage()` | auth once at join, seat bound via attachment; `place`/`ability` pass raw input to engine (still fail-closed) |
| `db.ts` (`bun:sqlite`) | D1 (`worker/src/db.ts`) | same schema + `ink`/`ink_ledger` columns native (drop T13 migration); `batch()` for settle writes; standings/Ink single-writer discipline (§5) |
| `Dockerfile`/`fly.toml` | `wrangler.toml` + GH Action | `wrangler deploy`; preview workers per PR |
| client transports | native WS clients | heartbeat, backoff, resume; `EXPO_PUBLIC_ASSIZE_SERVER` flips via OTA (it's JS-inlined — no store review needed) |

Portability check (do first, 30 min): `grep -rn "node:\|process\.\|Buffer" shared/` —
engine must be free of Node APIs (`performance.now`, `crypto.randomUUID` exist
in Workers; FNV-Rng is pure). Any hit gets a shim, not an engine edit.

## 5. Data rules (the parts that must not be naive)

1. **Ledger migration**: freeze Fly writes → `sqlite3 .dump` → `wrangler d1
   import` → row-count + spot-check (standings, ink balances, recovery hashes)
   → cutover. Rollback = flip origin back (Fly kept warm 1 week, read-only
   after freeze… in practice: keep Fly running, accept at most one ledger
   during the window, reconcile by duel id).
2. **Standings/Ink single-writer**: room DOs never `UPDATE accounts` directly;
   they enqueue settle intents consumed in one place (Ledger DO or serialized
   D1 batch with retry on conflict). Kills the lost-update race from Hole 4.
3. **Read-your-write**: after settle, subsequent reads use the returned values,
   not a re-`SELECT` (avoids replica lag surprises).
4. **Telemetry**: sampling + 7-day retention delete (kills the disk-fill vector
   structurally — D1 storage is also billed).

## 6. Test plan (non-negotiable before cutover)

1. Unit: settle law incl. `p0===p1 → cap 0`, streak/date, rating symmetry.
2. Contract: WS envelope tests for every row in §3 (absolute-winner pinned).
3. Integration: miniflare (Workers + DO + D1-local) full duel — human pair,
   shade fallback, disconnect→grace→forfeit, natural end settles + ratings move.
4. Soak: scripted 200-room bot storm; assert tick cadence, alarm counts, DO
   request burn < budget, hibernation engages (duration ≈ 0 idle).
5. Migration dry-run on a staging D1; client OTA flip rehearsal on preview.

## 7. Rollout

1. CF stack on staging origin → dev-build + web-preview shadow tests.
2. Fix-forward week: protocol diet ships to Fly first (proves the diet before
   it carries billing weight).
3. Cutover: flip `EXPO_PUBLIC_ASSIZE_SERVER` via **OTA** (preview channel,
   then production) + web env; monitor `end`-settle rate, grace fires, D1
   writes/min.
4. Rollback: OTA origin back to Fly (< 15 min, no review). Decommission Fly no
   earlier than 7 clean days.

## 8. Cost math (recheck at deploy — CF changes numbers)

- DO free: 100k req/day + 13k GB-s/day. Post-diet duel ≈ 300 requests, ~10
  wake-s ≈ within free to **hundreds of duels/day**. Pre-diet would be ~16
  duels/day — hence §1-hole-1 is a launch blocker, not polish.
- D1 free: 5M reads + 100k writes/day ≈ 10k duels/day. Non-binding at indie
  scale. Watch: rows-read on leaderboard scans (LIMIT 100 + index, fine).
- Workers free: 100k req/day covers REST + upgrades at this scale.
- vs today: Fly ~$2–5/mo + single-region tails + dead-on-deploy rooms. CF wins
  on price, latency, and durability; loses on simplicity (alarms, explicit
  persistence, wrangler ops). Accept the trade once the P0s force a rewrite
  touch anyway.

## 9. Timeline (honest)

| Day | Work |
|---|---|
| 0.5 | Portability grep, wrangler scaffold, D1 schema, deploy hello |
| 1 | Hono REST + diet protocol + client transports (mobile + web) |
| 1 | Matchmaker DO + Room DO (alarm ticks, hibernate/rehydrate, settle fixes) |
| 0.5–1 | Ledger discipline + migration dry-run + contract/integration tests |
| 0.5–1 | Soak/load, cutover rehearsal, OTA flip, monitor |

Total **3–5 eng-days**. Do not compress testing; the failure modes (stale reads,
alarm jitter, lost attachments) only show under soak.
