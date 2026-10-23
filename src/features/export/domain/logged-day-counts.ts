import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import { mostLogged } from '@/features/daily-log/domain/most-logged';
import { MIN_ENTRIES_FOR_CORRELATION } from '@/features/daily-log/domain/symptom-phase-correlation';

/**
 * How many days something has to have been written on to reach the page.
 *
 * The daily-log domain's five, not a second number that happens to agree with
 * it today. `records-summary.tsx` aliases the same constant for the same
 * reason, and the reason the document needs a floor at all is written in
 * `logged-day-counts.test.ts` and in `pdfCountsBelowFloor`.
 */
export const MIN_DAYS_FOR_DOCUMENT_COUNT = MIN_ENTRIES_FOR_CORRELATION;

/** One thing that was written down, with the word for it already chosen. */
export type LoggedDayCount = {
  readonly label: string;
  readonly days: number;
};

export type LoggedDayCounts = {
  /** Most written down first; ties broken by id, so two exports agree. */
  readonly listed: readonly LoggedDayCount[];
  /**
   * `true` when something this build has a word for was written on fewer days
   * than the floor, so the page can say that rather than leaving a gap.
   *
   * An id with no word in this build does not set it. That absence has a
   * different cause, and `pdfCountsBelowFloor` explaining it would be the page
   * accounting for something it has not got.
   */
  readonly hasBelowFloor: boolean;
};

/**
 * What the printable document counts.
 *
 * Symptoms and moods in one tally, because the section is one section and a
 * reader has no use for the boundary between two catalogues. `mostLogged` does
 * the counting, so the order is total: most written down first, ties broken by
 * id, which is what stops two exports of the same data disagreeing.
 *
 * ## Why the ids are deduplicated on the way in
 *
 * `mostLogged` adds one per id it is handed, so a stored day holding the same
 * symptom twice would count as two days. On a screen that cannot happen - the
 * chips are a toggle - but this reads whatever the database holds, and a count
 * of mentions printed under a heading that says days would be a wrong number
 * on a page somebody takes to an appointment. The `Set` makes the row shape
 * irrelevant. `most-logged.ts` is left alone deliberately: changing it would
 * change the records-summary screen too, and the fix belongs where the risk is.
 *
 * ## Why the labels are resolved before the floor is applied
 *
 * Both are reasons to leave a row off the page, and only one of them is a
 * reason to tell the reader so. Resolving first means `hasBelowFloor` is
 * computed over rows the page could actually have printed, so the sentence it
 * switches on is true about what is missing.
 *
 * ## It counts, it does not explain
 *
 * `most-logged.ts` states the rule this inherits: "'Cramps, eleven days' is a
 * count of what somebody wrote down. It is not a measure of how often they had
 * cramps, and nothing downstream may dress it as one." This is the furthest
 * downstream that number travels, which is why `pdfCountsNote` says it on the
 * page instead of trusting the reader to remember it.
 */
export function countLoggedDaysForDocument(
  entries: readonly DailyEntry[],
  labelOf: (id: string) => string | null
): LoggedDayCounts {
  const counted = mostLogged(
    entries,
    (entry) => [
      ...new Set([...entry.symptomIds, ...(entry.moodId === null ? [] : [entry.moodId])]),
    ],
    Number.POSITIVE_INFINITY
  );

  const named = counted
    .map((row) => ({ label: labelOf(row.id), days: row.count }))
    .filter((row): row is LoggedDayCount => row.label !== null);

  return {
    listed: named.filter((row) => row.days >= MIN_DAYS_FOR_DOCUMENT_COUNT),
    hasBelowFloor: named.some((row) => row.days < MIN_DAYS_FOR_DOCUMENT_COUNT),
  };
}
