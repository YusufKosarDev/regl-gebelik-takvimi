import { getMenstrualPhase } from '../menstrual-phase';
import type { CycleProfile, PeriodRecord } from '../types';

import type { ISODate } from '@/types/iso-date';
import { toISODate } from '@/utils/date';

function record(id: string, startDate: string, endDate?: string): PeriodRecord {
  return endDate === undefined
    ? { id, startDate: toISODate(startDate), isOngoing: false }
    : { id, startDate: toISODate(startDate), endDate: toISODate(endDate), isOngoing: false };
}

function profile(
  periodRecords: readonly PeriodRecord[],
  averagePeriodLengthDays = 5,
  averageCycleLengthDays = 28
): CycleProfile {
  return {
    settings: { averageCycleLengthDays, averagePeriodLengthDays },
    periodRecords,
  };
}

const single = [record('a', '2026-09-01')];

describe('getMenstrualPhase', () => {
  it('returns null when there are no period records', () => {
    expect(getMenstrualPhase(profile([]), toISODate('2026-09-01'))).toBeNull();
  });

  it('reports the first day as menstrual', () => {
    expect(getMenstrualPhase(profile(single), toISODate('2026-09-01'))).toBe('menstrual');
  });

  it('reports the second day as menstrual', () => {
    expect(getMenstrualPhase(profile(single), toISODate('2026-09-02'))).toBe('menstrual');
  });

  it('reports the last expected period day as menstrual', () => {
    expect(getMenstrualPhase(profile(single, 5), toISODate('2026-09-05'))).toBe('menstrual');
  });

  it('returns null on the day after the expected period ends', () => {
    expect(getMenstrualPhase(profile(single, 5), toISODate('2026-09-06'))).toBeNull();
  });

  it('returns null well past the expected period', () => {
    expect(getMenstrualPhase(profile(single, 5), toISODate('2026-09-28'))).toBeNull();
  });

  it('covers only day 1 when the period length is 1', () => {
    expect(getMenstrualPhase(profile(single, 1), toISODate('2026-09-01'))).toBe('menstrual');
    expect(getMenstrualPhase(profile(single, 1), toISODate('2026-09-02'))).toBeNull();
  });

  it('covers the full window for a long period length', () => {
    expect(getMenstrualPhase(profile(single, 20), toISODate('2026-09-20'))).toBe('menstrual');
    expect(getMenstrualPhase(profile(single, 20), toISODate('2026-09-21'))).toBeNull();
  });

  it('restarts at day 1 when a new period begins', () => {
    const records = [record('a', '2026-01-01'), record('b', '2026-01-29')];
    const input = profile(records, 5);

    expect(getMenstrualPhase(input, toISODate('2026-01-06'))).toBeNull();
    expect(getMenstrualPhase(input, toISODate('2026-01-29'))).toBe('menstrual');
    expect(getMenstrualPhase(input, toISODate('2026-02-02'))).toBe('menstrual');
    expect(getMenstrualPhase(input, toISODate('2026-02-03'))).toBeNull();
  });

  it('works when the records are not in chronological order', () => {
    const unordered = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const input = profile(unordered, 5);

    expect(getMenstrualPhase(input, toISODate('2026-02-26'))).toBe('menstrual');
    expect(getMenstrualPhase(input, toISODate('2026-03-01'))).toBe('menstrual');
    expect(getMenstrualPhase(input, toISODate('2026-03-03'))).toBeNull();
  });

  it('returns null when the target date precedes every record', () => {
    expect(getMenstrualPhase(profile(single), toISODate('2026-08-31'))).toBeNull();
  });

  it('ignores a recorded endDate', () => {
    // The record says bleeding stopped on day 2, but the expected window is 5 days.
    const records = [record('a', '2026-09-01', '2026-09-02')];

    expect(getMenstrualPhase(profile(records, 5), toISODate('2026-09-05'))).toBe('menstrual');
    expect(getMenstrualPhase(profile(records, 5), toISODate('2026-09-06'))).toBeNull();
  });

  it('propagates validation errors from an invalid profile', () => {
    const invalidSettings: CycleProfile = {
      settings: { averageCycleLengthDays: 14, averagePeriodLengthDays: 5 },
      periodRecords: single,
    };

    expect(() => getMenstrualPhase(invalidSettings, toISODate('2026-09-01'))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(() =>
      getMenstrualPhase(
        profile([record('a', '2026-01-01'), record('b', '2026-01-01')]),
        toISODate('2026-01-02')
      )
    ).toThrow(/Duplicate PeriodRecord startDate/);
  });

  it('throws on a target date that is not a real calendar date', () => {
    expect(() => getMenstrualPhase(profile(single), '2026-02-30' as ISODate)).toThrow(
      /invalid targetDate/
    );
  });

  it('is unaffected by averageCycleLengthDays', () => {
    for (const cycleLength of [15, 28, 35, 90]) {
      expect(getMenstrualPhase(profile(single, 5, cycleLength), toISODate('2026-09-05'))).toBe(
        'menstrual'
      );
      expect(
        getMenstrualPhase(profile(single, 5, cycleLength), toISODate('2026-09-06'))
      ).toBeNull();
    }
  });

  it('does not sort or mutate the input records', () => {
    const records = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const input = profile(records, 5);
    const snapshot = JSON.parse(JSON.stringify(records));

    getMenstrualPhase(input, toISODate('2026-02-27'));

    expect(records.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(JSON.parse(JSON.stringify(records))).toEqual(snapshot);
    expect(input.periodRecords).toBe(records);
  });
});
