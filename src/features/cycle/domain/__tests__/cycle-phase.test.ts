import { getCyclePhase } from '../cycle-phase';
import { getLutealPhase } from '../luteal-phase';
import { getMenstrualPhase } from '../menstrual-phase';
import { getOvulatoryPhase } from '../ovulatory-phase';
import type { CyclePhase } from '../phases';
import type { CycleProfile, PeriodRecord } from '../types';

import type { ISODate } from '@/types/iso-date';
import { addDays, toISODate } from '@/utils/date';

function record(id: string, startDate: string): PeriodRecord {
  return { id, startDate: toISODate(startDate), isOngoing: false };
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

describe('getCyclePhase on a 28 day cycle with a 5 day period', () => {
  const input = profile(single, 28, 5);

  it.each<[number, CyclePhase]>([
    [1, 'menstrual'],
    [5, 'menstrual'],
    [6, 'follicular'],
    [13, 'follicular'],
    [14, 'ovulatory'],
    [15, 'luteal'],
    [28, 'luteal'],
    [31, 'luteal'],
  ])('day %i resolves to %s', (cycleDay, expected) => {
    expect(getCyclePhase(input, dayOfCycle(cycleDay))).toBe(expected);
  });

  it('covers every day of the cycle without gaps', () => {
    for (let cycleDay = 1; cycleDay <= 28; cycleDay += 1) {
      expect(getCyclePhase(input, dayOfCycle(cycleDay))).not.toBeNull();
    }
  });
});

describe('getCyclePhase on a short 15 day cycle with a 5 day period', () => {
  const input = profile(single, 15, 5);

  it.each<[number, CyclePhase]>([
    [1, 'menstrual'],
    [2, 'menstrual'],
    [5, 'menstrual'],
    [6, 'luteal'],
  ])('day %i resolves to %s', (cycleDay, expected) => {
    expect(getCyclePhase(input, dayOfCycle(cycleDay))).toBe(expected);
  });

  it('prefers menstrual over ovulatory when both windows match day 1', () => {
    const day1 = dayOfCycle(1);

    // The independent phase functions genuinely overlap here.
    expect(getMenstrualPhase(input, day1)).toBe('menstrual');
    expect(getOvulatoryPhase(input, day1)).toBe('ovulatory');

    // The resolver breaks the tie in favour of menstrual.
    expect(getCyclePhase(input, day1)).toBe('menstrual');
  });

  it('prefers menstrual over luteal when both windows match day 2', () => {
    const day2 = dayOfCycle(2);

    expect(getMenstrualPhase(input, day2)).toBe('menstrual');
    expect(getLutealPhase(input, day2)).toBe('luteal');

    expect(getCyclePhase(input, day2)).toBe('menstrual');
  });
});

describe('getCyclePhase edge cases', () => {
  it('returns null when there are no period records', () => {
    expect(getCyclePhase(profile([]), toISODate(START))).toBeNull();
  });

  it('returns null when the target date precedes every record', () => {
    expect(getCyclePhase(profile(single), toISODate('2026-08-31'))).toBeNull();
    expect(getCyclePhase(profile([record('a', '2026-01-01')]), toISODate('2025-12-31'))).toBeNull();
  });

  it('restarts at menstrual when a new period begins', () => {
    const records = [record('a', '2026-01-01'), record('b', '2026-01-29')];
    const input = profile(records, 28, 5);

    // End of the first cycle.
    expect(getCyclePhase(input, toISODate('2026-01-28'))).toBe('luteal');
    // Day 1 of the second cycle.
    expect(getCyclePhase(input, toISODate('2026-01-29'))).toBe('menstrual');
    expect(getCyclePhase(input, toISODate('2026-02-02'))).toBe('menstrual');
    expect(getCyclePhase(input, toISODate('2026-02-03'))).toBe('follicular');
  });

  it('works when the records are not in chronological order', () => {
    const unordered = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const input = profile(unordered, 28, 5);

    expect(getCyclePhase(input, toISODate('2026-02-26'))).toBe('menstrual');
    expect(getCyclePhase(input, toISODate('2026-03-03'))).toBe('follicular');
    expect(getCyclePhase(input, toISODate('2026-03-11'))).toBe('ovulatory');
    expect(getCyclePhase(input, toISODate('2026-03-12'))).toBe('luteal');
  });

  it('keeps late cycles luteal', () => {
    const input = profile(single, 28, 5);

    expect(getCyclePhase(input, dayOfCycle(29))).toBe('luteal');
    expect(getCyclePhase(input, dayOfCycle(60))).toBe('luteal');
  });

  it('propagates validation errors from an invalid profile', () => {
    const invalidSettings: CycleProfile = {
      settings: { averageCycleLengthDays: 14, averagePeriodLengthDays: 5 },
      periodRecords: single,
    };

    expect(() => getCyclePhase(invalidSettings, toISODate(START))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(() =>
      getCyclePhase(
        profile([record('a', '2026-01-01'), record('b', '2026-01-01')]),
        toISODate('2026-01-10')
      )
    ).toThrow(/Duplicate PeriodRecord startDate/);
  });

  it('throws on a target date that is not a real calendar date', () => {
    expect(() => getCyclePhase(profile(single), '2026-02-30' as ISODate)).toThrow(
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

    getCyclePhase(input, toISODate('2026-03-03'));

    expect(records.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(JSON.parse(JSON.stringify(records))).toEqual(snapshot);
    expect(input.periodRecords).toBe(records);
  });
});
