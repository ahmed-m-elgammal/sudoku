// ASSIZE mobile — net client.
//
// PORT of ../src/net/client.ts. The protocol is unchanged (socket.io events + the
// same REST routes); the one edit that matters is the URL.
//
// The web build appended `?XTransformPort=3030` to every call because a sandbox
// gateway proxied every origin through one host. On a phone the app talks to a real
// origin directly. Configure it in one place:
//
//   EXPO_PUBLIC_ASSIZE_SERVER   e.g. https://api.assize.example
//
// Absent that variable it falls back to localhost, which is what you want against a
// dev server on the same machine (and what an Android emulator needs via 10.0.2.2).
//
// ┌────────────────────────────────────────────────────────────────────────────┐
// │ OWNED BY: the runtimes agent. Keep the exported shape: `rest`, `net`, `proto`.│
// │ Consumers: state/ui.ts (ServerDuelInit), state/inkLedger.ts, ServerDuel.    │
// └────────────────────────────────────────────────────────────────────────────┘

import { io, type Socket } from 'socket.io-client';
import type { AbilityId, Digit, OrderId } from '@shared/config';

const DEFAULT_SERVER = 'http://localhost:3030';

/** Resolve the server origin: explicit env -> Expo Go dev host -> localhost. */
export function serverOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_ASSIZE_SERVER;
  if (configured) return configured.replace(/\/$/, '');
  // In Expo Go / dev client the packager host is reachable from the device; the duel
  // server usually is not, so fall back to localhost unless told otherwise.
  return DEFAULT_SERVER;
}

export const SERVER_PORT = 3030;

export const rest = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(`${serverOrigin()}${path}`, {
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
  players: { seat: number; seals: number; progress: number; cd: Record<string, number> }[];
  events: Record<string, unknown>[];
  statuses: Record<string, unknown>[];
  unitOwner: Record<string, number>;
}

export interface ServerEnvelope {
  kind: 'state_delta' | 'claim' | 'status' | 'end' | 'matched' | 'error' | 'reconnect_grace';
  [k: string]: unknown;
}

/** What the socket's `matched` payload hands to ServerDuel. */
export interface ServerDuelInit {
  duelId: string;
  seat: 0 | 1;
  givens: number[];
  foeName: string;
  myName: string;
  myOrder: OrderId;
  foeOrder: OrderId;
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
        // Mobile can reach a real WebSocket directly, so websocket is preferred and
        // polling is the fallback for hostile networks (the web build was forced
        // into polling-first by the sandbox proxy).
        this.socket = io(serverOrigin(), {
          transports: ['websocket', 'polling'],
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
  get depth() { return this.queueDepth; }

  on(event: string, fn: (p: unknown) => void): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return () => { this.handlers.get(event)?.delete(fn); };
  }
  private emitLocal(event: string, payload: unknown) {
    this.handlers.get(event)?.forEach((fn) => fn(payload));
  }
  send(event: string, payload: unknown) {
    this.socket?.emit(event, payload);
  }

  // REST helpers -------------------------------------------------------------
  async auth(body: { id: string; secret: string; name: string; recoveryHash?: string | null }) {
    try {
      const r = await rest('/api/auth', { method: 'POST', body: JSON.stringify(body) });
      return r.ok ? ((await r.json()) as { standing: number; name: string; ok: true; ink?: number }) : null;
    } catch {
      return null;
    }
  }
  async joinQueue(body: { id: string; secret: string; order: OrderId; friendCode?: string }) {
    try {
      const r = await rest('/api/queue', { method: 'POST', body: JSON.stringify(body) });
      return r.ok ? ((await r.json()) as QueueJoined | { waitMs: number }) : null;
    } catch {
      return null;
    }
  }
  async createFriend(body: { id: string; secret: string }) {
    try {
      const r = await rest('/api/friend/create', { method: 'POST', body: JSON.stringify(body) });
      return r.ok ? ((await r.json()) as { code: string }) : null;
    } catch {
      return null;
    }
  }
  async daily(dateKey: string) {
    try {
      const r = await rest(`/api/daily?date=${dateKey}`);
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }
  async dailyResult(body: { id: string; secret: string; dateKey: string; timeMs: number; mistakes: number }) {
    try {
      const r = await rest('/api/daily/result', { method: 'POST', body: JSON.stringify(body) });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }
  async recovery(body: { code: string; id: string; secret: string }) {
    try {
      const r = await rest('/api/recovery', { method: 'POST', body: JSON.stringify(body) });
      return r.ok ? ((await r.json()) as { ok: boolean; standing?: number; purchases?: string[]; ink?: number }) : null;
    } catch {
      return null;
    }
  }
  async ink(body: { id: string; secret: string; entries: { duelId: string; mode: string; delta: number }[] }) {
    try {
      const r = await rest('/api/ink', { method: 'POST', body: JSON.stringify(body) });
      return r.ok ? ((await r.json()) as { ok: true; ink: number; results: { duelId: string; verdict: string; applied: number }[] }) : null;
    } catch {
      return null;
    }
  }
  async telemetry(event: string) {
    // first-party, best effort, and gated by the player's telemetry setting upstream
    try { await rest('/api/telemetry', { method: 'POST', body: JSON.stringify({ event, t: Date.now() }) }); }
    catch { /* ignore */ }
  }
}

export const net = new NetClient();

// duel protocol helpers: {join_queue, place, ability, pencil, concede, reconnect}
export const proto = {
  place: (duelId: string, cell: number, digit: Digit) => net.send('place', { duelId, cell, digit }),
  ability: (duelId: string, ability: AbilityId, arg: { cell?: number; unit?: string }) => net.send('ability', { duelId, ability, ...arg }),
  pencil: (duelId: string, cell: number, digits: number[]) => net.send('pencil', { duelId, cell, digits }),
  concede: (duelId: string) => net.send('concede', { duelId }),
  reconnect: (duelId: string, secret: string) => net.send('reconnect', { duelId, secret }),
  // The server's join_duel handler authenticates accountId + secret; the web build sent
  // only the secret, so every re-join (the S08 reconnect path) failed server-side and a
  // reconnected duel froze. ServerDuel passes both (reported web defect, fixed here).
  joinDuel: (duelId: string, secret: string, accountId?: string) => net.send('join_duel', { duelId, secret, accountId }),
  leaveQueue: () => net.send('leave_queue', {}),
};
