// Probe: is the server tick loop alive? Join solo (Shade fallback match),
// listen for 'you' snapshots + drop and listen for reconnect_grace.
import { io } from 'socket.io-client';

const URL = 'http://localhost:3030';
const rand = Math.random().toString(36).slice(2, 8);
const id = `probe-${rand}`;
const secret = `sec-${rand}`;

await fetch(`${URL}/api/auth`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id, secret, name: 'Probe' }),
});

const sock = io(URL, { transports: ['websocket'] });
await new Promise((r) => sock.on('connect', r));
let youCount = 0;
let graceCount = 0;
let peerDrop = null;
sock.on('you', () => youCount++);
sock.on('reconnect_grace', (p) => { graceCount++; console.log('grace', JSON.stringify(p)); });
sock.on('peer_disconnected', (p) => { peerDrop = p; console.log('peer_disconnected', JSON.stringify(p)); });

const matched = new Promise((r) => sock.once('matched', r));
sock.emit('join_queue', { accountId: id, secret, name: 'Probe', order: 'scholar' });
const m = await matched;
console.log('matched, duel', m.duelId, 'seat', m.seat);

await new Promise((r) => setTimeout(r, 2000));
console.log(`'you' snapshots in 2s: ${youCount} ${youCount > 0 ? '(tick loop alive)' : '(TICK LOOP DEAD)'}`);

// drop the socket → the OTHER seat is a Shade (no socket), so no peer_disconnected is
// expected; but reconnect_grace is only sent to remaining SEATS with sockets — none.
// So instead: reconnect with a second socket, then drop THAT one and watch.
const sock2 = io(URL, { transports: ['websocket'] });
await new Promise((r) => sock2.on('connect', r));
sock2.emit('reconnect', { duelId: m.duelId, accountId: id, secret });
const ok = await new Promise((r) => sock2.once('reconnect_ok', r));
console.log('reconnect_ok you.board len:', ok?.you?.board?.length);

// now a REAL second human: queue a fresh account and wait for a match, then drop it
const id2 = `probe2-${rand}`;
const secret2 = `sec2-${rand}`;
await fetch(`${URL}/api/auth`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id: id2, secret: secret2, name: 'Probe2' }),
});
const sockB = io(URL, { transports: ['websocket'] });
await new Promise((r) => sockB.on('connect', r));
const matchedB = new Promise((r) => sockB.once('matched', r));
sockB.emit('join_queue', { accountId: id2, secret: secret2, name: 'Probe2', order: 'executioner' });
const mB = await matchedB;
console.log('B matched into', mB.duelId, 'seat', mB.seat);

youCount = 0;
await new Promise((r) => setTimeout(r, 1500));
console.log(`'you' snapshots after B joined: ${youCount}`);

sockB.disconnect();
await new Promise((r) => setTimeout(r, 3600));
console.log(`peer_disconnected seen: ${JSON.stringify(peerDrop)}`);
console.log(`reconnect_grace ticks in 3.6s after drop: ${graceCount} ${graceCount >= 2 ? 'PASS' : 'FAIL'}`);
sock.disconnect();
sock2.disconnect();
process.exit(graceCount >= 2 ? 0 : 1);
