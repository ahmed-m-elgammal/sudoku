// Seeded, deterministic RNG (mulberry32) — spec R6: pure deterministic engine.
export class Rng {
  private s: number;
  constructor(seed: string | number) {
    if (typeof seed === 'number') this.s = seed >>> 0;
    else {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
      this.s = h >>> 0;
    }
    if (this.s === 0) this.s = 0x9E3779B9;
  }
  next(): number {
    let a = this.s;
    a = (a + 0x6D2B79F5) | 0;
    this.s = a;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(maxExclusive: number): number { return Math.floor(this.next() * maxExclusive); }
  range(min: number, maxInclusive: number): number { return min + this.int(maxInclusive - min + 1); }
  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]; }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  // uint32 contract: the state is serialized with the duel (spec R6) and must stay
  // in [0, 2^32) — the raw internal register is signed after `| 0` arithmetic
  get state(): number { return this.s >>> 0; }
  set state(v: number) { this.s = v >>> 0; }
}

export const todayUtcKey = (d = new Date()): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
