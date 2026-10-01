import type { CyclePhase } from '../domain/phases';
import type { CycleProfile } from '../domain/types';

import { buildCycleCalendarMonth } from './build-cycle-calendar-month';

import type { ISODate } from '@/types/iso-date';
import { canShiftYearMonth, daysBetween, getYearMonth, shiftYearMonth } from '@/utils/date';

/**
 * How many months one call may cover.
 *
 * A hundred years. Not a performance limit - it is a guard against a stored
 * date that should not exist. `toISODate` accepts any year from 0 to 9999, so a
 * corrupted row could ask this to walk a hundred thousand months and the loop
 * would simply keep going.
 */
export const MAX_INDEXED_MONTHS = 1200;

/**
 * Which cycle phase each date between two days falls in.
 *
 * `null` for a date the cycle cannot place - anything before the first recorded
 * period, and anything in a profile with no records at all. A caller must treat
 * that as "no opinion" rather than as a phase, which is why it is in the map
 * rather than left out of it.
 *
 * ## Why it builds months rather than asking day by day
 *
 * `getCyclePhase` runs `validateCycleProfile`, and so does every one of the four
 * phase functions underneath it. Asking it about two years of daily entries
 * would be something like three and a half thousand validations of the same
 * profile. `buildCycleCalendarMonth` does the work once per month and is already
 * the thing the calendar is drawn from, so the phases behind a symptom summary
 * and the phases on screen come from the same place by construction.
 *
 * Pure: no clock, no database, and the profile is read without being sorted or
 * mutated.
 */
export function buildCyclePhaseIndex(
  profile: CycleProfile,
  fromDate: ISODate,
  toDate: ISODate
): ReadonlyMap<ISODate, CyclePhase | null> {
  const index = new Map<ISODate, CyclePhase | null>();

  if (daysBetween(fromDate, toDate) < 0) {
    return index;
  }

  const last = getYearMonth(toDate);
  let { year, month } = getYearMonth(fromDate);
  let months = 0;

  for (;;) {
    months += 1;

    if (months > MAX_INDEXED_MONTHS) {
      throw new Error(
        `buildCyclePhaseIndex was asked to cover more than ${MAX_INDEXED_MONTHS} months. ` +
          'That is longer than anybody has been recording, so one of the dates is wrong.'
      );
    }

    for (const day of buildCycleCalendarMonth(profile, year, month).days) {
      if (daysBetween(fromDate, day.date) >= 0 && daysBetween(day.date, toDate) >= 0) {
        index.set(day.date, day.phase);
      }
    }

    if (year === last.year && month === last.month) {
      return index;
    }

    // Cannot happen for dates the index was given, since both are real dates
    // inside the supported range - but the shift is refused at the ends of that
    // range, and walking off one silently would be a loop that never finishes.
    if (!canShiftYearMonth(year, month, 1)) {
      return index;
    }

    ({ year, month } = shiftYearMonth(year, month, 1));
  }
}
