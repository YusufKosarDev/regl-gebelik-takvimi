import type { ISODate } from '@/types/iso-date';

/**
 * Where a due date came from.
 *
 * - `lmp` — counted from the last menstrual period, and nothing has changed it.
 * - `adjusted` — someone replaced it, typically after a dating scan measured the
 *   pregnancy as further along or behind what the LMP suggested.
 *
 * Stored rather than inferred by comparing the date to the formula: a scan can
 * land on exactly the day the LMP predicted, and that is still a measured date
 * rather than a calculated one.
 */
export type PregnancyDueDateSource = 'lmp' | 'adjusted';

/**
 * A pregnancy, as the app tracks it.
 *
 * Dated from the last menstrual period rather than from conception, which is how
 * pregnancies are dated in practice: the LMP is a day the person can name, and
 * the day of conception usually is not.
 *
 * `estimatedDueDate` is stored rather than derived on every read, because it is
 * not always the calculated one. `dueDateSource` says which it is, and decides
 * what may be checked about it: a calculated date has to match the formula
 * exactly, while a measured one only has to be a real date that is not before
 * the pregnancy began.
 */
export type PregnancyProfile = {
  readonly lastMenstrualPeriodStartDate: ISODate;
  readonly estimatedDueDate: ISODate;
  readonly dueDateSource: PregnancyDueDateSource;
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
