import type { SQLiteDatabase } from 'expo-sqlite';

import { getPregnancyDay, getPregnancyWeek } from '../domain/pregnancy-progress';
import type { PregnancyDueDateSource, PregnancyWeek } from '../domain/types';

import { getPregnancyProfile } from './get-pregnancy-profile';

import type { ISODate } from '@/types/iso-date';

/**
 * What a screen needs to show about a pregnancy on one day.
 *
 * `pregnancyDay` and `pregnancyWeek` are `null` together, and only when `today`
 * is before the pregnancy began — a stored profile whose last menstrual period
 * has not arrived yet. The due date is known either way, so it is not optional.
 */
export type PregnancyDashboard = {
  readonly today: ISODate;
  readonly pregnancyDay: number | null;
  readonly pregnancyWeek: PregnancyWeek | null;
  readonly estimatedDueDate: ISODate;
  readonly dueDateSource: PregnancyDueDateSource;
};

/**
 * The pregnancy summary for `today`, or `null` when no pregnancy is tracked.
 *
 * Every number comes from a domain function rather than being recomputed here,
 * so this and the rest of the app cannot disagree about how far along a
 * pregnancy is.
 *
 * `today` is passed in rather than read here, so the answer is deterministic and
 * the clock stays read in one place in the app.
 */
export async function getPregnancyDashboard(
  db: SQLiteDatabase,
  today: ISODate
): Promise<PregnancyDashboard | null> {
  const profile = await getPregnancyProfile(db);

  if (profile === null) {
    return null;
  }

  const lmp = profile.lastMenstrualPeriodStartDate;

  return {
    today,
    pregnancyDay: getPregnancyDay(lmp, today),
    pregnancyWeek: getPregnancyWeek(lmp, today),
    estimatedDueDate: profile.estimatedDueDate,
    dueDateSource: profile.dueDateSource,
  };
}
