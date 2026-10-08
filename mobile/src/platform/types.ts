// ASSIZE mobile — the platform seams.
//
// Every browser API the web build used that React Native does not have is replaced by
// one of the interfaces below. Code imports the interface, never a global, so the
// runtime implementation can change (MMKV -> AsyncStorage, expo-audio -> a WebAudio
// clone) without touching a single call site.
//
// Rationale and the full 18-item inventory: specs/14-deep-codebase-analysis.md §3.

// ---------------------------------------------------------------- storage
/**
 * The exact shape of the web build's `src/state/idb.ts` (idbGet/idbSet/idbDel/
 * idbClearAll) generalised to a document store + a key store. The save, the identity
 * and the echo ring all speak only this.
 */
export interface PlatformStorage {
  /** Read a JSON value. Resolves `undefined` when absent. Never throws on a read. */
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  /** Write a JSON value. */
  set(store: StoreName, key: string, value: unknown): Promise<void>;
  /** Delete one key. */
  del(store: StoreName, key: string): Promise<void>;
  /** Wipe every store (the Settings "un-write the ledger" action). */
  clearAll(): Promise<void>;
  /** Every key in a store, ascending. Used by the echo ring. */
  keys(store: StoreName): Promise<string[]>;
}

export const STORES = ['identity', 'save', 'duels', 'notes'] as const;
export type StoreName = (typeof STORES)[number];

// ---------------------------------------------------------------- secrets
/**
 * Keychain / Keystore. The guest secret and the recovery hash are the only two
 * values that must never sit in plain MMKV.
 */
export interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

// ---------------------------------------------------------------- audio
/**
 * The web build's `synth` surface, verbatim — every method, enumerated by grepping
 * every call site in src/. Reimplement it; do not redesign it. Every method must be
 * a no-op (never a throw) before `unlock()` and when audio is unavailable: the game
 * is fully playable silent.
 */
export interface AudioBackend {
  /** iOS/Android require a user gesture before audio. Called from the first tap. */
  unlock(): void;

  // one-shots
  place(): void;
  wrong(): void;
  pencil(): void;
  error(): void;
  uiTap(): void;
  pageTurn(): void;
  stamp(): void;
  claimWon(): void;
  claimLost(): void;
  statusApplied(): void;
  statusEnded(): void;
  padlock(): void;
  orderSwap(): void;
  cast(index: number): void;
  victory(): void;
  defeat(): void;
  draw(): void;
  /** S10 — the Reliquary chest ritual (web synth.reliquary; Reliquary/Cabinet/Ledger). */
  reliquary(): void;

  // continuous
  /** Tension 0..1 from the Seals gap; drives the ambient bed's intensity. */
  tickMusic(tension: number): void;
  /** J4 heat 0..1; drives the gallery murmur gain. */
  setHeat(heat: number): void;

  setMuted(muted: boolean): void;
  muted(): boolean;
  setVolumes(music: number, fx: number): void;
}

// ---------------------------------------------------------------- haptics
/**
 * The web build used `navigator.vibrate(...)` in 6 places with three distinct
 * patterns: a 60 ms mistake tick, a 40 ms clean-claim tick, a [30,50,90] pattern for
 * an Order swap, plus 30 ms on a status landing. Those become semantic methods so
 * the platform mapping lives in exactly one file.
 */
export interface Haptics {
  /** a digit landed (light) */
  tick(): void;
  /** a claim broke a Seal (medium); `clean` adds a second pulse */
  claim(clean: boolean): void;
  /** a mistake burned ink */
  mistake(): void;
  /** a rite landed on the foe */
  status(): void;
  /** an Order was set aside mid-duel (the T4 pattern) */
  orderSwap(): void;
  /** boss phase entry / duel end */
  impact(): void;
}

// ---------------------------------------------------------------- clipboard & files
export interface ClipboardPort {
  copy(text: string): Promise<boolean>;
  read(): Promise<string>;
}

export interface SharePort {
  available(): Promise<boolean>;
  share(fileUri: string, mimeType?: string): Promise<void>;
  /** Write text to a cache file and return its uri (for the export flows). */
  writeTextFile(name: string, contents: string): Promise<string>;
}

// ---------------------------------------------------------------- display settings
export interface DisplaySettings {
  /** 's' | 'm' | 'l' — the shipped text-size setting */
  text: 's' | 'm' | 'l';
  contrast: boolean;
  reducedMotion: boolean;
  leftHand: boolean;
  /** the OS-level Reduce Motion switch, OR-ed with the in-game setting */
  systemReducedMotion: boolean;
  /** true when EITHER reduced-motion source is on — the single check animations use */
  motionReduced(): boolean;
}
