import { getCycleDay } from '../cycle-day';
import type { CycleProfile, PeriodRecord } from '../types';

import type { ISODate } from '@/types/iso-date';
import { toISODate } from '@/utils/date';

function record(id: string, startDate: string): PeriodRecord {
  return { id, startDate: toISODate(startDate) };
}

function profile(
  periodRecords: readonly PeriodRecord[],
  averageCycleLengthDays = 28
): CycleProfile {
  return {
    settings: { averageCycleLengthDays, averagePeriodLengthDays: 5 },
    periodRecords,
  };
}

const single = [record('a', '2026-09-01')];

describe('getCycleDay', () => {
  it('returns null when there are no period records', () => {
    expect(getCycleDay(profile([]), toISODate('2026-09-01'))).toBeNull();
  });

  it('counts the period start itself as day 1', () => {
    expect(getCycleDay(profile(single), toISODate('2026-09-01'))).toBe(1);
  });

  it('counts the next day as day 2', () => {
    expect(getCycleDay(profile(single), toISODate('2026-09-02'))).toBe(2);
  });

  it('counts day 28', () => {
    expect(getCycleDay(profile(single), toISODate('2026-09-28'))).toBe(28);
  });

  it('keeps counting past the average cycle length', () => {
    expect(getCycleDay(profile(single), toISODate('2026-10-01'))).toBe(31);
  });

  it('counts across a month boundary', () => {
    expect(getCycleDay(profile([record('a', '2026-01-25')]), toISODate('2026-02-03'))).toBe(10);
  });

  it('counts across a year boundary', () => {
    expect(getCycleDay(profile([record('a', '2026-12-25')]), toISODate('2027-01-05'))).toBe(12);
  });

  it('counts 29 February in a leap year', () => {
    expect(getCycleDay(profile([record('a', '2024-02-20')]), toISODate('2024-03-01'))).toBe(11);
  });

  it('skips 29 February in a non-leap year', () => {
    expect(getCycleDay(profile([record('a', '2026-02-20')]), toISODate('2026-03-01'))).toBe(10);
  });

  it('uses the latest period start on or before the target date', () => {
    const records = [
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
      record('c', '2026-02-26'),
    ];

    expect(getCycleDay(profile(records), toISODate('2026-02-10'))).toBe(13);
  });

  it('ignores period records that start after the target date', () => {
    const records = [record('a', '2026-01-01'), record('c', '2026-02-26')];

    expect(getCycleDay(profile(records), toISODate('2026-01-10'))).toBe(10);
  });

  it('returns 1 when the target date is itself a later period start', () => {
    const records = [
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
      record('c', '2026-02-26'),
    ];

    expect(getCycleDay(profile(records), toISODate('2026-02-26'))).toBe(1);
    expect(getCycleDay(profile(records), toISODate('2026-01-29'))).toBe(1);
  });

  it('returns null when the target date precedes every record', () => {
    expect(getCycleDay(profile(single), toISODate('2026-08-31'))).toBeNull();
    expect(getCycleDay(profile([record('a', '2026-01-01')]), toISODate('2025-12-31'))).toBeNull();
  });

  it('works when the records are not in chronological order', () => {
    const unordered = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];

    expect(getCycleDay(profile(unordered), toISODate('2026-02-10'))).toBe(13);
    expect(getCycleDay(profile(unordered), toISODate('2026-02-26'))).toBe(1);
  });

  it('does not sort or mutate the input records', () => {
    const records = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const input = profile(records);
    const snapshot = JSON.parse(JSON.stringify(records));

    getCycleDay(input, toISODate('2026-02-10'));

    expect(records.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(JSON.parse(JSON.stringify(records))).toEqual(snapshot);
    expect(input.periodRecords).toBe(records);
  });

  it('propagates validation errors from an invalid profile', () => {
    const invalidSettings: CycleProfile = {
      settings: { averageCycleLengthDays: 14, averagePeriodLengthDays: 5 },
      periodRecords: single,
    };

    expect(() => getCycleDay(invalidSettings, toISODate('2026-09-01'))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(() =>
      getCycleDay(
        profile([record('a', '2026-01-01'), record('b', '2026-01-01')]),
        toISODate('2026-01-05')
      )
    ).toThrow(/Duplicate PeriodRecord startDate/);
  });

  it('throws on a target date that is not a real calendar date', () => {
    expect(() => getCycleDay(profile(single), '2026-02-30' as ISODate)).toThrow(
      /invalid targetDate/
    );
    expect(() => getCycleDay(profile(single), '2026-13-01' as ISODate)).toThrow(
      /invalid targetDate/
    );
  });

  it('ignores averageCycleLengthDays', () => {
    expect(getCycleDay(profile(single, 21), toISODate('2026-09-28'))).toBe(28);
    expect(getCycleDay(profile(single, 35), toISODate('2026-09-28'))).toBe(28);
    expect(getCycleDay(profile(single, 90), toISODate('2026-09-28'))).toBe(28);
  });
});
