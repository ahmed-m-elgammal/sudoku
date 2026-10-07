// specs/17 phase 4.6 — FriendScreen pairing laws, verified against the LIVE server.
//
// The 4.6 acceptance is "two parties pair on the code". Before this probe the
// server's 4 s Shade fallback ate friend entries too: a host whose friend took
// longer than 4 s to type the code was dragged into a RATED Shade duel. These
// probes pin the repaired matchmaking contract end to end (real sockets, real
// REST auth, real queue):
//
//   FRIEND-1  a lone host with a code is NOT Shade-fallbacked (waits past 4 s)
//   FRIEND-2  the guest pairs on the code; both seats get 'matched' with
//             foe.shade=false, mirrored names, and the same duelId
//   FRIEND-3  a departed host (leave_queue) can never pair — the late guest waits
//   FRIEND-4  a DEAD host's socket is reaped; the late guest is not paired with a
//             corpse (and still gets no Shade — a friend code waits for a human)
//   FRIEND-5  regression control: a lone RANKED queuer still Shade-fallbacks ~4 s
//             (spec §7 untouched by the friend fix)
//
// Run: node scripts/friend-pair-probe.mjs   (spawns the bun server on :3030)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { io } = require(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../mobile/node_modules/socket.io-client'));

const URL_ = 'http://localhost:3030';
const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../mini-services/assize-server');
const rand = Math.random().toString(36).slice(2, 8);
const log = (...a) => console.log(...a);
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitEvent = (sock, event, timeoutMs = 12000) =>
  new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeoutMs);
    sock.once(event, (p) => { clearTimeout(t); resolve(p); });
  });

const auth = async (id, secret) => {
  const r = await fetch(`${URL_}/api/auth`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, secret, name: `Probe ${id.slice(-6)}` }),
  });
  return r.json();
};

