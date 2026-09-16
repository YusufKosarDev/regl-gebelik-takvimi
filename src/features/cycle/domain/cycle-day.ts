import type { CycleProfile } from './types';
import { validateCycleProfile } from './validation';

import type { ISODate } from '@/types/iso-date';
import { daysBetween, isISODate } from '@/utils/date';

/**
 * Returns which day of the current cycle `targetDate` falls on, counting the
 * period start itself as day 1.
 *
 * The reference is the latest recorded period start that is on or before
 * `targetDate`; records that begin later are ignored, so the result reflects the
 * real number of elapsed days rather than an assumed cycle length.
 *
 * Pure: the profile is read, never sorted or mutated, and nothing here reads the
 * clock or touches a `Date`.
 *
 * Returns `null` when no recorded period starts on or before `targetDate`.
 */
export function getCycleDay(profile: CycleProfile, targetDate: ISODate): number | null {
  validateCycleProfile(profile);

  if (!isISODate(targetDate)) {
    throw new Error(
      `getCycleDay received an invalid targetDate: "${targetDate}". ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  let referenceStart: ISODate | null = null;

  for (const record of profile.periodRecords) {
    const isAfterTarget = daysBetween(record.startDate, targetDate) < 0;
    if (isAfterTarget) {
      continue;
    }

    if (referenceStart === null || daysBetween(referenceStart, record.startDate) > 0) {
      referenceStart = record.startDate;
    }
  }

  if (referenceStart === null) {
    return null;
  }

  return daysBetween(referenceStart, targetDate) + 1;
}
