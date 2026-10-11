# DEPLOY — the ASSIZE authoritative duel server

The server is **one Bun process**: Fastify (REST) + socket.io (duels) + SQLite (accounts,
duels, daily, streaks). Rooms and the matchmaking queue live in **RAM**, and the ledger
is a **SQLite file** — so the production shape is *one machine + one volume*. Do not
scale horizontally without first moving rooms into a registry (Redis) — the tick loop
and the queue are not shared-nothing.

```
mini-services/assize-server/
├── index.ts      Fastify REST + socket.io + tick loop (250ms) + matchmaking (500ms)
├── db.ts         bun:sqlite, WAL; path from ASSIZE_DB (default keeps the sandbox path)
├── Dockerfile    build context = repo ROOT (the server imports ../../shared/*)
└── fly.toml      Fly.io machine config (volume mount, health check on /api/health)
```

## Option A — Fly.io (recommended)

Cheapest always-on WebSocket host with real volumes; ~$2–5/month at indie traffic.

```bash
cd /path/to/sudoku                      # repo root — the Docker build context
fly auth login                          # or FLY_API_TOKEN in CI
fly launch --config mini-services/assize-server/fly.toml --no-deploy \
    --copy-config --nowOrg <your-org>   # first time only; pick the region closest to players
fly volumes create assize_data --size 1 --region ams
fly secrets set SESSION_SECRET=$(openssl rand -hex 32)   # reserved; not consumed yet
fly deploy --config mini-services/assize-server/fly.toml .
```

Verify (from any machine, **https is mandatory** — the mobile client refuses cleartext):

```bash
curl https://assize-duel.fly.dev/api/health
# {"ok":true,"rooms":0,"queue":0,"t":...}
```

Then bake the origin into the release client — `EXPO_PUBLIC_*` is inlined **at build
time**, so it must exist before `eas build`, not after:

```bash
cd mobile
npx eas env:create --production --name EXPO_PUBLIC_ASSIZE_SERVER \
    --value https://assize-duel.fly.dev
eas build --profile production --platform android   # then --platform ios
```

## Option B — Railway / Render (zero-ops alternative)

Both support WebSockets + persistent volumes on the same one-process shape:

- **Railway**: new service → *Deploy from repo* → root directory `mini-services/assize-server`,
  start command `bun index.ts`, add a **volume** mounted at `/data`, set env
  `ASSIZE_DB=/data/assize.db`, `PORT=3030` (Railway injects its own PORT — the server
  now honors it). Custom domain → https.
- **Render**: Web Service → Docker → root `.` + Docker path
  `mini-services/assize-server/Dockerfile`, add a **disk** at `/data` (1 GB),
  env `ASSIZE_DB=/data/assize.db`. Free tier is NOT suitable (no disk persistence,
  spin-down kills duels).

## Option C — any VPS (Hetzner/DO, ~$4/mo, most control)

```bash
docker build -f mini-services/assize-server/Dockerfile -t assize-server .
docker volume create assize-data
docker run -d --name assize --restart unless-stopped \
  -p 127.0.0.1:3030:3030 \
  -v assize-data:/data -e ASSIZE_DB=/data/assize.db \
  assize-server
```

Terminate TLS in front (Caddy example) — WebSocket upgrade is forwarded automatically:

```
duel.example.com {
    reverse_proxy 127.0.0.1:3030
}
```

## Operational notes (each one is a real constraint in the code)

1. **https only.** `net/client.ts` throws on any non-localhost cleartext origin (iOS ATS
   / Android 9+ would block it silently anyway).
2. **Single instance.** `rooms`/`queue` are in-process. One machine; do not enable
   multiple instances on Railway/Render — duels would split across processes.
3. **The volume is the save file.** Back it up: `fly sftp get` or litestream to S3
   (`litestream replicate /data/assize.db s3://...`) — one small binary, worth it.
4. **Idle suspend is safe-ish.** `auto_stop_machines = "suspend"` keeps live sockets
   connected; a suspended machine resumes on the next connection. If you observe
   matchmaking flakiness after idle periods, set `min_machines_running = 1` (already
   the default here).
5. **Health check** is `GET /api/health` → `{"ok":true,"rooms":N,"queue":N}`. Wire it
   to an uptime monitor (Better Stack free tier) and you get duel-server alerts.
6. **CORS is open** (`origin: true`, socket.io `*`) — the API authenticates per-account
   id+secret and holds no cookies, so this is acceptable; tighten if you add web
   sessions later.
7. **Client fallback chain**: env origin → Expo Go dev host → `localhost:3030`. A
   production build without `EXPO_PUBLIC_ASSIZE_SERVER` logs a loud warning and shows
   the honest "PvP unavailable" plate — that is the Day-1 fail-closed law working.

## Post-deploy smoke checklist

- [ ] `curl https://<host>/api/health` → ok
- [ ] Web PWA (assize web build) can queue and complete a duel vs a Shade
- [ ] Two phones queue ranked → paired with each other; standings move after the duel
- [ ] Kill the process mid-duel → reconnect grace fires; ledger intact after restart
- [ ] `fly logs` (or platform logs) show no `tick error` spam
