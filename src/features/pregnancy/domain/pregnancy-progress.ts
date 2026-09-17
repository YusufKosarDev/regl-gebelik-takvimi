import type { PregnancyWeek } from './types';

import type { ISODate } from '@/types/iso-date';
import { daysBetween, isISODate } from '@/utils/date';

const DAYS_PER_WEEK = 7;

function assertISODate(caller: string, field: string, value: ISODate): void {
  if (!isISODate(value)) {
    throw new Error(
      `${caller} received an invalid ${field}: "${value}". ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }
}

/**
 * Which day of the pregnancy `targetDate` falls on, counting the LMP itself as
 * day 1.
 *
 * Counting from 1 rather than 0 matches how the weeks are spoken about: the LMP
 * is the first day of week 1, not day zero of week zero.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 *
 * Returns `null` when `targetDate` is before the LMP — there is no day -3 of a
 * pregnancy, and a negative number would quietly flow into the week arithmetic.
 */
export function getPregnancyDay(
  lastMenstrualPeriodStartDate: ISODate,
  targetDate: ISODate
): number | null {
  assertISODate('getPregnancyDay', 'lastMenstrualPeriodStartDate', lastMenstrualPeriodStartDate);
  assertISODate('getPregnancyDay', 'targetDate', targetDate);

  const elapsed = daysBetween(lastMenstrualPeriodStartDate, targetDate);

  return elapsed < 0 ? null : elapsed + 1;
}

/**
 * How far along the pregnancy is on `targetDate`, as a week and a day within it.
 *
 * Week 1 runs from day 1 to day 7, so day 8 is week 2 day 1. Both numbers count
 * from 1.
 *
 * The day count is not recomputed here: it comes from `getPregnancyDay`, so the
 * two can never disagree about which day a date falls on.
 *
 * Returns `null` when `targetDate` is before the LMP.
 */
export function getPregnancyWeek(
  lastMenstrualPeriodStartDate: ISODate,
  targetDate: ISODate
): PregnancyWeek | null {
  const day = getPregnancyDay(lastMenstrualPeriodStartDate, targetDate);

  if (day === null) {
    return null;
  }

  // Shifted to zero-based for the division, then back, so day 7 stays in week 1
  // instead of starting week 2.
  const elapsed = day - 1;

  return {
    week: Math.floor(elapsed / DAYS_PER_WEEK) + 1,
    day: (elapsed % DAYS_PER_WEEK) + 1,
  };
}
