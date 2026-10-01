// T2 verification: two socket clients queue, match, one drops —
// the other must receive peer_disconnected + 1s reconnect_grace ticks,
// then peer_reconnected on rejoin, and a forfeit 'end' after the full 20s grace.
import { io } from 'socket.io-client';

const URL = 'http://localhost:3030';
const rand = Math.random().toString(36).slice(2, 8);
const log = (...a) => console.log(...a);
const results = [];
const check = (name, ok) => { results.push([name, ok]); log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };

const auth = async (id, secret) => {
  const r = await fetch(`${URL}/api/auth`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, secret, name: id.slice(0, 12) }),
  });
  return r.json();
};

const waitEvent = (socket, event, timeoutMs = 30000) =>
  new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeoutMs);
    socket.once(event, (p) => { clearTimeout(t); resolve(p); });
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const A = { id: `t2a-${rand}`, secret: `sec-${rand}-a` };
const B = { id: `t2b-${rand}`, secret: `sec-${rand}-b` };
await auth(A.id, A.secret);
await auth(B.id, B.secret);

const sockA = io(URL, { transports: ['websocket'] });
const sockB = io(URL, { transports: ['websocket'] });
await new Promise((r) => sockA.on('connect', r));
await new Promise((r) => sockB.on('connect', r));
log('both sockets connected');

// observability: record everything A hears during the test
const aSaw = { peer_disconnected: 0, reconnect_grace: [], peer_reconnected: 0, end: null };
sockA.on('peer_disconnected', (p) => { aSaw.peer_disconnected++; log('  A saw peer_disconnected', JSON.stringify(p)); });
sockA.on('reconnect_grace', (p) => { aSaw.reconnect_grace.push(p.s); });
sockA.on('peer_reconnected', (p) => { aSaw.peer_reconnected++; log('  A saw peer_reconnected', JSON.stringify(p)); });
sockA.on('end', (p) => { aSaw.end = p; });

const matchedA = waitEvent(sockA, 'matched');
const matchedB = waitEvent(sockB, 'matched');
sockA.emit('join_queue', { accountId: A.id, secret: A.secret, name: 'Clerk A', order: 'scholar' });
sockB.emit('join_queue', { accountId: B.id, secret: B.secret, name: 'Clerk B', order: 'executioner' });
const mA = await matchedA;
const mB = await matchedB;
check('matchmaking paired both seats', !!mA && !!mB && mA.duelId === mB.duelId);
const duelId = mA.duelId;
log('duel', duelId);

// ---- drop B
sockB.disconnect();
const t0 = Date.now();
const pd = await waitEvent(sockA, 'peer_disconnected', 5000);
check('A notified of peer drop', !!pd && pd.graceS === 20);

// grace ticks arrive ~1/s
await sleep(3400);
check('grace ticks at ~1s cadence (>=2 ticks)', aSaw.reconnect_grace.length >= 2);
log('  ticks so far:', aSaw.reconnect_grace.join(','));

// ---- B rejoins within the grace window
const sockB2 = io(URL, { transports: ['websocket'] });
sockB2.onAny((ev, ...args) => { if (ev !== 'you' && ev !== 'state_delta') log(`  [B2 <- ${ev}]`); });
await new Promise((r) => sockB2.on('connect', r));
const ro = waitEvent(sockB2, 'reconnect_ok', 5000);
sockB2.emit('reconnect', { duelId, accountId: B.id, secret: B.secret });
const reconnectOk = await ro;
const snap = reconnectOk?.you; // publicState: { duelId, givens, you: { board, ... }, foe, ... }
check('B rejoin answered with reconnect_ok + snapshot', !!snap && Array.isArray(snap.givens) && Array.isArray(snap.you?.board));
await sleep(600);
check('A told the peer is back (no countdown)', aSaw.peer_reconnected >= 1);

// ---- B drops again and stays gone: forfeit after 20s grace
aSaw.reconnect_grace.length = 0;
sockB2.disconnect();
const endP = waitEvent(sockA, 'end', 30000);
const end = await endP;
const waitedS = Math.round((Date.now() - t0) / 1000);
check('forfeit end after full grace', !!end && end.reason === 'forfeit' && end.winner === 0);
log(`  end payload: reason=${end?.reason} winner(seat of A)=${end?.winner} (A waited ~${waitedS}s total)`);

sockA.disconnect();
const failed = results.filter(([, ok]) => !ok);
log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
