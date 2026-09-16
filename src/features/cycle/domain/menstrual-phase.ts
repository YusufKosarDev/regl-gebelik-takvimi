import { getCycleDay } from './cycle-day';
import type { CycleProfile } from './types';

import type { ISODate } from '@/types/iso-date';

/**
 * Tells whether `targetDate` falls inside the *expected* menstrual phase.
 *
 * The window is derived purely from `averagePeriodLengthDays`, counting from the
 * cycle day: it is a prediction, not a statement about actual bleeding. Recorded
 * `endDate` values are deliberately ignored here; real bleeding duration belongs
 * to a later record/symptom layer.
 *
 * Profile and target date validation happen inside `getCycleDay`, so invalid
 * input throws before any phase is reported.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function getMenstrualPhase(
  profile: CycleProfile,
  targetDate: ISODate
): 'menstrual' | null {
  const cycleDay = getCycleDay(profile, targetDate);

  if (cycleDay === null) {
    return null;
  }

  const isWithinExpectedPeriod =
    cycleDay >= 1 && cycleDay <= profile.settings.averagePeriodLengthDays;

  return isWithinExpectedPeriod ? 'menstrual' : null;
}
