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
 * The furthest ahead of the last menstrual period an entered due date may sit.
 *
 * A sanity bound, deliberately loose, and it makes no clinical claim. A dating
 * scan moves a due date by days or a couple of weeks; what this refuses is the
 * class of thing nobody meant — a date before the pregnancy began, or one years
 * away because a year was mistyped.
 *
 * It is not ±3 weeks around `calculateEstimatedDueDate`, and that was a
 * deliberate decision rather than an oversight. A window that tight embeds a
 * clinical judgement this app avoids making everywhere else — the weekly
 * content is "content, not measurement" and every label in it is a "may" — and
 * it would refuse a legitimate date from a late scan or an atypical case. A
 * year refuses nothing real.
 *
 * Lives beside the formula rather than in a `limits.ts` of its own: the cycle
 * feature has one because six screens and three validators read its numbers,
 * and this is one number read by one assertion.
 */
export const MAX_ADJUSTED_DUE_DATE_DAYS = 365;

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
      'calculateEstimatedDueDate received an invalid lastMenstrualPeriodStartDate. ' +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  return addDays(lastMenstrualPeriodStartDate, GESTATION_LENGTH_DAYS);
}
