// T19 — sealed chits + the privacy pass. ADVERSARIAL SUITE. A shared echo is
// UNTRUSTED DATA crossing a Clerk-to-Clerk channel, and it carries the one thing
// it must never carry: a name. These tests try to smuggle names through codes,
// crash the decoder, and sneak polluted payloads onto the shelf:
//   · round-trips keep gameplay byte-faithful while names are redacted on BOTH
//     sides (export AND import — a hand-crafted code cannot smuggle a name in)
//   · no substring of any original name (≥5 chars, any case) survives in a chit
//   · the hostile-code matrix returns null and NEVER throws
//   · 4000-action maximum echoes still encode within the cap
import { describe, it, expect } from 'vitest';
import {
  encodeEchoCode, decodeEchoCode, redactEcho, bytesToBase64Url, base64UrlToBytes,
  ECHO_CODE_PREFIX, MAX_ECHO_CODE_CHARS, REDACTED_CLERK, REDACTED_ECHO,
} from '../echoShare';
import { validateReplay, REPLAY_MAX_ACTIONS, type DuelReplay } from '../replay';
import { LocalDuel } from '../../src/game/localDuel';
import type { Digit } from '../config';

// ---------------------------------------------------------------- fixtures
const baseReplay = (): DuelReplay => ({
  v: 1,
  seed: 'share-seed-1',
  tier: 'Easy',
  orders: ['scholar', 'executioner'],
  names: ['Enguerrand', 'Shade of Enguerrand'],
  seals: [7, 7],
  durationMs: 120_000,
  actions: [
    { t: 1200, kind: 'place', cell: 5, digit: 3 },
    { t: 4800, kind: 'place', cell: 11, digit: 7 },
    { t: 9300, kind: 'ability', id: 'augur', cell: 20 },
  ],
  outcome: { winner: 0, reason: 'seals' },
});

const b64u = (s: string): string => bytesToBase64Url(new TextEncoder().encode(s));

// a real recorded echo (the T7 harness): a scripted duel, sealed by the recorder
const recordedEcho = (): DuelReplay | null => {
  const duel = new LocalDuel({
    mode: 'practice', seed: 'chit-record', tier: 'Easy',
    orders: ['scholar', 'executioner'], names: ['You', 'Foe'],
    foeProfile: {
      name: 'The Tablet', order: 'executioner',
      placeDelayMs: [99999, 100000], mistakeRate: 0,
      abilityCadenceMs: [999999, 1000000], aggression: 0, singlesSkill: 0,
    },
  });
  const wake = (duel as unknown as { shadeWake: () => void });
  for (let i = 0; i < 30 && duel.state.phase === 'live'; i++) {
    (duel as unknown as { state: { clockMs: number } });
    const st = duel.state;
    if (i % 3 === 0) {
      let cell = -1;
      for (let c = 0; c < 81; c++) if (st.players[0].board[c] === 0) { cell = c; break; }
      if (cell >= 0) duel.place(cell, st.solution![cell] as Digit);
    }
    // eslint-disable-next-line
    tick500(duel);
    wake.shadeWake();
  }
  return duel.toReplay({ winner: 0, reason: 'seals' });
};
import { tick } from '../engine';
const tick500 = (d: LocalDuel) => tick(d.state, 500);

// every sliding window of length ≥ 5 of `name` must be absent from the code
const nameLeaks = (name: string, code: string): string[] => {
  const leaks: string[] = [];
  const low = code.toLowerCase();
  const n = name.toLowerCase();
  for (let len = 5; len <= n.length; len++) {
    for (let i = 0; i + len <= n.length; i++) {
      const w = n.slice(i, i + len);
      if (low.includes(w)) leaks.push(w);
    }
  }
  return leaks;
};

