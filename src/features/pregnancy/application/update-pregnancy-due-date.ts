import type { SQLiteDatabase } from 'expo-sqlite';

import { savePregnancyProfile } from '../data/pregnancy-repository';
import { calculateEstimatedDueDate } from '../domain/due-date';
import type { PregnancyDueDateSource, PregnancyProfile } from '../domain/types';
import { validatePregnancyProfile } from '../domain/validation';

import { getPregnancyProfile } from './get-pregnancy-profile';

import type { ISODate } from '@/types/iso-date';
import { daysBetween, isISODate } from '@/utils/date';
import { describeValue } from '@/shared/logging';

const DUE_DATE_SOURCES: readonly PregnancyDueDateSource[] = ['lmp', 'adjusted'];

/**
 * `today` is passed in for the same reason every other dated mutation takes it:
 * the clock stays read in one place in the app. No rule here depends on it — a
 * due date is a date in the future by nature, and a pregnancy that runs past
 * term has one in the past — so it is checked for being a real date and nothing
 * more.
 */
export type UpdatePregnancyDueDateInput = {
  readonly estimatedDueDate: ISODate;
  readonly source: PregnancyDueDateSource;
  readonly today: ISODate;
};

/**
 * Corrects the estimated due date, or puts it back to what the dates give.
 *
 * Which of those it is comes from `source`, not from comparing the date to the
 * formula: a scan can land on exactly the calculated day and that is still a
 * measured date. So `adjusted` accepts any real date from the last menstrual
 * period onwards, while `lmp` accepts only the one `calculateEstimatedDueDate`
 * produces — anything else claiming to be calculated is a mistake rather than a
 * correction.
 *
 * No upper bound: how far ahead a due date may sit is the domain's business, and
 * it does not set one.
 */
export async function updatePregnancyDueDate(
  db: SQLiteDatabase,
  input: UpdatePregnancyDueDateInput
): Promise<PregnancyProfile> {
  const { estimatedDueDate, source, today } = input;

  if (!DUE_DATE_SOURCES.includes(source)) {
    throw new Error(
      `updatePregnancyDueDate received an invalid source: ${describeValue(source)}. ` +
        'Expected "lmp" or "adjusted".'
    );
  }

  if (!isISODate(estimatedDueDate)) {
    throw new Error(
      `updatePregnancyDueDate received an invalid estimatedDueDate. ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  if (!isISODate(today)) {
    throw new Error(
      `updatePregnancyDueDate received an invalid today. ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  const profile = await getPregnancyProfile(db);

  if (profile === null) {
    throw new Error('updatePregnancyDueDate found no tracked pregnancy to update.');
  }

  const lmp = profile.lastMenstrualPeriodStartDate;

  if (source === 'adjusted' && daysBetween(lmp, estimatedDueDate) < 0) {
    throw new Error(
      'updatePregnancyDueDate cannot set a due date before the pregnancy began.'
    );
  }

  if (source === 'lmp') {
    const calculated = calculateEstimatedDueDate(lmp);

    if (estimatedDueDate !== calculated) {
      throw new Error(
        'updatePregnancyDueDate cannot record a due date that is not the one ' +
          'counted from the last menstrual period.'
      );
    }
  }

  // Nothing to write when the answer is already what was asked for.
  if (profile.estimatedDueDate === estimatedDueDate && profile.dueDateSource === source) {
    return profile;
  }

  const updated: PregnancyProfile = {
    lastMenstrualPeriodStartDate: lmp,
    estimatedDueDate,
    dueDateSource: source,
  };

  validatePregnancyProfile(updated);
  await savePregnancyProfile(db, updated);

  return updated;
}
