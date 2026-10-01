// ServerDuel — client mirror of an authoritative server duel (spec §6: predict + reconcile).
// Implements the same surface as LocalDuel so DuelScreen renders both identically.
// The solution never reaches the client in PvP; placements round-trip through the server.
'use client';
import type { AbilityId, Digit, DuelState, PlayerId } from '@shared/config';
import { createDuel } from '@shared/engine';
import { proto, net } from '@/net/client';
import { synth } from '@/audio/synth';

export interface ServerDuelInit {
  duelId: string;
  seat: PlayerId;
  givens: number[];
  foeName: string;
  myName: string;
  myOrder: 'scholar' | 'executioner' | 'apothecary' | 'warden';
  foeOrder: 'scholar' | 'executioner' | 'apothecary' | 'warden';
}

export class ServerDuel {
  state: DuelState;
  opts: { duelId: string; seat: PlayerId; onEnd?: (r: { winner: PlayerId | 'draw'; reason: string }) => void };
  notes = new Map<number, Set<number>>();
  selected: number | null = null;
  pencil = false;
  lastWrong: number | null = null;
  lastWrongCell = -1;
  lastWrongDigit = 0;
  lastWrongClearAt = 0;
  wrongVariant = 0;
  paused = false;
  ended = false;
  version = 0;
  private listeners = new Set<() => void>();
  private unsubs: Array<() => void> = [];
  tutorialStep = 0;
  pencilUsedOnce = false;
  claimedOnce = false;
  freeAugurGranted = false;
  mode = 'server' as const;

  constructor(init: ServerDuelInit) {
    this.opts = { duelId: init.duelId, seat: init.seat };
    const seat = init.seat;
    this.state = createDuel({
      seed: init.duelId,
      givens: Uint8Array.from(init.givens),
      solution: null, // never sent in PvP (spec §6 anticheat)
      names: seat === 0 ? [init.myName, init.foeName] : [init.foeName, init.myName],
      orders: seat === 0 ? [init.myOrder, init.foeOrder] : [init.foeOrder, init.myOrder],
    });
    // join/reconnect with the token
    proto.joinDuel(init.duelId, localStorage.getItem('assize-secret') ?? '');

    this.unsubs.push(
      net.on('you', (p) => this.applyYou(p)),
      net.on('end', (p) => {
        const e = p as { winner?: PlayerId | 'draw'; reason?: string; ratingDelta?: number | null };
        this.applyEnd(e.winner ?? 'draw', e.reason ?? '', e.ratingDelta ?? null);
      }),
    );
    // TODO(T2): wire the 20s disconnect countdown modal to server 'reconnect_grace' events.
    net.on('reconnect_ok', (p) => this.applyYou((p as { you: unknown }).you));
  }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.version;
  private bump() { this.version++; this.listeners.forEach((l) => l()); }
  bumpPublic() { this.bump(); }

  // server 'you' payload -> local mirror (spec protocol: state_delta/claim/status/end)
  private applyYou(p: unknown) {
    const d = p as {
      you: {
        seat: number; seals: number; board: number[]; progress: number; mistakes: number;
        abilities: Record<string, { cdLeftMs: number; usedOnce: boolean; usesLeft: number | null }>;
        statuses: DuelState['players'][0]['statuses']; immuneUntil: Record<string, number>;
        claimed: string[]; reckoningUntilMs: number; wardUntilMs: number; mirrorUntilMs: number;
      };
      foe: { name: string; seals: number; progress: number; board: number[]; claimed: string[]; statuses: DuelState['players'][0]['statuses'] };
      unitOwner: Record<string, number>;
      clockMs: number; phase: string; events: Array<Record<string, unknown>>; eventSeq: number;
    };
    if (!d?.you) return;
    const st = this.state;
    const mySeat = this.opts.seat;
    const me = st.players[mySeat];
    const foe = st.players[mySeat === 0 ? 1 : 0];
    const prevSeals = me.seals;
    const prevFoeSeals = foe.seals;
    me.board = Uint8Array.from(d.you.board);
    me.seals = d.you.seals;
    me.progress = d.you.progress;
    me.mistakes = d.you.mistakes;
    me.abilities = d.you.abilities;
    me.statuses = d.you.statuses;
    me.immuneUntil = d.you.immuneUntil;
    me.claimed = d.you.claimed;
    me.reckoningUntilMs = d.you.reckoningUntilMs;
    me.wardUntilMs = d.you.wardUntilMs;
    me.mirrorUntilMs = d.you.mirrorUntilMs;
    foe.board = Uint8Array.from(d.foe.board);
    foe.seals = d.foe.seals;
    foe.progress = d.foe.progress;
    foe.claimed = d.foe.claimed;
    foe.statuses = d.foe.statuses;
    st.unitOwner = d.unitOwner;
    st.clockMs = d.clockMs;
    st.phase = d.phase === 'ended' ? 'ended' : 'live';
    // sfx on transitions
    if (me.seals < prevSeals) synth.wrong();
    if (foe.seals < prevFoeSeals) { synth.stamp(); synth.claimWon(); }
    const newClaim = me.claimed.length + foe.claimed.length;
    void newClaim;
    if (d.you.statuses.length > (this.prevStatusCount ?? 0)) synth.statusApplied();
    this.prevStatusCount = d.you.statuses.length;
    st.events = d.events as unknown as DuelState['events'];
    st.eventSeq = d.eventSeq;
    this.bump();
  }
  private prevStatusCount = 0;
  lastRatingDelta: number | null = null;