const connectAccount = async (id, secret) => {
  const sock = io(URL_, { transports: ['websocket'] });
  await new Promise((res, rej) => { sock.on('connect', res); sock.on('connect_error', rej); });
  // the queue authenticates against the server account (the mobile port reads
  // the identity from the Keychain; the wire payload is the same shape)
  try { await fetch(`${URL_}/api/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, secret, name: `Probe ${id.slice(-6)}` }) }); } catch { /* auth below may still pass */ }
  return sock;
};

const joinQueue = (sock, accountId, secret, friendCode) =>
  sock.emit('join_queue', { accountId, secret, name: `Probe ${accountId.slice(-6)}`, order: 'scholar', ...(friendCode ? { friendCode } : {}) });

// ---- spawn the server -------------------------------------------------------
const server = spawn('bun', ['index.ts'], { cwd: SERVER_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  await sleep(500);
  try { const r = await fetch(`${URL_}/api/health`); up = r.ok; } catch { /* not yet */ }
}
if (!up) { console.error('server failed to start:\n' + serverLog); process.exit(1); }
log('server up on :3030');

try {
  // ---- FRIEND-1 + FRIEND-2: host waits past 4 s, then pairs on the code -------
  const A = { id: `frp-a-${rand}`, secret: `sec-${rand}-a` };
  const B = { id: `frp-b-${rand}`, secret: `sec-${rand}-b` };
  await auth(A.id, A.secret);
  await auth(B.id, B.secret);

  const sockA = await connectAccount(A.id, A.secret);
  const sockB = await connectAccount(B.id, B.secret);

  const CODE = `F${rand.slice(0, 5).toUpperCase()}`; // 6-char code, the /api/friend/create shape
  let aMatched = null;
  sockA.once('matched', (p) => { aMatched = p; });

  joinQueue(sockA, A.id, A.secret, CODE);
  // the old server Shade-fallbacked the host right here at 4 s (a RATED duel,
  // foe.shade=true) — the 4.6 pairing law keeps the host in the queue instead
  await sleep(5500);
  check('FRIEND-1 lone friend host is NOT Shade-fallbacked past 4 s', !aMatched, aMatched ? `got ${JSON.stringify(aMatched).slice(0, 80)}` : 'still queued at 5.5 s');

  const bP = waitEvent(sockB, 'matched');
  joinQueue(sockB, B.id, B.secret, CODE);
  const bMatched = await bP;
  const paired = await waitEvent(sockA, 'matched');
  aMatched = paired ?? aMatched;

  const bothMatched = !!bMatched && !!aMatched;
  check('FRIEND-2 two parties pair on the code', bothMatched, bothMatched ? `duelId ${(aMatched ?? bMatched).duelId}` : 'no matched on one/both seats');
  if (bothMatched) {
    check('FRIEND-2a both seats share the duelId, seats 0 and 1',
      aMatched.duelId === bMatched.duelId && aMatched.seat !== bMatched.seat,
      `A=${aMatched.seat} B=${bMatched.seat}`);
    check('FRIEND-2b friend matches are HUMAN (foe.shade false on both seats)',
      aMatched.foe?.shade === false && bMatched.foe?.shade === false);
    check('FRIEND-2c mirrored foe plates (A sees B, B sees A)',
      aMatched.foe?.name === `Probe ${B.id.slice(-6)}` && bMatched.foe?.name === `Probe ${A.id.slice(-6)}`);
  }
  sockA.disconnect();
  sockB.disconnect();
  await sleep(300);

  // ---- FRIEND-3: a departed host can never pair ------------------------------
  const C = { id: `frp-c-${rand}`, secret: `sec-${rand}-c` };
  const D = { id: `frp-d-${rand}`, secret: `sec-${rand}-d` };
  await auth(C.id, C.secret);
  await auth(D.id, D.secret);
  const sockC = await connectAccount(C.id, C.secret);
  const sockD = await connectAccount(D.id, D.secret);
  const CODE2 = `F${rand.slice(0, 5).toUpperCase()}X`.slice(0, 6);
  const dSawNothing = { matched: false };
  sockD.on('matched', () => { dSawNothing.matched = true; });
  joinQueue(sockC, C.id, C.secret, CODE2);
  await sleep(400);
  sockC.emit('leave_queue', {}); // the mobile port sends this on unmount
  joinQueue(sockD, D.id, D.secret, CODE2);
  await sleep(5500);
  check('FRIEND-3 a departed host (leave_queue) never pairs with a late guest', !dSawNothing.matched);
  sockD.emit('leave_queue', {});
  sockC.disconnect();
  sockD.disconnect();
  await sleep(300);

  // ---- FRIEND-4: a DEAD host is reaped; the late guest is not paired with it --
  const E = { id: `frp-e-${rand}`, secret: `sec-${rand}-e` };
  const F = { id: `frp-f-${rand}`, secret: `sec-${rand}-f` };
  await auth(E.id, E.secret);
  await auth(F.id, F.secret);
  const sockE = await connectAccount(E.id, E.secret);
  const sockF = await connectAccount(F.id, F.secret);
  const CODE3 = `F${rand.slice(0, 5).toUpperCase()}Y`.slice(0, 6);
  const fSaw = { matched: null };
  sockF.on('matched', (p) => { fSaw.matched = p; });
  joinQueue(sockE, E.id, E.secret, CODE3);
  await sleep(400);
  sockE.disconnect(true); // the app died on the host; no leave_queue was sent
  joinQueue(sockF, F.id, F.secret, CODE3);
  await sleep(5500);
  const reaped = !fSaw.matched || fSaw.matched.foe?.name !== `Probe ${E.id.slice(-6)}`;
  check('FRIEND-4 a dead host is reaped — the late guest never pairs with a corpse', reaped);
  if (fSaw.matched) check('FRIEND-4a the reaped-guest case is STILL not a Shade (friend codes wait)', fSaw.matched.foe?.shade === false, JSON.stringify(fSaw.matched.foe ?? {}));
  sockF.emit('leave_queue', {});
  sockF.disconnect();
  await sleep(300);

  // ---- FRIEND-5: regression control — ranked keeps the 4 s Shade fallback -----
  const G = { id: `frp-g-${rand}`, secret: `sec-${rand}-g` };
  await auth(G.id, G.secret);
  const sockG = await connectAccount(G.id, G.secret);
  joinQueue(sockG, G.id, G.secret, undefined); // no friendCode — the ranked queue
  const t0 = Date.now();
  const gMatched = await waitEvent(sockG, 'matched', 9000);
  const waited = Date.now() - t0;
  check('FRIEND-5 ranked Shade fallback intact (spec §7 untouched)',
    !!gMatched && gMatched.foe?.shade === true && waited >= 3500 && waited <= 8500,
    gMatched ? `matched at ${waited} ms` : 'no fallback within 9 s');
  sockG.disconnect();
} finally {
  server.kill('SIGKILL');
}

const failed = results.filter(([, ok]) => !ok);
log(`\n${results.length - failed.length}/${results.length} probes passed`);
process.exit(failed.length ? 1 : 0);
