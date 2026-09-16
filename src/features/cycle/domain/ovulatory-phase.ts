import { getCycleDay } from './cycle-day';
import { getEstimatedOvulationCycleDay } from './ovulation';
import type { CycleProfile } from './types';

import type { ISODate } from '@/types/iso-date';

/**
 * Tells whether `targetDate` falls on the *expected* ovulation day.
 *
 * The estimate is a single cycle day derived from the average cycle length, so
 * it is a prediction with no claim to medical accuracy. It says nothing about
 * fertility or the chance of conceiving, and recorded `endDate` values and the
 * average period length are deliberately ignored.
 *
 * Profile and target date validation happen inside `getCycleDay`, so invalid
 * input throws before any phase is reported.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function getOvulatoryPhase(
  profile: CycleProfile,
  targetDate: ISODate
): 'ovulatory' | null {
  const cycleDay = getCycleDay(profile, targetDate);

  if (cycleDay === null) {
    return null;
  }

  const estimatedOvulationDay = getEstimatedOvulationCycleDay(profile);

  // Defensive: settings validation keeps the cycle length at 15 or more, so this
  // cannot be reached today, but the rule does not depend on that holding.
  if (estimatedOvulationDay < 1) {
    return null;
  }

  return cycleDay === estimatedOvulationDay ? 'ovulatory' : null;
}
