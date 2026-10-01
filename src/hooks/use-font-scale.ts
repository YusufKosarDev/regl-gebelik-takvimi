import { PixelRatio } from 'react-native';

/**
 * How much larger the system is drawing text than the app asked for.
 *
 * `1` at the default setting, up to roughly `2` at Android's largest. This is
 * the only thing in the app that reads it, and it exists so a line box can be
 * grown by the same amount as the letters inside it - React Native scales
 * `fontSize` on its own and leaves `lineHeight` alone, which is what made large
 * text clip.
 *
 * A hook rather than a bare call so the dependency is visible at the call site,
 * and so a future version can subscribe to changes. It does not re-render on a
 * change today: Android restarts the activity when the font scale is changed in
 * settings, so a running screen never sees it move.
 */
export function useFontScale(): number {
  return PixelRatio.getFontScale();
}
