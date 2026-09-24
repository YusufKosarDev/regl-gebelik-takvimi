/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * The brand palette, as it appears in the app icon and the splash screen.
 *
 * These are the artwork colours. They are not the accent the interface uses:
 * `Brand.main` on white is 3.72:1, which is under WCAG AA for text, so
 * the interface uses a darker sibling in light mode and a lighter one in dark
 * mode (see `Colors.light.primary` and `Colors.dark.primary` below).
 * The artwork these come from lives in `assets/icon-source/`.
 */
export const Brand = {
  /** Lavender mist. The crescent itself. */
  light: '#EDE8FA',
  /** Supporting lavender. The disc beside the crescent. */
  mid: '#C3B6E4',
  /** Muted lavender. The light end of the icon's background. */
  main: '#8B7AC0',
  /** Deep plum-indigo. The dark end of the icon's background. */
  deep: '#4A3D78',
} as const;

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    /**
     * The accent: primary buttons, the on position of a switch, a selected
     * tile, a link. A darkened `Brand.main`, chosen so white text on it
     * reaches 5.30:1 and so it still reaches 4.66:1 as link text on
     * `backgroundElement`. Brand.main itself reaches neither.
     */
    primary: '#7160AB',
    /** What goes on top of `primary`. 5.30:1. */
    onPrimary: '#ffffff',
    /**
     * The on position of a switch.
     *
     * Its own pair rather than `primary`/`onPrimary`, because Android draws the
     * thumb slightly proud of the track: whatever colour the thumb is also
     * has to hold against the card behind it, not only against the track.
     * Here the white thumb sits inside a purple track, which is what a light
     * switch looks like everywhere else on the phone.
     */
    switchTrackOn: '#7160AB',
    switchThumbOn: '#ffffff',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    /** The same accent lifted for a dark background: 9.71:1 on it, 7.35:1 on an element. */
    primary: '#B6A9DD',
    /** What goes on top of `primary`. 7.42:1. Plum, not black, to stay in the family. */
    onPrimary: '#241C3D',
    /**
     * The on position of a switch, the other way round.
     *
     * A dark thumb on a light track reads correctly by the numbers and badly
     * on screen: the part of the thumb that overhangs the track disappears
     * into the card, and the control turns into a lavender half-pill. Dim
     * track, bright thumb is both legible and what Android does in the dark.
     */
    switchTrackOn: '#4A3D78',
    switchThumbOn: '#B6A9DD',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
