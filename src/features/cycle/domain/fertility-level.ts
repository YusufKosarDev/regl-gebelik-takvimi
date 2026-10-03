import { getCycleDay } from './cycle-day';
import { isFertileCycleDay } from './fertility-window';
import { estimatedOvulationCycleDay } from './ovulation';
import type { CycleProfile, CycleSettings } from './types';

import type { ISODate } from '@/types/iso-date';

export type FertilityLevel = 'low' | 'elevated' | 'peak';

/**
 * Grades a cycle day that has already been worked out.
 *
 * ## Why this is exported
 *
 * The same reason as `resolveCyclePhase`: the calendar month grades a run of
 * consecutive days and already knows the cycle day of each, so it can ask this
 * directly instead of sending every day back through the record list. This
 * function used to be reached only through the lookup below, which derived the
 * cycle day three times over to answer once — once for itself, once inside the
 * ovulation estimate, and once more inside the window check.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function resolveFertilityLevel(
  settings: CycleSettings,
  cycleDay: number
): FertilityLevel {
  if (cycleDay === estimatedOvulationCycleDay(settings)) {
    return 'peak';
  }

  return isFertileCycleDay(settings, cycleDay) ? 'elevated' : 'low';
}

/**
 * Grades `targetDate` against the *estimated* fertility window.
 *
 * `peak` is the estimated ovulation day itself, `elevated` is the rest of the
 * window, and `low` is everything else in the cycle. Neither the ovulation day
 * nor the window is recomputed here: both come from the existing helpers, so a
 * change to either assumption flows through automatically.
 *
 * The result is an ordinal label only. It carries no percentage, no conception
 * chance, no confidence score and no advice, and it makes no medical claim.
 * Recorded `endDate` values and the average period length are ignored.
 *
 * Profile and target date validation happen inside `getCycleDay`, so invalid
 * input throws before any level is reported.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function getEstimatedFertilityLevel(
  profile: CycleProfile,
  targetDate: ISODate
): FertilityLevel | null {
  const cycleDay = getCycleDay(profile, targetDate);

  if (cycleDay === null) {
    return null;
  }

  return resolveFertilityLevel(profile.settings, cycleDay);
}
