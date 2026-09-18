import type { CycleProfile, PeriodRecord } from './types';

/**
 * The period that is happening now.
 *
 * Found by `isOngoing`, not by a missing end date: a finished period whose end
 * nobody wrote down also has no end date, and treating that as current would
 * offer to "finish" a period from months ago.
 *
 * Pure: the profile is read, never mutated or reordered.
 *
 * Returns `null` when nothing is running. Throws when more than one record is,
 * because there is no honest way to choose between them: picking one silently
 * would close a period the person did not mean to close. A caller that cannot
 * act on that should treat it as a state to report, not to guess at.
 */
export function getOpenPeriodRecord(profile: CycleProfile): PeriodRecord | null {
  const open = profile.periodRecords.filter((record) => record.isOngoing);

  if (open.length === 0) {
    return null;
  }

  if (open.length > 1) {
    throw new Error(
      `getOpenPeriodRecord found ${open.length} ongoing periods; at most 1 is valid.`
    );
  }

  return open[0];
}
