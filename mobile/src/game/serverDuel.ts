// ServerDuel — client mirror of an authoritative server duel (spec §6: predict + reconcile).
// Implements the same surface as LocalDuel so DuelScreen renders both identically.
// The solution never reaches the client in PvP; placements round-trip through the server.
//
// PORT of ../src/game/serverDuel.ts (specs/17 phase 4.4). Platform edits, and nothing else:
//   1. `synth.*`                        -> the `audio` seam (identical 18-method surface)
//   2. `'use client'`                   -> dropped (a Next.js directive, meaningless here)
//   3. `localStorage['assize-secret']`  -> `loadIdentity()` (the Keychain-backed identity;
//                                          the web's two sync reads become one async law —
//                                          specs/15: "storage.getSecret()")
//   4. the class satisfies the `DuelRuntime` interface from ./duelRuntime, including the
//      notifiedVersion snapshot law (see localDuel.ts — the "duel ignores taps" guard)
//
// TWO DEFECTS IN THE WEB BUILD, REPORTED AND FIXED HERE (the port needs both seats to
// play end to end; ../src keeps its behaviour — report, don't fix):
//   a. SEAT PERSPECTIVE. The web mirror built createDuel with seat-swapped names and then
//      wrote the server's `you` payload into `players[mySeat]` — while every component in
//      the single JSX tree (Board, NumPad, AbilityBar, MirrorStrip, HudHeader, fx.ts)
//      renders players[0] as "me". A seat-1 player saw the foe's board, seals and claims
//      as their own. Here the local mirror is ALWAYS seat-0-perspective: players[0] = me,
//      players[1] = foe, and the server's absolute-seat payloads (you/foe/unitOwner/
//      events.player/winner) are mapped through `mySeat` on arrival. The wire contract is
//      untouched — only the client mirror's lens changed.
//   b. join_duel AUTH. The server's `join_duel` handler authenticates `p.accountId` +
//      `p.secret`; the web client sent only the secret, so every re-join (the S08
//      reconnect path) failed server-side and the duel froze after a network blip. The
//      mobile client sends both (see ./net/client proto.joinDuel) — the player proves the
//      account, and nothing but the account's own room state ever comes back.
import type { DuelEvent, DuelState } from '@shared/engine';
import { createDuel } from '@shared/engine';
import type { AbilityId, Digit, OrderId, PlayerId } from '@shared/config';
import { proto, net } from './net/client';
import type { ServerDuelInit } from './net/client';
import { audio } from '@/platform/audio';
import { loadIdentity } from '@/state/identity';
import type { DuelRuntime } from './duelRuntime';

export type { ServerDuelInit };

// S08 (TODO T2): the 20s reconnect grace, mirrored client-side for the modal.
export interface DisconnectState {
  secondsLeft: number;   // grace remaining (server-ticked)
  graceS: number;        // total grace the countdown started with
  who: string;           // the seat that dropped
}

/** The server's per-seat public snapshot (mini-services publicState(), seat-indexed). */
interface PublicState {
  you: {
    seat: number; seals: number; board: number[]; progress: number; mistakes: number;
    abilities: DuelState['players'][0]['abilities'];
    statuses: DuelState['players'][0]['statuses']; immuneUntil: DuelState['players'][0]['immuneUntil'];
    claimed: string[]; reckoningUntilMs: number; wardUntilMs: number; mirrorUntilMs: number;
  };
  foe: {
    name: string; seals: number; progress: number; board: number[];
    claimed: string[]; statuses: DuelState['players'][0]['statuses'];
  };
  unitOwner: Record<string, number>;
  clockMs: number; phase: string; events: DuelEvent[]; eventSeq: number;
}

export class ServerDuel implements DuelRuntime {
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
  disconnect: DisconnectState | null = null; // peer dropped: S08 countdown
  selfOffline = false;                       // MY line dropped: reconnecting banner
  private listeners = new Set<() => void>();
  private lastNotifyAt = 0;
  private notifiedVersion = 0;
  private unsubs: (() => void)[] = [];
  private destroyed = false;
  tutorialStep = 0;
  pencilUsedOnce = false;
  claimedOnce = false;
  freeAugurGranted = false;
  mode = 'server' as const;

