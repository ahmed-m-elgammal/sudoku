// ASSIZE mobile — the offline audio renderer (specs/07, the SETTLED decision).
//
//   node tools/render-audio.mjs
//     -> writes every sound the mobile AudioBackend plays into mobile/assets/audio/
//
// The web build's src/audio/synth.ts synthesizes everything at runtime through
// WebAudio (oscillators, biquads, gain envelopes). React Native has no AudioContext,
// and spec 07 settles the port: DELETE the graph, pre-render every sound to a file,
// and play the files through expo-audio with gain ramps. This script is that offline
// render: it re-implements the web graph's EXACT parameters (oscillator types and
// frequencies, envelope attack/decay times and peaks, biquad filter kinds/Q/frequencies,
// the drone's filter LFO, the J4 murmur's leaky-integrated pinkish noise and its
// wobble) sample by sample in plain Node, and writes 16-bit mono WAV.
//
// Fidelity notes, so the next audio change knows where it stands:
//   - One-shots are rendered at 44100 Hz (the pencil high-pass has content past 5 kHz).
//   - The three continuous beds are rendered at 22050 Hz — everything in them sits
//     under 1 kHz — and baked into SEAMLESS loops: render length L+F, then
//     out[i] = render[i]*w(i) + render[L+i]*(1-w(i)) with w ramping 0→1 over the F
//     seconds of fade. The head of the file IS the wrap content, so `loop=true`
//     repeats without a seam.
//   - The drone's filter LFO is 0.05 Hz — a 20 s period — so the drone loop is exactly
//     20 s. The murmur's wobble LFO is rendered at 0.125 Hz (period 8 s) instead of the
//     web's 0.13 Hz so the wobble closes over an integer loop; 0.005 Hz is inaudible
//     and the law (a bed that breathes, never the target) is unchanged.
//   - The tension layer's bowed tones are stochastic on the web (one bow every 4-13 s
//     from a 6-note scale, peak scaled by live tension). The loop bakes four bows from
//     that same scale and envelope at a fixed representative tension; the RUNTIME
//     `tickMusic(tension)` law still owns the loudness (gain ramps in platform/audio.ts),
//     so what survives is the web's material and envelope, not its scheduling.
//
// Every byte below is deterministic except the noise bursts (Math.random), whose
// character — not their exact samples — is what the sound law needs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'mobile', 'assets', 'audio');

// --------------------------------------------------------------------------- wav
function writeWav(name, samples, sampleRate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, name), buf);
  return (buf.length / 1024).toFixed(0);
}

const TAU = Math.PI * 2;

// An oscillator's sample at phase p (0..TAU), the WebAudio wavetable.
function oscSample(type, p) {
  const f = (p / TAU) % 1;
  switch (type) {
    case 'sine': return Math.sin(p);
    case 'square': return f < 0.5 ? 1 : -1;
    case 'sawtooth': return 2 * f - 1;
    case 'triangle': return 4 * Math.abs(f - 0.5) - 1;
    default: throw new Error(`unknown oscillator ${type}`);
  }
}

// Mix an oscillator into `buf` with the web env() law: exponential 0.0001 → peak over
// `a` seconds, exponential peak → 0.0001 over `d` seconds, starting at `t0`.
function tone(buf, sr, t0, type, freq, a, d, peak) {
  const start = Math.floor(t0 * sr);
  const attack = Math.floor(a * sr);
  const decay = Math.floor(d * sr);
  const total = attack + decay;
  let phase = 0;
  const step = TAU * freq / sr;
  for (let i = 0; i < total; i++) {
    const idx = start + i;
    if (idx >= buf.length) break;
    const g = i < attack
      ? 0.0001 * Math.pow(peak / 0.0001, i / attack)
      : peak * Math.pow(0.0001 / peak, (i - attack) / decay);
    buf[idx] += oscSample(type, phase) * g;
    phase += step;
  }
}

// RBJ biquad (the WebAudio BiquadFilterNode cookbook forms).
class Biquad {
  constructor(sr, type, freq, q) {
    this.sr = sr; this.type = type; this.q = q;
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
    this.setFreq(freq);
  }

