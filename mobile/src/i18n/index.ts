// ASSIZE mobile — copy loader.
//
// The web build imported its dictionaries directly (`import en from '@/i18n/en.json'`)
// and its Settings screen said "Language: EN" with the structure ready but no runtime
// switching (TODO T14). This loader keeps that promise honest on mobile: one
// dictionary, one `t()`, and `expo-localization`-ready structure — add a locale and
// the whole app follows.
//
// The JSON itself is data and is copied verbatim. Nothing in it may be reworded
// during the port: it is the game's voice, and the story copy is canon.
import en from './en.json';
import story from './story.json';

export type Dictionary = typeof en;
export type StoryDictionary = typeof story;

export const i18n: Dictionary = en as Dictionary;
export const storyJson: StoryDictionary = story as StoryDictionary;

/** Dot-path lookup with a visible fallback: a missing key must be obvious in dev. */
export function t(path: string): string {
  const parts = path.split('.');
  let cur: unknown = i18n as unknown;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  return typeof cur === 'string' ? cur : path;
}

/**
 * Substitution with the web build's `{name}` placeholder style, so copy strings can be
 * moved over without rewriting them.
 */
export function tf(path: string, vars: Record<string, string | number>): string {
  return t(path).replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
}

export type Locale = 'en';
export const LOCALE: Locale = 'en';
