import type { CycleProfile } from './types';
import { validateCycleProfile } from './validation';

import type { ISODate } from '@/types/iso-date';
import { addDays, daysBetween } from '@/utils/date';

/**
 * Predicts the next period start date from the most recent recorded period and
 * the average cycle length.
 *
 * Pure: the profile is read, never sorted or mutated, and nothing here reads the
 * clock or touches a `Date`. The same profile always yields the same answer.
 *
 * Returns `null` when there is no period on record to count forward from.
 */
export function predictNextPeriodStart(profile: CycleProfile): ISODate | null {
  validateCycleProfile(profile);

  let latestStart: ISODate | null = null;

  for (const record of profile.periodRecords) {
    if (latestStart === null || daysBetween(latestStart, record.startDate) > 0) {
      latestStart = record.startDate;
    }
  }

  if (latestStart === null) {
    return null;
  }

  return addDays(latestStart, profile.settings.averageCycleLengthDays);
}
