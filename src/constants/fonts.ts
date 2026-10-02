import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import type { TextStyle } from 'react-native';

import { Fonts } from './theme';

/**
 * The two typefaces this app is set in, and how a weight picks a file.
 *
 * ## Why two, and why these two
 *
 * Until now there were none: `expo-font` sat in `package.json` unused and every
 * screen rendered in whatever the phone's system font happened to be. An
 * interface carries most of its character in its typography, so the app had no
 * character to speak of - it read as a form.
 *
 * **Fraunces** is a serif with a little warmth in it, and it is used only where
 * the screen says the thing it exists to say: the date, the cycle day, the
 * pregnancy week. **Figtree** carries everything else. One voice is raised and
 * the rest are quiet; if every size were set in the serif it would be noise
 * rather than emphasis.
 *
 * Both were checked against Turkish before being chosen. Google's `latin-ext`
 * subset covers `U+0100-02BA`, which holds Ğ/ğ, İ and Ş/ş, and dotless `ı`
 * (U+0131) is in the base latin set. A display face missing those would break
 * the source language of this app, and a lot of fashionable ones do.
 *
 * ## Why a weight picks a file rather than being passed through
 *
 * Android does not synthesise across separately registered font files. Loading
 * one Figtree and asking for `fontWeight: 700` gets a faked bold or no bold at
 * all - not the drawn one. Each weight is therefore its own family name, and
 * `fontFamilyFor` maps the weight a style ended up with onto the right file.
 *
 * That mapping happens in `ThemedText` **after** the style is flattened, which
 * is what makes it reach the twenty-three `fontWeight` overrides scattered
 * through screen stylesheets. Resolving the family from the table alone would
 * have left every one of those rendering at the table's weight.
 */

/** Which typeface a piece of text is set in. */
export type FontRole = 'serif' | 'sans' | 'mono';

/**
 * The loadable name of every file, as `useFonts` registers it.
 *
 * Exported as the map so the root layout and this resolver cannot disagree
 * about which files exist.
 */
export const FONT_ASSETS = {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} as const;

const SERIF: Readonly<Record<number, string>> = {
  600: 'Fraunces_600SemiBold',
  700: 'Fraunces_700Bold',
};

const SANS: Readonly<Record<number, string>> = {
  400: 'Figtree_400Regular',
  500: 'Figtree_500Medium',
  600: 'Figtree_600SemiBold',
  700: 'Figtree_700Bold',
};

/**
 * The weight used when a style names none.
 *
 * Four hundred, because that is what the system font was drawing before any of
 * this - a `link` has never asked for a weight and should not start looking
 * heavier for having been given a typeface.
 */
const DEFAULT_WEIGHT = 400;

/** The nearest weight that has a file, so an unavailable one degrades rather than vanishes. */
function nearest(available: Readonly<Record<number, string>>, weight: number): string {
  const weights = Object.keys(available).map(Number);

  let best = weights[0];

  for (const candidate of weights) {
    if (Math.abs(candidate - weight) < Math.abs(best - weight)) {
      best = candidate;
    }
  }

  return available[best];
}

/**
 * The font file a role and a weight resolve to.
 *
 * `mono` ignores the weight and answers with the platform's own monospace,
 * which is what `code` has always used and what a code sample should be set in.
 */
export function fontFamilyFor(
  role: FontRole,
  fontWeight: TextStyle['fontWeight']
): string | undefined {
  if (role === 'mono') {
    return Fonts.mono;
  }

  const weight = Number(fontWeight ?? DEFAULT_WEIGHT);
  const table = role === 'serif' ? SERIF : SANS;

  return nearest(table, Number.isNaN(weight) ? DEFAULT_WEIGHT : weight);
}
