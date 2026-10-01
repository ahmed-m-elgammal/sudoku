// ASSIZE synth — every sound is synthesized with WebAudio (spec §10). No audio files exist.
// Music: low detuned-saw drone through a slow filter, sparse bowed tones, tension layer under 3 Seals.
'use client';

type Ctx = AudioContext & { unlock?: boolean };

class Synth {
  private ctx: Ctx | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private fxBus!: GainNode;
  private droneNodes: { osc: OscillatorNode[]; filter: BiquadFilterNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  private tensionGain!: GainNode;
  private murmurGain: GainNode | null = null; // J4 — the gallery murmur bed
  private murmurStarted = false;
  private pendingHeat = 0;
  private nextBowAt = 0;
  musicVol = 0.3;
  fxVol = 0.7;
  muted = false;
  private unlocked = false;

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC() as Ctx;
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVol;
    this.musicBus.connect(this.master);
    this.fxBus = ctx.createGain();
    this.fxBus.gain.value = this.fxVol;
    this.fxBus.connect(this.master);
    this.tensionGain = ctx.createGain();
    this.tensionGain.gain.value = 0;
    this.tensionGain.connect(this.musicBus);
  }

  unlock() {
    this.init();
    if (this.ctx!.state === 'suspended') void this.ctx!.resume();
    if (!this.unlocked) { this.unlocked = true; this.startDrone(); }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }
  setMusic(v: number) { this.musicVol = v; if (this.ctx) this.musicBus.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.05); }
  setFx(v: number) { this.fxVol = v; if (this.ctx) this.fxBus.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.05); }

  private env(node: AudioNode, t0: number, a: number, d: number, peak = 1): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    node.connect(g);
    return g;
  }
  private tone(type: OscillatorType, freq: number, t0: number, a: number, d: number, peak = 0.5, dest?: AudioNode): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    const g = this.env(o, t0, a, d, peak);
    g.connect(dest ?? this.fxBus);
    o.start(t0);
    o.stop(t0 + a + d + 0.05);
    return o;
  }
  private noise(t0: number, dur: number, peak = 0.3, filterFreq = 3000, type: BiquadFilterType = 'bandpass'): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    src.connect(f);
    const g = this.env(f, t0, 0.004, dur, peak);
    g.connect(this.fxBus);
    return src;
  }

  // ------------------------------------------------------------- music
  private startDrone() {
    if (this.droneNodes || !this.ctx) return;
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0.16;
    const oscs = [55, 55.7, 82.4].map((f) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(filter);
      o.start();
      return o;
    });
    filter.connect(gain);
    gain.connect(this.musicBus);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.droneNodes = { osc: oscs, filter, gain, lfo };
    this.nextBowAt = ctx.currentTime + 2;
    this.startMurmur();
  }

  // J4 — the gallery murmur: a looping pinkish-noise bed whose gain follows the
  // duel's --heat law (synth.setHeat, same public-state derivation as the CSS var).
  // It rides musicBus, so mute and musicVol are inherited. A slow LFO breathes on
  // a series wobble gain — the BED moves, never the target, so heat 0 is silent.
  private startMurmur() {
    if (this.murmurStarted || !this.ctx) return;
    this.murmurStarted = true;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; // leaky-integrated white → pinkish
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = 0.4;
    const wobble = ctx.createGain();
    wobble.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.22;
    lfo.connect(lfoGain);
    lfoGain.connect(wobble.gain);
    this.murmurGain = ctx.createGain();
    this.murmurGain.gain.value = 0;
    src.connect(lp);
    lp.connect(wobble);
    wobble.connect(this.murmurGain);
    this.murmurGain.connect(this.musicBus);
    src.start();
    lfo.start();
    this.setHeat(this.pendingHeat); // a heat set before unlock applies now
  }

  // J4 — heat 0..1 from fx.ts's public-state law. Clamped, buffered pre-unlock,
  // smoothed ~0.9 s so claims swell the gallery rather than jump it.
  setHeat(h: number) {
    const v = Number.isFinite(h) ? Math.min(1, Math.max(0, h)) : 0;
    if (!this.ctx || !this.murmurGain) { this.pendingHeat = v; return; }
    this.murmurGain.gain.setTargetAtTime(v * 0.07, this.ctx.currentTime, 0.9);
  }

  // call each frame-ish: schedules sparse bowed tones + tension
  tickMusic(tension: number) {
    if (!this.ctx || !this.droneNodes) return;
    const ctx = this.ctx;
    this.tensionGain.gain.setTargetAtTime(Math.min(1, Math.max(0, tension)) * 0.5, ctx.currentTime, 1.5);
    if (ctx.currentTime >= this.nextBowAt) {
      this.nextBowAt = ctx.currentTime + 4 + Math.random() * 9;
      const scale = [196, 220, 233.1, 261.6, 293.7, 311.1];
      const f = scale[Math.floor(Math.random() * scale.length)];
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 8;
      o.connect(lp);
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06 + tension * 0.05, t + 1.4);
      g.gain.linearRampToValueAtTime(0.0001, t + 3.4);
      lp.connect(g);
      g.connect(this.tensionGain);
      o.start(t); o.stop(t + 3.6);
    }
  }

  // ------------------------------------------------------------- fx
  private t() { return this.ctx!.currentTime; }

  pencil() { if (!this.ctx) return; this.noise(this.t(), 0.06, 0.1, 5200, 'highpass'); }
  place() {
    if (!this.ctx) return;
    const t = this.t();
    this.tone('sine', 660, t, 0.005, 0.09, 0.28);
    this.tone('sine', 990, t + 0.012, 0.005, 0.07, 0.12);
  }
  wrong() {
    if (!this.ctx) return;
    const t = this.t();
    this.noise(t, 0.08, 0.4, 900, 'bandpass');           // dry crack
    this.tone('sine', 92, t + 0.03, 0.01, 0.28, 0.5);    // low thud
  }
  stamp() {
    if (!this.ctx) return;
    const t = this.t();
    this.noise(t, 0.12, 0.5, 300, 'lowpass');
    this.tone('sine', 70, t, 0.005, 0.2, 0.6);
  }
  sealBreak() {
    if (!this.ctx) return;
    const t = this.t();
    this.noise(t, 0.05, 0.5, 2400);
    this.noise(t + 0.05, 0.07, 0.35, 1600);
    this.tone('triangle', 220, t + 0.02, 0.004, 0.18, 0.2);
  }
  chain() {
    if (!this.ctx) return;
    const t = this.t();
    for (let i = 0; i < 4; i++) this.tone('square', 900 + i * 130 + Math.random() * 40, t + i * 0.05, 0.002, 0.05, 0.06);
    this.noise(t + 0.2, 0.05, 0.2, 4000, 'highpass');
  }
  padlock() { if (!this.ctx) return; const t = this.t(); this.tone('square', 1400, t, 0.002, 0.04, 0.12); this.tone('square', 900, t + 0.06, 0.002, 0.05, 0.1); }
  abilityReady() { if (!this.ctx) return; this.tone('sine', 1320, this.t(), 0.003, 0.14, 0.1); }
  statusApplied() {
    if (!this.ctx) return;
    const t = this.t();
    this.tone('sawtooth', 180, t, 0.01, 0.3, 0.12);
    this.tone('sawtooth', 171, t, 0.01, 0.3, 0.12);
  }
  statusEnded() {
    if (!this.ctx) return;
    const t = this.t();
    this.tone('sine', 520, t, 0.01, 0.16, 0.08);
    this.tone('sine', 780, t + 0.05, 0.01, 0.12, 0.06);
  }
  cast(kind: number) {
    if (!this.ctx) return;
    const t = this.t();
    const base = 340 + kind * 40;
    this.tone('triangle', base, t, 0.01, 0.16, 0.16);
    this.tone('triangle', base * 1.5, t + 0.07, 0.01, 0.2, 0.12);
  }
  claimWon() {
    if (!this.ctx) return;
    const t = this.t();
    [392, 523.3, 659.3].forEach((f, i) => this.tone('sine', f, t + i * 0.07, 0.01, 0.22, 0.14));
    this.stamp();
  }
  claimLost() {
    if (!this.ctx) return;
    const t = this.t();
    this.tone('sine', 311, t, 0.01, 0.2, 0.14);
    this.tone('sine', 233, t + 0.09, 0.01, 0.26, 0.14);
  }
  victory() {
    if (!this.ctx) return;
    const t = this.t();
    [261.6, 329.6, 392, 523.3].forEach((f, i) => this.tone('triangle', f, t + i * 0.14, 0.02, 0.5, 0.16));
    this.droneNodes?.gain.gain.setTargetAtTime(0.05, t, 0.5);
  }
  defeat() {
    if (!this.ctx) return;
    const t = this.t();
    [220, 207.7, 185, 146.8].forEach((f, i) => this.tone('triangle', f, t + i * 0.18, 0.02, 0.6, 0.14));
  }
  draw() {
    if (!this.ctx) return;
    const t = this.t();
    this.tone('sine', 261.6, t, 0.02, 0.5, 0.12);
    this.tone('sine', 261.6, t + 0.02, 0.02, 0.5, 0.12);
  }
  pageTurn() { if (!this.ctx) return; this.noise(this.t(), 0.16, 0.12, 2600, 'highpass'); }
  reliquary() {
    if (!this.ctx) return;
    const t = this.t();
    this.tone('square', 620, t, 0.003, 0.06, 0.08);
    this.noise(t + 0.25, 0.1, 0.3, 1200);
    [523.3, 659.3, 784].forEach((f, i) => this.tone('sine', f, t + 0.6 + i * 0.1, 0.01, 0.3, 0.1));
  }
  uiTap() { if (!this.ctx) return; this.tone('sine', 840, this.t(), 0.002, 0.04, 0.06); }
  error() { if (!this.ctx) return; const t = this.t(); this.tone('square', 160, t, 0.004, 0.12, 0.1); this.tone('square', 120, t + 0.07, 0.004, 0.12, 0.1); }
  // T4 — the Ninth sets one Order aside and takes up another: a bowed fall, a wax
  // crack, and a floor-drop boom. Meant to feel like the room tilting.
  orderSwap() {
    if (!this.ctx) return;
    const t = this.t();
    this.tone('sawtooth', 196, t, 0.02, 0.7, 0.16);
    this.tone('sawtooth', 130.8, t + 0.12, 0.02, 0.8, 0.15);
    this.tone('sine', 65.4, t + 0.28, 0.03, 1.1, 0.24);
    this.noise(t + 0.05, 0.4, 0.16, 500, 'lowpass');
    this.padlock();
  }
}

export const synth = new Synth();
