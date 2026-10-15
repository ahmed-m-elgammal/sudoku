// endlessLaw.ts — P3.1: the Endless Assize remembers the ending
// (docs/STORY_HOLD_PLAN.md P3.1).
//
// Extracted pure so the gate can pin it without native chrome (the screen
// module pulls image registries the runner cannot parse). Pre-ending saves
// keep the shipped line; the verdict swaps it once, forever.
import { i18n } from '@/i18n';

export type CampaignEnding = 'balance' | 'burn';

export function endlessSubFor(ending: CampaignEnding | undefined): string {
  if (ending === 'burn') return i18n.endless.subBurned;
  if (ending === 'balance') return i18n.endless.subBalanced;
  return i18n.endless.sub;
}
