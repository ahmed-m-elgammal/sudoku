// loadFonts.ts — registers the canon families from tokens.fonts with expo-font.
//
// The web build's identity rests on three Google Fonts (tokens.css):
//
//   --font-display: 'IM Fell English SC'   -> headings, the wordmark, screen titles
//   --font-body:    'IM Fell DW Pica'      -> running text (the boot line is its italic)
//   --font-digit:   'Libre Caslon Text'    -> board digits and counters
//
// Spec 1.1 demands these be registered BEFORE the first screen renders — fonts are
// loaded in the root Boot component (App.tsx), which renders nothing but a black view
// until this returns true. That satisfies the spec's "first screen, no prior load":
// by the time BootScreen (or any screen) paints, every name in tokens.fonts resolves.
//
// RN cannot synthesize italics or weights for custom-loaded fonts reliably across
// platforms (Android renders the regular file; iOS drops to regular), so the italic and
// bold cuts are registered under their own family names from tokens.fonts (bodyItalic,
// digitBold) instead of relying on fontStyle/fontWeight matching.

import { useFonts } from 'expo-font';
import { IMFellEnglishSC_400Regular } from '@expo-google-fonts/im-fell-english-sc';
import { IMFellDWPica_400Regular, IMFellDWPica_400Regular_Italic } from '@expo-google-fonts/im-fell-dw-pica';
import { LibreCaslonText_400Regular, LibreCaslonText_700Bold } from '@expo-google-fonts/libre-caslon-text';
import { fonts } from './tokens';

/** Load every family tokens.fonts names. Returns true once all are registered. */
export function useAssizeFonts(): boolean {
  const [loaded] = useFonts({
    [fonts.display]: IMFellEnglishSC_400Regular,
    [fonts.body]: IMFellDWPica_400Regular,
    [fonts.bodyItalic]: IMFellDWPica_400Regular_Italic,
    [fonts.digit]: LibreCaslonText_400Regular,
    [fonts.digitBold]: LibreCaslonText_700Bold,
  });
  return !!loaded;
}
