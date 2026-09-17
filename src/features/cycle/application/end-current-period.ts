import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile, saveCycleProfile } from '../data/cycle-repository';
import { getOpenPeriodRecord } from '../domain/open-period';
import type { CycleProfile } from '../domain/types';
import { validateCycleProfile } from '../domain/validation';

import type { ISODate } from '@/types/iso-date';
import { daysBetween, isISODate } from '@/utils/date';

/**
 * `today` is passed in rather than read here, so the rule about future dates is
 * deterministic and the clock stays read in one place in the app.
 */
export type EndCurrentPeriodInput = {
  readonly endDate: ISODate;
  readonly today: ISODate;
};

/**
 * Records the day the open period ended.
 *
 * Only that record changes: every other record keeps its id, its dates and its
 * place in the list, and the caller's profile is not mutated.
 *
 * How long a record may span is the domain's rule, checked by
 * `validateCycleProfile` rather than restated here.
 */
export async function endCurrentPeriod(
  db: SQLiteDatabase,
  input: EndCurrentPeriodInput
): Promise<CycleProfile> {
  const { endDate, today } = input;

  if (!isISODate(endDate)) {
    throw new Error(
      `endCurrentPeriod received an invalid endDate: "${endDate}". ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  if (!isISODate(today)) {
    throw new Error(
      `endCurrentPeriod received an invalid today: "${today}". ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  if (daysBetween(endDate, today) < 0) {
    throw new Error(`endCurrentPeriod cannot record ${endDate}, which is in the future.`);
  }

  const profile = await loadCycleProfile(db);

  if (profile === null) {
    throw new Error('endCurrentPeriod found no saved cycle profile to update.');
  }

  const open = getOpenPeriodRecord(profile);

  if (open === null) {
    throw new Error('endCurrentPeriod found no open period to end.');
  }

  if (daysBetween(open.startDate, endDate) < 0) {
    throw new Error(
      `endCurrentPeriod cannot end a period on ${endDate}, ` +
        `before it started on ${open.startDate}.`
    );
  }

  const updated: CycleProfile = {
    settings: profile.settings,
    periodRecords: profile.periodRecords.map((record) =>
      record.id === open.id ? { ...record, endDate } : record
    ),
  };

  validateCycleProfile(updated);
  await saveCycleProfile(db, updated);

  return updated;
}
