// audio.test.ts — the AudioBackend contract, end to end against the expo-audio double.
//
// The contract (specs/16 A1, ./types): 18 methods + unlock/setMuted/muted/setVolumes;
// never throws; every method is a no-op before unlock(); tickMusic and setHeat drive
// the continuous beds through the gain law; mute lands instantly. The runner's
// expo-audio double (vitest.setup.ts) records the machinery, so these tests prove
// what a real device would hear: which players exist, which are looping, and what
// their volumes are doing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { audio, audioState, __resetAudioForTests } from '@/platform/audio';
import { DRONE_GAIN, MURMUR_CEIL, TENSION_CEIL } from '@/platform/gainLaw';

type PlayerDouble = {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  volume: number;
  loop: boolean;
};

const createPlayer = vi.mocked(createAudioPlayer);
const setMode = vi.mocked(setAudioModeAsync);

function players(): PlayerDouble[] {
  return createPlayer.mock.results.map((r) => r.value as PlayerDouble);
}

beforeEach(() => {
  __resetAudioForTests();
  createPlayer.mockClear();
  createPlayer.mock.results.length = 0;
  setMode.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('before unlock — the silent-but-safe contract', () => {
  it('creates no players and applies no audio mode', () => {
    audio.place();
    audio.tickMusic(0.5);
    audio.setHeat(0.5);
    audio.setMuted(true);
    audio.setVolumes(0.5, 0.5);
    expect(createPlayer).not.toHaveBeenCalled();
    expect(setMode).not.toHaveBeenCalled();
  });

  it('every one-shot and every state read is a safe no-op', () => {
    expect(() => {
      audio.place(); audio.wrong(); audio.pencil(); audio.error(); audio.uiTap();
      audio.pageTurn(); audio.stamp(); audio.claimWon(); audio.claimLost();
      audio.statusApplied(); audio.statusEnded(); audio.padlock(); audio.orderSwap();
      audio.cast(2); audio.victory(); audio.defeat(); audio.draw(); audio.reliquary();
    }).not.toThrow();
    expect(createPlayer).not.toHaveBeenCalled();
    expect(audio.muted()).toBe(false);
    expect(audioState().unlocked).toBe(false);
  });
});

describe('unlock — the first gesture', () => {
  it('raises the audio mode, starts the three beds looping, and is idempotent', () => {
    audio.unlock();
    expect(setMode).toHaveBeenCalledTimes(1);
    expect(setMode).toHaveBeenCalledWith({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
    expect(createPlayer).toHaveBeenCalledTimes(3);
    const beds = players();
    expect(beds.map((p) => p.loop)).toEqual([true, true, true]);
    expect(beds.map((p) => p.play.mock.calls.length)).toEqual([1, 1, 1]);
    audio.unlock();
    audio.unlock();
    expect(createPlayer).toHaveBeenCalledTimes(3); // the beds are created once
  });

  it('opens the drone at the web bed gain under the default music volume', () => {
    audio.unlock();
    const drone = players()[0];
    expect(drone.volume).toBeCloseTo(DRONE_GAIN * 0.3, 12); // default musicVol 0.3
  });

  it('opens the tension and murmur beds SILENT (they ride their cues)', () => {
    audio.unlock();
    expect(players()[1].volume).toBe(0);
    expect(players()[2].volume).toBe(0);
  });

  it('degrades to silence when the native module is gone — never throws', () => {
    createPlayer.mockImplementationOnce(() => { throw new Error('native module is null'); });
    expect(() => audio.unlock()).not.toThrow();
    expect(audioState().degraded).toBe(true);
    // and the game keeps calling the backend freely afterwards
    expect(() => { audio.place(); audio.tickMusic(0.4); audio.unlock(); }).not.toThrow();
  });
});

describe('one-shots — the fx bus', () => {
  it('plays a voice at fxVol and restarts it from zero on retrigger', () => {
    audio.unlock();
    audio.setVolumes(0.3, 0.7);
    audio.place();
    audio.place();
    const place = players()[3]; // after the three beds
    expect(place.play).toHaveBeenCalledTimes(2);
    expect(place.seekTo).toHaveBeenCalledWith(0);
    expect(place.volume).toBeCloseTo(0.7, 12);
    expect(createPlayer).toHaveBeenCalledTimes(4); // one voice, reused
  });

  it('cast(kind) folds onto the four rendered variants, one voice per variant', () => {
    audio.unlock();
    audio.cast(0);
    audio.cast(3);
    audio.cast(4); // folds to variant 0 — the SAME voice as cast(0), restarted
    expect(createPlayer).toHaveBeenCalledTimes(3 + 2); // beds + cast0 + cast3
    const cast0 = players()[3];
    expect(cast0.play).toHaveBeenCalledTimes(2); // variant 0 fired twice
  });

  it('a muted trigger is silent at the moment of the call', () => {
    audio.unlock();
    audio.setMuted(true);
    audio.victory();
    expect(players()[3].volume).toBe(0);
  });
});

describe('tickMusic / setHeat — the continuous laws', () => {
  it('retargets the tension bed toward tension*0.5*musicVol', () => {
    vi.useFakeTimers();
    audio.unlock();
    audio.setVolumes(1, 1);
    audio.tickMusic(1);
    vi.advanceTimersByTime(1500);
    const tension = players()[1];
    expect(tension.volume).toBeGreaterThan(0.3); // well on its way to 0.5
    expect(tension.volume).toBeLessThanOrEqual(TENSION_CEIL);
  });

  it('retargets the murmur toward heat*0.07 — full heat is a murmur, not a roar', () => {
    vi.useFakeTimers();
    audio.unlock();
    audio.setVolumes(1, 1);
    audio.setHeat(1);
    vi.advanceTimersByTime(5000);
    const murmur = players()[2];
    expect(murmur.volume).toBeCloseTo(MURMUR_CEIL, 2);
    expect(murmur.volume).toBeLessThanOrEqual(MURMUR_CEIL);
  });

  it('heat 0 keeps the murmur silent', () => {
    vi.useFakeTimers();
    audio.unlock();
    audio.setVolumes(1, 1);
    audio.setHeat(0);
    vi.advanceTimersByTime(2000);
    expect(players()[2].volume).toBeCloseTo(0, 12);
  });
});

describe('mute and volumes — the bus law', () => {
  it('setMuted lands instantly on every bed', () => {
    audio.unlock();
    audio.setVolumes(1, 1);
    audio.setMuted(true);
    expect(players().map((p) => p.volume)).toEqual([0, 0, 0]);
    audio.setMuted(false);
    expect(players()[0].volume).toBeCloseTo(DRONE_GAIN, 12);
  });

  it('setVolumes rescales the beds and clamps hostile input', () => {
    audio.unlock();
    audio.setVolumes(2, -1);
    expect(players()[0].volume).toBeCloseTo(DRONE_GAIN, 12);
    expect(audioState().musicVol).toBe(1);
    expect(audioState().fxVol).toBe(0);
  });
});

describe('the state view', () => {
  it('tracks the continuous state the web kept private', () => {
    audio.unlock();
    audio.tickMusic(0.25);
    audio.setHeat(0.5);
    const s = audioState();
    expect(s.lastTension).toBeCloseTo(0.25, 12);
    expect(s.lastHeat).toBeCloseTo(0.5, 12);
    expect(s.unlocked).toBe(true);
    expect(s.degraded).toBe(false);
    expect(s.musicVol).toBe(0.3);
    expect(s.fxVol).toBe(0.7);
  });

  it('tickMusic clamps out-of-range tension before storing it', () => {
    audio.tickMusic(9);
    expect(audioState().lastTension).toBe(1);
    audio.tickMusic(NaN);
    expect(audioState().lastTension).toBe(0);
  });
});
