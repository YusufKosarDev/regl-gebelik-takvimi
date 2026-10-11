/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Sky } from '@/constants/sky';
import { Colors, CyclePhaseColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Light unless the system says otherwise; "unspecified" is not a third answer. */
function resolvedScheme(scheme: ReturnType<typeof useColorScheme>): 'light' | 'dark' {
  return scheme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  return Colors[resolvedScheme(useColorScheme())];
}

/**
 * The phase palette for the scheme in force.
 *
 * Its own hook rather than more keys on `useTheme`, because almost nothing in
 * the app draws a phase - the calendar, its legend and the home screen - and
 * every other component would be carrying eight colours it has no use for.
 */
export function useCyclePhaseColors() {
  return CyclePhaseColors[resolvedScheme(useColorScheme())];
}

/**
 * The sky palette for the scheme in force.
 *
 * Separate from `useCyclePhaseColors` because the two are different jobs, not
 * two spellings of one. The phase colours mark data on a calendar and have to
 * survive colour blindness; the sky is atmosphere behind words that name the
 * phase anyway. The long version is in `constants/sky.ts`.
 */
export function useSky() {
  return Sky[resolvedScheme(useColorScheme())];
}
