import { predictNextPeriodStart } from '../predictions';
import type { CycleProfile, PeriodRecord } from '../types';

import { toISODate } from '@/utils/date';

function record(id: string, startDate: string): PeriodRecord {
  return { id, startDate: toISODate(startDate) };
}

function profile(
  averageCycleLengthDays: number,
  periodRecords: readonly PeriodRecord[],
  averagePeriodLengthDays = 5
): CycleProfile {
  return {
    settings: { averageCycleLengthDays, averagePeriodLengthDays },
    periodRecords,
  };
}

describe('predictNextPeriodStart', () => {
  it('returns null when there are no period records', () => {
    expect(predictNextPeriodStart(profile(28, []))).toBeNull();
  });

  it('adds the average cycle length to a single record', () => {
    expect(predictNextPeriodStart(profile(28, [record('a', '2026-09-01')]))).toBe('2026-09-29');
  });

  it('handles a short cycle', () => {
    expect(predictNextPeriodStart(profile(21, [record('a', '2026-09-01')]))).toBe('2026-09-22');
  });

  it('handles a long cycle', () => {
    expect(predictNextPeriodStart(profile(35, [record('a', '2026-09-01')]))).toBe('2026-10-06');
  });

  it('crosses a month boundary', () => {
    expect(predictNextPeriodStart(profile(28, [record('a', '2026-01-31')]))).toBe('2026-02-28');
  });

  it('crosses a year boundary', () => {
    expect(predictNextPeriodStart(profile(28, [record('a', '2026-12-20')]))).toBe('2027-01-17');
  });

  it('counts 29 February in a leap year', () => {
    expect(predictNextPeriodStart(profile(28, [record('a', '2024-02-10')]))).toBe('2024-03-09');
  });

  it('skips 29 February in a non-leap year', () => {
    expect(predictNextPeriodStart(profile(28, [record('a', '2026-02-10')]))).toBe('2026-03-10');
  });

  it('uses the most recent start date when several records exist', () => {
    const records = [
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
      record('c', '2026-02-26'),
    ];

    expect(predictNextPeriodStart(profile(28, records))).toBe('2026-03-26');
  });

  it('finds the most recent start date even when records are unordered', () => {
    const unordered = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];

    expect(predictNextPeriodStart(profile(28, unordered))).toBe('2026-03-26');
  });

  it('does not sort or mutate the input records', () => {
    const records = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const input = profile(28, records);
    const snapshot = JSON.parse(JSON.stringify(records));

    predictNextPeriodStart(input);

    expect(records.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(JSON.parse(JSON.stringify(records))).toEqual(snapshot);
    expect(input.periodRecords).toBe(records);
  });

  it('propagates validation errors from an invalid profile', () => {
    expect(() => predictNextPeriodStart(profile(14, [record('a', '2026-09-01')]))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(() =>
      predictNextPeriodStart(
        profile(28, [record('a', '2026-01-01'), record('b', '2026-01-01')])
      )
    ).toThrow(/Duplicate PeriodRecord startDate/);
  });

  it('ignores averagePeriodLengthDays', () => {
    const records = [record('a', '2026-09-01')];

    expect(predictNextPeriodStart(profile(28, records, 1))).toBe('2026-09-29');
    expect(predictNextPeriodStart(profile(28, records, 20))).toBe('2026-09-29');
  });
});
