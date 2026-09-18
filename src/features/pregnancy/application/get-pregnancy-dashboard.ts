import type { SQLiteDatabase } from 'expo-sqlite';

import { PREGNANCY_WEEKLY_CONTENT } from '../data/pregnancy-weekly-content';
import { getPregnancyDay, getPregnancyWeek } from '../domain/pregnancy-progress';
import type {
  PregnancyDueDateSource,
  PregnancyWeek,
  PregnancyWeeklyContent,
} from '../domain/types';
import {
  MAX_PREGNANCY_WEEK,
  MIN_PREGNANCY_WEEK,
  getPregnancyWeeklyContent,
} from '../domain/weekly-content';

import { getPregnancyProfile } from './get-pregnancy-profile';

import type { ISODate } from '@/types/iso-date';

/**
 * What a screen needs to show about a pregnancy on one day.
 *
 * `pregnancyDay` and `pregnancyWeek` are `null` together, and only when `today`
 * is before the pregnancy began — a stored profile whose last menstrual period
 * has not arrived yet. The due date is known either way, so it is not optional.
 *
 * `weeklyContent` is `null` whenever there is nothing written to show: before
 * the pregnancy starts, and past week 40, where the sources stop.
 */
export type PregnancyDashboard = {
  readonly today: ISODate;
  readonly pregnancyDay: number | null;
  readonly pregnancyWeek: PregnancyWeek | null;
  readonly estimatedDueDate: ISODate;
  readonly dueDateSource: PregnancyDueDateSource;
  readonly weeklyContent: PregnancyWeeklyContent | null;
};

/**
 * What is written for the week a pregnancy is in, if anything is.
 *
 * A pregnancy that has run past week 40 is asked about nothing: the lookup
 * refuses a week outside the range it covers, and that is a question this should
 * not be asking rather than an error to show someone. The bounds come from the
 * domain rather than being repeated here.
 */
function weeklyContentFor(week: PregnancyWeek | null): PregnancyWeeklyContent | null {
  if (week === null) {
    return null;
  }

  if (week.week < MIN_PREGNANCY_WEEK || week.week > MAX_PREGNANCY_WEEK) {
    return null;
  }

  return getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, week.week);
}

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
  const pregnancyWeek = getPregnancyWeek(lmp, today);

  return {
    today,
    pregnancyDay: getPregnancyDay(lmp, today),
    pregnancyWeek,
    estimatedDueDate: profile.estimatedDueDate,
    dueDateSource: profile.dueDateSource,
    weeklyContent: weeklyContentFor(pregnancyWeek),
  };
}
