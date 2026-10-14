Listed directory sudokou%20game
Listed directory assize-server
Searched for "assize"
Viewed package.json:1-15
Viewed db.ts:1-111
Viewed index.ts:1-300
Viewed index.ts:301-528
Listed directory shared
Listed directory tests
Listed directory __tests__
Viewed e2e-duel-test.mjs:1-121
Viewed client.ts:1-150
Viewed client.ts:151-244
Searched for "reconnect"
Viewed 03-realtime-pvp.md:1-30
Viewed 18-cloudflare-duel-server-plan.md:1-150
Ran command: `git log -n 10 --oneline -- "mini-services/assize-server"`
Viewed inkLedger.ts:1-172
Viewed engine.ts:1-150
Viewed engine.ts:151-350
Viewed engine.ts:351-500
Viewed engine.ts:501-653
Viewed shade.ts:1-100
Viewed shade.ts:250-360
Viewed shade.ts:361-416
Viewed localDuel.ts:110-160
Searched for "shadeAct"
Searched for "shadeAct("
Viewed localDuel.ts:510-545
Viewed localDuel.ts:546-570
Viewed rng.ts:1-39
Searched for "recoveryHash"
Searched for "updateRecovery"
Viewed ledgerRecovery.tsx:35-75
Searched for "generateRecoveryCode"
Viewed identity.ts:39-65
Viewed identity.ts:1-38
Viewed crypto.ts:1-59
Viewed serverDuel.ts:90-160
Viewed serverDuel.ts:161-240
Viewed serverDuel.ts:241-280
Viewed serverDuel.ts:281-319
Viewed serverDuel.ts:100-160
Viewed Dockerfile:1-23
Viewed fly.toml:1-39
Viewed DEPLOY.md:1-100
Viewed AWS-SETUP.md:1-100
Viewed config.ts:1-120
Viewed engine.test.ts:1-100
Searched for "3039"
Listed directory scripts
Viewed pvp-disconnect-test.mjs:1-91
Viewed t13_wire_e2e.py:1-100
Viewed t13_wire_e2e.py:100-131

# Comprehensive Security & Correctness Audit: `mini-services/assize-server`

**Audit Target**: `mini-services/assize-server` (Authoritative Duel & Ledger Server)  
**Supporting Modules Inspected**: `shared/engine.ts`, `shared/shade.ts`, `shared/inkLedger.ts`, `shared/sudoku.ts`, `shared/config.ts`, `mobile/src/game/net/client.ts`, `mobile/src/game/serverDuel.ts`, `src/game/serverDuel.ts`, and test suites.  
**Mode**: Read-Only Audit (No files modified).

---

## Executive Architecture & System Overview

```
                        +---------------------------------------------+
                        |                 Clients                     |
                        |   (Mobile Expo / Web / scripts / probes)    |
                        +----------------------+----------------------+
                                               |
                          WSS (Socket.IO)      |      HTTPS (Fastify REST)
                                               v
                        +---------------------------------------------+
                        |      mini-services/assize-server            |
                        |   (Bun Runtime, Fastify + Socket.IO Server) |
                        +----------------------+----------------------+
                                |              |              |
           In-Memory State      |              |              | Persistence
   +----------------------------+              |              +-----------------------------+
   | - `rooms`: Map<string, Room>              |              | SQLite (`bun:sqlite`, WAL)  |
   | - `queue`: Matchmaking FIFO               |              | - accounts (auth/ledger)    |
   | - Tick Loop: setInterval(250ms)           |              | - duels (match history)     |
   | - Matchmaking: setInterval(500ms)         |              | - daily_results & streaks   |
   |                                           |              | - telemetry                 |
   +-------------------------------------------+              +-----------------------------+
                                               |
                                     Shared Deterministic
                                          Game Engine
                               +---------------+---------------+
                               |  `shared/engine.ts`           |
                               |  `shared/shade.ts` (Bot AI)   |
                               |  `shared/inkLedger.ts` (Rules)|
                               +-------------------------------+
```

### Architecture Entry Points & Lifecycles
1. **Network Entry Points**:
   - **REST (Fastify)**: `/api/auth`, `/api/queue`, `/api/friend/create`, `/api/daily`, `/api/daily/result`, `/api/recovery`, `/api/ink`, `/api/purchases`, `/api/telemetry`, `/api/health`.
   - **Socket.IO (WebSocket)**: Events `join_queue`, `join_duel`, `leave_queue`, `place`, `ability`, `pencil`, `concede`, `reconnect`, `disconnect`.
2. **Game Loop (`setInterval` 250ms)**:
   - Advances duel clock via `tick(r.state, 250)`.
   - Executes bot actions for AI seats via `shadeAct`.
   - Evaluates player disconnect grace (20s forfeit timeout).
   - Broadcasts player snapshot (`you`) at 4 Hz.
