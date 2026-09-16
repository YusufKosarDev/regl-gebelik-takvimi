import { getLutealPhase } from '../luteal-phase';
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

describe('getLutealPhase', () => {
  it('returns null when there are no period records', () => {
    expect(getLutealPhase(profile([]), toISODate(START))).toBeNull();
  });

  it('opens the day after estimated ovulation for a 28 day cycle', () => {
    const input = profile(single, 28);

    expect(getLutealPhase(input, dayOfCycle(14))).toBeNull();
    expect(getLutealPhase(input, dayOfCycle(15))).toBe('luteal');
    expect(getLutealPhase(input, dayOfCycle(28))).toBe('luteal');
  });

  it('opens the day after estimated ovulation for a 30 day cycle', () => {
    const input = profile(single, 30);

    expect(getLutealPhase(input, dayOfCycle(16))).toBeNull();
    expect(getLutealPhase(input, dayOfCycle(17))).toBe('luteal');
    expect(getLutealPhase(input, dayOfCycle(30))).toBe('luteal');
  });

  it('returns null on every day up to and including estimated ovulation', () => {
    const input = profile(single, 28);

    for (let cycleDay = 1; cycleDay <= 14; cycleDay += 1) {
      expect(getLutealPhase(input, dayOfCycle(cycleDay))).toBeNull();
    }
  });

  it('stays luteal when the cycle runs late', () => {
    const input = profile(single, 28);

    expect(getLutealPhase(input, dayOfCycle(29))).toBe('luteal');
    expect(getLutealPhase(input, dayOfCycle(31))).toBe('luteal');
    expect(getLutealPhase(input, dayOfCycle(60))).toBe('luteal');
    expect(getLutealPhase(input, dayOfCycle(200))).toBe('luteal');
  });

  it('handles the shortest allowed cycle, where ovulation lands on day 1', () => {
    const input = profile(single, 15);

    expect(getLutealPhase(input, dayOfCycle(1))).toBeNull();
    expect(getLutealPhase(input, dayOfCycle(2))).toBe('luteal');
  });

  it('handles a long cycle', () => {
    const input = profile(single, 90);

    expect(getLutealPhase(input, dayOfCycle(76))).toBeNull();
    expect(getLutealPhase(input, dayOfCycle(77))).toBe('luteal');
  });

  it('resets when a new period begins', () => {
    const records = [record('a', '2026-01-01'), record('b', '2026-01-29')];
    const input = profile(records, 28);

    // Day 28 of the first cycle.
    expect(getLutealPhase(input, toISODate('2026-01-28'))).toBe('luteal');
    // Day 1 of the second cycle, not day 29 of the first.
    expect(getLutealPhase(input, toISODate('2026-01-29'))).toBeNull();
    // Day 14 of the second cycle.
    expect(getLutealPhase(input, toISODate('2026-02-11'))).toBeNull();
    // Day 15 of the second cycle.
    expect(getLutealPhase(input, toISODate('2026-02-12'))).toBe('luteal');
  });

  it('works when the records are not in chronological order', () => {
    const unordered = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const input = profile(unordered, 28);

    expect(getLutealPhase(input, toISODate('2026-03-11'))).toBeNull();
    expect(getLutealPhase(input, toISODate('2026-03-12'))).toBe('luteal');
  });

  it('returns null when the target date precedes every record', () => {
    expect(getLutealPhase(profile(single), toISODate('2026-08-31'))).toBeNull();
  });

  it('is unaffected by averagePeriodLengthDays', () => {
    for (const periodLength of [1, 5, 14, 20]) {
      expect(getLutealPhase(profile(single, 28, periodLength), dayOfCycle(14))).toBeNull();
      expect(getLutealPhase(profile(single, 28, periodLength), dayOfCycle(15))).toBe('luteal');
    }
  });

  it('ignores a recorded endDate', () => {
    const withEnd = [record('a', START, '2026-09-02')];
    const withoutEnd = [record('a', START)];

    for (const cycleDay of [14, 15, 28, 31]) {
      expect(getLutealPhase(profile(withEnd, 28), dayOfCycle(cycleDay))).toBe(
        getLutealPhase(profile(withoutEnd, 28), dayOfCycle(cycleDay))
      );
    }

    expect(getLutealPhase(profile(withEnd, 28), dayOfCycle(15))).toBe('luteal');
  });

  it('propagates validation errors from an invalid profile', () => {
    const invalidSettings: CycleProfile = {
      settings: { averageCycleLengthDays: 91, averagePeriodLengthDays: 5 },
      periodRecords: single,
    };

    expect(() => getLutealPhase(invalidSettings, toISODate(START))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(() =>
      getLutealPhase(
        profile([record('a', '2026-01-01'), record('b', '2026-01-01')]),
        toISODate('2026-01-20')
      )
    ).toThrow(/Duplicate PeriodRecord startDate/);
  });

  it('throws on a target date that is not a real calendar date', () => {
    expect(() => getLutealPhase(profile(single), '2026-02-30' as ISODate)).toThrow(
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

    getLutealPhase(input, toISODate('2026-03-12'));

    expect(records.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(JSON.parse(JSON.stringify(records))).toEqual(snapshot);
    expect(input.periodRecords).toBe(records);
  });
});
