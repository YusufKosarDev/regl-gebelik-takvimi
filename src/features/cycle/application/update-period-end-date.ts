import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile, saveCycleProfile } from '../data/cycle-repository';
import type { CycleProfile, PeriodRecord } from '../domain/types';
import { validateCycleProfile } from '../domain/validation';

import type { ISODate } from '@/types/iso-date';
import { daysBetween, isISODate } from '@/utils/date';

/**
 * `endDate` left out means "this period finished, but nobody recorded when".
 * That is a different thing from a period still running, and this never produces
 * the latter.
 *
 * `today` is passed in rather than read here, so the rule about future dates is
 * deterministic and the clock stays read in one place in the app.
 */
export type UpdatePeriodEndDateInput = {
  readonly recordId: string;
  readonly endDate?: ISODate;
  readonly today: ISODate;
};

/**
 * Corrects when a recorded period ended.
 *
 * Only the end date moves: the start date and the id are what the record is, and
 * changing either would make it a different record rather than a corrected one.
 *
 * A period that is still running is refused. Finishing one has its own flow, and
 * letting this edit close it would be a second way to do the same thing with
 * different rules.
 *
 * How long a record may span stays the domain's rule, checked by
 * `validateCycleProfile` rather than restated here.
 */
export async function updatePeriodEndDate(
  db: SQLiteDatabase,
  input: UpdatePeriodEndDateInput
): Promise<CycleProfile> {
  const { recordId, endDate, today } = input;

  if (typeof recordId !== 'string' || recordId.trim() === '') {
    throw new Error('updatePeriodEndDate requires a non-empty record id.');
  }

  if (!isISODate(today)) {
    throw new Error(
      `updatePeriodEndDate received an invalid today. ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  if (endDate !== undefined) {
    if (!isISODate(endDate)) {
      throw new Error(
        `updatePeriodEndDate received an invalid endDate. ` +
          'Expected a real calendar date in YYYY-MM-DD format.'
      );
    }

    if (daysBetween(endDate, today) < 0) {
      throw new Error('updatePeriodEndDate cannot record an end date in the future.');
    }
  }

  const profile = await loadCycleProfile(db);

  if (profile === null) {
    throw new Error('updatePeriodEndDate found no saved cycle profile to update.');
  }

  const target = profile.periodRecords.find((record) => record.id === recordId);

  if (target === undefined) {
    throw new Error('updatePeriodEndDate found no period record with that id.');
  }

  if (target.isOngoing) {
    throw new Error(
      'updatePeriodEndDate cannot edit a record while it is ongoing; end it instead.'
    );
  }

  if (endDate !== undefined && daysBetween(target.startDate, endDate) < 0) {
    throw new Error(
      'updatePeriodEndDate cannot end a period before it started.'
    );
  }

  // Nothing to write when the answer is already what was asked for. Saving would
  // rewrite every row for no change.
  if (target.endDate === endDate) {
    return profile;
  }

  const updated: CycleProfile = {
    settings: profile.settings,
    periodRecords: profile.periodRecords.map((record) => {
      if (record.id !== recordId) {
        return record;
      }

      // Rebuilt rather than spread over, so clearing the end date really removes
      // the key instead of leaving `endDate: undefined` behind.
      const corrected: PeriodRecord = {
        id: record.id,
        startDate: record.startDate,
        isOngoing: false,
      };

      return endDate === undefined ? corrected : { ...corrected, endDate };
    }),
  };

  validateCycleProfile(updated);
  await saveCycleProfile(db, updated);

  return updated;
}
