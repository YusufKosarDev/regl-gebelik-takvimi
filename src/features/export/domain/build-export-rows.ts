import type { CyclePhase } from '@/features/cycle/domain/phases';
import type { PeriodRecord } from '@/features/cycle/domain/types';
import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import type { ISODate } from '@/types/iso-date';
import { addDays, daysBetween } from '@/utils/date';

/**
 * The columns, as machine ids rather than words.
 *
 * ## Why these are not translated
 *
 * A CSV is for a spreadsheet. A stable header is worth more than a familiar
 * one: a formula, a script or a second export written six months later all
 * depend on the column being called the same thing, and a header that changed
 * with the app's language would quietly break every one of them. Somebody
 * reading the file by eye has the readable summary for that - this is the raw
 * half, and raw means stable.
 *
 * Keeping them ASCII also keeps this file clear of the Turkish-letter lint
 * rule without needing an exception, which is a smaller reason but a real one.
 */
export const EXPORT_COLUMNS = [
  'date',
  'is_period_day',
  'period_record_id',
  'cycle_day',
  'phase',
  'flow',
  'symptoms',
  'mood',
] as const;

/** How several symptom ids share one field. */
export const SYMPTOM_SEPARATOR = ';';

export type ExportRowsInput = {
  readonly periodRecords: readonly PeriodRecord[];
  readonly dailyEntries: readonly DailyEntry[];
  readonly phases: ReadonlyMap<ISODate, CyclePhase | null>;
  readonly cycleDays: ReadonlyMap<ISODate, number | null>;
  readonly fromDate: ISODate;
  readonly toDate: ISODate;
};

/**
 * One row per calendar day, from the first thing recorded to today.
 *
 * ## Why dense rather than one row per record
 *
 * A day is the thing both halves of this app are about. A sparse file would
 * need either two tables or a join, and anybody opening it in a spreadsheet
 * would have to do that join by hand to answer "what was happening on the
 * fourteenth". A dense file is a strict superset: every period day and every
 * logged day is in it, and so are the days in between, which are themselves an
 * answer.
 *
 * A few years of days is a few hundred kilobytes of text.
 *
 * ## Values are stored ids, never labels
 *
 * `flow`, `symptoms`, `mood` and `phase` come out as the ids the database
 * holds. They do not change with the app's language or with a later rewording,
 * which is the same reason the headers are not translated.
 *
 * Pure: nothing read from the clock, nothing mutated.
 */
export function buildExportRows(input: ExportRowsInput): readonly (readonly string[])[] {
  const { periodRecords, dailyEntries, phases, cycleDays, fromDate, toDate } = input;

  const entriesByDate = new Map(dailyEntries.map((entry) => [entry.date, entry]));

  // Which record covers a day, so a row can name the record it belongs to
  // rather than only saying yes or no.
  const recordByDate = new Map<ISODate, PeriodRecord>();

  for (const record of periodRecords) {
    // An ongoing period runs to today; one with no end date covers only the day
    // it started, because nothing is known about the days after it.
    const end = record.endDate ?? (record.isOngoing ? toDate : record.startDate);

    for (
      let date = record.startDate;
      daysBetween(date, end) >= 0;
      date = addDays(date, 1)
    ) {
      recordByDate.set(date, record);
    }
  }

  const rows: string[][] = [];

  for (let date = fromDate; daysBetween(date, toDate) >= 0; date = addDays(date, 1)) {
    const entry = entriesByDate.get(date);
    const record = recordByDate.get(date);
    const cycleDay = cycleDays.get(date) ?? null;

    rows.push([
      date,
      record === undefined ? 'no' : 'yes',
      record?.id ?? '',
      cycleDay === null ? '' : String(cycleDay),
      phases.get(date) ?? '',
      entry?.flowId ?? '',
      (entry?.symptomIds ?? []).join(SYMPTOM_SEPARATOR),
      entry?.moodId ?? '',
    ]);
  }

  return rows;
}
