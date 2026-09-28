import type { PeriodRecord } from './types';
import { MAX_PERIOD_DURATION_DAYS } from './limits';

import type { ISODate } from '@/types/iso-date';
import { addDays, daysBetween } from '@/utils/date';

/**
 * The days a recorded period could have begun or ended on.
 *
 * Pure: a record and a date in, a date out. No clock of its own - `today`
 * arrives as an argument - and no storage.
 *
 * These were written beside the history screen, which is where they are used,
 * and they are rules rather than layout: they say what the domain would accept,
 * and the steppers on that screen are bounded by them so a control cannot offer
 * a date that saving would then refuse. Here they can be tested without a
 * screen, and anything else that needs to correct a record gets the same
 * answers.
 *
 * `MAX_PERIOD_DURATION_DAYS` is imported rather than restated, so the picker
 * and validation cannot drift apart.
 */

/**
 * The latest day a period could have finished.
 *
 * Whichever comes first: today, or the domain's limit on how long one record
 * may span.
 */
export function maxSelectableEndDate(startDate: ISODate, today: ISODate): ISODate {
  const durationLimit = addDays(startDate, MAX_PERIOD_DURATION_DAYS - 1);

  return daysBetween(durationLimit, today) < 0 ? today : durationLimit;
}

/**
 * The latest day a period could have begun.
 *
 * Never after today, and never after the day it ended: a period that finished
 * on the 7th cannot have started on the 9th.
 */
export function maxSelectableStartDate(record: PeriodRecord, today: ISODate): ISODate {
  if (record.endDate === undefined) {
    return today;
  }

  return daysBetween(record.endDate, today) < 0 ? today : record.endDate;
}

/**
 * The earliest day a period could have begun, or `null` when nothing bounds it.
 *
 * A recorded end date pins the other side: reaching further back would make the
 * record span more days than the domain allows. With no end date there is
 * nothing to measure against, so the stepper is left open rather than given an
 * invented floor.
 */
export function minSelectableStartDate(record: PeriodRecord): ISODate | null {
  if (record.endDate === undefined) {
    return null;
  }

  return addDays(record.endDate, -(MAX_PERIOD_DURATION_DAYS - 1));
}