  /** Retune in place — the drone's LFO moves the centre every sample, and the
   * filter STATE must carry across (recreating the node would zero it). */
  setFreq(freq) {
    const w0 = TAU * freq / this.sr;
    const s = Math.sin(w0);
    const c = Math.cos(w0);
    const alpha = s / (2 * this.q);
    let b0, b1, b2;
    switch (this.type) {
      case 'lowpass':
        b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; break;
      case 'highpass':
        b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; break;
      case 'bandpass': // 0 dB peak gain, the WebAudio default
        b0 = alpha; b1 = 0; b2 = -alpha; break;
      default: throw new Error(`unknown filter ${this.type}`);
    }
    const a0 = 1 + alpha, a1 = -2 * c, a2 = 1 - alpha;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  step(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// A noise burst: white noise → biquad → env(attack 0.004, decay dur), the web noise().
function noiseBurst(buf, sr, t0, dur, peak, filterFreq, filterType = 'bandpass', q = 1) {
  const start = Math.floor(t0 * sr);
  const total = Math.floor((0.004 + dur) * sr);
  const f = new Biquad(sr, filterType, filterFreq, q);
  for (let i = 0; i < total; i++) {
    const idx = start + i;
    if (idx >= buf.length) break;
    const g = i < 0.004 * sr
      ? 0.0001 * Math.pow(peak / 0.0001, i / (0.004 * sr))
      : peak * Math.pow(0.0001 / peak, (i - 0.004 * sr) / (dur * sr));
    buf[idx] += f.step(Math.random() * 2 - 1) * g;
  }
}

// The seamless-loop bake (see the fidelity notes above).
function bakeLoop(rendered, loopSeconds, fadeSeconds, sr) {
  const L = Math.floor(loopSeconds * sr);
  const F = Math.floor(fadeSeconds * sr);
  const out = new Float64Array(L);
  for (let i = 0; i < L; i++) {
    if (i < F) {
      const w = i / F; // 0 → 1 across the fade
      out[i] = rendered[L + i] * (1 - w) + rendered[i] * w;
    } else {
      out[i] = rendered[i];
    }
  }
  return out;
}

// --------------------------------------------------------------------- one-shots
// Every builder mirrors one synth.ts method param-for-param. `t` is always 0 — the
// web plays each at ctx.currentTime; a file needs no clock.
const S = 44100;

const oneShots = {
  // pencil: high-passed tick of the quill
  'pencil.wav': (b, sr) => noiseBurst(b, sr, 0, 0.06, 0.1, 5200, 'highpass'),
  // place: a soft double sine, the digit landing
  'place.wav': (b, sr) => {
    tone(b, sr, 0, 'sine', 660, 0.005, 0.09, 0.28);
    tone(b, sr, 0.012, 'sine', 990, 0.005, 0.07, 0.12);
  },
  // wrong: a dry crack and the low thud of burned ink
  'wrong.wav': (b, sr) => {
    noiseBurst(b, sr, 0, 0.08, 0.4, 900, 'bandpass');
    tone(b, sr, 0.03, 'sine', 92, 0.01, 0.28, 0.5);
  },
  // stamp: the wax slam
  'stamp.wav': (b, sr) => {
    noiseBurst(b, sr, 0, 0.12, 0.5, 300, 'lowpass');
    tone(b, sr, 0, 'sine', 70, 0.005, 0.2, 0.6);
  },
  // claimWon: the rising third + the stamp underneath
  'claim-won.wav': (b, sr) => {
    [392, 523.3, 659.3].forEach((f, i) => tone(b, sr, i * 0.07, 'sine', f, 0.01, 0.22, 0.14));
    oneShots['stamp.wav'](b, sr);
  },
  // claimLost: the falling second
  'claim-lost.wav': (b, sr) => {
    tone(b, sr, 0, 'sine', 311, 0.01, 0.2, 0.14);
    tone(b, sr, 0.09, 'sine', 233, 0.01, 0.26, 0.14);
  },
  // statusApplied: the dissonant saw pair of a status landing
  'status-applied.wav': (b, sr) => {
    tone(b, sr, 0, 'sawtooth', 180, 0.01, 0.3, 0.12);
    tone(b, sr, 0, 'sawtooth', 171, 0.01, 0.3, 0.12);
  },
  // statusEnded: its release
  'status-ended.wav': (b, sr) => {
    tone(b, sr, 0, 'sine', 520, 0.01, 0.16, 0.08);
    tone(b, sr, 0.05, 'sine', 780, 0.01, 0.12, 0.06);
  },
  // padlock: the locked-cell clack
  'padlock.wav': (b, sr) => {
    tone(b, sr, 0, 'square', 1400, 0.002, 0.04, 0.12);
    tone(b, sr, 0.06, 'square', 900, 0.002, 0.05, 0.1);
  },
  // orderSwap: the bowed fall, the wax crack, the floor drop (T4)
  'order-swap.wav': (b, sr) => {
    tone(b, sr, 0, 'sawtooth', 196, 0.02, 0.7, 0.16);
    tone(b, sr, 0.12, 'sawtooth', 130.8, 0.02, 0.8, 0.15);
    tone(b, sr, 0.28, 'sine', 65.4, 0.03, 1.1, 0.24);
    noiseBurst(b, sr, 0.05, 0.4, 0.16, 500, 'lowpass');
    oneShots['padlock.wav'](b, sr);
  },
  // cast(kind): the rite's two-note rise; base = 340 + kind*40, four variants
  'cast-0.wav': (b, sr) => { tone(b, sr, 0, 'triangle', 340, 0.01, 0.16, 0.16); tone(b, sr, 0.07, 'triangle', 510, 0.01, 0.2, 0.12); },
  'cast-1.wav': (b, sr) => { tone(b, sr, 0, 'triangle', 380, 0.01, 0.16, 0.16); tone(b, sr, 0.07, 'triangle', 570, 0.01, 0.2, 0.12); },
  'cast-2.wav': (b, sr) => { tone(b, sr, 0, 'triangle', 420, 0.01, 0.16, 0.16); tone(b, sr, 0.07, 'triangle', 630, 0.01, 0.2, 0.12); },
  'cast-3.wav': (b, sr) => { tone(b, sr, 0, 'triangle', 460, 0.01, 0.16, 0.16); tone(b, sr, 0.07, 'triangle', 690, 0.01, 0.2, 0.12); },
  // victory: the rising triad, brass-bright triangle
  'victory.wav': (b, sr) => {
    [261.6, 329.6, 392, 523.3].forEach((f, i) => tone(b, sr, i * 0.14, 'triangle', f, 0.02, 0.5, 0.16));
  },
  // defeat: the falling line
  'defeat.wav': (b, sr) => {
    [220, 207.7, 185, 146.8].forEach((f, i) => tone(b, sr, i * 0.18, 'triangle', f, 0.02, 0.6, 0.14));
  },
  // draw: the doubled unison
  'draw.wav': (b, sr) => {
    tone(b, sr, 0, 'sine', 261.6, 0.02, 0.5, 0.12);
    tone(b, sr, 0.02, 'sine', 261.6, 0.02, 0.5, 0.12);
  },
  // pageTurn: a folio's page
  'page-turn.wav': (b, sr) => noiseBurst(b, sr, 0, 0.16, 0.12, 2600, 'highpass'),
  // reliquary: the chest ritual — click, crack, three rising sines (S10)
  'reliquary.wav': (b, sr) => {
    tone(b, sr, 0, 'square', 620, 0.003, 0.06, 0.08);
    noiseBurst(b, sr, 0.25, 0.1, 0.3, 1200, 'bandpass');
    [523.3, 659.3, 784].forEach((f, i) => tone(b, sr, 0.6 + i * 0.1, 'sine', f, 0.01, 0.3, 0.1));
  },
  // uiTap: the quietest voice in the game
  'ui-tap.wav': (b, sr) => tone(b, sr, 0, 'sine', 840, 0.002, 0.04, 0.06),
  // error: the refused action
  'error.wav': (b, sr) => {
    tone(b, sr, 0, 'square', 160, 0.004, 0.12, 0.1);
    tone(b, sr, 0.07, 'square', 120, 0.004, 0.12, 0.1);
  },
};

// How long each rendered buffer must be: the latest event plus its release tail.
const ONE_SHOT_SECONDS = {
  'pencil.wav': 0.25, 'place.wav': 0.3, 'wrong.wav': 0.5, 'stamp.wav': 0.45,
  'claim-won.wav': 0.8, 'claim-lost.wav': 0.6, 'status-applied.wav': 0.5,
  'status-ended.wav': 0.45, 'padlock.wav': 0.3, 'order-swap.wav': 1.7,
  'cast-0.wav': 0.5, 'cast-1.wav': 0.5, 'cast-2.wav': 0.5, 'cast-3.wav': 0.5,
  'victory.wav': 2.3, 'defeat.wav': 2.5, 'draw.wav': 0.9, 'page-turn.wav': 0.4,
  'reliquary.wav': 1.4, 'ui-tap.wav': 0.15, 'error.wav': 0.4,
};

// ------------------------------------------------------------------------ loops
const SR_LOOP = 22050;

// The courtroom drone: three detuned saws (55 / 55.7 / 82.4) through a lowpass at
// 220 Hz (Q 0.6) whose centre breathes ±90 Hz on a 0.05 Hz LFO, at bed gain 0.16.
// Loop = exactly one LFO period (20 s), 2 s crossfade.
function renderDrone(seconds, sr) {
  const n = Math.floor(seconds * sr);
  const buf = new Float64Array(n);
  const step = [TAU * 55 / sr, TAU * 55.7 / sr, TAU * 82.4 / sr];
  const phase = [0, 0, 0];
  const filter = new Biquad(sr, 'lowpass', 220, 0.6);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // the LFO breathes the filter's centre frequency; the filter's state carries
    filter.setFreq(220 + 90 * Math.sin(TAU * 0.05 * t));
    let x = 0;
    for (let k = 0; k < 3; k++) {
      x += oscSample('sawtooth', phase[k]);
      phase[k] += step[k];
    }
    buf[i] = filter.step(x / 3) * 0.16;
  }
  return buf;
}

// The gallery murmur (J4): leaky-integrated white noise → pinkish bed → lowpass
// 480 (Q 0.4) → a wobble gain breathing on a 0.125 Hz LFO (±0.22). The bed MOVES;
// heat rides the runtime gain. Loop = one wobble period (8 s), 1 s crossfade.
function renderMurmur(seconds, sr) {
  const n = Math.floor(seconds * sr);
  const buf = new Float64Array(n);
  const lp = new Biquad(sr, 'lowpass', 480, 0.4);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
    const wobble = 1 + 0.22 * Math.sin(TAU * 0.125 * t);
    buf[i] = lp.step(last * 3.2) * wobble;
  }
  return buf;
}

// The tension layer: sparse bowed saws from the web's six-note scale, lowpass 900
// (Q 8), linear swell 1.4 s → release to 3.4 s (the web's linearRamp law), baked at
// a representative tension of 0.3 → peak 0.075. Loop 26 s, 2 s crossfade; four bows
// so the density matches the web's 4-13 s scheduler at mid tension.
function renderTension(seconds, sr) {
  const n = Math.floor(seconds * sr);
  const buf = new Float64Array(n);
  const scale = [196, 220, 233.1, 261.6, 293.7, 311.1];
  const bows = [2, 8.5, 15, 23.5]; // the last bow's tail crosses the seam — by design
  const lp = new Biquad(sr, 'lowpass', 900, 8);
  let phase = 0;
  const stepNote = TAU * scale[0] / sr; // rewritten per-sample below
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let env = 0;
    for (const t0 of bows) {
      const dt = t - t0;
      if (dt >= 0 && dt <= 3.4) {
        env = Math.max(env, dt < 1.4 ? 0.0001 + (0.075 - 0.0001) * (dt / 1.4) : 0.075 + (0.0001 - 0.075) * ((dt - 1.4) / 2));
      }
    }
    const f = scale[Math.floor(t / 6.5) % scale.length]; // one note per bow window
    if (env > 0) {
      buf[i] += lp.step(oscSample('sawtooth', phase)) * env;
      phase += TAU * f / sr;
    } else {
      phase += TAU * f / sr;
    }
  }
  void stepNote;
  return buf;
}

// --------------------------------------------------------------------------- run
fs.mkdirSync(OUT, { recursive: true });
const kb = {};
for (const [name, build] of Object.entries(oneShots)) {
  const sr = S;
  const buf = new Float64Array(Math.ceil(ONE_SHOT_SECONDS[name] * sr));
  build(buf, sr);
  kb[name] = writeWav(name, buf, sr);
}

const drone = bakeLoop(renderDrone(22, SR_LOOP), 20, 2, SR_LOOP);
kb['drone-loop.wav'] = writeWav('drone-loop.wav', drone, SR_LOOP);
const murmur = bakeLoop(renderMurmur(9, SR_LOOP), 8, 1, SR_LOOP);
kb['murmur-loop.wav'] = writeWav('murmur-loop.wav', murmur, SR_LOOP);
const tension = bakeLoop(renderTension(28, SR_LOOP), 26, 2, SR_LOOP);
kb['tension-loop.wav'] = writeWav('tension-loop.wav', tension, SR_LOOP);

console.log(`rendered ${Object.keys(kb).length} files into mobile/assets/audio/`);
for (const [name, size] of Object.entries(kb)) console.log(`  ${name.padEnd(22)} ${size} KB`);
