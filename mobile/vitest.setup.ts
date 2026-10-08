// ASSIZE mobile — vitest environment setup.
//
// vitest owns the pure logic; but the engine suites (crossOrder, echoShare,
// phaseScript, replay) drive a REAL duel through `LocalDuel`, which is a React
// Native module graph. So the native seams get the same honest doubles jest.setup.js
// gives the component runner.
//
// The rule, identical in both runners: a native module that is absent must make the
// code degrade, never throw. If a test needs a double to be wrong, that is a finding.

import { vi } from 'vitest';

// react-native itself cannot be loaded here: `react-native/index.js` ships Flow-typed
// source and vitest's rolldown transform has no RN/Flow parser (jest-expo's is broken
// under Node 22 here too — see vitest.config.ts). So the primitives are doubled.
//
// The double is a *host-component* stand-in: every component becomes a string type,
// which is exactly what react-test-renderer consumes natively. A render test therefore
// still proves the tree mounts and its text lands — it does not assert RN internals.
// Same rule as every other mock in this file: a seam that is absent must degrade,
// never throw.
vi.mock('react-native', async () => {
  const React = await import('react');
  const host = (name: string) => {
    const C = React.forwardRef(({ children, ...props }: Record<string, unknown>, _ref: unknown) =>
      React.createElement(name, props, children as React.ReactNode),
    );
    C.displayName = name;
    return C;
  };

  const flatList = (name: string) => {
    const C = React.forwardRef(
      (
        { data = [], renderItem, keyExtractor, ListEmptyComponent, ...props }: Record<string, any>,
        _ref: unknown,
      ) => {
        const rows = (data as unknown[]).length
          ? (data as unknown[]).map((item, i) =>
              React.createElement(
                React.Fragment,
                { key: keyExtractor ? keyExtractor(item, i) : String(i) },
                renderItem({ item, index: i }),
              ),
            )
          : ListEmptyComponent
            ? React.createElement(ListEmptyComponent)
            : null;
        return React.createElement(name, props, rows);
      },
    );
    C.displayName = name;
    return C;
  };

  const noopSubscription = { remove: () => {} };

  return {
    __esModule: true,
    default: {},

    // host components
    View: host('View'),
    Text: host('Text'),
    ScrollView: host('ScrollView'),
    SafeAreaView: host('SafeAreaView'),
    Pressable: host('Pressable'),
    TouchableOpacity: host('TouchableOpacity'),
    Modal: host('Modal'),
    ActivityIndicator: host('ActivityIndicator'),
    Image: host('Image'),
    ImageBackground: host('ImageBackground'),
    TextInput: host('TextInput'),
    Switch: host('Switch'),
    StatusBar: host('StatusBar'),
    FlatList: flatList('FlatList'),
    SectionList: flatList('SectionList'),

    // StyleSheet: create() is identity — the assertions are about the values, which
    // come from @/theme/tokens, not about the registry.
    StyleSheet: {
      create: <T,>(styles: T): T => styles,
      flatten: (style: unknown) => style,
      compose: (a: unknown, b: unknown) => (a && b ? [a, b] : a ?? b),
      hairlineWidth: 1,
      absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },

    Platform: {
      OS: 'ios' as const,
      Version: 17,
      isTV: false,
      select: (spec: Record<string, unknown>) => spec.ios ?? spec.default,
    },

    Dimensions: {
      get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
      addEventListener: () => noopSubscription,
      removeEventListener: () => {},
    },

    useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
    useColorScheme: () => 'dark',

    AccessibilityInfo: {
      isReduceMotionEnabled: vi.fn(async () => false),
      isScreenReaderEnabled: vi.fn(async () => false),
      isBoldTextEnabled: vi.fn(async () => false),
      announceForAccessibility: vi.fn(),
      addEventListener: () => noopSubscription,
    },

    // GameShell wires Android hardware back to ui.goBack(); the double records nothing
    // and returns a removable no-op so the subscription law stays exercised.
    BackHandler: {
      addEventListener: () => noopSubscription,
      removeEventListener: () => {},
      exitApp: () => {},
    },

    // the Daily's Offer-a-Candle note rides Alert.alert (the web's alert());
    // recorded so a render test can assert the press without native dialog chrome.
    Alert: { alert: vi.fn() },

    AppState: {
      currentState: 'active',
      addEventListener: () => noopSubscription,
      removeEventListener: () => {},
    },

    Animated: { View: host('Animated.View'), Text: host('Animated.Text') },
    PixelRatio: { get: () => 3, roundToNearestPixel: (n: number) => Math.round(n) },
  };
});

// react-native-svg ships Flow-typed source the rolldown transform cannot parse
// (the same law as react-native itself above): its primitives become host
// components. A render test proves the tree mounts and the props land; the SVG
// internals are Metro's business. Screens that import SvgUri (Cabinet, Ribbon…)
// stay component-testable through this double.
vi.mock('react-native-svg', async () => {
  const React = await import('react');
  const host = (name: string) => {
    const C = (props: Record<string, unknown>) => React.createElement(name, props);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    SvgUri: host('SvgUri'),
    SvgXml: host('SvgXml'),
    Svg: host('Svg'),
    Circle: host('Circle'),
    Rect: host('Rect'),
    Path: host('Path'),
    G: host('G'),
    Line: host('Line'),
  };
});

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async () => {}),
  selectionAsync: vi.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid', Soft: 'soft' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

