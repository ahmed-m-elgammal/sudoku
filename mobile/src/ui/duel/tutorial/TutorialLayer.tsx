// TutorialLayer.tsx — the M2 lesson's OVERLAY surfaces, composed in one place
// (docs/TUTORIAL_OPTIMIZATION_PLAN.md §6.1 "UI", §6.2). DuelScreen renders this once;
// the layer decides what a phase floats over the room:
//
//   t0  PrologueCards  — the blocking two-card canon intro
//   t2  GhostDemo      — the rule demo (its own mini-board; the real Board is untouched)
//   t7  GhostDemo      — the claim demo, auto-dismissed so the board can be played
//   t1,3–8  Spotlight  — scrim + hole over the measured target container
//
// The docked BANNER is NOT here: it stays in the layout flow in DuelScreen (the G3 law,
// pinned by COACH-7 for v1 and TUTORIAL-B for v2). This file only floats overlays.
// The spotlight hole is pure geometry (spotlight.ts) fed by measureInWindow rects of
// the four target containers — DuelScreen wires the refs, nothing else is measured.
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { DuelRuntime, TutorialSpotTarget } from '@/game/duelRuntime';
import type { TutorialPhase } from '@/game/tutorialDirector';
import PrologueCards from './PrologueCards';
import GhostDemo, { DEMO_ROW } from './GhostDemo';
import Spotlight from './Spotlight';
import { abilityHole, cellHole, digitHole, toolbarHole, type Rect } from './spotlight';
import { layout, type Theme } from '@/theme/tokens';

export interface TutorialLayerProps {
  duel: DuelRuntime;
  phase: TutorialPhase;
  theme: Theme;
  /** the measured board-wrap edge (DuelScreen's own onLayout state) */
  boardSize: number;
  refs: {
    board: RefObject<View | null>;
    pad: RefObject<View | null>;
    toolbar: RefObject<View | null>;
    ability: RefObject<View | null>;
  };
  onGate: (gate: 'prologueDone' | 'continue' | 'tryIt') => void;
}

interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EMPTY_RECT: WindowRect = { x: 0, y: 0, w: 0, h: 0 };
/** how long the t7 claim demo floats before the board must be playable again */
const CLAIM_DEMO_MS = 4200;

export default function TutorialLayer({ duel, phase, theme, boardSize, refs, onGate }: TutorialLayerProps) {
  const { width, height } = useWindowDimensions();
  const [boardRect, setBoardRect] = useState<WindowRect>(EMPTY_RECT);
  const [padRect, setPadRect] = useState<WindowRect>(EMPTY_RECT);
  const [toolbarRect, setToolbarRect] = useState<WindowRect>(EMPTY_RECT);
  const [abilityRect, setAbilityRect] = useState<WindowRect>(EMPTY_RECT);
  const [claimDemo, setClaimDemo] = useState(false);
  const prevPhase = useRef<TutorialPhase | null>(null);

  // t7 entry — the claim demo floats once, briefly, then yields the board.
  useEffect(() => {
    if (phase === 't7' && prevPhase.current !== 't7') {
      setClaimDemo(true);
      const t = setTimeout(() => setClaimDemo(false), CLAIM_DEMO_MS);
      prevPhase.current = phase;
      return () => clearTimeout(t);
    }
    prevPhase.current = phase;
  }, [phase]);

  // measure the container the live target sits in (phase / layout / board size moves it)
  const target: TutorialSpotTarget = duel.tutorialTarget ? duel.tutorialTarget() : null;
  const want = wantContainer(target);
  useEffect(() => {
    const read = (ref: RefObject<View | null>, set: (r: WindowRect) => void) => {
      ref.current?.measureInWindow((x, y, w, h) => set({ x, y, w, h }));
    };
    if (want === 'board') read(refs.board, setBoardRect);
    else if (want === 'pad') read(refs.pad, setPadRect);
    else if (want === 'toolbar') read(refs.toolbar, setToolbarRect);
    else if (want === 'ability') read(refs.ability, setAbilityRect);
  }, [want, phase, boardSize, width, height, refs]);

  const spot = spotlightFor(duel, target, boardSize, { boardRect, padRect, toolbarRect, abilityRect });

  return (
    <>
      {phase === 't0' ? <PrologueCards theme={theme} onDone={() => onGate('prologueDone')} /> : null}

      {phase === 't2' ? (
        <View pointerEvents="box-none" style={styles.demoHost}>
          <GhostDemo kind="rule" theme={theme} digits={DEMO_ROW} />
        </View>
      ) : null}
      {claimDemo ? (
        <View pointerEvents="box-none" style={styles.demoHost}>
          <GhostDemo kind="claim" theme={theme} digits={DEMO_ROW} />
        </View>
      ) : null}

      {spot ? <Spotlight theme={theme} container={spot.container} hole={spot.hole} /> : null}
    </>
  );
}

