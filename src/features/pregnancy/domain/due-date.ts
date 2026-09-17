import type { ISODate } from '@/types/iso-date';
import { addDays, isISODate } from '@/utils/date';

/**
 * Days from the last menstrual period to the estimated due date.
 *
 * 280 days — Naegele's rule, the convention obstetric care is built around. It
 * assumes a 28-day cycle with ovulation on day 14, so it is an estimate and not
 * a prediction of the birth.
 *
 * Kept private on purpose: callers ask for the date rather than rebuild the
 * arithmetic from the constant, so there is one place the rule lives.
 */
const GESTATION_LENGTH_DAYS = 280;

/**
 * The due date estimated from the last menstrual period.
 *
 * Pure integer date arithmetic: no `Date` is constructed, so the result does not
 * depend on the host timezone or on when it is asked for. Leap days and year
 * ends are handled by `addDays` rather than approximated.
 */
export function calculateEstimatedDueDate(lastMenstrualPeriodStartDate: ISODate): ISODate {
  if (!isISODate(lastMenstrualPeriodStartDate)) {
    throw new Error(
      `calculateEstimatedDueDate received an invalid lastMenstrualPeriodStartDate: ` +
        `"${lastMenstrualPeriodStartDate}". ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  return addDays(lastMenstrualPeriodStartDate, GESTATION_LENGTH_DAYS);
}
