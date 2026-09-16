import { getCycleDay } from './cycle-day';
import { isInEstimatedFertilityWindow } from './fertility-window';
import { getEstimatedOvulationCycleDay } from './ovulation';
import type { CycleProfile } from './types';

import type { ISODate } from '@/types/iso-date';

export type FertilityLevel = 'low' | 'elevated' | 'peak';

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

  if (cycleDay === getEstimatedOvulationCycleDay(profile)) {
    return 'peak';
  }

  return isInEstimatedFertilityWindow(profile, targetDate) ? 'elevated' : 'low';
}