vi.mock('expo-audio', () => ({
  createAudioPlayer: vi.fn(() => ({
    play: vi.fn(), pause: vi.fn(), remove: vi.fn(), seekTo: vi.fn(),
    volume: 1, loop: false, muted: false, currentTime: 0, duration: 0,
  })),
  setAudioModeAsync: vi.fn(async () => {}),
  AudioModule: {},
}));

vi.mock('expo-clipboard', () => ({
  setStringAsync: vi.fn(async () => true),
  getStringAsync: vi.fn(async () => ''),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(async () => false),
  shareAsync: vi.fn(async () => {}),
}));

vi.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' }, document: { uri: 'file:///document/' } },
  File: class {
    create() {}
    write() {}
    text() { return ''; }
    delete() {}
    exists() { return false; }
  },
}));

vi.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: vi.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    setItemAsync: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
    deleteItemAsync: vi.fn(async (k: string) => { store.delete(k); }),
    isAvailableAsync: vi.fn(async () => true),
  };
});

// expo-crypto: the recovery-code law needs a REAL SHA-256, so only the random
// helpers are doubled - Node's own crypto provides the digest.
vi.mock('expo-crypto', async () => {
  const nodeCrypto = await import('node:crypto');
  const bytes = (n: number): Uint8Array => {
    const b = new Uint8Array(n);
    nodeCrypto.randomFillSync(b);
    return b;
  };
  return {
    __esModule: true,
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomBytes: (n: number) => bytes(n),
    getRandomBytesAsync: async (n: number) => bytes(n),
    digestStringAsync: async (algo: string, data: string) =>
      nodeCrypto.createHash(algo.replace('-', '').toLowerCase()).update(data).digest('hex'),
    randomUUID: () => {
      const b = bytes(16);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    },
  };
});

// MMKV v4 / Nitro are native-only. Mirrors the jest double exactly.
// MMKV v4 / Nitro are native-only. Mirrors the jest double exactly.
// NOTE: storage.ts reaches this through a DYNAMIC import inside a probe, which is why
// the factory below must be a real module shape and not a bare object.
vi.mock('react-native-mmkv', () => {
  const store = new Map<string, unknown>();
  const inst = (id: string) => ({
    id,
    set: (k: string, v: unknown) => { store.set(`${id}:${k}`, v); },
    getString: (k: string) => { const v = store.get(`${id}:${k}`); return typeof v === 'string' ? v : undefined; },
    getNumber: (k: string) => { const v = store.get(`${id}:${k}`); return typeof v === 'number' ? v : undefined; },
    getBoolean: (k: string) => { const v = store.get(`${id}:${k}`); return typeof v === 'boolean' ? v : undefined; },
    contains: (k: string) => store.has(`${id}:${k}`),
    remove: (k: string) => store.delete(`${id}:${k}`),
    clearAll: () => { for (const k of [...store.keys()]) if (k.startsWith(`${id}:`)) store.delete(k); },
    getAllKeys: () => [...store.keys()].filter((k) => k.startsWith(`${id}:`)).map((k) => k.slice(id.length + 1)),
    trim: () => {},
  });
  return {
    __esModule: true,
    __store: store,
    createMMKV: vi.fn((config?: { id?: string }) => inst(config?.id ?? 'mmkv.default')),
    existsMMKV: vi.fn(() => true),
    deleteMMKV: vi.fn(),
  };
});

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(async () => ({
    execAsync: vi.fn(async () => {}),
    runAsync: vi.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
    getAllAsync: vi.fn(async () => []),
    getFirstAsync: vi.fn(async () => null),
    withTransactionAsync: vi.fn(async (fn: () => unknown) => fn()),
    closeSync: vi.fn(),
  })),
}));

// AsyncStorage fallback path (used when MMKV's native side is unavailable).
vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: vi.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
      setItem: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
      removeItem: vi.fn(async (k: string) => { store.delete(k); }),
      removeMany: vi.fn(async (ks: string[]) => { for (const k of ks) store.delete(k); }),
      getAllKeys: vi.fn(async () => [...store.keys()]),
      getMany: vi.fn(async (ks: string[]) => Object.fromEntries(ks.map((k) => [k, store.get(k) ?? null]))),
      setMany: vi.fn(async (e: Record<string, string>) => { for (const [k, v] of Object.entries(e)) store.set(k, v); }),
      clear: vi.fn(async () => { store.clear(); }),
    },
  };
});

// socket.io has no business in a logic test.
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(), onAny: vi.fn(), emit: vi.fn(), close: vi.fn(),
    connected: false, id: undefined,
  })),
}));
