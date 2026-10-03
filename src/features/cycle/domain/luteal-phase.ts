import { getCycleDay } from './cycle-day';
import { estimatedOvulationCycleDay } from './ovulation';
import type { CycleProfile, CycleSettings } from './types';

import type { ISODate } from '@/types/iso-date';

/**
 * The rule itself: whether a cycle day falls after the estimated ovulation day.
 *
 * Separate from the lookup below for the reason given beside
 * `isMenstrualCycleDay`: the rule needs a cycle day, not the record list.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function isLutealCycleDay(settings: CycleSettings, cycleDay: number): boolean {
  const estimatedOvulationDay = estimatedOvulationCycleDay(settings);

  // Defensive: settings validation keeps the cycle length at 15 or more, so this
  // cannot be reached today, but the rule does not depend on that holding.
  if (estimatedOvulationDay < 1) {
    return false;
  }

  return cycleDay > estimatedOvulationDay;
}

/**
 * Tells whether `targetDate` falls inside the *expected* luteal phase.
 *
 * The phase opens the day after the estimated ovulation day and has no upper
 * bound: `getCycleDay` keeps counting from the last recorded period start, so a
 * late cycle stays luteal past the average cycle length rather than wrapping
 * around. It is a prediction with no claim to medical accuracy, and recorded
 * `endDate` values and the average period length are deliberately ignored.
 *
 * Profile and target date validation happen inside `getCycleDay`, so invalid
 * input throws before any phase is reported.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function getLutealPhase(profile: CycleProfile, targetDate: ISODate): 'luteal' | null {
  const cycleDay = getCycleDay(profile, targetDate);

  if (cycleDay === null) {
    return null;
  }

  return isLutealCycleDay(profile.settings, cycleDay) ? 'luteal' : null;
}
