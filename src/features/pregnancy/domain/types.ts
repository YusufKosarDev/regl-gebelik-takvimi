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

/**
 * Where a piece of content came from.
 *
 * `name` is what to credit it as, `url` where it can be read. Both are required:
 * a citation nobody can follow is not a citation.
 */
export type PregnancyContentSource = {
  readonly name: string;
  readonly url: string;
};

/**
 * How big the pregnancy is in a given week, in words.
 *
 * `label` is the measurement itself ("2,5 cm"), `comparison` the everyday thing
 * it is being held up against. They are separate because a screen may want the
 * measurement without the comparison, and because a translation will not always
 * reach for the same object.
 */
export type PregnancyContentSize = {
  readonly label: string;
  readonly comparison: string;
};

/**
 * What there is to say about one week of a pregnancy.
 *
 * Content, not measurement: every field is written text meant to be read as-is,
 * and nothing here is calculated from a date. `week` is which week it belongs
 * to, matching the `week` of `PregnancyWeek`.
 *
 * `size` is optional because the earliest weeks do not have one worth stating.
 * Week 1 is counted from the last menstrual period, before conception, and there
 * is nothing to measure or compare; a made-up figure would be worse than no
 * figure, so the type lets a week simply not have one.
 *
 * `sources` is required rather than optional. This is text about someone's
 * pregnancy, and a claim with nothing behind it should not be writable in the
 * first place — the type is where that is easiest to enforce.
 */
export type PregnancyWeeklyContent = {
  readonly week: number;
  readonly size?: PregnancyContentSize;
  readonly developmentSummary: string;
  readonly developingFeatures: readonly string[];
  readonly sources: readonly PregnancyContentSource[];
};
