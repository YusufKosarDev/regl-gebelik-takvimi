import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile, saveCycleProfile } from '../data/cycle-repository';
import { getUpdatedPeriodRecordId } from '../domain/period-record-id';
import type { CycleProfile, PeriodRecord } from '../domain/types';
import { validateCycleProfile } from '../domain/validation';

import type { ISODate } from '@/types/iso-date';
import { daysBetween, isISODate } from '@/utils/date';

/**
 * `recordId` is the record as it is stored right now. Correcting the start date
 * can change the id, so the caller identifies the record by the id it had when
 * the edit began and reads the new one off the returned profile.
 *
 * `today` is passed in rather than read here, so the rule about future dates is
 * deterministic and the clock stays read in one place in the app.
 */
export type UpdatePeriodStartDateInput = {
  readonly recordId: string;
  readonly startDate: ISODate;
  readonly today: ISODate;
};

/**
 * Corrects the day a recorded period began.
 *
 * Only a finished record can move. A period that is still running started when
 * the person said it started and is being lived through now; changing that here
 * would be editing the present rather than correcting the past.
 *
 * The end date is left exactly as it was, so this edit only ever answers "it
 * actually began earlier/later than I said". How far apart the two ends may be
 * stays the domain's rule, checked by `validateCycleProfile` rather than
 * restated here.
 */
export async function updatePeriodStartDate(
  db: SQLiteDatabase,
  input: UpdatePeriodStartDateInput
): Promise<CycleProfile> {
  const { recordId, startDate, today } = input;

  if (typeof recordId !== 'string' || recordId.trim() === '') {
    throw new Error('updatePeriodStartDate requires a non-empty record id.');
  }

  if (!isISODate(startDate)) {
    throw new Error(
      `updatePeriodStartDate received an invalid startDate. ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  if (!isISODate(today)) {
    throw new Error(
      `updatePeriodStartDate received an invalid today. ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  if (daysBetween(startDate, today) < 0) {
    throw new Error('updatePeriodStartDate cannot record a start date in the future.');
  }

  const profile = await loadCycleProfile(db);

  if (profile === null) {
    throw new Error('updatePeriodStartDate found no saved cycle profile to update.');
  }

  const target = profile.periodRecords.find((record) => record.id === recordId);

  if (target === undefined) {
    throw new Error('updatePeriodStartDate found no period record with that id.');
  }

  if (target.isOngoing) {
    throw new Error(
      'updatePeriodStartDate cannot edit a record while it is ongoing; end it first.'
    );
  }

  // Nothing to write when the answer is already what was asked for. Saving would
  // rewrite every row, and regenerating the id, for no change.
  if (target.startDate === startDate) {
    return profile;
  }

  if (target.endDate !== undefined && daysBetween(startDate, target.endDate) < 0) {
    throw new Error(
      'updatePeriodStartDate cannot start a period after it ended.'
    );
  }

  // The record itself is excluded: it is the one being moved, not a clash.
  const clash = profile.periodRecords.find(
    (record) => record.id !== recordId && record.startDate === startDate
  );

  if (clash !== undefined) {
    throw new Error(
      'updatePeriodStartDate found another period already recorded on that date.'
    );
  }

  const updatedId = getUpdatedPeriodRecordId(target, startDate);

  // A duplicate start date is refused above, so this can only happen when some
  // other record already carries the id this one would be renamed to. Refused
  // rather than resolved: overwriting it would drop a record silently.
  if (
    updatedId !== recordId &&
    profile.periodRecords.some((record) => record.id !== recordId && record.id === updatedId)
  ) {
    throw new Error(
      'updatePeriodStartDate cannot rename the record: ' +
        'another period record already has the id it would take.'
    );
  }

  const updated: CycleProfile = {
    settings: profile.settings,
    periodRecords: profile.periodRecords.map((record) => {
      if (record.id !== recordId) {
        return record;
      }

      // Rebuilt rather than spread over, so a record with no end date does not
      // pick up an `endDate: undefined` key on the way through.
      const corrected: PeriodRecord = { id: updatedId, startDate, isOngoing: false };

      return record.endDate === undefined ? corrected : { ...corrected, endDate: record.endDate };
    }),
  };

  validateCycleProfile(updated);
  await saveCycleProfile(db, updated);

  return updated;
}
