// Guest identity, display names, and Recovery Codes (spec §7).
'use client';
import { idbGet, idbSet } from './idb';

const ADJ = ['Gaunt', 'Ashen', 'Quiet', 'Bleak', 'Hollow', 'Sallow', 'Grave', 'Sober', 'Pale', 'Stern', 'Wry', 'Fallow', 'Meek', 'Iron', 'Rusted', 'Waxen'];
const NOUN = ['Notary', 'Scrivener', 'Clerk', 'Advocate', 'Quill', 'Ledger', 'Seal', 'Bell', 'Lantern', 'Folio', 'Vial', 'Candle', 'Magistrate', 'Warden', 'Axe', 'Censer'];
const CODE_WORDS = ['ash', 'bell', 'cinder', 'doyle', 'ember', 'flint', 'gravel', 'hollow', 'ivory', 'juniper', 'kelp', 'lint', 'moss', 'nettle', 'oath', 'parchment', 'quill', 'russet', 'sable', 'tallow', 'umber', 'vellum', 'wax', 'zinc'];

export interface GuestIdentity {
  id: string;
  secret: string;
  name: string;
  recoveryHash: string | null;
}

const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];

export function generateName(): string {
  return `${pick(ADJ)} ${pick(NOUN)} ${1000 + Math.floor(rand() * 9000)}`;
}

export function generateRecoveryCode(): string {
  const words = [pick(CODE_WORDS), pick(CODE_WORDS), pick(CODE_WORDS), pick(CODE_WORDS)];
  const body = words.join('-');
  const sum = [...body].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % 100;
  return `${body}-${String(sum).padStart(2, '0')}`;
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(`assize:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function validateRecoveryCode(code: string): boolean {
  const parts = code.trim().toLowerCase().split('-');
  if (parts.length !== 5) return false;
  const body = parts.slice(0, 4).join('-');
  const sum = [...body].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % 100;
  return String(sum).padStart(2, '0') === parts[4];
}

export async function loadIdentity(): Promise<GuestIdentity> {
  const existing = await idbGet<GuestIdentity>('identity', 'me');
  if (existing) return existing;
  const fresh: GuestIdentity = {
    id: crypto.randomUUID(),
    secret: crypto.randomUUID(),
    name: generateName(),
    recoveryHash: null,
  };
  await idbSet('identity', 'me', fresh);
  return fresh;
}

export async function saveIdentity(identity: GuestIdentity): Promise<void> {
  await idbSet('identity', 'me', identity);
}
