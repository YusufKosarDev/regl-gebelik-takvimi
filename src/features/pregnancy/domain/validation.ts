import { calculateEstimatedDueDate } from './due-date';
import type { PregnancyProfile } from './types';

import { isISODate } from '@/utils/date';

/**
 * Checks a stored pregnancy, throwing on the first rule it breaks.
 *
 * The due date is checked against `calculateEstimatedDueDate` rather than
 * recomputed from a second copy of the rule, so this cannot drift away from the
 * formula it is checking.
 *
 * Pure: nothing is mutated and the profile is read exactly as given.
 */
export function validatePregnancyProfile(profile: PregnancyProfile): void {
  if (!isISODate(profile.lastMenstrualPeriodStartDate)) {
    throw new Error(
      `PregnancyProfile has an invalid lastMenstrualPeriodStartDate: ` +
        `"${profile.lastMenstrualPeriodStartDate}".`
    );
  }

  if (!isISODate(profile.estimatedDueDate)) {
    throw new Error(
      `PregnancyProfile has an invalid estimatedDueDate: "${profile.estimatedDueDate}".`
    );
  }

  const expected = calculateEstimatedDueDate(profile.lastMenstrualPeriodStartDate);

  if (profile.estimatedDueDate !== expected) {
    throw new Error(
      `PregnancyProfile has an estimatedDueDate of ${profile.estimatedDueDate}, ` +
        `but ${profile.lastMenstrualPeriodStartDate} gives ${expected}.`
    );
  }
}
