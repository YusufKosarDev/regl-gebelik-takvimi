import { getOvulatoryPhase } from '../ovulatory-phase';
import type { CycleProfile, PeriodRecord } from '../types';

import type { ISODate } from '@/types/iso-date';
import { addDays, toISODate } from '@/utils/date';

function record(id: string, startDate: string, endDate?: string): PeriodRecord {
  return endDate === undefined
    ? { id, startDate: toISODate(startDate), isOngoing: false }
    : { id, startDate: toISODate(startDate), endDate: toISODate(endDate), isOngoing: false };
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

describe('getOvulatoryPhase', () => {
  it('returns null when there are no period records', () => {
    expect(getOvulatoryPhase(profile([]), toISODate(START))).toBeNull();
  });

  it('marks day 14 for a 28 day cycle', () => {
    const input = profile(single, 28);

    expect(getOvulatoryPhase(input, dayOfCycle(13))).toBeNull();
    expect(getOvulatoryPhase(input, dayOfCycle(14))).toBe('ovulatory');
    expect(getOvulatoryPhase(input, dayOfCycle(15))).toBeNull();
  });

  it('marks day 16 for a 30 day cycle', () => {
    const input = profile(single, 30);

    expect(getOvulatoryPhase(input, dayOfCycle(15))).toBeNull();
    expect(getOvulatoryPhase(input, dayOfCycle(16))).toBe('ovulatory');
    expect(getOvulatoryPhase(input, dayOfCycle(17))).toBeNull();
  });

  it('marks exactly one day across the whole cycle', () => {
    const input = profile(single, 28);
    const ovulatoryDays: number[] = [];

    for (let cycleDay = 1; cycleDay <= 28; cycleDay += 1) {
      if (getOvulatoryPhase(input, dayOfCycle(cycleDay)) === 'ovulatory') {
        ovulatoryDays.push(cycleDay);
      }
    }

    expect(ovulatoryDays).toEqual([14]);
  });

  it('handles the shortest allowed cycle, where ovulation lands on day 1', () => {
    const input = profile(single, 15);

    expect(getOvulatoryPhase(input, dayOfCycle(1))).toBe('ovulatory');
    expect(getOvulatoryPhase(input, dayOfCycle(2))).toBeNull();
  });

  it('handles a long cycle', () => {
    const input = profile(single, 90);

    expect(getOvulatoryPhase(input, dayOfCycle(75))).toBeNull();
    expect(getOvulatoryPhase(input, dayOfCycle(76))).toBe('ovulatory');
    expect(getOvulatoryPhase(input, dayOfCycle(77))).toBeNull();
  });

  it('resets when a new period begins', () => {
    const records = [record('a', '2026-01-01'), record('b', '2026-01-29')];
    const input = profile(records, 28);

    // Day 14 of the first cycle.
    expect(getOvulatoryPhase(input, toISODate('2026-01-14'))).toBe('ovulatory');
    // Day 1 of the second cycle, not day 29 of the first.
    expect(getOvulatoryPhase(input, toISODate('2026-01-29'))).toBeNull();
    // Day 14 of the second cycle.
    expect(getOvulatoryPhase(input, toISODate('2026-02-11'))).toBe('ovulatory');
  });

  it('works when the records are not in chronological order', () => {
    const unordered = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const input = profile(unordered, 28);

    expect(getOvulatoryPhase(input, toISODate('2026-03-11'))).toBe('ovulatory');
    expect(getOvulatoryPhase(input, toISODate('2026-03-12'))).toBeNull();
  });

  it('returns null when the target date precedes every record', () => {
    expect(getOvulatoryPhase(profile(single), toISODate('2026-08-31'))).toBeNull();
  });

  it('is unaffected by averagePeriodLengthDays', () => {
    for (const periodLength of [1, 5, 14, 20]) {
      expect(getOvulatoryPhase(profile(single, 28, periodLength), dayOfCycle(14))).toBe(
        'ovulatory'
      );
      expect(getOvulatoryPhase(profile(single, 28, periodLength), dayOfCycle(15))).toBeNull();
    }
  });

  it('ignores a recorded endDate', () => {
    const withEnd = [record('a', START, '2026-09-02')];
    const withoutEnd = [record('a', START)];

    for (const cycleDay of [13, 14, 15]) {
      expect(getOvulatoryPhase(profile(withEnd, 28), dayOfCycle(cycleDay))).toBe(
        getOvulatoryPhase(profile(withoutEnd, 28), dayOfCycle(cycleDay))
      );
    }

    expect(getOvulatoryPhase(profile(withEnd, 28), dayOfCycle(14))).toBe('ovulatory');
  });

  it('propagates validation errors from an invalid profile', () => {
    const invalidSettings: CycleProfile = {
      settings: { averageCycleLengthDays: 14, averagePeriodLengthDays: 5 },
      periodRecords: single,
    };

    expect(() => getOvulatoryPhase(invalidSettings, toISODate(START))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(() =>
      getOvulatoryPhase(
        profile([record('a', '2026-01-01'), record('b', '2026-01-01')]),
        toISODate('2026-01-14')
      )
    ).toThrow(/Duplicate PeriodRecord startDate/);
  });

  it('throws on a target date that is not a real calendar date', () => {
    expect(() => getOvulatoryPhase(profile(single), '2026-02-30' as ISODate)).toThrow(
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

    getOvulatoryPhase(input, toISODate('2026-03-11'));

    expect(records.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(JSON.parse(JSON.stringify(records))).toEqual(snapshot);
    expect(input.periodRecords).toBe(records);
  });
});
