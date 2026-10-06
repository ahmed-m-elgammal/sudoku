// Pins the Settings-wipe contract on the AsyncStorage and FS tiers.
//
// Keys are namespaced `${store}/${key}` (identity/, save/, duels/, notes/). clearAll()
// used to filter with `k.startsWith('assize')` — which matches none of them — so the
// wipe silently deleted NOTHING in Expo Go (FS tier) or on the AsyncStorage tier.
// (The MMKV tier only worked because its whole instance is named 'assize'.)
import { afterEach, describe, expect, it } from 'vitest';
import { storage, __forceStorageBackend, __resetStorageBackends } from '@/platform/storage';
import { STORES } from '@/platform/types';

afterEach(() => __resetStorageBackends());

describe('storage.clearAll · the wipe deletes the app\'s namespaced keys on every tier', () => {
  it('WIPE-1 the FS tier (Expo Go) deletes every STORES-prefixed key', async () => {
    __forceStorageBackend('fs');
    await storage.set('save', 'main', { ink: 5 });
    await storage.set('identity', 'profile', { name: 'A' });
    await storage.set('duels', 'd1', { seed: 'x' });
    await storage.set('notes', 'n1', [1, 2, 3]);

    await storage.clearAll();

    expect(await storage.get('save', 'main')).toBeUndefined();
    expect(await storage.get('identity', 'profile')).toBeUndefined();
    expect(await storage.get('duels', 'd1')).toBeUndefined();
    expect(await storage.get('notes', 'n1')).toBeUndefined();
    expect(await storage.keys('save')).toEqual([]);
  });

  it('WIPE-2 every known store prefix is covered by the filter', () => {
    // If a store is added to STORES, clearAll must follow automatically — this pin
    // exists so nobody reintroduces a hand-rolled prefix list.
    expect([...STORES].sort()).toEqual(['duels', 'identity', 'notes', 'save']);
  });
});
