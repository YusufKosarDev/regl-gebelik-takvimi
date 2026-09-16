import { getCycleDay } from './cycle-day';
import { getEstimatedOvulationCycleDay } from './ovulation';
import type { CycleProfile } from './types';

import type { ISODate } from '@/types/iso-date';

/** Days before the estimated ovulation day that count as fertile. */
const FERTILE_DAYS_BEFORE_OVULATION = 5;

/** Days after the estimated ovulation day that count as fertile. */
const FERTILE_DAYS_AFTER_OVULATION = 1;

/**
 * Tells whether `targetDate` falls inside the *estimated* fertility window.
 *
 * The window spans the five days before the estimated ovulation day through the
 * day after it, both bounds included, and is clamped to cycle day 1 on short
 * cycles where the opening day would otherwise fall before the cycle starts.
 *
 * It answers membership only: no probability, no conception chance and no
 * low/medium/high level. It is an estimate with no claim to medical accuracy,
 * and recorded `endDate` values and the average period length are deliberately
 * ignored.
 *
 * Profile and target date validation happen inside `getCycleDay`, so invalid
 * input throws before any answer is returned.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function isInEstimatedFertilityWindow(
  profile: CycleProfile,
  targetDate: ISODate
): boolean {
  const cycleDay = getCycleDay(profile, targetDate);

  if (cycleDay === null) {
    return false;
  }

  const estimatedOvulationDay = getEstimatedOvulationCycleDay(profile);
  const effectiveStartDay = Math.max(
    1,
    estimatedOvulationDay - FERTILE_DAYS_BEFORE_OVULATION
  );
  const fertilityEndDay = estimatedOvulationDay + FERTILE_DAYS_AFTER_OVULATION;

  return cycleDay >= effectiveStartDay && cycleDay <= fertilityEndDay;
}
