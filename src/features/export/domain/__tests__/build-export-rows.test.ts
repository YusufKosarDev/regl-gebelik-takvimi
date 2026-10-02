import { EXPORT_COLUMNS, SYMPTOM_SEPARATOR, buildExportRows } from '../build-export-rows';

import type { CyclePhase } from '@/features/cycle/domain/phases';
import type { PeriodRecord } from '@/features/cycle/domain/types';
import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import { toISODate } from '@/utils/date';

/**
 * One row per calendar day, from the first thing recorded to today.
 *
 * The decisions worth pinning are the dense shape - every day present, not only
 * the ones holding something - and that the values are stored ids rather than
 * words, so the file does not change meaning with the app's language.
 */

const date = (value: string) => toISODate(value);

function rowsFor(input: {
  periodRecords?: readonly PeriodRecord[];
  dailyEntries?: readonly DailyEntry[];
  phases?: readonly [string, CyclePhase | null][];
  cycleDays?: readonly [string, number | null][];
  from: string;
  to: string;
}) {
  return buildExportRows({
    periodRecords: input.periodRecords ?? [],
    dailyEntries: input.dailyEntries ?? [],
    phases: new Map((input.phases ?? []).map(([d, p]) => [date(d), p])),
    cycleDays: new Map((input.cycleDays ?? []).map(([d, c]) => [date(d), c])),
    fromDate: date(input.from),
    toDate: date(input.to),
  });
}

/** Column index by name, so the assertions read as what they are about. */
const at = (name: (typeof EXPORT_COLUMNS)[number]) => EXPORT_COLUMNS.indexOf(name);

describe('the shape', () => {
  it('has a row for every day in the range, ends included', () => {
    const rows = rowsFor({ from: '2026-03-01', to: '2026-03-05' });

    expect(rows).toHaveLength(5);
    expect(rows[0][at('date')]).toBe('2026-03-01');
    expect(rows[4][at('date')]).toBe('2026-03-05');
  });

  it('has a row for a day holding nothing at all', () => {
    // The point of a dense file: a day with no record is itself an answer, and
    // a sparse file would make anyone join two tables by hand to see it.
    const rows = rowsFor({ from: '2026-03-01', to: '2026-03-01' });

    expect(rows[0]).toEqual(['2026-03-01', 'no', '', '', '', '', '', '']);
  });

  it('gives every row as many values as there are columns', () => {
    const rows = rowsFor({
      dailyEntries: [
        { date: date('2026-03-02'), flowId: 'light', moodId: 'bad', symptomIds: ['cramps'] },
      ],
      from: '2026-03-01',
      to: '2026-03-03',
    });

    for (const row of rows) {
      expect(row).toHaveLength(EXPORT_COLUMNS.length);
    }
  });
});

describe('period days', () => {
  it('marks every day a finished record covers, and names the record', () => {
    const rows = rowsFor({
      periodRecords: [
        {
          id: 'period-2026-03-02',
          startDate: date('2026-03-02'),
          endDate: date('2026-03-04'),
          isOngoing: false,
        },
      ],
      from: '2026-03-01',
      to: '2026-03-05',
    });

    expect(rows.map((row) => row[at('is_period_day')])).toEqual(['no', 'yes', 'yes', 'yes', 'no']);
    expect(rows[1][at('period_record_id')]).toBe('period-2026-03-02');
  });

  it('runs an ongoing record to the end of the range', () => {
    const rows = rowsFor({
      periodRecords: [
        { id: 'open', startDate: date('2026-03-03'), isOngoing: true },
      ],
      from: '2026-03-01',
      to: '2026-03-05',
    });

    expect(rows.map((row) => row[at('is_period_day')])).toEqual(['no', 'no', 'yes', 'yes', 'yes']);
  });

  it('covers only the first day when the end is not known', () => {
    // Nothing is known about the days after it, so claiming them would be
    // inventing data in a file somebody may show a doctor.
    const rows = rowsFor({
      periodRecords: [
        { id: 'unknown-end', startDate: date('2026-03-03'), isOngoing: false },
      ],
      from: '2026-03-01',
      to: '2026-03-05',
    });

    expect(rows.map((row) => row[at('is_period_day')])).toEqual(['no', 'no', 'yes', 'no', 'no']);
  });
});

describe('the recorded values', () => {
  it('writes stored ids rather than words', () => {
    // So the file means the same thing whatever language the app was in when
    // it was taken, and after a later rewording.
    const rows = rowsFor({
      dailyEntries: [
        {
          date: date('2026-03-02'),
          flowId: 'medium',
          moodId: 'very-bad',
          symptomIds: ['cramps', 'headache'],
        },
      ],
      from: '2026-03-02',
      to: '2026-03-02',
    });

    expect(rows[0][at('flow')]).toBe('medium');
    expect(rows[0][at('mood')]).toBe('very-bad');
    expect(rows[0][at('symptoms')]).toBe(`cramps${SYMPTOM_SEPARATOR}headache`);
  });

  it('carries the phase and the cycle day it was given', () => {
    const rows = rowsFor({
      phases: [['2026-03-02', 'menstrual']],
      cycleDays: [['2026-03-02', 1]],
      from: '2026-03-02',
      to: '2026-03-02',
    });

    expect(rows[0][at('phase')]).toBe('menstrual');
    expect(rows[0][at('cycle_day')]).toBe('1');
  });

  it('leaves a day the cycle cannot place empty rather than guessing', () => {
    const rows = rowsFor({
      phases: [['2026-03-02', null]],
      cycleDays: [['2026-03-02', null]],
      from: '2026-03-02',
      to: '2026-03-02',
    });

    expect(rows[0][at('phase')]).toBe('');
    expect(rows[0][at('cycle_day')]).toBe('');
  });
});

describe('the columns themselves', () => {
  it('are ASCII machine ids', () => {
    // A formula or a script written against this file depends on the column
    // being called the same thing next time, in either language.
    for (const column of EXPORT_COLUMNS) {
      expect(column).toMatch(/^[a-z_]+$/);
    }
  });
});
