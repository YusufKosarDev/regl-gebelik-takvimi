import { getFollicularPhase } from '../follicular-phase';
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

describe('getFollicularPhase', () => {
  it('returns null when there are no period records', () => {
    expect(getFollicularPhase(profile([]), toISODate(START))).toBeNull();
  });

  it('returns null during the expected menstrual days', () => {
    const input = profile(single, 28, 5);

    for (const cycleDay of [1, 2, 3, 4, 5]) {
      expect(getFollicularPhase(input, dayOfCycle(cycleDay))).toBeNull();
    }
  });

  it('covers day 6 to day 13 for a 28 day cycle with a 5 day period', () => {
    const input = profile(single, 28, 5);

    expect(getFollicularPhase(input, dayOfCycle(6))).toBe('follicular');
    expect(getFollicularPhase(input, dayOfCycle(13))).toBe('follicular');
    expect(getFollicularPhase(input, dayOfCycle(14))).toBeNull();
  });

  it('covers day 6 to day 15 for a 30 day cycle with a 5 day period', () => {
    const input = profile(single, 30, 5);

    expect(getFollicularPhase(input, dayOfCycle(6))).toBe('follicular');
    expect(getFollicularPhase(input, dayOfCycle(15))).toBe('follicular');
    expect(getFollicularPhase(input, dayOfCycle(16))).toBeNull();
  });

  it('returns null after the estimated ovulation day', () => {
    const input = profile(single, 28, 5);

    expect(getFollicularPhase(input, dayOfCycle(20))).toBeNull();
    expect(getFollicularPhase(input, dayOfCycle(28))).toBeNull();
  });

  it('shifts the window when the period length changes', () => {
    const input = profile(single, 28, 7);

    expect(getFollicularPhase(input, dayOfCycle(7))).toBeNull();
    expect(getFollicularPhase(input, dayOfCycle(8))).toBe('follicular');
    expect(getFollicularPhase(input, dayOfCycle(13))).toBe('follicular');
    expect(getFollicularPhase(input, dayOfCycle(14))).toBeNull();
  });

  it('handles a short cycle with a single follicular day', () => {
    // cycleLength 21 -> ovulation day 7, period 5 -> window starts day 6.
    const input = profile(single, 21, 5);

    expect(getFollicularPhase(input, dayOfCycle(5))).toBeNull();
    expect(getFollicularPhase(input, dayOfCycle(6))).toBe('follicular');
    expect(getFollicularPhase(input, dayOfCycle(7))).toBeNull();
  });

  it('treats the window as empty when ovulation is not after the follicular start', () => {
    // cycleLength 20 -> ovulation day 6, period 5 -> window starts day 6.
    const equalBounds = profile(single, 20, 5);
    // cycleLength 15 -> ovulation day 1, period 5 -> window starts day 6.
    const invertedBounds = profile(single, 15, 5);

    for (const cycleDay of [1, 5, 6, 7, 10, 15]) {
      expect(getFollicularPhase(equalBounds, dayOfCycle(cycleDay))).toBeNull();
      expect(getFollicularPhase(invertedBounds, dayOfCycle(cycleDay))).toBeNull();
    }
  });

  it('resets when a new period begins', () => {
    const records = [record('a', '2026-01-01'), record('b', '2026-01-29')];
    const input = profile(records, 28, 5);

    expect(getFollicularPhase(input, toISODate('2026-01-06'))).toBe('follicular');
    expect(getFollicularPhase(input, toISODate('2026-01-29'))).toBeNull();
    expect(getFollicularPhase(input, toISODate('2026-02-03'))).toBe('follicular');
    expect(getFollicularPhase(input, toISODate('2026-02-11'))).toBeNull();
  });

  it('works when the records are not in chronological order', () => {
    const unordered = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const input = profile(unordered, 28, 5);

    expect(getFollicularPhase(input, toISODate('2026-03-03'))).toBe('follicular');
    expect(getFollicularPhase(input, toISODate('2026-03-11'))).toBeNull();
  });

  it('returns null when the target date precedes every record', () => {
    expect(getFollicularPhase(profile(single), toISODate('2026-08-31'))).toBeNull();
  });

  it('ignores a recorded endDate', () => {
    const withEnd = [record('a', START, '2026-09-02')];
    const withoutEnd = [record('a', START)];

    for (const cycleDay of [5, 6, 13, 14]) {
      expect(getFollicularPhase(profile(withEnd, 28, 5), dayOfCycle(cycleDay))).toBe(
        getFollicularPhase(profile(withoutEnd, 28, 5), dayOfCycle(cycleDay))
      );
    }

    expect(getFollicularPhase(profile(withEnd, 28, 5), dayOfCycle(6))).toBe('follicular');
  });

  it('propagates validation errors from an invalid profile', () => {
    const invalidSettings: CycleProfile = {
      settings: { averageCycleLengthDays: 91, averagePeriodLengthDays: 5 },
      periodRecords: single,
    };

    expect(() => getFollicularPhase(invalidSettings, toISODate(START))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(() =>
      getFollicularPhase(
        profile([record('a', '2026-01-01'), record('b', '2026-01-01')]),
        toISODate('2026-01-08')
      )
    ).toThrow(/Duplicate PeriodRecord startDate/);
  });

  it('throws on a target date that is not a real calendar date', () => {
    expect(() => getFollicularPhase(profile(single), '2026-02-30' as ISODate)).toThrow(
      /invalid targetDate/
    );
  });

  it('does not sort or mutate the input records', () => {
    const records = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const input = profile(records, 28, 5);
    const snapshot = JSON.parse(JSON.stringify(records));

    getFollicularPhase(input, toISODate('2026-03-03'));

    expect(records.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(JSON.parse(JSON.stringify(records))).toEqual(snapshot);
    expect(input.periodRecords).toBe(records);
  });
});
