// Smoke test — proves the gate can render a React Native tree and that the platform
// seams work end to end, before any agent relies on them.
//
// Component tests use react-test-renderer directly: @testing-library/react-native's
// peer matrix fights React 19 in this tree, and jest-expo's transform is broken under
// Node 22 here (see vitest.config.ts). react-test-renderer is already a dependency of
// react-native, so this adds nothing to the bundle.
//
// `react-native` is doubled in vitest.setup.ts — its real entry point is Flow-typed and
// neither runner's transform can parse it here — so the render assertion proves the tree
// mounts and its text lands, not React Native's internals.
import { describe, it, expect } from 'vitest';
import type React from 'react';
import { View, Text } from 'react-native';
import { palette } from '@/theme/tokens';
import { storage, __resetStorageBackends } from '@/platform/storage';
import { randomUuid, hashRecoveryCode } from '@/platform/crypto';
import { validateRecoveryCode, generateRecoveryCode } from '@/state/identity';
import { freshSave, useSave } from '@/state/save';

function renderToJson(element: React.ReactElement) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const renderer = require('react-test-renderer');
  let tree: { toJSON: () => unknown } | null = null;
  renderer.act(() => {
    tree = renderer.create(element);
  });
  return tree!.toJSON();
}

describe('Phase A baseline', () => {
  it('renders a React Native tree', () => {
    const json = renderToJson(
      <View>
        <Text>ASSIZE</Text>
      </View>,
    );
    expect(JSON.stringify(json)).toContain('ASSIZE');
    expect(palette.oxblood).toBe('#7b1a1f');
  });

  it('round-trips the save through the storage seam', async () => {
    __resetStorageBackends();
    await storage.set('save', 'me', { v: 2, ink: 42 });
    expect(await storage.get<{ ink: number }>('save', 'me')).toEqual({ v: 2, ink: 42 });
    expect(await storage.get('save', 'missing')).toBeUndefined();
    await storage.del('save', 'me');
    expect(await storage.get('save', 'me')).toBeUndefined();
  });

  it('keeps the recovery-code law (a code issued on web still verifies)', async () => {
    const code = generateRecoveryCode();
    expect(validateRecoveryCode(code)).toBe(true);
    expect(validateRecoveryCode(`${code}x`)).toBe(false);
    const hash = await hashRecoveryCode(code);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // domain-separated: a different code must not collide
    expect(await hashRecoveryCode(`${code}x`)).not.toBe(hash);
  });

  it('mints an RFC 4122 v4 uuid', () => {
    const id = randomUuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(randomUuid()).not.toBe(id);
  });

  it('loads a fresh Clerk and persists it', async () => {
    __resetStorageBackends();
    await useSave.getState().load();
    const save = useSave.getState().save;
    expect(save).not.toBeNull();
    expect(save!.v).toBe(2);
    expect(save!.standing).toBe(1000);
    // the endless salt must persist: a re-minted salt rewrites every rung's tablet
    const salt = save!.endless.salt;
    await useSave.getState().load();
    expect(useSave.getState().save!.endless.salt).toBe(salt);
    expect(freshSave('X').economy.ink).toBe(0);
  });
});
