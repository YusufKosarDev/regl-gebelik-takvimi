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
 *
 * Each takes the whole record list as well, because saving now refuses two
 * periods that share a day (`assertNoOverlappingPeriodRecords`): the record
 * next door bounds the steppers exactly as far as the save would let them go.
 * A neighbour with no end date bounds nothing beyond its start, the same
 * stance the floor below has always documented.
 */

/** The record with the latest start before this one's, or `null`. */
function previousRecord(
  record: PeriodRecord,
  records: readonly PeriodRecord[]
): PeriodRecord | null {
  let found: PeriodRecord | null = null;

  for (const candidate of records) {
    if (candidate.id === record.id || daysBetween(candidate.startDate, record.startDate) <= 0) {
      continue;
    }

    if (found === null || daysBetween(found.startDate, candidate.startDate) > 0) {
      found = candidate;
    }
  }

  return found;
}

/** The earliest start after the given one, or `null`. */
function nextStartAfter(startDate: ISODate, records: readonly PeriodRecord[]): ISODate | null {
  let found: ISODate | null = null;

  for (const candidate of records) {
    if (daysBetween(startDate, candidate.startDate) <= 0) {
      continue;
    }

    if (found === null || daysBetween(candidate.startDate, found) > 0) {
      found = candidate.startDate;
    }
  }

  return found;
}

function earlierOf(a: ISODate, b: ISODate): ISODate {
  return daysBetween(a, b) < 0 ? b : a;
}

/**
 * The latest day a period could have finished.
 *
 * Whichever comes first: today, the domain's limit on how long one record may
 * span, or the eve of the next recorded period.
 */
export function maxSelectableEndDate(
  startDate: ISODate,
  today: ISODate,
  records: readonly PeriodRecord[] = []
): ISODate {
  const durationLimit = addDays(startDate, MAX_PERIOD_DURATION_DAYS - 1);
  let bound = earlierOf(durationLimit, today);

  const nextStart = nextStartAfter(startDate, records);

  if (nextStart !== null) {
    bound = earlierOf(bound, addDays(nextStart, -1));
  }

  return bound;
}

/**
 * The latest day a period could have begun.
 *
 * Never after today, and never after the day it ended: a period that finished
 * on the 7th cannot have started on the 9th. A record with no recorded end is
 * held off the next record's start as well, because moving its start there
 * would be the overlap the save refuses.
 */
export function maxSelectableStartDate(
  record: PeriodRecord,
  today: ISODate,
  records: readonly PeriodRecord[] = []
): ISODate {
  let bound = today;

  if (record.endDate !== undefined) {
    bound = earlierOf(bound, record.endDate);
  } else {
    const nextStart = nextStartAfter(record.startDate, records);

    if (nextStart !== null) {
      bound = earlierOf(bound, addDays(nextStart, -1));
    }
  }

  return bound;
}

/**
 * The earliest day a period could have begun, or `null` when nothing bounds it.
 *
 * A recorded end date pins one side: reaching further back would make the
 * record span more days than the domain allows. The previous record's end
 * pins the other: starting on or before it is the overlap the save refuses.
 * With neither to measure against, the stepper is left open rather than given
 * an invented floor.
 */
export function minSelectableStartDate(
  record: PeriodRecord,
  records: readonly PeriodRecord[] = []
): ISODate | null {
  const durationFloor =
    record.endDate === undefined ? null : addDays(record.endDate, -(MAX_PERIOD_DURATION_DAYS - 1));

  const previous = previousRecord(record, records);
  const neighbourFloor =
    previous === null || previous.endDate === undefined ? null : addDays(previous.endDate, 1);

  if (durationFloor === null) {
    return neighbourFloor;
  }

  if (neighbourFloor === null) {
    return durationFloor;
  }

  // The nearer of the two floors is the one that binds.
  return daysBetween(durationFloor, neighbourFloor) > 0 ? neighbourFloor : durationFloor;
}