// ================================================================ round-trips
describe('CH · chits carry the ink, never the name', () => {
  it('CH1 a recorded echo survives encode→decode byte-faithfully, anonymously', () => {
    const rec = recordedEcho();
    expect(rec).not.toBeNull();
    const code = encodeEchoCode(rec);
    expect(code).not.toBeNull();
    expect(code!.startsWith(ECHO_CODE_PREFIX)).toBe(true);
    const back = decodeEchoCode(code!);
    expect(back).not.toBeNull();
    const v = validateReplay(back);
    expect(v).not.toBeNull();
    expect(back!.seed).toBe(rec!.seed);
    expect(back!.tier).toBe(rec!.tier);
    expect(back!.orders).toEqual(rec!.orders);
    expect(back!.durationMs).toBe(rec!.durationMs);
    expect(back!.actions).toEqual(rec!.actions);
    expect(back!.outcome).toEqual(rec!.outcome);
    expect(back!.seals).toEqual(rec!.seals);
    // the privacy pass — both seats, both directions
    expect(back!.names).toEqual([REDACTED_CLERK, REDACTED_ECHO]);
  });

  it('CH2 no substring of any original name survives anywhere in the chit', () => {
    const r = baseReplay();
    r.names = ['Wilhelmina-der-Blatter', 'Shade of Wilhelmina'];
    const code = encodeEchoCode(r)!;
    expect(code).not.toBeNull();
    expect(nameLeaks('Wilhelmina-der-Blatter', code)).toEqual([]);
    expect(nameLeaks('Shade of Wilhelmina', code)).toEqual([]);
    // even the decoded JSON — not just the base64 — carries no name
    const body = decodeEchoCode(code)!;
    expect(body.names).toEqual([REDACTED_CLERK, REDACTED_ECHO]);
  });

  it('CH3 redactEcho is pure and validates first', () => {
    const r = baseReplay();
    const frozen = JSON.parse(JSON.stringify(r));
    const out = redactEcho(r);
    expect(out).not.toBeNull();
    expect(r).toEqual(frozen); // input untouched
    expect(out!.names).toEqual([REDACTED_CLERK, REDACTED_ECHO]);
    expect(redactEcho({ v: 99 })).toBeNull();
    expect(redactEcho('nope')).toBeNull();
    expect(redactEcho(null)).toBeNull();
  });

  it('CH4 encoding is deterministic — the same echo seals to the byte-identical chit', () => {
    const r = baseReplay();
    expect(encodeEchoCode(r)).toBe(encodeEchoCode(r));
    expect(encodeEchoCode(recordedEcho())).toBe(encodeEchoCode(recordedEcho()));
  });

  it('CH5 a name-smuggling code still lands redacted (import re-redacts)', () => {
    // hand-craft a VALID replay with real names, bypass encodeEchoCode, seal it raw
    const smuggled = baseReplay();
    smuggled.names = ['Lord Forename the Vain', 'Shade of Lord Forename'];
    const raw = ECHO_CODE_PREFIX + b64u(JSON.stringify(smuggled));
    const back = decodeEchoCode(raw);
    expect(back).not.toBeNull();
    expect(back!.names).toEqual([REDACTED_CLERK, REDACTED_ECHO]); // scrubbed, unconditionally
  });

  it('CH6 UTF-8 gameplay fields round-trip through the chit', () => {
    const r = baseReplay();
    r.seed = 'таблетка-石板-𓋹';
    const code = encodeEchoCode(r)!;
    const back = decodeEchoCode(code)!;
    expect(back.seed).toBe(r.seed);
  });
});

