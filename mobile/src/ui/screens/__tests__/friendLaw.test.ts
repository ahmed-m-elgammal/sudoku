// FriendScreen laws — the wax-sealed challenge's pure core (specs/17 phase 4.6).
//
// The pairing screen's silent rots are all payload/code hygiene: a mislabelled
// plate sends the duel screen a mirror it cannot authorise, an empty code leaks
// the guest into the RANKED queue, and a Shade payload answering a friend seal
// means the server's fallback reached somewhere it must never reach. These pins
// walk the web build's values verbatim (FriendScreen.tsx:31-35/95-99).
import { describe, expect, it } from 'vitest';
import {
  CODE_MAX_LEN, FRIEND_TIER,
  friendMatchedToNav, isFriendMatch, isJoinableCode, normalizeCode,
} from '@/ui/screens/friendLaw';

describe('the code hygiene (the web sent friendCode: \'\' into the RANKED queue)', () => {
  it('CODE-1 the input uppercases as you type and trims pasted whitespace', () => {
    expect(normalizeCode('ab3x9k')).toBe('AB3X9K');
    expect(normalizeCode('  ab-cd  ')).toBe('AB-CD');
    expect(normalizeCode('\tXy\t')).toBe('XY');
  });

  it('CODE-2 an empty or whitespace code is never joinable — no silent ranked-queue leak', () => {
    expect(isJoinableCode('')).toBe(false);
    expect(isJoinableCode('   ')).toBe(false);
    expect(isJoinableCode('\n\t')).toBe(false);
    expect(isJoinableCode('AB3X9K')).toBe(true);
  });

  it('CODE-3 a paste is capped — the wire never carries a hostile code blob', () => {
    const blob = 'A'.repeat(500);
    expect(normalizeCode(blob).length).toBe(CODE_MAX_LEN);
    expect(normalizeCode(blob)).toBe('A'.repeat(CODE_MAX_LEN));
  });
});

describe("the friend 'matched' mapping (socket payload -> versus payload)", () => {
  const save = { name: 'Clerk One', order: 'scholar' as const };

  it('MAP-1 a friend pair is unrated: tier Friend duel, range [0, 0], duelMode friend', () => {
    // the server's matchedPayload carries ranked stakes (tier Medium, ±10% range);
    // the web's FriendScreen relabelled both, verbatim
    const nav = friendMatchedToNav({
      duelId: 'duel-91', seat: 1, givens: [0, 4, 7],
      foe: { name: 'Old Friend', order: 'apothecary', shade: false, standing: 1030 },
      stakes: { tier: 'Medium', range: [927, 1133] },
    }, save);
    expect(nav.duelMode).toBe('friend');
    expect(nav.pendingFoe).toEqual({
      name: 'Old Friend', order: 'apothecary', shade: false,
      standing: 1030, tier: 'Friend duel', range: [0, 0],
    });
    // the duel screen constructs the authoritative mirror from exactly this
    expect(nav.serverDuel).toEqual({
      duelId: 'duel-91', seat: 1, givens: [0, 4, 7],
      foeName: 'Old Friend', myName: 'Clerk One',
      myOrder: 'scholar', foeOrder: 'apothecary',
    });
  });

  it('MAP-2 the tier label is the web\'s verbatim "Friend duel" (the unrated plate)', () => {
    expect(FRIEND_TIER).toBe('Friend duel');
  });

  it('MAP-3 both seats map through the same law — the server is the sole authority on the tablet', () => {
    const givens = Array.from({ length: 30 }, (_, i) => i);
    const seat0 = friendMatchedToNav({
      duelId: 'duel-92', seat: 0, givens,
      foe: { name: 'Friend B', order: 'warden', shade: false, standing: 1000 },
    }, save);
    const seat1 = friendMatchedToNav({
      duelId: 'duel-92', seat: 1, givens,
      foe: { name: 'Clerk One', order: 'scholar', shade: false, standing: 1000 },
    }, { name: 'Friend B', order: 'warden' as const });
    expect(seat0.serverDuel.givens).toBe(givens); // rides through untouched
    expect(seat0.serverDuel.myName).toBe('Clerk One');
    expect(seat1.serverDuel.myName).toBe('Friend B');
    expect(seat1.serverDuel.foeName).toBe('Clerk One');
  });
});

describe('the Shade guard (a Shade never answers a friend seal)', () => {
  it('GUARD-1 a shade-flagged payload is refused — no friend host is pulled into a Shade room', () => {
    expect(isFriendMatch({
      duelId: 'duel-93', seat: 0, givens: [],
      foe: { name: 'Shade of Someone', order: 'executioner', shade: true, standing: 1000 },
    })).toBe(false);
  });

  it('GUARD-2 a human friend payload passes the guard', () => {
    expect(isFriendMatch({
      duelId: 'duel-94', seat: 1, givens: [],
      foe: { name: 'Old Friend', order: 'scholar', shade: false, standing: 1000 },
    })).toBe(true);
  });

  it('GUARD-3 a hostile payload without a foe fails CLOSED (refused)', () => {
    expect(isFriendMatch({} as never)).toBe(false);
    expect(isFriendMatch(undefined as never)).toBe(false);
  });
});
