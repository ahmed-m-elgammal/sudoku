// ASSIZE net client — authoritative server protocol (spec §6, §7).
// Transport: socket.io over WebSocket via the sandbox gateway (XTransformPort). Deviation from the
// spec's raw `ws` is forced by the sandbox gateway; socket.io runs over WebSocket frames.
'use client';
import { io, type Socket } from 'socket.io-client';
import type { AbilityId, Digit, OrderId } from '@shared/config';

export const SERVER_PORT = 3030;
export const rest = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(`${path}?XTransformPort=${SERVER_PORT}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });

export interface QueueJoined {
  duelId: string;
  seat: 0 | 1;
  seed: string;
  givens: number[];
  foe: { name: string; order: OrderId; shade: boolean; standing: number };
  stakes: { tier: string; range: [number, number] };
}
export interface ServerStateDelta {
  duelId: string;
  seq: number;
  clockMs: number;
  players: Array<{ seat: number; seals: number; progress: number; cd: Record<string, number> }>;
  events: Array<Record<string, unknown>>;
  statuses: Array<Record<string, unknown>>;
  unitOwner: Record<string, number>;
}
export interface ServerEnvelope {
  kind: 'state_delta' | 'claim' | 'status' | 'end' | 'matched' | 'error' | 'reconnect_grace';
  [k: string]: unknown;
}

class NetClient {
  private socket: Socket | null = null;
  private handlers = new Map<string, Set<(p: unknown) => void>>();
  private queueDepth = 0;

  connected = false;

  connect(): Promise<boolean> {
    if (this.socket?.connected) return Promise.resolve(true);
    return new Promise((resolve) => {
      try {
        this.socket = io(`/?XTransformPort=${SERVER_PORT}`, {
          transports: ['polling', 'websocket'], // polling first: survives proxies; upgrades to ws when possible
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 4,
          reconnectionDelay: 1200,
          timeout: 6000,
        });
        const s = this.socket;
        s.on('connect', () => { this.connected = true; this.emitLocal('net:online', {}); resolve(true); });
        s.on('connect_error', () => { this.connected = false; this.emitLocal('net:offline', {}); resolve(false); });
        s.on('disconnect', () => { this.connected = false; this.emitLocal('net:offline', {}); });
        s.onAny((event: string, payload: unknown) => {
          if (event.startsWith('net:')) return;
          this.emitLocal(event, payload);
        });
      } catch {
        resolve(false);
      }
    });
  }

  get socketId() { return this.socket?.id ?? null; }

  on(event: string, fn: (p: unknown) => void): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return () => this.handlers.get(event)?.delete(fn);
  }
  private emitLocal(event: string, payload: unknown) {
    this.handlers.get(event)?.forEach((fn) => fn(payload));
  }
  send(event: string, payload: unknown) {
    this.socket?.emit(event, payload);
  }

  // REST helpers -------------------------------------------------------------
  async auth(body: { id: string; secret: string; name: string; recoveryHash?: string | null }) {
    const r = await rest('/api/auth', { method: 'POST', body: JSON.stringify(body) });
    return r.ok ? ((await r.json()) as { standing: number; name: string; ok: true; ink?: number }) : null;
  }
  async joinQueue(body: { id: string; secret: string; order: OrderId; friendCode?: string }) {
    const r = await rest('/api/queue', { method: 'POST', body: JSON.stringify(body) });
    return r.ok ? ((await r.json()) as QueueJoined | { waitMs: number }) : null;
  }
  async createFriend(body: { id: string; secret: string }) {
    const r = await rest('/api/friend/create', { method: 'POST', body: JSON.stringify(body) });
    return r.ok ? ((await r.json()) as { code: string }) : null;
  }
  async daily(dateKey: string) {
    const r = await rest(`/api/daily?date=${dateKey}`);
    return r.ok ? await r.json() : null;
  }
  async dailyResult(body: { id: string; secret: string; dateKey: string; timeMs: number; mistakes: number }) {
    const r = await rest('/api/daily/result', { method: 'POST', body: JSON.stringify(body) });
    return r.ok ? await r.json() : null;
  }
  async recovery(body: { code: string; id: string; secret: string }) {
    const r = await rest('/api/recovery', { method: 'POST', body: JSON.stringify(body) });
    return r.ok ? ((await r.json()) as { ok: boolean; standing?: number; purchases?: string[]; ink?: number }) : null;
  }
  // T13 — the Ink ledger: post award deltas with duel ids; the server verifies/bounds/drops.
  async ink(body: { id: string; secret: string; entries: Array<{ duelId: string; mode: string; delta: number }> }) {
    const r = await rest('/api/ink', { method: 'POST', body: JSON.stringify(body) });
    return r.ok ? ((await r.json()) as { ok: true; ink: number; results: Array<{ duelId: string; verdict: string; applied: number }> }) : null;
  }
  async telemetry(event: string) {
    try { await rest('/api/telemetry', { method: 'POST', body: JSON.stringify({ event, t: Date.now() }) }); } catch { /* first-party, best effort */ }
  }
}

export const net = new NetClient();

// duel protocol helpers (spec §6): {join_queue, place, ability, pencil, concede, reconnect}
export const proto = {
  place: (duelId: string, cell: number, digit: Digit) => net.send('place', { duelId, cell, digit }),
  ability: (duelId: string, ability: AbilityId, arg: { cell?: number; unit?: string }) => net.send('ability', { duelId, ability, ...arg }),
  pencil: (duelId: string, cell: number, digits: number[]) => net.send('pencil', { duelId, cell, digits }),
  concede: (duelId: string) => net.send('concede', { duelId }),
  reconnect: (duelId: string, secret: string) => net.send('reconnect', { duelId, secret }),
  joinDuel: (duelId: string, secret: string) => net.send('join_duel', { duelId, secret }),
  leaveQueue: () => net.send('leave_queue', {}),
};
