import type { ISODate } from '@/types/iso-date';
import { daysBetween, isISODate, toISODate } from '@/utils/date';

/**
 * Reads the `lastPeriodStartDate` route param.
 *
 * Accepts a single real calendar date that is today or earlier. A start date in
 * the future is refused rather than clamped: a cycle cannot have begun after
 * today, and letting one through would give every later calculation a negative
 * cycle day.
 *
 * The comparison goes through `daysBetween` rather than string ordering, so the
 * rule does not silently depend on the format staying lexicographically sortable.
 */
export function parseLastPeriodStartDateParam(
  value: string | string[] | undefined,
  today: ISODate
): ISODate | null {
  if (typeof value !== 'string' || !isISODate(value)) {
    return null;
  }

  const startDate = toISODate(value);

  if (daysBetween(startDate, today) < 0) {
    return null;
  }

  return startDate;
}