  // T4 parity: human opponents never adapt; the union surface stays identical.
  swapBanner(): { from: OrderId; to: OrderId } | null { return null; }

  constructor(init: ServerDuelInit) {
    this.opts = { duelId: init.duelId, seat: init.seat };
    // Defect (a): the mirror is ALWAYS [me, foe] — the seat lens lives in the payload
    // mapping below, never in the constructed state (the UI renders players[0] as me).
    this.state = createDuel({
      seed: init.duelId,
      givens: Uint8Array.from(init.givens),
      solution: null, // never sent in PvP (spec §6 anticheat)
      names: [init.myName, init.foeName],
      orders: [init.myOrder, init.foeOrder],
    });
    // join/reconnect with the account's own credentials (defect (b): accountId + secret)
    void this.joinWithIdentity();

    this.unsubs.push(
      net.on('you', (p) => this.applyYou(p)),
      net.on('end', (p) => {
        const e = p as { winner?: PlayerId | 'draw'; reason?: string; ratingDelta?: number | null };
        this.applyEnd(e.winner ?? 'draw', e.reason ?? '', e.ratingDelta ?? null);
      }),
      // ---- S08 disconnect grace (TODO T2) --------------------------------
      net.on('peer_disconnected', (p) => {
        const d = p as { graceS?: number; name?: string };
        this.disconnect = { secondsLeft: Math.max(0, d.graceS ?? 20), graceS: Math.max(1, d.graceS ?? 20), who: d.name ?? this.state.players[1].name };
        audio.padlock();
        this.bump(true);
      }),
      net.on('reconnect_grace', (p) => {
        const d = p as { s?: number };
        if (!this.disconnect) this.disconnect = { secondsLeft: Math.max(0, d.s ?? 20), graceS: 20, who: this.state.players[1].name };
        else this.disconnect = { ...this.disconnect, secondsLeft: Math.max(0, d.s ?? this.disconnect.secondsLeft) };
        this.bump(true);
      }),
      net.on('peer_reconnected', () => {
        this.disconnect = null;
        audio.statusEnded();
        this.bump(true);
      }),
      // ---- my own line: banner + automatic resume -------------------------
      net.on('net:offline', () => {
        this.selfOffline = true;
        this.bump(true);
      }),
      net.on('net:online', () => {
        this.selfOffline = false;
        // the socket is back: re-register with the room; the server answers
        // reconnect_ok with a fresh authoritative snapshot.
        void this.joinWithIdentity();
        this.bump(true);
      }),
      net.on('reconnect_ok', (p) => {
        this.disconnect = null;
        this.selfOffline = false;
        this.applyYou((p as { you: unknown }).you);
      }),
    );
  }

  // The account proof. Re-read on every join: a recovery-code restore mid-session
  // must never keep duel auth pinned to a stale identity.
  private async joinWithIdentity() {
    try {
      const id = await loadIdentity();
      if (this.destroyed || this.ended) return;
      proto.joinDuel(this.opts.duelId, id.secret, id.id);
    } catch { /* offline: net:online retries the join when the line returns */ }
  }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  // The notifiedVersion law (localDuel.ts SNAP-1/2): the snapshot moves ONLY when
  // listeners fire, or useSyncExternalStore force-render-loops between server pushes.
  getSnapshot = () => this.notifiedVersion;
  private bump(immediate = false) {
    this.version++;
    if (this.destroyed) return;
    const now = performance.now();
    if (immediate || now - this.lastNotifyAt >= 66) {
      this.lastNotifyAt = now;
      this.notifiedVersion = this.version;
      this.listeners.forEach((l) => l());
    }
  }
  bumpPublic() { this.bump(); }

