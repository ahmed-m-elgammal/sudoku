// chronicleLaw.ts — P2.4: the Chronicle's pure law (docs/STORY_HOLD_PLAN.md P2.4).
//
// The Chronicle is a read-only Ledger of story beats the player has reached.
// This file owns the canonical beat order and the content resolution (title,
// lines, plate) per beat id — the screen only paints. Copy is never invented
// here: titles and lines come from story.json and the dictionary, verbatim.
//
// Beat ids: 'prologue', 'folio:<folioKey>', 'interlude1', 'interlude2',
// 'reveal', 'ending:balance', 'ending:burn'.
import { FOLIOS } from '@shared/orders';
import { i18n, storyJson } from '@/i18n';

export type ChronicleBeatKind = 'prologue' | 'folio' | 'interlude' | 'reveal' | 'ending';

/** Canonical story order — the Chronicle reads top to bottom, never by grind. */
export const CHRONICLE_ORDER: readonly string[] = [
  'prologue',
  ...FOLIOS.slice(0, 3).map((f) => `folio:${f.key}`),
  'interlude1',
  ...FOLIOS.slice(3, 6).map((f) => `folio:${f.key}`),
  'interlude2',
  ...FOLIOS.slice(6).map((f) => `folio:${f.key}`),
  'reveal',
  'ending:balance',
  'ending:burn',
];

export interface ChronicleBeat {
  id: string;
  kind: ChronicleBeatKind;
  /** Unlocked title. Locked rows use lockedLabel() instead (spoiler guard). */
  title: string;
  sub?: string;
  lines: string[];
  /** Web asset path, resolved through imageForPath (null when unmapped). */
  plate: string | null;
}

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter(str) : []);

export function isChronicleSeen(seen: readonly string[] | undefined, id: string): boolean {
  return Array.isArray(seen) && seen.includes(id);
}

/**
 * Locked-row label. Folio titles are public (they hang on the FolioMap), but
 * interlude/reveal/ending titles would spoil the plot — those rows read
 * "Sealed" until reached.
 */
export function chronicleLockedLabel(id: string): string {
  if (id === 'prologue') return i18n.duel.chronicle.prologue;
  if (id.startsWith('folio:')) {
    const key = id.slice('folio:'.length);
    const title = (storyJson.folios as Record<string, { title?: unknown }>)[key]?.title;
    if (typeof title === 'string' && title) return title;
  }
  return i18n.duel.chronicle.sealed;
}

export function chronicleBeat(id: string): ChronicleBeat | null {
  if (id === 'prologue') {
    return {
      id, kind: 'prologue',
      title: i18n.duel.chronicle.prologue,
      lines: strArray(storyJson.prologue),
      plate: '/assets/plates/plate-prologue.webp',
    };
  }
  if (id.startsWith('folio:')) {
    const key = id.slice('folio:'.length);
    const idx = FOLIOS.findIndex((f) => f.key === key);
    if (idx < 0) return null;
    const copy = (storyJson.folios as Record<string, { title?: unknown; sub?: unknown }>)[key];
    const mag = (storyJson.mag as Record<string, { folio?: unknown }>)[key];
    const title = typeof copy?.title === 'string' ? copy.title : key;
    const sub = typeof copy?.sub === 'string' ? copy.sub : undefined;
    // the folio card is one ~60-word string (not an array like the other beats)
    const card = typeof mag?.folio === 'string' && mag.folio ? [mag.folio] : [];
    return {
      id, kind: 'folio', title, sub,
      lines: card,
      plate: `/assets/plates/plate-folio-${idx + 1}.webp`,
    };
  }
  if (id === 'interlude1' || id === 'interlude2') {
    const n = id === 'interlude1' ? 1 : 2;
    return {
      id, kind: 'interlude',
      title: n === 1 ? i18n.duel.chronicle.interlude1 : i18n.duel.chronicle.interlude2,
      lines: strArray((storyJson as Record<string, unknown>)[id]),
      plate: `/assets/plates/plate-interlude-${n}.webp`,
    };
  }
  if (id === 'reveal') {
    // P3.4 — the Chronicle re-reads what the night showed: Orsolo's three
    // lines, then the Clerk's reply.
    const reply = (storyJson as { orsoloRevealReply?: unknown }).orsoloRevealReply;
    return {
      id, kind: 'reveal',
      title: i18n.duel.chronicle.reveal,
      lines: [...strArray(storyJson.orsoloReveal), ...strArray(reply)],
      plate: '/assets/plates/plate-orsolo-reveal.webp',
    };
  }
  if (id === 'ending:balance' || id === 'ending:burn') {
    const burn = id === 'ending:burn';
    return {
      id, kind: 'ending',
      title: burn ? i18n.endingChoice.burnTitle : i18n.endingChoice.balanceTitle,
      lines: strArray(burn ? storyJson.endings.burn : storyJson.endings.balance),
      plate: burn ? '/assets/plates/plate-ending-burn.webp' : '/assets/plates/plate-ending-balance.webp',
    };
  }
  return null;
}