// ================================================================ hostile codes
describe('CH · the hostile-code matrix fails closed, never throws', () => {
  const hostile: Array<[string, string]> = [
    ['empty', ''],
    ['whitespace', '     '],
    ['garbage', 'the wax has hardened over this chit'],
    ['prefix only', ECHO_CODE_PREFIX],
    ['wrong prefix', 'ASSIZE2-hello'],
    ['non-base64', `${ECHO_CODE_PREFIX}!!!!####`],
    ['base64 of non-JSON', `${ECHO_CODE_PREFIX}${b64u('not json at all')}`],
    ['JSON null', `${ECHO_CODE_PREFIX}${b64u('null')}`],
    ['JSON array', `${ECHO_CODE_PREFIX}${b64u('[]')}`],
    ['JSON number', `${ECHO_CODE_PREFIX}${b64u('42')}`],
    ['invalid utf-8', `${ECHO_CODE_PREFIX}${bytesToBase64Url(new Uint8Array([0xff, 0xfe, 0xfd]))}`],
    ['valid JSON, invalid replay', `${ECHO_CODE_PREFIX}${b64u('{"v":2,"nope":true}')}`],
    ['oversized', ECHO_CODE_PREFIX + 'A'.repeat(MAX_ECHO_CODE_CHARS + 1)],
  ];

  for (const [label, code] of hostile) {
    it(`CH7 ${label} → null`, () => {
      expect(decodeEchoCode(code)).toBeNull();
    });
  }

  it('CH7b a pollution attempt riding a VALID replay is scrubbed, not honored', () => {
    // the payload is a lawful replay plus a __proto__ key — the T7 contract:
    // junk keys ride nowhere, valid fields survive, the prototype stays clean
    const out = decodeEchoCode(`${ECHO_CODE_PREFIX}${b64u('{"__proto__":{"polluted":1},"v":1,"seed":"s","tier":"Easy","orders":["scholar","executioner"],"names":["a","b"],"durationMs":60000,"actions":[]}')}`);
    expect(out).not.toBeNull();
    expect(out!.names).toEqual([REDACTED_CLERK, REDACTED_ECHO]); // import still re-redacts
    expect(Object.keys(out!)).not.toContain('__proto__');
    expect(Object.getOwnPropertyDescriptor(out!, '__proto__')).toBeUndefined();
  });

  it('CH8 non-string and hostile decode inputs are refused', () => {
    for (const bad of [null, undefined, 42, {}, [], NaN]) {
      expect(decodeEchoCode(bad)).toBeNull();
    }
  });

  it('CH9 the pollution payload pollutes nothing', () => {
    const victim: Record<string, unknown> = {};
    decodeEchoCode(`${ECHO_CODE_PREFIX}${b64u('{"__proto__":{"polluted":1},"v":1}')}`);
    expect((victim as unknown as { polluted?: unknown }).polluted).toBeUndefined();
    expect(({} as unknown as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it('CH10 truncated chits never decode to half an echo', () => {
    const full = encodeEchoCode(recordedEcho())!;
    for (let cut = 1; cut < full.length; cut += Math.max(1, Math.floor(full.length / 40))) {
      const t = full.slice(0, cut);
      const out = decodeEchoCode(t);
      if (out !== null) {
        // the only decodable truncation is a payload that independently
        // validates — never a partial action log
        expect(out.actions.length).toBeGreaterThan(0);
      }
    }
    expect(decodeEchoCode(full)).not.toBeNull(); // the full chit is fine
  });

  it('CH11 200 hostile round-trip fuzz payloads: null-or-valid, never a throw', () => {
    const full = encodeEchoCode(baseReplay())!;
    const rngSeed = Array.from({ length: 200 }, (_, i) => i);
    for (const i of rngSeed) {
      let payload: string;
      const mode = i % 5;
      if (mode === 0) payload = ECHO_CODE_PREFIX + Array.from({ length: 20 }, () => 'ABCDEFGH-_abcdefghijklmnopqrstuvwxyz0123456789'[i % 64]).join('');
      else if (mode === 1) payload = full.slice(0, 8 + (i % Math.max(1, full.length - 8)));
      else if (mode === 2) payload = full.replace(/[A-Z]/, (c) => (c === 'A' ? 'Z' : c)); // corrupt one char
      else if (mode === 3) payload = `${ECHO_CODE_PREFIX}${b64u(JSON.stringify({ v: 1, seed: 'x'.repeat(i % 200), tier: 'Easy' }))}`;
      else payload = ECHO_CODE_PREFIX + b64u(`{"deep":${'['.repeat(i % 40)}}${']'.repeat(i % 40)}`);
      const out = decodeEchoCode(payload);
      if (out !== null) expect(validateReplay(out)).not.toBeNull();
    }
  });
});

// ================================================================ base64url + capacity
describe('CH · the code primitive and the capacity ceiling', () => {
  it('CH12 base64url round-trips arbitrary bytes', () => {
    const rngs = [0, 1, 2, 3, 4, 5, 31, 32, 33, 255];
    for (const n of rngs) {
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) bytes[i] = (i * 37 + 11) & 0xff;
      const enc = bytesToBase64Url(bytes);
      const dec = base64UrlToBytes(enc);
      expect(dec).not.toBeNull();
      expect(Array.from(dec!)).toEqual(Array.from(bytes));
    }
  });

  it('CH13 base64url rejects dangling bits and foreign alphabets', () => {
    expect(base64UrlToBytes('A')).toBeNull();        // length ≡ 1 mod 4 — dangling 6 bits
    expect(base64UrlToBytes('AB+C')) .toBeNull();    // standard-base64 '+' is not base64url
    expect(base64UrlToBytes('AB=C')).toBeNull();     // padding character is not in the alphabet
    expect(base64UrlToBytes('AB')).toEqual(new Uint8Array([0])); // 'AB' → 12 bits → 1 byte (0b000000_000000)
    expect(base64UrlToBytes('')).toEqual(new Uint8Array(0));
  });

  it('CH14 a maximum 4000-action echo encodes within the cap and decodes whole', () => {
    const actions: DuelReplay['actions'] = [];
    let t = 500;
    for (let i = 0; i < REPLAY_MAX_ACTIONS; i++) {
      if (i % 10 === 9) actions.push({ t, kind: 'ability', id: 'augur', cell: i % 81 });
      else actions.push({ t, kind: 'place', cell: i % 81, digit: ((i % 9) + 1) });
      t += 90; // 4000 × 90 ms = 360 s — inside the duration ceiling
    }
    const big: DuelReplay = {
      v: 1, seed: 'max-echo', tier: 'Hard',
      orders: ['warden', 'apothecary'],
      names: ['A', 'B'],
      durationMs: 400_000,
      actions: actions as DuelReplay['actions'],
    };
    expect(validateReplay(big)).not.toBeNull();
    const code = encodeEchoCode(big);
    expect(code).not.toBeNull();
    expect(code!.length).toBeLessThanOrEqual(MAX_ECHO_CODE_CHARS);
    const back = decodeEchoCode(code!);
    expect(back).not.toBeNull();
    expect(back!.actions).toHaveLength(REPLAY_MAX_ACTIONS);
    expect(back!.actions).toEqual(big.actions);
  });
});