  // server 'you' payload -> local mirror (spec protocol: state_delta/claim/status/end).
  // ABSOLUTE server seats are mapped through `mySeat` into the ALWAYS-me-perspective
  // mirror: `you` -> players[0], `foe` -> players[1], unitOwner + event players flipped
  // when I sit in seat 1.
  private applyYou(p: unknown) {
    const d = p as PublicState;
    if (!d?.you) return;
    const flip = this.opts.seat === 1;
    const st = this.state;
    const me = st.players[0];
    const foe = st.players[1];
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
    st.unitOwner = this.ownPerspective(d.unitOwner, flip);
    st.clockMs = d.clockMs;
    st.phase = d.phase === 'ended' ? 'ended' : 'live';
    // sfx on transitions (the mirror's own seats, after the lens)
    if (me.seals < prevSeals) audio.wrong();
    if (foe.seals < prevFoeSeals) { audio.stamp(); audio.claimWon(); }
    if (d.you.statuses.length > this.prevStatusCount) audio.statusApplied();
    this.prevStatusCount = d.you.statuses.length;
    st.events = this.eventPerspective(d.events, flip);
    st.eventSeq = d.eventSeq;
    if (st.phase === 'ended') this.bump(true);
    else this.bump();
  }
  private prevStatusCount = 0;
  lastRatingDelta: number | null = null;

  // unitOwner values are absolute server seats; the fx law + Board read 0 = me.
  private ownPerspective(unitOwner: Record<string, number>, flip: boolean): Record<string, PlayerId> {
    if (!flip) return unitOwner as Record<string, PlayerId>;
    const out: Record<string, PlayerId> = {};
    for (const [unit, owner] of Object.entries(unitOwner)) {
      if (owner === 0) out[unit] = 1;
      else if (owner === 1) out[unit] = 0;
      // anything else is hostile — the unit simply stays unowned
    }
    return out;
  }

  // Event `player` fields are absolute server seats; sounds/floods ride the mirror's lens.
  private eventPerspective(events: DuelEvent[], flip: boolean): DuelEvent[] {
    if (!flip) return events;
    return events.map((e) => {
      if (e.player !== 0 && e.player !== 1) return e;
      return { ...e, player: e.player === 0 ? 1 : 0 };
    });
  }

  private applyEnd(winner: PlayerId | 'draw', reason: string, ratingDelta: number | null = null) {
    if (this.ended) return;
    this.ended = true;
    this.disconnect = null;
    this.selfOffline = false;
    const mySeat = this.opts.seat;
    const mapped = winner === 'draw' ? 'draw' : winner === mySeat ? 0 : 1;
    this.lastRatingDelta = ratingDelta;
    this.state.phase = 'ended';
    this.state.winner = mapped === 'draw' ? 'draw' : (mapped as PlayerId);
    this.state.winReason = reason as DuelState['winReason'];
    if (mapped === 'draw') audio.draw(); else if (mapped === 0) audio.victory(); else audio.defeat();
    this.opts.onEnd?.({ winner: mapped === 'draw' ? 'draw' : (mapped as PlayerId), reason });
    this.bump(true);
  }

  select(cell: number | null) { this.selected = cell; audio.uiTap(); this.bump(); }
  start() { /* server drives the clock */ }
  destroy() {
    this.destroyed = true;
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.listeners.clear();
  }
  setPaused(paused: boolean) { this.paused = paused; this.bump(); }
  togglePencil() { this.pencil = !this.pencil; this.bumpPublic(); }
  setOnEnd(fn: (r: { winner: PlayerId | 'draw'; reason: string }) => void) { this.opts.onEnd = fn; }
  flags() {
    const p = this.state.players[0];
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
    audio.pencil();
  }

  ability(id: AbilityId, arg: { cell?: number; unit?: string } = {}) {
    const a = arg.cell !== undefined ? arg : this.selected !== null ? { ...arg, cell: this.selected } : arg;
    proto.ability(this.opts.duelId, id, a);
    audio.cast(0);
    this.bump();
    return { ok: true, applied: undefined };
  }

  concede() { proto.concede(this.opts.duelId); }
  tutorialNote(): string | null { return null; }
  grantFreeAugur() { this.freeAugurGranted = true; }
}
