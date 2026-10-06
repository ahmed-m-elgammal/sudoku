# 03 — Realtime PvP

## Today
`ServerDuel` (client) ↔ Fastify + socket.io (Bun, :3030). Ranked queue with widening Standing window, 4 s Shade fallback, friend codes, 20 s disconnect grace ticking at 1 s, reconnect → `join_duel` re-snapshot, forfeit on timeout, Elo updates, anticheat flags. Server is authoritative for duel state; the client renders and sends placements/abilities.

## Decision: keep the self-hosted socket.io service

**Why:**
- The protocol is already specified, tested (`scripts/pvp-disconnect-test.mjs`, rejoin probes, E2E transcripts), and the Shade-fallback + disconnect-grace logic is game-specific.
- RN's `socket.io-client` is the same npm package — protocol parity is free.
- A turn-paced duel (placements on a 10-minute board) needs ~1 message/second; any realtime backend handles this. Cost and latency favor the status quo.

**Alternatives:**

| Option | Why not / when to use |
|---|---|
| Supabase Realtime / Ably / PartyKit | Good dev UX but per-message/connection pricing, less control over Shade-fallback and grace semantics, migration cost. Consider only if ops load becomes painful. |
| Raw WebSocket + custom protocol | Rejected: would re-implement socket.io's rooms/reconnect/heartbeat for no gain. |
| HTTP polling | Rejected: 100 ms+ added latency breaks duel feel. |
| Managed matchmaking (PlayFab, GameSparks) | Rejected: lock-in, generic matchmaking, migration off later is painful; our matchmaking rules are already written and tested. |

## Mobile-specific changes
- **AppState handling:** on background, send `leave_duel`-adjacent heartbeat or just let the 20 s grace run (it already exists) — surface the same "peer disconnected" modal on return. On resume within grace, re-`join_duel` (existing path).
- **App never killed assumption:** iOS suspends sockets on background; the grace modal + reconnect flow already covers it.
- Connection status in RN: reuse `ServerDuel.selfOffline` banner wiring; expo-network for "no internet" → `OfflineScreen`.
- Keep polling-first transport (the web build forced polling-first because of proxy constraints); on mobile you can prefer `websocket` transport and fall back to polling on flaky networks.

## Scale-out path (later)
One Bun box → socket.io Redis adapter + sticky load balancer + a `queue` (BullMQ) for matchmaking. Don't build preemptively.
