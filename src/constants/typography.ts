import { Platform, type TextStyle } from 'react-native';

import { Fonts } from './theme';

/**
 * Every size of text this app uses, in one table.
 *
 * ## Why this file exists
 *
 * The sizes used to live as literals inside `ThemedText`'s stylesheet, and
 * screens that needed a size the scale did not have wrote their own on top. Two
 * things followed from that, and the second one is a real accessibility defect.
 *
 * A fixed `lineHeight` next to a `fontSize` does not survive the system font
 * setting. React Native scales `fontSize` by the device's font scale and leaves
 * `lineHeight` exactly as written, so at the largest Android setting the app's
 * 48dp title was being drawn into a 52dp line box. Letters clipped, lines
 * overlapped, and nothing in the codebase read the font scale at all.
 *
 * ## How the numbers are used
 *
 * `fontSize` is handed to React Native, which scales it. `lineHeight` is
 * multiplied by the same scale in `ThemedText`, so the ratio between them is
 * preserved at every setting. The numbers here are the absolute ones at scale 1,
 * so everything looks exactly as it did before at the default setting - which is
 * also why this moved no existing assertion.
 *
 * `maxFontSizeMultiplier` is set only on the two display sizes. At Android's
 * largest setting a 48dp title becomes 96dp, which is correct and unusable;
 * body text is left uncapped because that is the text somebody turned the
 * setting up to read. The line height is deliberately **not** capped - capping
 * the box while the letters keep growing re-creates the clipping this is here
 * to remove.
 *
 * ## What this table is not, yet
 *
 * Thirty files still carry their own `fontSize`/`lineHeight` pairs in screen
 * stylesheets - `index.tsx` alone has four - so "how big is a heading" still
 * depends on which screen you ask. Those overrides no longer clip, because
 * `ThemedText` scales whatever line height a text ends up with rather than only
 * the ones from this table. Folding them in here is a consistency job across
 * thirty files and a separate piece of work from the accessibility defect.
 */
export type TextScaleEntry = {
  readonly fontSize: number;
  /** Absent only for `code`, which has never had one. */
  readonly lineHeight?: number;
  /** Taken from React Native rather than widened to `number`: the platform
      accepts a fixed set of weights and a stray 450 should not compile. */
  readonly fontWeight?: TextStyle['fontWeight'];
  readonly fontFamily?: string;
  readonly maxFontSizeMultiplier?: number;
};

export type TextType =
  | 'default'
  | 'title'
  | 'small'
  | 'smallBold'
  | 'subtitle'
  | 'link'
  | 'linkPrimary'
  | 'code';

/** How far the display sizes may grow before they stop being readable. */
export const MAX_DISPLAY_FONT_SCALE = 1.4;

export const TEXT_SCALE: Readonly<Record<TextType, TextScaleEntry>> = {
  title: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: 600,
    maxFontSizeMultiplier: MAX_DISPLAY_FONT_SCALE,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
    maxFontSizeMultiplier: MAX_DISPLAY_FONT_SCALE,
  },
  default: { fontSize: 16, lineHeight: 24, fontWeight: 500 },
  small: { fontSize: 14, lineHeight: 20, fontWeight: 500 },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: 700 },
  link: { fontSize: 14, lineHeight: 30 },
  linkPrimary: { fontSize: 14, lineHeight: 30 },
  code: {
    fontSize: 12,
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
  },
};