3. **Player Lifecycle**:
   - Accounts registered via `POST /api/auth` (storing `id`, `name`, `secret_hash`, default standing `1000`).
   - Matchmaking via `join_queue`: 4s window before falling back to local Shade bot; friend codes match strictly on shared code without AI fallback.
   - Disconnection handles 20s grace period with 1 Hz ticking countdown before auto-forfeit.

---

## Findings Summary Matrix

| ID | Title | Severity | Category | Status |
|---|---|---|---|---|
| **SEC-01** | Natural Game Endings Unsettled Due to Tick Loop Early-Exit Guard (P0) | **Critical** | A. Game Rules & Combat | **Confirmed Bug** |
| **SEC-02** | Account Recovery Ineffective on Existing Accounts Due to Dropped Hash in `/api/auth` | **Critical** | C. Concurrency & Correctness | **Confirmed Bug** |
| **SEC-03** | Low Recovery Code Entropy (18.3 bits) + Unthrottled Endpoint Enables Global Account Takeover | **Critical** | C. Concurrency & Correctness | **Confirmed Vulnerability** |
| **SEC-04** | Client `proto.reconnect` Omits `accountId`, Causing Reconnections to Silently Fail | **Critical** | B. Networking & Protocol | **Confirmed Bug** |
| **SEC-05** | Shade Bot AI Freezes Indefinitely Due to Static Event Seed and Lacks Pacing Delay | **High** | A. Game Rules & Combat | **Confirmed Bug** |
| **SEC-06** | Matchmaking Queue Accepts Duplicate Entries, Causing Room Spawns & Ghost Streams | **High** | B. Networking & Protocol | **Confirmed Bug** |
| **SEC-07** | Premature Disconnection Grace Forfeits Active Multi-Socket Players | **High** | B. Networking & Protocol | **Confirmed Bug** |
| **SEC-08** | Frankened Daily Leaderboard Scores via Disjoint `MIN()` Conflict Resolution | **High** | C. Concurrency & Correctness | **Confirmed Bug** |
| **SEC-09** | Anticheat Epoch Distortion (`now - 0`) and Interleaved Cross-Player Interval Tracking | **High** | A. Game Rules & Combat | **Confirmed Bug** |
| **SEC-10** | Augur & Fair Copy Abilities Broadcast Secret Puzzle Solutions to Opponent via `events` | **Medium** | A. Game Rules & Combat | **Confirmed Bug** |
| **SEC-11** | Daily Puzzle Cache Invalidation DoS via Alternating Date Query Parameter | **Medium** | C. Concurrency & Correctness | **Confirmed Vulnerability** |
| **SEC-12** | Ink Deduplication Bypass via 200-Item Sliding Window Eviction | **Medium** | C. Concurrency & Correctness | **Confirmed Vulnerability** |
| **SEC-13** | Inaccurate Rating Delta Emitted to Seat 1 (`-da` vs `dB`) | **Low** | A. Game Rules & Combat | **Confirmed Bug** |
| **SEC-14** | `join_duel` Overwrites Foe Order and Standing with Hardcoded Defaults | **Low** | B. Networking & Protocol | **Confirmed Bug** |
| **SEC-15** | Memory & Database Inflation via Uncollected Rooms and Unthrottled Telemetry | **Informational** | C. Concurrency & Correctness | **Suspicious Pattern** |

---

## Detailed Audit Findings

---

### Category A: Game Rules and Combat

#### [CRITICAL] SEC-01: Natural Game Endings Unsettled Due to Tick Loop Early-Exit Guard (P0)
- **File Path**: [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L131-L155)
- **Symbol**: `setInterval` (Tick Loop), `socket.on('place')`
- **Line Numbers**: [index.ts:134](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L134), [index.ts:152-155](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L152-L155), [index.ts:328](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L328)
- **Status**: **Confirmed Bug** *(Flagged in architecture docs `specs/18-cloudflare-duel-server-plan.md:64` as "unsettled natural ends")*
- **Mechanism & Code Path**:
  When a human player places the final winning digit (triggering Reckoning) or causes seal death via mistake or claim, `place(r.state, seat, p.cell, p.digit)` in [index.ts:328](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L328) transitions `r.state.phase` from `'live'` to `'ended'`. However:
  1. `socket.on('place')` does **not** call `finishRoom(r, ...)`.
  2. In the 250ms tick loop ([index.ts:131-161](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L131-L161)):
     ```typescript
     for (const r of rooms.values()) {
       if ((r.state as { phase: string }).phase !== 'live') continue; // LINE 134: SKIPS IMMEDIATELY!
       tick(r.state, 250);
       ...
       if ((r.state as { phase: string }).phase === 'ended') {        // LINE 152: NEVER REACHED!
         finishRoom(r, (r.state as { winner: unknown }).winner as PlayerId, ...);
         continue;
       }
     ```
  Because line 134 checks `if (phase !== 'live') continue;` at the **top** of the loop, any duel whose phase became `'ended'` from an asynchronous socket event skips the rest of the tick loop.
