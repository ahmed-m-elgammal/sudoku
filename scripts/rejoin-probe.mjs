// Focused probe: what does the rejoining socket actually receive?
import { io } from 'socket.io-client';
const URL = 'http://localhost:3030';
const rand = Math.random().toString(36).slice(2, 8);
const A = { id: `pa-${rand}`, secret: `s-${rand}-a` };
const B = { id: `pb-${rand}`, secret: `s-${rand}-b` };
const auth = async (x) => (await fetch(`${URL}/api/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: x.id, secret: x.secret, name: x.id }) })).json();
await auth(A); await auth(B);

const sa = io(URL, { transports: ['websocket'] });
const sb = io(URL, { transports: ['websocket'] });
await new Promise((r) => sa.on('connect', r));
await new Promise((r) => sb.on('connect', r));
const mA = new Promise((r) => sa.once('matched', r));
const mB = new Promise((r) => sb.once('matched', r));
sa.emit('join_queue', { accountId: A.id, secret: A.secret, name: 'A', order: 'scholar' });
sb.emit('join_queue', { accountId: B.id, secret: B.secret, name: 'B', order: 'executioner' });
const mA2 = await mA;
console.log('A matched:', mA2.duelId, 'seat', mA2.seat);
const mb = await mB;
console.log('B matched:', mb.duelId, 'seat', mb.seat);

sb.disconnect();
await new Promise((r) => setTimeout(r, 1200));

const sb2 = io(URL, { transports: ['websocket'] });
sb2.onAny((ev, ...args) => console.log(`  [B2 <- ${ev}]`, JSON.stringify(args).slice(0, 120)));
await new Promise((r) => sb2.on('connect', r));
console.log('B2 connected, emitting reconnect…');
sb2.emit('reconnect', { duelId: mb.duelId, accountId: B.id, secret: B.secret });
await new Promise((r) => setTimeout(r, 2500));
console.log('done');
process.exit(0);
