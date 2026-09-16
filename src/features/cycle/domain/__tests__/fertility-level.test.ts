import { getEstimatedFertilityLevel, type FertilityLevel } from '../fertility-level';
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

/** Levels for cycle days 1..limit, as a list so the whole shape is asserted at once. */
function levelsAcrossCycle(input: CycleProfile, limit: number): (FertilityLevel | null)[] {
  const levels: (FertilityLevel | null)[] = [];

  for (let cycleDay = 1; cycleDay <= limit; cycleDay += 1) {
    levels.push(getEstimatedFertilityLevel(input, dayOfCycle(cycleDay)));
  }

  return levels;
}

describe('getEstimatedFertilityLevel on a 28 day cycle', () => {
  const input = profile(single, 28);

  it.each<[number, FertilityLevel]>([
    [8, 'low'],
    [9, 'elevated'],
    [13, 'elevated'],
    [14, 'peak'],
    [15, 'elevated'],
    [16, 'low'],
  ])('day %i is %s', (cycleDay, expected) => {
    expect(getEstimatedFertilityLevel(input, dayOfCycle(cycleDay))).toBe(expected);
  });

  it('marks exactly one peak day and six elevated days', () => {
    const levels = levelsAcrossCycle(input, 28);

    expect(levels.filter((level) => level === 'peak')).toHaveLength(1);
    expect(levels.filter((level) => level === 'elevated')).toHaveLength(6);
    expect(levels.indexOf('peak')).toBe(13); // zero-based index of cycle day 14
  });
});

describe('getEstimatedFertilityLevel on a 30 day cycle', () => {
  const input = profile(single, 30);

  it.each<[number, FertilityLevel]>([
    [10, 'low'],
    [11, 'elevated'],
    [16, 'peak'],
    [17, 'elevated'],
    [18, 'low'],
  ])('day %i is %s', (cycleDay, expected) => {
    expect(getEstimatedFertilityLevel(input, dayOfCycle(cycleDay))).toBe(expected);
  });
});

describe('getEstimatedFertilityLevel on a short 15 day cycle', () => {
  const input = profile(single, 15);

  it.each<[number, FertilityLevel]>([
    [1, 'peak'],
    [2, 'elevated'],
    [3, 'low'],
  ])('day %i is %s', (cycleDay, expected) => {
    expect(getEstimatedFertilityLevel(input, dayOfCycle(cycleDay))).toBe(expected);
  });

  it('puts peak on the first cycle day', () => {
    expect(levelsAcrossCycle(input, 5)).toEqual(['peak', 'elevated', 'low', 'low', 'low']);
  });
});

describe('getEstimatedFertilityLevel edge cases', () => {
  it('returns null when there are no period records', () => {
    expect(getEstimatedFertilityLevel(profile([]), toISODate(START))).toBeNull();
  });

  it('returns null when the target date precedes every record', () => {
    expect(getEstimatedFertilityLevel(profile(single), toISODate('2026-08-31'))).toBeNull();
  });

  it('resets when a new period begins', () => {
    const records = [record('a', '2026-01-01'), record('b', '2026-01-29')];
    const input = profile(records, 28);

    // Day 14 of the first cycle.
    expect(getEstimatedFertilityLevel(input, toISODate('2026-01-14'))).toBe('peak');
    // Day 1 of the second cycle, not day 29 of the first.
    expect(getEstimatedFertilityLevel(input, toISODate('2026-01-29'))).toBe('low');
    // Day 9 and day 14 of the second cycle.
    expect(getEstimatedFertilityLevel(input, toISODate('2026-02-06'))).toBe('elevated');
    expect(getEstimatedFertilityLevel(input, toISODate('2026-02-11'))).toBe('peak');
  });

  it('works when the records are not in chronological order', () => {
    const unordered = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const input = profile(unordered, 28);

    // Days 8, 9 and 14 of the cycle starting 2026-02-26.
    expect(getEstimatedFertilityLevel(input, toISODate('2026-03-05'))).toBe('low');
    expect(getEstimatedFertilityLevel(input, toISODate('2026-03-06'))).toBe('elevated');
    expect(getEstimatedFertilityLevel(input, toISODate('2026-03-11'))).toBe('peak');
  });

  it('is unaffected by averagePeriodLengthDays', () => {
    const baseline = levelsAcrossCycle(profile(single, 28, 5), 28);

    for (const periodLength of [1, 14, 20]) {
      expect(levelsAcrossCycle(profile(single, 28, periodLength), 28)).toEqual(baseline);
    }
  });

  it('ignores a recorded endDate', () => {
    const withEnd = [record('a', START, '2026-09-02')];
    const withoutEnd = [record('a', START)];

    expect(levelsAcrossCycle(profile(withEnd, 28), 28)).toEqual(
      levelsAcrossCycle(profile(withoutEnd, 28), 28)
    );
    expect(getEstimatedFertilityLevel(profile(withEnd, 28), dayOfCycle(14))).toBe('peak');
  });

  it('stays low well past the end of the cycle', () => {
    const input = profile(single, 28);

    expect(getEstimatedFertilityLevel(input, dayOfCycle(31))).toBe('low');
    expect(getEstimatedFertilityLevel(input, dayOfCycle(60))).toBe('low');
  });

  it('propagates validation errors from an invalid profile', () => {
    const invalidSettings: CycleProfile = {
      settings: { averageCycleLengthDays: 91, averagePeriodLengthDays: 5 },
      periodRecords: single,
    };

    expect(() => getEstimatedFertilityLevel(invalidSettings, toISODate(START))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(() =>
      getEstimatedFertilityLevel(
        profile([record('a', '2026-01-01'), record('b', '2026-01-01')]),
        toISODate('2026-01-14')
      )
    ).toThrow(/Duplicate PeriodRecord startDate/);
  });

  it('throws on a target date that is not a real calendar date', () => {
    expect(() => getEstimatedFertilityLevel(profile(single), '2026-02-30' as ISODate)).toThrow(
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

    getEstimatedFertilityLevel(input, toISODate('2026-03-11'));

    expect(records.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(JSON.parse(JSON.stringify(records))).toEqual(snapshot);
    expect(input.periodRecords).toBe(records);
  });
});