  private applyEnd(winner: PlayerId | 'draw', reason: string, ratingDelta: number | null = null) {
    if (this.ended) return;
    this.ended = true;
    const mySeat = this.opts.seat;
    const mapped = winner === 'draw' ? 'draw' : winner === mySeat ? 0 : 1;
    this.lastRatingDelta = ratingDelta;
    this.state.phase = 'ended';
    this.state.winner = mapped === 'draw' ? 'draw' : (mapped as PlayerId);
    this.state.winReason = reason as DuelState['winReason'];
    if (mapped === 'draw') synth.draw(); else if (mapped === 0) synth.victory(); else synth.defeat();
    this.opts.onEnd?.({ winner: mapped === 'draw' ? 'draw' : (mapped as PlayerId), reason });
    this.bump();
  }

  select(cell: number | null) { this.selected = cell; synth.uiTap(); this.bump(); }
  start() { /* server drives the clock */ }
  destroy() { this.unsubs.forEach((u) => u()); this.listeners.clear(); }
  flags() {
    const p = this.state.players[this.opts.seat];
    const chained = new Set<number>();
    const smudged = new Set<number>();
    for (const s of p.statuses) {
      if (s.type === 'chain' && s.cell !== undefined) chained.add(s.cell);
      if (s.type === 'smudge' && s.cells) for (const c of s.cells) smudged.add(c);
    }
    return {
      chained, smudged,
      hushed: p.statuses.some((s) => s.type === 'hush'),
      miasma: p.statuses.some((s) => s.type === 'miasma'),
      quarantinedUnits: new Set(p.statuses.filter((s) => s.type === 'quarantine').map((s) => s.unit!)),
    };
  }

  place(cell: number, digit: Digit) {
    if (this.ended) return { ok: false, reason: 'ended' as const };
    if (this.selected !== null && this.flags().hushed) return { ok: false, reason: 'hushed' as const };
    proto.place(this.opts.duelId, cell, digit);
    this.lastWrongCell = cell; this.lastWrongDigit = digit; this.lastWrongClearAt = this.state.clockMs + 1000;
    return { ok: true, correct: undefined };
  }

  setNotes(cell: number, digits: number[]) {
    if (digits.length === 0) this.notes.delete(cell); else this.notes.set(cell, new Set(digits));
    proto.pencil(this.opts.duelId, cell, digits);
    this.bump();
  }
  toggleNote(cell: number, d: number) {
    this.pencilUsedOnce = true;
    const set = this.notes.get(cell) ?? new Set<number>();
    if (set.has(d)) set.delete(d); else set.add(d);
    this.setNotes(cell, [...set]);
    synth.pencil();
  }

  ability(id: AbilityId, arg: { cell?: number; unit?: string } = {}) {
    const a = arg.cell !== undefined ? arg : this.selected !== null ? { ...arg, cell: this.selected } : arg;
    proto.ability(this.opts.duelId, id, a);
    synth.cast(0);
    this.bump();
    return { ok: true, applied: undefined };
  }

  concede() { proto.concede(this.opts.duelId); }
  tutorialNote(): string | null { return null; }
  grantFreeAugur() { this.freeAugurGranted = true; }
}
