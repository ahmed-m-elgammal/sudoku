// Matchmaking laws — the pure, testable core of the Summoning screen.
//
// The web build inlined these in ../src/app/game/Matchmaking.tsx; this port extracts
// them (the dailyFormat.ts precedent) so the gate can pin the queue laws without
// mounting native chrome:
//
//   · the 4 s Shade fallback — the server runs its own authoritative fallback at
//     CONFIG.matchmaking.shadeFallbackMs; the client waits JUST PAST it (+500 ms) so
//     the server's 'matched' (human or Shade) wins the race against the local one,
//     and the local fallback is the honest offline/last-resort path (R7 labelling).
//   · the fallback foe — one of the four web names, "Shade of …", executioner order,
//     'Practice ladder' stakes, the player's own Standing.
//   · the 'matched' mapping — the socket payload becomes the screen machine's
//     versus payload: ranked vs shade mode, the pendingFoe plate, and the
//     ServerDuelInit the duel screen will construct the authoritative mirror from.
import { CONFIG, type OrderId } from '@shared/config';

/** The web build's four fallback names, verbatim. */
export const SHADE_FALLBACK_NAMES = [
  'Gaunt Notary',
  'Ashen Clerk',
  'Quiet Advocate',
  'Hollow Scrivener',
] as const;

/** Server fallback 4000 ms + the web's +500 ms margin. */
export const SHADE_FALLBACK_WAIT_MS = CONFIG.matchmaking.shadeFallbackMs + 500;

/** No human answered: a local Shade takes the plea, honestly labelled (R7). */
export function shadeFallbackName(): string {
  return `Shade of ${SHADE_FALLBACK_NAMES[Math.floor(Math.random() * SHADE_FALLBACK_NAMES.length)]}`;
}

/** The socket 'matched' payload (mini-services matchedPayload()). */
export interface MatchedPayload {
  duelId: string;
  seat: 0 | 1;
  givens: number[];
  foe: { name: string; order: OrderId; shade: boolean; standing: number };
  stakes?: { tier?: string; range?: [number, number] };
}

export interface MatchmakingNav {
  duelMode: 'shade' | 'ranked';
  pendingFoe: {
    name: string; order: string; shade: boolean; standing: number;
    tier?: string; range?: [number, number];
  };
  serverDuel: {
    duelId: string; seat: 0 | 1; givens: number[];
    foeName: string; myName: string; myOrder: OrderId; foeOrder: OrderId;
  } | null;
}

/**
 * A server match (human, or a Shade from the authoritative queue) -> the versus
 * payload. The givens ride through untouched — the server is the sole authority on
 * the tablet (spec §6); the mirror only ever sees what this seat may see.
 */
export function matchedToNav(
  m: MatchedPayload,
  save: { name: string; order: OrderId },
): MatchmakingNav {
  return {
    duelMode: m.foe.shade ? 'shade' : 'ranked',
    pendingFoe: {
      name: m.foe.name,
      order: m.foe.order,
      shade: m.foe.shade,
      standing: m.foe.standing,
      tier: m.stakes?.tier ?? 'Ranked',
      range: m.stakes?.range ?? [0, 0],
    },
    serverDuel: {
      duelId: m.duelId,
      seat: m.seat,
      givens: m.givens,
      foeName: m.foe.name,
      myName: save.name,
      myOrder: save.order,
      foeOrder: m.foe.order,
    },
  };
}

/** The local Shade fallback's versus payload (serverDuel: null — a LocalDuel runs it). */
export function shadeFallbackNav(save: { standing: number }): MatchmakingNav {
  return {
    duelMode: 'shade',
    pendingFoe: {
      name: shadeFallbackName(),
      order: 'executioner',
      shade: true,
      standing: save.standing,
      tier: 'Practice ladder',
      range: [0, 0],
    },
    serverDuel: null,
  };
}
