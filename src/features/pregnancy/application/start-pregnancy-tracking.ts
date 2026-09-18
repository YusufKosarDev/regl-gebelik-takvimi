import type { SQLiteDatabase } from 'expo-sqlite';

import { savePregnancyProfile } from '../data/pregnancy-repository';
import { calculateEstimatedDueDate } from '../domain/due-date';
import type { PregnancyProfile } from '../domain/types';
import { validatePregnancyProfile } from '../domain/validation';

import type { ISODate } from '@/types/iso-date';
import { daysBetween, isISODate } from '@/utils/date';

/**
 * `today` is passed in rather than read here, so the rule about future dates is
 * deterministic and the clock stays read in one place in the app.
 */
export type StartPregnancyTrackingInput = {
  readonly lmp: ISODate;
  readonly today: ISODate;
};

/**
 * Begins tracking a pregnancy from the last menstrual period.
 *
 * The due date is calculated rather than asked for: at this point nothing has
 * measured the pregnancy, so the formula is the only thing there is to go on.
 * The profile records that with `dueDateSource: 'lmp'`, which is what lets a
 * later correction be told apart from the calculated date it replaced.
 *
 * A future LMP is refused. A period that has not happened yet cannot be the one
 * a pregnancy started from, and dating from it would put the due date and every
 * week count wrong.
 */
export async function startPregnancyTracking(
  db: SQLiteDatabase,
  input: StartPregnancyTrackingInput
): Promise<PregnancyProfile> {
  const { lmp, today } = input;

  if (!isISODate(lmp)) {
    throw new Error(
      `startPregnancyTracking received an invalid lmp: "${lmp}". ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  if (!isISODate(today)) {
    throw new Error(
      `startPregnancyTracking received an invalid today: "${today}". ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  if (daysBetween(lmp, today) < 0) {
    throw new Error(`startPregnancyTracking cannot start from ${lmp}, which is in the future.`);
  }

  const profile: PregnancyProfile = {
    lastMenstrualPeriodStartDate: lmp,
    estimatedDueDate: calculateEstimatedDueDate(lmp),
    dueDateSource: 'lmp',
  };

  validatePregnancyProfile(profile);
  await savePregnancyProfile(db, profile);

  return profile;
}
