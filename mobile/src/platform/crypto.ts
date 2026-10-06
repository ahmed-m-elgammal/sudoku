// ASSIZE mobile — crypto.
//
// Replaces the three WebCrypto calls the web build made in src/state/identity.ts:
//
//   crypto.getRandomValues(new Uint32Array(1))  -> getRandomFloat()
//   crypto.randomUUID()                         -> randomUuid()   (NOT in RN/Hermes)
//   crypto.subtle.digest('SHA-256', data)       -> sha256Hex()    (NOT in RN)
//
// The recovery-code law is a hash contract: the web build hashes
// `assize:${code}` with SHA-256 and the server stores the hex. If this file changes
// its output, every recovery code already issued to a player stops verifying. So
// sha256Hex must produce byte-identical lowercase hex to WebCrypto.

import * as Crypto from 'expo-crypto';

const HEX = '0123456789abcdef';

/** A float in [0, 1) — the exact shape `generateName`/`generateRecoveryCode` want. */
export function getRandomFloat(): number {
  const bytes = Crypto.getRandomBytes(4);
  const n = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return n / 4294967296;
}

export function getRandomBytes(n: number): Uint8Array {
  return Crypto.getRandomBytes(n);
}

/**
 * RFC 4122 v4 UUID. `crypto.randomUUID` does not exist in React Native, so this
 * reproduces it: 16 random bytes with the version (4) and variant (10xx) bits set.
 * Format must stay 8-4-4-4-12 lowercase hex — the server stores it as an account id.
 */
export function randomUuid(): string {
  const b = Crypto.getRandomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += HEX[b[i] >> 4] + HEX[b[i] & 0x0f];
    if (i === 3 || i === 5 || i === 7 || i === 9) out += '-';
  }
  return out;
}

/** Lowercase hex SHA-256 of a UTF-8 string. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  return digest.toLowerCase();
}

/**
 * The web build hashed exactly `assize:${code}` (identity.ts:31). Keep the prefix —
 * it is a domain separator, and changing it invalidates every issued code.
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  return sha256Hex(`assize:${code}`);
}
