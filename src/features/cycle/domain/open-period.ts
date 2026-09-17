import type { CycleProfile, PeriodRecord } from './types';

/**
 * The period that has started but not been recorded as finished.
 *
 * Pure: the profile is read, never mutated or reordered.
 *
 * Returns `null` when nothing is open. Throws when more than one record is,
 * because there is no honest way to choose between them: picking one silently
 * would close a period the person did not mean to close. A caller that cannot
 * act on that should treat it as a state to report, not to guess at.
 */
export function getOpenPeriodRecord(profile: CycleProfile): PeriodRecord | null {
  const open = profile.periodRecords.filter((record) => record.endDate === undefined);

  if (open.length === 0) {
    return null;
  }

  if (open.length > 1) {
    throw new Error(
      `getOpenPeriodRecord found ${open.length} periods without an end date: ` +
        `${open.map((record) => record.startDate).join(', ')}.`
    );
  }

  return open[0];
}