/** Which container the spotlight must measure for the live target (null = no scrim). */
function wantContainer(target: TutorialSpotTarget): 'board' | 'pad' | 'toolbar' | 'ability' | null {
  if (!target) return null;
  switch (target.kind) {
    case 'board':
    case 'cell':
      return 'board';
    case 'digit':
    case 'erase':
      return 'pad';
    case 'toolbar':
      return 'toolbar';
    case 'ability':
      return 'ability';
    default:
      return null;
  }
}

/** The measured container + the hole inside it; null when nothing is (yet) measurable. */
function spotlightFor(
  duel: DuelRuntime,
  target: TutorialSpotTarget,
  boardSize: number,
  rects: { boardRect: WindowRect; padRect: WindowRect; toolbarRect: WindowRect; abilityRect: WindowRect },
): { container: WindowRect; hole: Rect } | null {
  if (!target) return null;
  switch (target.kind) {
    case 'board': {
      if (!boardSize || rects.boardRect.w <= 0) return null;
      // the wrap is centered in the board area (boardArea's centering law)
      const ox = (rects.boardRect.w - boardSize) / 2;
      const oy = (rects.boardRect.h - boardSize) / 2;
      return {
        container: rects.boardRect,
        hole: { x: Math.max(0, ox), y: Math.max(0, oy), w: boardSize, h: boardSize },
      };
    }
    case 'cell': {
      if (!boardSize || rects.boardRect.w <= 0) return null;
      const ox = (rects.boardRect.w - boardSize) / 2;
      const oy = (rects.boardRect.h - boardSize) / 2;
      const h = cellHole(boardSize, target.cell);
      return { container: rects.boardRect, hole: { x: h.x + ox, y: h.y + oy, w: h.w, h: h.h } };
    }
    case 'digit':
      return rects.padRect.w > 0 ? { container: rects.padRect, hole: digitHole(rects.padRect.w, target.digit) } : null;
    case 'erase':
      return rects.padRect.w > 0 ? { container: rects.padRect, hole: digitHole(rects.padRect.w, 'erase') } : null;
    case 'toolbar':
      return rects.toolbarRect.w > 0 ? { container: rects.toolbarRect, hole: toolbarHole(rects.toolbarRect.w, target.index) } : null;
    case 'ability':
      return rects.abilityRect.w > 0 ? { container: rects.abilityRect, hole: abilityHole(rects.abilityRect.w, augurIndex(duel)) } : null;
    default:
      return null; // t0 covers the room itself; t2 runs the ghost demo; t9/t10 open the room
  }
}

/** the augur tile's position in the Clerk's rite row (the tutorial spec is scholar-owned) */
function augurIndex(duel: DuelRuntime): number {
  const abilities = duel.state.players[0].abilities;
  const ids = Object.keys(abilities);
  const i = ids.indexOf('augur');
  return i >= 0 ? i : 0;
}

const styles = StyleSheet.create({
  // the ghost demos float centered over the room; the demo card itself absorbs nothing
  demoHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gutter,
  },
});