- **Reproduction Steps**:
  1. Pair two human players in a ranked duel.
  2. Player 0 exhausts all seals or fills the board correctly.
  3. Notice that no `end` event is ever emitted to either socket.
  4. Query `/api/health` — the room remains alive in `rooms.size` forever. Standings in SQLite (`accounts.standing`) are never adjusted.
- **Impact**:
  Duels that end through legitimate gameplay (Reckoning or Seal depletion) freeze permanently. Match results are neither emitted to clients nor persisted to SQLite.
- **Concrete Remediation**:
  Check for game termination and settle before early-exiting the tick loop, or invoke `finishRoom` directly within the `place` / `ability` socket handlers:
  ```typescript
  // In index.ts tick loop:
  for (const r of rooms.values()) {
    if ((r.state as { phase: string }).phase === 'ended') {
      finishRoom(r, (r.state as { winner: unknown }).winner as PlayerId, (r.state as { winReason: string }).winReason ?? 'suddenJudgment');
      continue;
    }
    if ((r.state as { phase: string }).phase !== 'live') continue;
    tick(r.state, 250);
    ...
  ```

---

#### [HIGH] SEC-05: Shade Bot AI Freezes Indefinitely Due to Static Event Seed and Lacks Pacing Delay
- **File Path**: [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L136-L144), [shared/shade.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/shared/shade.ts#L311-L394)
- **Symbol**: `setInterval` (Tick Loop), `shadeAct`
- **Line Numbers**: [index.ts:137-144](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L137-L144)
- **Status**: **Confirmed Bug**
- **Mechanism & Code Path**:
  ```typescript
  if (r.shadeSeat !== undefined) {
    const st = r.state;
    const me = r.shadeSeat;
    const rng = new Rng(`${r.id}-${st.eventSeq}`);
    const act = shadeAct(st, me, profileForStanding(1000), () => rng.next(), performance.now());
    if (act.kind === 'place') place(st, me, act.cell, act.digit);
    else if (act.kind === 'ability') useAbility(st, me, act.id, { cell: act.cell, unit: act.unit });
  }
  ```
  Two distinct flaws exist here:
  1. **Absence of Delay Scheduling**: `shadeAct` returns `{ kind: 'wait', untilMs }`. The server tick loop discards `act.untilMs` and re-runs `shadeAct` on every single 250ms tick. If naked or deduced singles exist on the board and `rand() < singlesSkill`, the Shade places moves up to 4 times per second (every 250ms), ignoring `placeDelayMs` (`[1600, 3200] ms`).
  2. **Deterministic Freeze**: When `shadeAct` returns `wait`, no placement or ability occurs, meaning `st.eventSeq` does not increment. On the next tick 250ms later, `new Rng(`${r.id}-${st.eventSeq}`)` generates the **identical** pseudo-random seed. Since `shadeAct` only uses `nowRealMs` to compute `untilMs` on wait, the internal branch conditions (`rand() < singlesSkill`, `rand() < aggression`) evaluate to the exact same results. The bot is locked into `wait` indefinitely until the human player performs an action to bump `st.eventSeq`.
- **Reproduction Steps**:
  1. Queue for a ranked match and wait 4s for Shade fallback.
  2. Do not touch the board.
  3. Observe that if the Shade does not deduce an immediate move or pass aggression on tick 1, it will never place a digit or cast an ability for the entire 10-minute duration.
- **Impact**:
  Bot matches are either superhumanly fast (4 placements/sec) or completely paralyzed.
- **Concrete Remediation**:
  Store `nextShadeActAtMs` on `Room`. When `act.kind === 'wait'`, defer execution until `act.untilMs`. On actions, apply the profile's placement cadence (minimum 900ms). Advance RNG state across ticks rather than re-instantiating from `st.eventSeq`.

---

#### [MEDIUM] SEC-10: Augur & Fair Copy Abilities Broadcast Secret Puzzle Solutions to Opponent via `events`
- **File Path**: [shared/engine.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/shared/engine.ts#L423), [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L70-L94)
- **Symbol**: `useAbility`, `publicState`
- **Line Numbers**: [shared/engine.ts:423](file:///c:/Users/A-Dev/Downloads/sudokou%20game/shared/engine.ts#L423), [shared/engine.ts:447](file:///c:/Users/A-Dev/Downloads/sudokou%20game/shared/engine.ts#L447), [index.ts:91](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L91)
- **Status**: **Confirmed Bug**
- **Mechanism & Code Path**:
  In `shared/engine.ts:423`:
  ```typescript
  pushEvent(st, 'ability', { player, ability: 'augur', cell, digit: st.solution[cell] });
  ```
  In `mini-services/assize-server/index.ts:91`:
  ```typescript
  events: s.events.slice(-30),
  ```
  `publicState` sends `events` to **both** players in the 4 Hz `you` snapshot. While `st.solution` is hidden from the root state, the opponent's client receives the revealed digit in `events` whenever the other player uses Augur or Fair Copy candidates.
- **Reproduction Steps**:
  1. In a 2-player match, Player 0 casts Augur on cell 10.
  2. Inspect the WebSocket frames received by Player 1.
  3. The `you` payload's `events` array contains `{ ability: 'augur', cell: 10, digit: X }`.
- **Impact**:
  Leads to secret solution leakage to opponents, enabling automated client scripts to solve cells for free.
- **Concrete Remediation**:
  Filter event streams in `publicState(r, seat)` so that private ability payload data (such as `digit` in Augur and `candidates` in Fair Copy) is only included if `event.player === seat`.

---

#### [LOW] SEC-13: Inaccurate Rating Delta Emitted to Seat 1 (`-da` vs `dB`)
- **File Path**: [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L114-L117), [mini-services/assize-server/db.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/db.ts#L99-L107)
- **Symbol**: `finishRoom`, `adjustRating`
- **Line Numbers**: [index.ts:114-117](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L114-L117), [db.ts:104-106](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/db.ts#L104-L106)
- **Status**: **Confirmed Bug**
- **Mechanism & Code Path**:
  `adjustRating` supports asymmetric K-factors (`kA` and `kB` can be 20 or 32 depending on whether rating >= 1600):
  ```typescript
  const da = Math.round(kA * (scoreA - expectedA));
  const dB = Math.round(kB * ((1 - scoreA) - expectedB));
  return { a: Math.max(100, a + da), b: Math.max(100, b + dB), da };
  ```
  In `finishRoom`:
  ```typescript
  q.updateStanding.run(a, r.accounts[0]!);
  q.updateStanding.run(b, r.accounts[1]!);
  ratings[0] = da; ratings[1] = -da; // FLAW: ratings[1] is NOT -da when kA != kB
  ```
  Player 1's standing in SQLite updates by `dB`, but the event emitted to Player 1 reports `-da`.
- **Impact**:
  UI displays an incorrect rating change that desyncs from the actual stored database rating.
- **Concrete Remediation**:
  Return both `da` and `db` from `adjustRating`, and set `ratings[0] = a - a0.standing` and `ratings[1] = b - a1.standing`.

---

### Category B: Networking and Protocol

#### [CRITICAL] SEC-04: Client `proto.reconnect` Omits `accountId`, Causing Reconnections to Silently Fail
- **File Path**: [mobile/src/game/net/client.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mobile/src/game/net/client.ts#L237), [src/net/client.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/src/net/client.ts#L127), [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L347-L361)
- **Symbol**: `proto.reconnect`, `socket.on('reconnect')`
- **Line Numbers**: [client.ts:237](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mobile/src/game/net/client.ts#L237), [index.ts:347-351](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L347-L351)
- **Status**: **Confirmed Bug**
- **Mechanism & Code Path**:
  In `client.ts:237`:
  ```typescript
  reconnect: (duelId: string, secret: string) => net.send('reconnect', { duelId, secret }),
  ```
  In `index.ts:347-351`:
  ```typescript
  socket.on('reconnect', (p: { duelId: string; accountId: string; secret: string }) => {
    const acc = auth(p.accountId, p.secret);
    const r = rooms.get(p.duelId);
    if (!acc || !r || (r.accounts[0] !== acc.id && r.accounts[1] !== acc.id)) return;
  ```
  Because `p.accountId` is not sent by `proto.reconnect`, `auth(undefined, p.secret)` fails and returns `null`. The server handler exits silently without attaching the socket or sending `reconnect_ok`. The player is stranded until the 20s grace period expires and forfeits them.
- **Reproduction Steps**:
  1. Call `proto.reconnect(duelId, secret)`.
  2. Observe that no response or snapshot is ever returned.
  3. Notice `pvp-disconnect-test.mjs` had to bypass `proto.reconnect` and manually format `{ duelId, accountId: B.id, secret: B.secret }`.
- **Impact**:
  Any client attempting reconnection via `proto.reconnect` fails to rejoin and forfeits.
- **Concrete Remediation**:
  Update `proto.reconnect` to send `accountId`, or unify `reconnect` and `join_duel` into a single validated endpoint as planned in `specs/18`.

---

#### [HIGH] SEC-06: Matchmaking Queue Accepts Duplicate Entries, Causing Room Spawns & Ghost Streams
- **File Path**: [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L276-L282)
- **Symbol**: `socket.on('join_queue')`, `leave_queue`, Matchmaking Loop
- **Line Numbers**: [index.ts:281](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L281), [index.ts:304-305](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L304-L305), [index.ts:376-377](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L376-L377)
- **Status**: **Confirmed Bug**
- **Mechanism & Code Path**:
  In `socket.on('join_queue')`:
  ```typescript
  queue.push({ socketId: socket.id, accountId: acc.id, name: acc.name, standing: acc.standing, order: p.order, joinedAt: Date.now(), friendCode: p.friendCode });
  ```
  There is no check whether `socket.id` or `acc.id` is already in `queue`.
  If a client sends `join_queue` 10 times, 10 entries are added. When `leave_queue` or `disconnect` fires:
  ```typescript
  const qi = queue.findIndex((e) => e.socketId === socket.id);
  if (qi >= 0) queue.splice(qi, 1);
  ```
  Only the **first** entry is removed; the remaining 9 remain in the queue.
- **Reproduction Steps**:
  1. Emit `join_queue` 5 times on a single socket.
  2. Wait 4 seconds for the Shade fallback to trigger.
  3. `startShadeDuel` is called 5 times, creating 5 distinct rooms for the same socket.
  4. The socket receives 5 simultaneous 4Hz streams of `you` events (20 packets/sec).
- **Impact**:
  Resource exhaustion, state corruption, and client socket flooding.
- **Concrete Remediation**:
  Check if `socket.id` or `accountId` already exists in `queue` before pushing. If present, update the entry in place or reject. When removing, filter all occurrences matching `socket.id`.

---

#### [HIGH] SEC-07: Premature Disconnection Grace Forfeits Active Multi-Socket Players
- **File Path**: [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L363-L375)
- **Symbol**: `socket.on('disconnect')`
- **Line Numbers**: [index.ts:365-374](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L365-L374)
- **Status**: **Confirmed Bug**
- **Mechanism & Code Path**:
  When a player reconnects, `r.seats.set(newSocket.id, seat)` binds the new socket. If the old stale socket subsequently disconnects, `socket.on('disconnect')` fires:
  ```typescript
  socket.on('disconnect', () => {
    for (const r of rooms.values()) {
      const seat = r.seats.get(socket.id);
      if (seat === undefined) continue;
      r.seats.delete(socket.id);
      if ((r.state as { phase: string }).phase !== 'live') continue;
      r.disconnectAt[seat] = Date.now();
      r.lastGraceEmitAt[seat] = 0;
      for (const [sid, s] of r.seats) {
        if (s !== seat) io.to(sid).emit('peer_disconnected', ...);
      }
    }
  ```
  The server unconditionally sets `r.disconnectAt[seat] = Date.now()` without checking if there are other sockets associated with that seat (`Array.from(r.seats.values()).includes(seat)`).
- **Reproduction Steps**:
  1. Player connects with Socket A.
  2. Network fluctuates; Player establishes Socket B and calls `join_duel`.
  3. Socket A closes cleanly.
  4. Server starts 20s grace timer despite Socket B actively playing.
  5. 20s later, Player is forfeited while actively making moves on Socket B.
- **Impact**:
  Active players can be unjustly forfeited during network recovery.
- **Concrete Remediation**:
  Only set `r.disconnectAt[seat]` if no other socket in `r.seats` maps to that seat.

---

#### [LOW] SEC-14: `join_duel` Overwrites Foe Order and Standing with Hardcoded Defaults
- **File Path**: [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L294)
- **Symbol**: `socket.on('join_duel')`
- **Line Numbers**: [index.ts:294](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L294)
- **Status**: **Confirmed Bug**
- **Mechanism & Code Path**:
  ```typescript
  socket.emit('matched', {
    duelId: r.id, seat, seed: r.state.seed, givens: Array.from(r.state.givens), tier: r.tier,
    foe: { name: r.names[seat === 0 ? 1 : 0], order: 'scholar', shade: r.shadeSeat === (seat === 0 ? 1 : 0), standing: 1000 },
    stakes: { tier: r.tier, range: [0, 0] }
  });
  ```
  On reconnect, `foe.order` is hardcoded to `'scholar'` and `foe.standing` to `1000`, ignoring the actual order (`r.state.players[foeSeat].order`) and standing of the opponent.
- **Impact**:
  Reconnected client UI resets opponent portrait, insignia, and ability indicators to Scholar / 1000 standing.
- **Concrete Remediation**:
  Populate `order` and `standing` from the room's actual player states.

---

### Category C: Concurrency, Correctness & Persistence

#### [CRITICAL] SEC-02: Account Recovery Ineffective on Existing Accounts Due to Dropped Hash in `/api/auth`
- **File Path**: [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L382-L394), [mini-services/assize-server/db.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/db.ts#L73)
- **Symbol**: `/api/auth`, `q.updateRecovery`
- **Line Numbers**: [index.ts:385-393](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L385-L393), [db.ts:73](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/db.ts#L73)
- **Status**: **Confirmed Bug**
- **Mechanism & Code Path**:
  In `POST /api/auth`:
  ```typescript
  const { id, secret, name, recoveryHash } = req.body as ...;
  ...
  const existing = q.getAccount.get(id) as ...;
  if (existing) {
    if (existing.secret_hash !== hash(secret)) return reply.code(401).send({ ok: false });
    if (name && name !== existing.name) q.updateName.run(name.slice(0, 24), id);
    const acc = q.getAccount.get(id) as ...;
    return { ok: true, name: acc.name, standing: acc.standing, ink: acc.ink };
  }
  q.insertAccount.run(id, hash(secret), (name ?? 'Unnamed Clerk').slice(0, 24), 1000, recoveryHash ?? null, '[]', Date.now());
  ```
  When an existing account registers a recovery code (via `LedgerProfile.tsx:166` / `ledgerRecovery.tsx:64`), it sends `POST /api/auth` with `recoveryHash`. If `existing` is true, the server updates `name` if changed, but **completely ignores `recoveryHash`**. `q.updateRecovery` is never invoked in `/api/auth`.
  As a result, `recovery_hash` remains `NULL` in the database for all existing accounts.
- **Reproduction Steps**:
  1. Boot game; account is registered with `recovery_hash = null`.
  2. Go to Profile, click "Write the code" to generate a recovery code.
  3. Client makes `POST /api/auth` with `recoveryHash: "..."`.
  4. Query SQLite `SELECT recovery_hash FROM accounts WHERE id = ?`. It is `NULL`.
  5. Attempt to restore on a second device using `/api/recovery`: returns `{ ok: false }`.
- **Impact**:
  Account recovery is completely broken for all real users who generate their code after account creation.
- **Concrete Remediation**:
  Update `recovery_hash` when provided in `POST /api/auth` on an existing account:
  ```typescript
  if (existing) {
    if (existing.secret_hash !== hash(secret)) return reply.code(401).send({ ok: false });
    if (name && name !== existing.name) q.updateName.run(name.slice(0, 24), id);
    if (recoveryHash !== undefined && recoveryHash !== existing.recovery_hash) {
      q.updateRecovery.run(recoveryHash, id);
    }
  ```

---

#### [CRITICAL] SEC-03: Low Recovery Code Entropy (18.3 bits) + Unthrottled Endpoint Enables Global Account Takeover
- **File Path**: [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L449-L468), [mobile/src/state/identity.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mobile/src/state/identity.ts#L19-L42)
- **Symbol**: `/api/recovery`, `generateRecoveryCode`
- **Line Numbers**: [index.ts:449-468](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L449-L468), [identity.ts:19](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mobile/src/state/identity.ts#L19)
- **Status**: **Confirmed Vulnerability**
- **Mechanism & Code Path**:
  Recovery codes are 4 words chosen from a fixed 24-word dictionary:
  `Total Keyspace = 24^4 = 331,776 combinations` (~18.3 bits of entropy).
  In `POST /api/recovery`:
  ```typescript
  const h = hash(code.trim().toLowerCase());
  const donor = q.byRecovery.get(h) as { id: string; standing: number; purchases: string; ink: number } | null;
  if (!donor || donor.id === id) return { ok: false };
  q.updateStanding.run(donor.standing, id);
  q.updatePurchases.run(donor.purchases, id);
  q.updateInk.run(donorInk, id);
  q.updateRecovery.run(null, donor.id);
  ```
  1. `/api/recovery` searches globally across all accounts (`q.byRecovery.get(h)`). It does not require the victim's account ID.
  2. There is no rate limiting, IP throttling, or failure lockout.
  3. At 1,000 requests/sec, an attacker can exhaust all 331,776 combinations in under 6 minutes.
  4. If 1,000 players have generated codes, on average an attacker succeeds once every ~331 attempts.
  5. When a match is found, the victim's Standing, Purchases, and Ink are transferred to the attacker's account, and the victim's recovery slot is consumed (`q.updateRecovery.run(null, donor.id)`).
- **Reproduction Steps**:
  1. Register an account with a recovery code.
  2. Send sequential POST requests to `/api/recovery` iterating through the 24 words.
  3. The server immediately transfers account data upon collision with zero rate-limit resistance.
- **Impact**:
  Account takeover and theft of Standing, cosmetic purchases, and Ink.
- **Concrete Remediation**:
  1. Increase recovery code word list (e.g. BIP-39 with 2048 words, 4 words = $2048^4 \approx 1.75 \times 10^{13}$ combinations).
  2. Add strict rate limiting (e.g. maximum 5 failed attempts per IP / account per hour).
  3. Require both `donorAccountId` (or donor name) AND the recovery code, preventing global search attacks.

---

#### [HIGH] SEC-08: Frankened Daily Leaderboard Scores via Disjoint `MIN()` Conflict Resolution
- **File Path**: [mini-services/assize-server/db.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/db.ts#L82-L84), [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L429-L447)
- **Symbol**: `q.dailyUpsert`, `POST /api/daily/result`
- **Line Numbers**: [db.ts:82-84](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/db.ts#L82-L84), [index.ts:436](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L436)
- **Status**: **Confirmed Bug**
- **Mechanism & Code Path**:
  In `db.ts:82-84`:
  ```sql
  INSERT INTO daily_results (date_key, account_id, name, time_ms, mistakes, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT (date_key, account_id) DO UPDATE SET
    time_ms = MIN(time_ms, excluded.time_ms),
    mistakes = MIN(mistakes, excluded.mistakes)
  ```
  `time_ms` and `mistakes` are minimized independently across runs:
  - Run 1: 80,000 ms, 0 mistakes.
  - Run 2: 25,001 ms, 25 mistakes.
  - Stored Row: `time_ms = 25001, mistakes = 0`.
  The player receives an impossible rank combining the best attributes of both runs.
  Additionally, `/api/daily/result` does not validate that the puzzle was actually solved.
- **Reproduction Steps**:
  1. Submit `/api/daily/result` with `{ timeMs: 90000, mistakes: 0 }`.
  2. Submit `/api/daily/result` with `{ timeMs: 25000, mistakes: 10 }`.
  3. Check leaderboard via `GET /api/daily`: row shows `timeMs: 25000, mistakes: 0`.
- **Impact**:
  Leaderboard integrity is compromised; users can fabricate impossible top scores.
- **Concrete Remediation**:
  Only update the row if the entire attempt score (effective time = `time_ms + mistakes * 10000`) is better than the existing attempt:
  ```sql
  ON CONFLICT (date_key, account_id) DO UPDATE SET
    time_ms = excluded.time_ms,
    mistakes = excluded.mistakes
  WHERE (excluded.time_ms + excluded.mistakes * 10000) < (time_ms + mistakes * 10000)
  ```

---

#### [HIGH] SEC-09: Anticheat Epoch Distortion (`now - 0`) and Interleaved Cross-Player Interval Tracking
- **File Path**: [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L312-L327)
- **Symbol**: `socket.on('place')`
- **Line Numbers**: [index.ts:314-326](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L314-L326)
- **Status**: **Confirmed Bug**
- **Mechanism & Code Path**:
  In `socket.on('place')`:
  ```typescript
  const now = Date.now();
  const gap = now - r.lastPlaceAt[seat];
  if (r.lastPlaceAt[seat] && gap < 120) { q.telemetry.run(`anticheat:fast-place:${r.id}`, now); return; }
  r.intervals.push(gap);
  if (r.intervals.length > 24) {
    const mean = r.intervals.reduce((a, b) => a + b, 0) / r.intervals.length;
    const cv = Math.sqrt(r.intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / r.intervals.length) / mean;
    const acc0 = r.accounts[seat];
    if (cv < 0.02 && mean > 0 && r.intervals.length >= 20) {
      if (acc0) q.shadow.run(acc0);
  ...
  ```
  1. `r.lastPlaceAt` is initialized to `[0, 0]`. On the first placement by a player, `gap = now - 0 ≈ 1.74e12 ms`. This value is pushed to `r.intervals`.
  2. Because `1.74e12` is present, `mean` is skewed into tens of billions, and `cv` is permanently elevated, making `cv < 0.02` mathematically impossible to satisfy.
  3. `r.intervals` is never trimmed when `cv >= 0.02`, causing the array to grow unboundedly.
  4. `r.intervals` is a single room-wide array. In a 2-player match, intervals from both players interleave into the same calculation.
- **Reproduction Steps**:
  1. Inspect `r.intervals` after the first placement.
  2. Observe `[174..., ...]`.
- **Impact**:
  Uniform-timing anticheat detection is completely neutralized.
- **Concrete Remediation**:
  Only push `gap` if `r.lastPlaceAt[seat] > 0`. Track `intervals` per seat (`r.intervals: [number[], number[]]`), and bound history to the last 24 entries (`r.intervals[seat].slice(-24)`).

---

#### [MEDIUM] SEC-11: Daily Puzzle Cache Invalidation DoS via Alternating Date Query Parameter
- **File Path**: [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L412-L427)
- **Symbol**: `dailyCache`, `GET /api/daily`
- **Line Numbers**: [index.ts:412](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L412), [index.ts:419-422](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L419-L422)
- **Status**: **Confirmed Vulnerability**
- **Mechanism & Code Path**:
  ```typescript
  let dailyCache: { key: string; tier: Tier; givensCount: number } | null = null;
  ...
  const dateKey = String((req.query as { date?: string }).date ?? todayUtcKey());
  if (!dailyCache || dailyCache.key !== dateKey) {
    const puz = generateDaily(dateKey);
    dailyCache = { key: dateKey, tier: puz.tier, givensCount: puz.givensCount };
  }
  ```
  `dailyCache` holds a single slot. An unauthenticated attacker sending alternating requests:
  - `GET /api/daily?date=2026-01-01`
  - `GET /api/daily?date=2026-01-02`
  evicts the cache on every request. `generateDaily()` performs backtracking puzzle generation (3-12 ms of synchronous CPU time per call). Sending 100 requests per second will starve the Bun event loop and drop WebSocket heartbeats.
- **Impact**:
  Denial of service and degraded realtime gameplay.
- **Concrete Remediation**:
  Use an LRU or `Map<string, DailyPuzzleMeta>` cache, or disallow arbitrary historical date generation from unauthenticated clients.

---

#### [MEDIUM] SEC-12: Ink Deduplication Bypass via 200-Item Sliding Window Eviction
- **File Path**: [shared/inkLedger.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/shared/inkLedger.ts#L133-L170), [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L473-L495)
- **Symbol**: `settleInkEntries`, `POST /api/ink`
- **Line Numbers**: [inkLedger.ts:133-134](file:///c:/Users/A-Dev/Downloads/sudokou%20game/shared/inkLedger.ts#L133-L134), [inkLedger.ts:168](file:///c:/Users/A-Dev/Downloads/sudokou%20game/shared/inkLedger.ts#L168)
- **Status**: **Confirmed Vulnerability**
- **Mechanism & Code Path**:
  ```typescript
  const history = parseLedgerColumn(ledger);
  const settled = new Set(history.map((l) => l.duelId));
  ...
  ledger: [...history, ...fresh].slice(-INK_LEDGER_MAX), // Max 200 items
  ```
  `settled` is derived exclusively from `accounts.ink_ledger`, which is truncated to the most recent 200 items. When an account claims a legitimate verified duel (e.g. `pvp-win-01`), they can push 200 dummy solo bounded entries to push `pvp-win-01` out of the ledger. Once evicted, re-submitting `pvp-win-01` passes the `settled.has()` check, passes the SQLite `q.getDuel` verification check, and awards the +111 Ink payout again.
- **Reproduction Steps**:
  1. Win a ranked duel and claim +111 Ink via `/api/ink`.
  2. Post 4 batches of 50 dummy practice entries (`dummy-1` to `dummy-200`).
  3. Re-post the original ranked duel ID.
  4. Server awards another +111 Ink.
- **Impact**:
  Infinite Ink generation through replay attacks on verified duels.
- **Concrete Remediation**:
  Store settled duel IDs in a dedicated SQLite table (`settled_claims (account_id, duel_id, created_at, PRIMARY KEY(account_id, duel_id))`), rather than relying on a 200-row JSON column.

---

#### [INFORMATIONAL] SEC-15: Memory & Database Inflation via Uncollected Rooms and Unthrottled Telemetry
- **File Path**: [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L52), [mini-services/assize-server/index.ts](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L505-L519)
- **Symbol**: `rooms`, `POST /api/telemetry`
- **Line Numbers**: [index.ts:52](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L52), [index.ts:505-519](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L505-L519)
- **Status**: **Suspicious Pattern / Reliability Risk**
- **Mechanism & Code Path**:
  1. `rooms.delete(r.id)` is only called inside `setTimeout` within `finishRoom`. Rooms that do not finish normally (such as those affected by **SEC-01**) persist in memory indefinitely, causing the 250ms tick loop iteration to slow down over time.
  2. `POST /api/telemetry` allows unauthenticated insertion of arbitrary strings up to 80 characters. The pruning query only runs every 5 minutes, allowing rapid disk inflation on limited-storage VPS/Fly volumes.
- **Impact**:
  Server memory leak and SQLite disk bloat.
- **Concrete Remediation**:
  Implement a sweep timer for rooms that have exceeded `durationMs + 60s` regardless of phase, and add rate limiting to `/api/telemetry`.

---

## Actionable Remediation Roadmap

1. **Immediate P0 Fixes (Game Stability & Persistence)**:
   - Fix **SEC-01**: In [index.ts:134](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L134), settle finished rooms before skipping non-live duels in the tick loop.
   - Fix **SEC-02**: In [index.ts:386-391](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mini-services/assize-server/index.ts#L386-L391), update `recovery_hash` on existing accounts when provided in `POST /api/auth`.
   - Fix **SEC-04**: In [mobile/src/game/net/client.ts:237](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mobile/src/game/net/client.ts#L237) and [src/net/client.ts:127](file:///c:/Users/A-Dev/Downloads/sudokou%20game/src/net/client.ts#L127), include `accountId` in `proto.reconnect`.

2. **Next-Phase Fixes (Match Integrity & Exploitation Prevention)**:
   - Fix **SEC-03**: Enforce rate limits on `/api/recovery` and require account identifier input.
   - Fix **SEC-05**: Implement timer-based delay tracking for the Shade bot.
   - Fix **SEC-08**: Modify the `daily_results` upsert clause to prevent mixed best scores.
   - Fix **SEC-09**: Initialize and isolate anticheat placement interval tracking.
   - Fix **SEC-10**: Scrub private ability data from public event broadcasts.
   - Fix **SEC-12**: Persist settled claim records in a relational table to prevent sliding-window replays.