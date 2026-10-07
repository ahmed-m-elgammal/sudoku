// FriendScreen (S-spec 4.6) — wax-sealed challenges: seal a code, send it to a
// friend, both queues carry the same label, and the server pairs them. Unrated.
//
// PORT of ../src/app/game/FriendScreen.tsx (specs/17 phase 4.6); the panels live
// in ./friendPanels.tsx, the pure laws in ./friendLaw.ts. The screen owns the
// FLOW — and the flow is where the web build's defects live (reported in its
// source, refused here — the port needs the pairing to work end to end):
//
//   a. LISTENER LEAK. The web host registered `net.on('matched')` and never
//      removed it: after leaving the screen the stale listener was still armed,
//      so a LATER ranked match could yank the player into versus with a friend
//      payload (and the un-leave_queue'd entry kept pairing after the host left).
//      Here the unmount cleanup cancels, offs the listener, and sends leave_queue
//      — the 4.4 Matchmaking lifecycle, exactly once per mount.
//   b. EMPTY-CODE QUEUE LEAK. The web's Begin button sent `friendCode: ''` and the
//      authoritative queue read falsy — the guest was silently RANKED-queued from
//      the friend screen. Here Begin is disabled until the code is non-empty
//      (friendLaw.isJoinableCode).
//   c. UNPAIRABLE OFFLINE CODE. The web's create fallback minted `LOCAL-XXXXXX`
//      and left the host "Waiting…" forever — the host was never queued, so no
//      guest could ever pair. Here a failed create is the error note and the
//      button back (retry), not a fake code.
//   d. SILENT CONNECT FAILURE. The web's host skipped queueing when the socket
//      failed and showed nothing at all. Here the offline note renders (and the
//      waiting line never lies about a queue it never joined).
//   e. ERROR IN THE WRONG PANEL. The web's join-path error rendered the offline
//      note inside the CREATE panel, away from the input. Here each panel keeps
//      its own error state.
//   f. SHARE HONESTY. The web's copy button put `${origin}/?duel=CODE` on the
//      clipboard, but nothing in either client parses that query — a dead link
//      (reported web defect). The join token that actually works on BOTH clients
//      is the code itself, typed into "Break a seal"; the share text is
//      i18n.friend.shareCode and the clipboard carries the code.
//
// The secret is never duplicated into plain storage — it lives in the Keychain
// identity (loadIdentity), which net.auth and ServerDuel read (specs/15).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import { loadIdentity, type GuestIdentity } from '@/state/identity';
import { net } from '@/game/net/client';
import { audio } from '@/platform/audio';
import { clipboard } from '@/platform/clipboard';
import { useDisplaySettings } from '@/platform/display';
import { fonts, themeFor, type as typeScale } from '@/theme/tokens';
import { i18n } from '@/i18n';
import type { OrderId } from '@shared/config';
import {
  friendMatchedToNav, isFriendMatch, isJoinableCode, normalizeCode,
} from './friendLaw';
import { FriendCreatePanel, FriendJoinPanel } from './friendPanels';
import type { MatchedPayload } from './matchmakingLaw';

