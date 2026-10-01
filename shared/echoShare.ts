// ASSIZE T19 — echo sharing as "sealed chits", behind the privacy pass.
//
// The privacy pass (T7/T17's deferred obligation): a recorded echo carries the
// Clerk's chosen name, and a name is identity. So:
//   · EXPORT never carries a name — redactEcho() replaces both seats with fixed
//     fictional labels before a single byte is encoded ("a wandering Clerk" /
//     "an ink-echo"). Gameplay data (seed, tier, orders, actions, outcome) is
//     kept byte-faithful: the echo must replay exactly, only anonymously.
//   · IMPORT force-redacts AGAIN — a hand-crafted or third-party chit cannot
//     smuggle a name onto your shelf even in principle. The redaction on
//     decode is unconditional, not a courtesy.
//   · No server, no pool this iteration: a chit is a copy-paste string. Nothing
//     leaves the device unless the Clerk physically passes it on.
//
// Format: `ASSIZE1-` + base64url(UTF-8(JSON payload in fixed key order)).
// Deterministic: the same echo always encodes to the byte-identical chit.
//
// Fail-closed posture, the T7 lineage: decode NEVER throws. Wrong prefix, bad
// base64url, invalid UTF-8, non-JSON, JSON bombs, prototype pollution, oversized
// payloads and replays that fail validation all return null.
import { validateReplay, type DuelReplay } from './replay';

export const ECHO_CODE_PREFIX = 'ASSIZE1-';
// a full 4000-action echo encodes well under this; anything larger is refuse
export const MAX_ECHO_CODE_CHARS = 400_000;

export const REDACTED_CLERK = 'a wandering Clerk';
export const REDACTED_ECHO = 'an ink-echo';

// ---------------------------------------------------------------- redaction
// validate first, then replace both seats. Pure: the input is never mutated.
export const redactEcho = (raw: unknown): DuelReplay | null => {
  const clean = validateReplay(raw);
  if (!clean) return null;
  return { ...clean, names: [REDACTED_CLERK, REDACTED_ECHO] };
};

// ---------------------------------------------------------------- base64url
// Pure TS (browser + bun + node, no Buffer, no btoa-unicode traps).
const B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64U_REV: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < B64U.length; i++) m[B64U[i]] = i;
  return m;
})();

export const bytesToBase64Url = (bytes: Uint8Array): string => {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64U[(n >>> 18) & 63] + B64U[(n >>> 12) & 63] + B64U[(n >>> 6) & 63] + B64U[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64U[(n >>> 18) & 63] + B64U[(n >>> 12) & 63];
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64U[(n >>> 18) & 63] + B64U[(n >>> 12) & 63] + B64U[(n >>> 6) & 63];
  }
  return out; // unpadded — the length is self-describing
};

// null on any character outside the alphabet, any length ≡ 1 mod 4 (dangling
// 6 bits), or internal whitespace (paste tolerance strips it BEFORE this call)
export const base64UrlToBytes = (s: string): Uint8Array | null => {
  if (typeof s !== 'string' || s.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((s.length * 6) / 8));
  let bits = 0;
  let acc = 0;
  let o = 0;
  for (let i = 0; i < s.length; i++) {
    const v = B64U_REV[s[i]];
    if (v === undefined) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >>> bits) & 0xff;
    }
  }
  return out;
};

// ---------------------------------------------------------------- encode
export const encodeEchoCode = (raw: unknown): string | null => {
  const redacted = redactEcho(raw);
  if (!redacted) return null;
  // fixed key order → JSON.stringify is deterministic; JSON.stringify omits
  // undefined fields, so seals/outcome stay absent when absent
  const payload = JSON.stringify({
    v: redacted.v,
    seed: redacted.seed,
    tier: redacted.tier,
    orders: redacted.orders,
    names: redacted.names,
    seals: redacted.seals,
    durationMs: redacted.durationMs,
    actions: redacted.actions,
    outcome: redacted.outcome,
  });
  const code = ECHO_CODE_PREFIX + bytesToBase64Url(new TextEncoder().encode(payload));
  if (code.length > MAX_ECHO_CODE_CHARS) return null; // cannot happen ≤ 4000 actions; belt and braces
  return code;
};

// ---------------------------------------------------------------- decode
export const decodeEchoCode = (text: unknown): DuelReplay | null => {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!t.startsWith(ECHO_CODE_PREFIX)) return null;
  const body = t.slice(ECHO_CODE_PREFIX.length).replace(/\s+/g, '');
  if (!body.length || body.length > MAX_ECHO_CODE_CHARS) return null;
  const bytes = base64UrlToBytes(body);
  if (!bytes) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
  const clean = validateReplay(parsed);
  if (!clean) return null;
  // THE PRIVACY PASS, second half: import redacts unconditionally — a forged or
  // third-party chit cannot put a name on your shelf, whatever it carries.
  return { ...clean, names: [REDACTED_CLERK, REDACTED_ECHO] };
};
