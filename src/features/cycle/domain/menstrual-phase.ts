import { getCycleDay } from './cycle-day';
import type { CycleProfile, CycleSettings } from './types';

import type { ISODate } from '@/types/iso-date';

/**
 * The rule itself: whether a cycle day falls inside the expected period.
 *
 * ## Why the rule is separate from the lookup
 *
 * The rule needs a cycle day and the settings. It does not need the record
 * list - working out *which* cycle day a date falls on is the part that reads
 * the records, and `getCyclePhase` was redoing that once per phase to answer a
 * single question. The rule is stated once, here, and the function below is a
 * thin lookup in front of it.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function isMenstrualCycleDay(settings: CycleSettings, cycleDay: number): boolean {
  return cycleDay >= 1 && cycleDay <= settings.averagePeriodLengthDays;
}

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

  return isMenstrualCycleDay(profile.settings, cycleDay) ? 'menstrual' : null;
}