export default function FriendScreen() {
  const go = useUi((s) => s.go);
  const display = useDisplaySettings();
  const theme = useMemo(
    () => themeFor({ contrast: display.contrast, text: display.text }),
    [display.contrast, display.text],
  );
  const insets = useSafeAreaInsets();
  const fs = typeScale(theme.textScale);

  const [code, setCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(false);
  // the one live queue membership (host OR guest) — drives the waiting lines;
  // queuedRef is the async-flow/cleanup mirror of the same truth
  const [queuedUi, setQueuedUi] = useState<string | null>(null);
  const queuedRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const cancelledRef = useRef(false);
  const offRef = useRef<(() => void) | null>(null);

  const setQueued = useCallback((c: string | null) => {
    queuedRef.current = c;
    setQueuedUi(c);
  }, []);

  // the unmount cleanup: cancel the async flows, tear the listener down, and never
  // leave a ghost behind in the authoritative queue (law a)
  useEffect(() => () => {
    cancelledRef.current = true;
    offRef.current?.();
    if (queuedRef.current) net.send('leave_queue', {});
  }, []);

  const onMatched = useCallback((p: unknown) => {
    if (cancelledRef.current || settledRef.current) return;
    const m = p as MatchedPayload;
    if (!isFriendMatch(m)) return; // a Shade (or a hostile payload) never answers a friend seal
    const fresh = useSave.getState().save;
    if (!fresh) return;
    settledRef.current = true;
    offRef.current?.();
    offRef.current = null;
    setQueued(null);
    go('versus', friendMatchedToNav(m, { name: fresh.name, order: fresh.order }));
  }, [go, setQueued]);

  // at most ONE live queue entry per client: a new join_queue first leaves the
  // previous one (the server's leave_queue pops a single entry), and exactly one
  // matched listener is ever armed. The save/identity are read FRESH at each await.
  const ensureQueued = useCallback(async (friendCode: string, fresh: { name: string; order: OrderId }, id: GuestIdentity) => {
    if (queuedRef.current) net.send('leave_queue', {});
    setQueued(null);
    try {
      await net.auth({ id: id.id, secret: id.secret, name: fresh.name, recoveryHash: id.recoveryHash });
    } catch { /* offline: the join_queue auth would fail anyway; the error note shows */ }
    if (cancelledRef.current || settledRef.current) return;
    offRef.current?.();
    offRef.current = net.on('matched', onMatched);
    net.send('join_queue', { accountId: id.id, secret: id.secret, name: fresh.name, order: fresh.order, friendCode });
    setQueued(friendCode);
  }, [onMatched, setQueued]);

  const create = useCallback(async () => {
    audio.uiTap();
    if (creating || code) return; // one create lifecycle at a time
    setCreating(true);
    setCreateError(false);
    const id = await loadIdentity();
    if (cancelledRef.current) return;
    const res = await net.createFriend({ id: id.id, secret: id.secret });
    if (cancelledRef.current) return;
    if (!res || !res.code) {
      // law c: honest error + retry, never an unpairable code
      setCreating(false);
      setCreateError(true);
      return;
    }
    setCode(res.code);
    setCreating(false);
    const ok = await net.connect();
    if (cancelledRef.current) return;
    const fresh = useSave.getState().save;
    if (!ok || !fresh) {
      // law d: the web failed silently here — show the note, never the waiting lie
      setCreateError(true);
      return;
    }
    await ensureQueued(res.code, fresh, id);
  }, [code, creating, ensureQueued]);

  const begin = useCallback(async () => {
    audio.uiTap();
    if (joining) return;
    const joined = normalizeCode(joinCode);
    if (!isJoinableCode(joined)) return; // Begin is disabled anyway (law b)
    setJoining(true);
    setJoinError(false);
    const id = await loadIdentity();
    if (cancelledRef.current) return;
    const fresh = useSave.getState().save;
    const ok = await net.connect();
    if (cancelledRef.current) return;
    if (!ok || !fresh) {
      audio.error(); // the web's synth.error() on the join path
      setJoining(false);
      setJoinError(true); // law e: the note belongs to THIS panel
      return;
    }
    await ensureQueued(joined, fresh, id);
    if (cancelledRef.current) return;
    setJoining(false);
  }, [joinCode, joining, ensureQueued]);

  const copyCode = useCallback(async () => {
    audio.uiTap();
    if (code) await clipboard.copy(code);
  }, [code]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* web header: textAlign center */}
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.fg, fontSize: 2 * fs.md, letterSpacing: 0.02 * 2 * fs.md }]}
          >
            {i18n.friend.title}
          </Text>
          <Text style={[styles.pickOrder, { color: theme.fgDim, fontSize: fs.sm }]}>
            {i18n.friend.pickOrder}
          </Text>
        </View>

        <FriendCreatePanel
          theme={theme}
          fs={fs}
          code={code}
          creating={creating}
          error={createError}
          onCreate={create}
          onCopy={copyCode}
        />

        <FriendJoinPanel
          theme={theme}
          fs={fs}
          value={joinCode}
          onChange={(t) => setJoinCode(normalizeCode(t))}
          joining={joining}
          error={joinError}
          waiting={!!queuedUi && (!code || queuedUi !== code)}
          onBegin={begin}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // web main.hub: padding 'calc(var(--safe-top) + 16px) 16px 24px' — insets ride inline
  scroll: { paddingHorizontal: 16 },
  header: { alignItems: 'center' },
  // web h1: the display face at the browser's 2em default (the Matchmaking port's treatment)
  title: { fontFamily: fonts.display, textAlign: 'center' },
  // web p (no override): the italic-dim subtitle line
  pickOrder: { fontFamily: fonts.bodyItalic, textAlign: 'center', marginTop: 2 },
});
