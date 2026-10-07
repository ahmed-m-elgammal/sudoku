// FriendScreen laws — the pure, testable core of the wax-sealed challenge
// (specs/17 phase 4.6: create/join a code, unrated; two parties pair on the code).
//
// The web build inlined these in ../src/app/game/FriendScreen.tsx — twice for the
// mapping, zero times for the code hygiene. This port extracts them (the
// matchmakingLaw.ts precedent) so the gate can pin the friend laws without mounting
// native chrome:
//
//   · the versus mapping — a friend 'matched' payload becomes duelMode 'friend'
//     with the web's verbatim plate: tier 'Friend duel', range [0, 0] (unrated —
//     the server's ranked stakes never reach the friend screen).
//   · the code hygiene — the input uppercases as you type (the web's onChange)
//     and MUST be non-empty before join_queue: the web sent `friendCode: ''` for
//     an empty input, and the server's falsy check routed that join into the
//     RANKED queue (reported web defect, refused here).
//   · the Shade guard — a Shade never answers a friend seal. The server now lets
//     friend entries wait for their human (see mini-services matchmaking); if a
//     shade-flagged payload still arrives (an older server), the screen ignores
//     it instead of pulling a friend host into a Shade room.
import type { OrderId } from '@shared/config';
import type { MatchedPayload } from './matchmakingLaw';

/** The web's verbatim pendingFoe tier label for a friend duel (FriendScreen.tsx:33). */
export const FRIEND_TIER = 'Friend duel';

/** The code rides the join_queue as-is; only whitespace and case are normalized. */
export const CODE_MAX_LEN = 16; // the server's codes are 6 base36 chars; the cap is paste hygiene

/** The web uppercased on every keystroke; the port also trims pasted whitespace. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().slice(0, CODE_MAX_LEN);
}

/**
 * The empty-code guard. The web's Begin button sent `friendCode: ''` and the
 * authoritative queue read falsy — a guest tapping Begin with an empty input was
 * silently RANKED-queued. A friend join must carry a code or not join at all.
 */
export function isJoinableCode(raw: string): boolean {
  return normalizeCode(raw).length > 0;
}

/** A friend room is HUMAN only: a foe plate must exist and never be a Shade. */
export function isFriendMatch(m: MatchedPayload): boolean {
  return !!m?.foe && m.foe.shade !== true;
}

export interface FriendNav {
  duelMode: 'friend';
  pendingFoe: {
    name: string;
    order: string;
    shade: boolean;
    standing: number;
    tier: string;
    range: [number, number];
  };
  serverDuel: {
    duelId: string;
    seat: 0 | 1;
    givens: number[];
    foeName: string;
    myName: string;
    myOrder: OrderId;
    foeOrder: OrderId;
  };
}

/**
 * A friend pair's 'matched' payload -> the versus payload, the web's inline object
 * verbatim (FriendScreen.tsx:31-35 / 95-99): the tier is relabelled 'Friend duel'
 * and the stakes range pinned to [0, 0] — unrated, unruffled. The givens ride
 * through untouched: the server is the sole authority on the tablet (spec §6).
 */
export function friendMatchedToNav(
  m: MatchedPayload,
  save: { name: string; order: OrderId },
): FriendNav {
  return {
    duelMode: 'friend',
    pendingFoe: {
      name: m.foe.name,
      order: m.foe.order,
      shade: false,
      standing: m.foe.standing,
      tier: FRIEND_TIER,
      range: [0, 0],
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
