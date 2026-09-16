import { isInEstimatedFertilityWindow } from '../fertility-window';
import type { CycleProfile, PeriodRecord } from '../types';

import type { ISODate } from '@/types/iso-date';
import { addDays, toISODate } from '@/utils/date';

function record(id: string, startDate: string, endDate?: string): PeriodRecord {
  return endDate === undefined
    ? { id, startDate: toISODate(startDate) }
    : { id, startDate: toISODate(startDate), endDate: toISODate(endDate) };
}

function profile(
  periodRecords: readonly PeriodRecord[],
  averageCycleLengthDays = 28,
  averagePeriodLengthDays = 5
): CycleProfile {
  return {
    settings: { averageCycleLengthDays, averagePeriodLengthDays },
    periodRecords,
  };
}

const START = '2026-09-01';
const single = [record('a', START)];

/** Target date for a given cycle day, counting the period start as day 1. */
function dayOfCycle(cycleDay: number): ISODate {
  return addDays(toISODate(START), cycleDay - 1);
}

/** Every cycle day in 1..limit that the window reports as fertile. */
function fertileDays(input: CycleProfile, limit: number): number[] {
  const days: number[] = [];

  for (let cycleDay = 1; cycleDay <= limit; cycleDay += 1) {
    if (isInEstimatedFertilityWindow(input, dayOfCycle(cycleDay))) {
      days.push(cycleDay);
    }
  }

  return days;
}

describe('isInEstimatedFertilityWindow on a 28 day cycle', () => {
  const input = profile(single, 28);

  it.each([
    [8, false],
    [9, true],
    [13, true],
    [14, true],
    [15, true],
    [16, false],
  ])('day %i is %s', (cycleDay, expected) => {
    expect(isInEstimatedFertilityWindow(input, dayOfCycle(cycleDay))).toBe(expected);
  });

  it('covers exactly days 9 through 15', () => {
    expect(fertileDays(input, 28)).toEqual([9, 10, 11, 12, 13, 14, 15]);
  });
});

describe('isInEstimatedFertilityWindow on a 30 day cycle', () => {
  const input = profile(single, 30);

  it.each([
    [10, false],
    [11, true],
    [16, true],
    [17, true],
    [18, false],
  ])('day %i is %s', (cycleDay, expected) => {
    expect(isInEstimatedFertilityWindow(input, dayOfCycle(cycleDay))).toBe(expected);
  });

  it('covers exactly days 11 through 17', () => {
    expect(fertileDays(input, 30)).toEqual([11, 12, 13, 14, 15, 16, 17]);
  });
});

describe('isInEstimatedFertilityWindow on a short 15 day cycle', () => {
  const input = profile(single, 15);

  it.each([
    [1, true],
    [2, true],
    [3, false],
  ])('day %i is %s', (cycleDay, expected) => {
    expect(isInEstimatedFertilityWindow(input, dayOfCycle(cycleDay))).toBe(expected);
  });

  it('clamps the window to start at cycle day 1', () => {
    expect(fertileDays(input, 15)).toEqual([1, 2]);
  });
});

describe('isInEstimatedFertilityWindow edge cases', () => {
  it('returns false when there are no period records', () => {
    expect(isInEstimatedFertilityWindow(profile([]), toISODate(START))).toBe(false);
  });

  it('returns false when the target date precedes every record', () => {
    expect(isInEstimatedFertilityWindow(profile(single), toISODate('2026-08-31'))).toBe(false);
  });

  it('resets when a new period begins', () => {
    const records = [record('a', '2026-01-01'), record('b', '2026-01-29')];
    const input = profile(records, 28);

    // Day 9 of the first cycle.
    expect(isInEstimatedFertilityWindow(input, toISODate('2026-01-09'))).toBe(true);
    // Day 1 of the second cycle, not day 29 of the first.
    expect(isInEstimatedFertilityWindow(input, toISODate('2026-01-29'))).toBe(false);
    // Day 9 of the second cycle.
    expect(isInEstimatedFertilityWindow(input, toISODate('2026-02-06'))).toBe(true);
    // Day 16 of the second cycle.
    expect(isInEstimatedFertilityWindow(input, toISODate('2026-02-13'))).toBe(false);
  });

  it('works when the records are not in chronological order', () => {
    const unordered = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const input = profile(unordered, 28);

    // Day 8 and day 9 of the cycle starting 2026-02-26.
    expect(isInEstimatedFertilityWindow(input, toISODate('2026-03-05'))).toBe(false);
    expect(isInEstimatedFertilityWindow(input, toISODate('2026-03-06'))).toBe(true);
  });

  it('is unaffected by averagePeriodLengthDays', () => {
    for (const periodLength of [1, 5, 14, 20]) {
      expect(fertileDays(profile(single, 28, periodLength), 28)).toEqual([
        9, 10, 11, 12, 13, 14, 15,
      ]);
    }
  });

  it('ignores a recorded endDate', () => {
    const withEnd = [record('a', START, '2026-09-02')];
    const withoutEnd = [record('a', START)];

    expect(fertileDays(profile(withEnd, 28), 28)).toEqual(fertileDays(profile(withoutEnd, 28), 28));
    expect(isInEstimatedFertilityWindow(profile(withEnd, 28), dayOfCycle(9))).toBe(true);
  });

  it('propagates validation errors from an invalid profile', () => {
    const invalidSettings: CycleProfile = {
      settings: { averageCycleLengthDays: 14, averagePeriodLengthDays: 5 },
      periodRecords: single,
    };

    expect(() => isInEstimatedFertilityWindow(invalidSettings, toISODate(START))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(() =>
      isInEstimatedFertilityWindow(
        profile([record('a', '2026-01-01'), record('b', '2026-01-01')]),
        toISODate('2026-01-10')
      )
    ).toThrow(/Duplicate PeriodRecord startDate/);
  });

  it('throws on a target date that is not a real calendar date', () => {
    expect(() => isInEstimatedFertilityWindow(profile(single), '2026-02-30' as ISODate)).toThrow(
      /invalid targetDate/
    );
  });

  it('does not sort or mutate the input records', () => {
    const records = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const input = profile(records, 28);
    const snapshot = JSON.parse(JSON.stringify(records));

    isInEstimatedFertilityWindow(input, toISODate('2026-03-06'));

    expect(records.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(JSON.parse(JSON.stringify(records))).toEqual(snapshot);
    expect(input.periodRecords).toBe(records);
  });
});
