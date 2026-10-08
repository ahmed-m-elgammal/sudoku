// netClient.test.ts — the server-origin law (store-audit blocker P0-2.3, fail-closed).
//
// A production build produced without EXPO_PUBLIC_ASSIZE_SERVER falls back to
// localhost — matchmaking cannot work from a phone — and a plain-http origin would
// be blocked at the OS layer (iOS ATS / Android cleartext) SILENTLY. The law here
// makes both failures loud at the one place that names them, and keeps every
// developer path (Expo Go, the Android emulator's 10.0.2.2) working untouched.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isServerConfigured, serverOrigin } from '@/game/net/client';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('serverOrigin — the resolve order', () => {
  it('falls back to localhost when nothing is configured (the dev path)', () => {
    vi.stubEnv('EXPO_PUBLIC_ASSIZE_SERVER', '');
    expect(serverOrigin()).toBe('http://localhost:3030');
    expect(isServerConfigured()).toBe(false);
  });

  it('prefers the configured origin and strips a trailing slash', () => {
    vi.stubEnv('EXPO_PUBLIC_ASSIZE_SERVER', 'https://api.assize.game/');
    expect(serverOrigin()).toBe('https://api.assize.game');
    expect(isServerConfigured()).toBe(true);
  });
});

describe('serverOrigin — the https fail-closed law', () => {
  it('keeps every local cleartext developer host working', () => {
    for (const host of ['http://localhost:3030', 'http://127.0.0.1:3030', 'http://10.0.2.2:3030']) {
      vi.stubEnv('EXPO_PUBLIC_ASSIZE_SERVER', host);
      expect(serverOrigin()).toBe(host);
    }
  });

  it('refuses a plain-http remote origin — loudly, at the one place that names it', () => {
    vi.stubEnv('EXPO_PUBLIC_ASSIZE_SERVER', 'http://api.assize.game');
    expect(() => serverOrigin()).toThrow(/https/);
  });

  it('accepts any https origin', () => {
    vi.stubEnv('EXPO_PUBLIC_ASSIZE_SERVER', 'https://duels.assize.game');
    expect(serverOrigin()).toBe('https://duels.assize.game');
  });
});
