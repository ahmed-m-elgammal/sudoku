// ASSIZE mobile — guest identity, display names, Recovery Codes.
//
// PORT of ../src/state/identity.ts. The word lists, the code format (4 words + a 2
// digit mod-100 checksum), and `validateRecoveryCode` are UNCHANGED and must stay so:
// a code already printed on a player's screenshot has to verify against the same law.
//
// Three platform edits:
//   crypto.getRandomValues  -> getRandomFloat()   (@/platform/crypto)
//   crypto.randomUUID       -> randomUuid()       (not in React Native at all)
//   crypto.subtle.digest    -> hashRecoveryCode() (expo-crypto)
// ...and the id/secret/name now live in the Keychain-backed store, because on a phone
// the secret is a real credential. See specs/04 and specs/08.

import { storage, secrets } from '@/platform/storage';
import { getRandomFloat, randomUuid, hashRecoveryCode as sha } from '@/platform/crypto';

const ADJ = ['Gaunt', 'Ashen', 'Quiet', 'Bleak', 'Hollow', 'Sallow', 'Grave', 'Sober', 'Pale', 'Stern', 'Wry', 'Fallow', 'Meek', 'Iron', 'Rusted', 'Waxen'];
const NOUN = ['Notary', 'Scrivener', 'Clerk', 'Advocate', 'Quill', 'Ledger', 'Seal', 'Bell', 'Lantern', 'Folio', 'Vial', 'Candle', 'Magistrate', 'Warden', 'Axe', 'Censer'];
const CODE_WORDS = ['ash', 'bell', 'cinder', 'doyle', 'ember', 'flint', 'gravel', 'hollow', 'ivory', 'juniper', 'kelp', 'lint', 'moss', 'nettle', 'oath', 'parchment', 'quill', 'russet', 'sable', 'tallow', 'umber', 'vellum', 'wax', 'zinc'];

export interface GuestIdentity {
  id: string;
  secret: string;
  name: string;
  recoveryHash: string | null;
}

const pick = <T,>(a: readonly T[]): T => a[Math.floor(getRandomFloat() * a.length)];

export function generateName(): string {
  return `${pick(ADJ)} ${pick(NOUN)} ${1000 + Math.floor(getRandomFloat() * 9000)}`;
}

const checksum = (body: string): string => {
  const sum = [...body].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % 100;
  return String(sum).padStart(2, '0');
};

export function generateRecoveryCode(): string {
  const body = [pick(CODE_WORDS), pick(CODE_WORDS), pick(CODE_WORDS), pick(CODE_WORDS)].join('-');
  return `${body}-${checksum(body)}`;
}

export async function hashRecoveryCode(code: string): Promise<string> {
  return sha(code);
}

export function validateRecoveryCode(code: string): boolean {
  const parts = code.trim().toLowerCase().split('-');
  if (parts.length !== 5) return false;
  const body = parts.slice(0, 4).join('-');
  return checksum(body) === parts[4];
}

export async function loadIdentity(): Promise<GuestIdentity> {
  const existing = await storage.get<GuestIdentity>('identity', 'me');
  if (existing?.id && existing.name) {
    // the secret moved to the Keychain; heal a row that predates the move
    if (!existing.secret) {
      const secret = await secrets.getSecret();
      if (secret) existing.secret = secret;
    }
    return existing;
  }
  const fresh: GuestIdentity = {
    id: randomUuid(),
    secret: randomUuid(),
    name: generateName(),
    recoveryHash: null,
  };
  await secrets.setSecret(fresh.secret);
  await storage.set('identity', 'me', fresh);
  return fresh;
}

export async function saveIdentity(identity: GuestIdentity): Promise<void> {
  await secrets.setSecret(identity.secret);
  await storage.set('identity', 'me', identity);
}

/** The secret the net client signs every request with (was `localStorage['assize-secret']`). */
export async function getAuthSecret(): Promise<string> {
  const id = await storage.get<GuestIdentity>('identity', 'me');
  if (id?.secret) return id.secret;
  const secret = await secrets.getSecret();
  if (secret) return secret;
  return (await loadIdentity()).secret;
}
