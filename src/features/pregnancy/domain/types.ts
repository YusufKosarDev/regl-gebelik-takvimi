import type { ISODate } from '@/types/iso-date';

/**
 * A pregnancy, as the app tracks it.
 *
 * Dated from the last menstrual period rather than from conception, which is how
 * pregnancies are dated in practice: the LMP is a day the person can name, and
 * the day of conception usually is not.
 *
 * `estimatedDueDate` is stored rather than derived on every read so that a due
 * date a doctor corrected — after a dating scan, say — has somewhere to live.
 * Until something corrects it, it is what `calculateEstimatedDueDate` produces,
 * which is what `validatePregnancyProfile` checks.
 */
export type PregnancyProfile = {
  readonly lastMenstrualPeriodStartDate: ISODate;
  readonly estimatedDueDate: ISODate;
};

/**
 * How far along a pregnancy is, the way it is spoken about: "28 weeks and 3
 * days".
 *
 * `week` counts from 1 and `day` is the day within that week, 1 to 7. So the LMP
 * itself is week 1 day 1, and the day after week 1 ends is week 2 day 1.
 */
export type PregnancyWeek = {
  readonly week: number;
  readonly day: number;
};
