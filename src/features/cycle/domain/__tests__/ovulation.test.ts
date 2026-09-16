import { getEstimatedOvulationCycleDay } from '../ovulation';
import type { CycleProfile, PeriodRecord } from '../types';

import { toISODate } from '@/utils/date';

function record(id: string, startDate: string): PeriodRecord {
  return { id, startDate: toISODate(startDate) };
}

function profile(
  averageCycleLengthDays: number,
  periodRecords: readonly PeriodRecord[] = [],
  averagePeriodLengthDays = 5
): CycleProfile {
  return {
    settings: { averageCycleLengthDays, averagePeriodLengthDays },
    periodRecords,
  };
}

describe('getEstimatedOvulationCycleDay', () => {
  it.each([
    [28, 14],
    [30, 16],
    [15, 1],
    [90, 76],
  ])('maps a %i day cycle to cycle day %i', (cycleLength, expected) => {
    expect(getEstimatedOvulationCycleDay(profile(cycleLength))).toBe(expected);
  });

  it('works with period records present', () => {
    expect(getEstimatedOvulationCycleDay(profile(28, [record('a', '2026-09-01')]))).toBe(14);
  });

  it('is unaffected by averagePeriodLengthDays', () => {
    for (const periodLength of [1, 5, 14, 20]) {
      expect(getEstimatedOvulationCycleDay(profile(28, [], periodLength))).toBe(14);
    }
  });

  it('never returns a cycle day below 1 for a valid profile', () => {
    for (let cycleLength = 15; cycleLength <= 90; cycleLength += 1) {
      expect(getEstimatedOvulationCycleDay(profile(cycleLength))).toBeGreaterThanOrEqual(1);
    }
  });

  it('propagates validation errors from an invalid profile', () => {
    expect(() => getEstimatedOvulationCycleDay(profile(14))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(() => getEstimatedOvulationCycleDay(profile(91))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(() => getEstimatedOvulationCycleDay(profile(28.5))).toThrow(
      /averageCycleLengthDays must be an integer/
    );
    expect(() =>
      getEstimatedOvulationCycleDay(
        profile(28, [record('a', '2026-01-01'), record('b', '2026-01-01')])
      )
    ).toThrow(/Duplicate PeriodRecord startDate/);
  });

  it('does not mutate the profile', () => {
    const records = [record('b', '2026-01-29'), record('a', '2026-01-01')];
    const input = profile(28, records);
    const snapshot = JSON.parse(JSON.stringify(records));

    getEstimatedOvulationCycleDay(input);

    expect(records.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(JSON.parse(JSON.stringify(records))).toEqual(snapshot);
    expect(input.periodRecords).toBe(records);
    expect(input.settings.averageCycleLengthDays).toBe(28);
  });
});
