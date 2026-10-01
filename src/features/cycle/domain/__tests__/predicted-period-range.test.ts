import { observeCycleLengths } from '../observed-cycle-lengths';
import { predictNextPeriodRange } from '../predicted-period-range';
import { predictNextPeriodStart } from '../predictions';
import type { CycleProfile, PeriodRecord } from '../types';

import { addDays, daysBetween, toISODate } from '@/utils/date';

/**
 * The range shown when one day would overstate the case.
 *
 * The property this file is really about is the last describe block: the single
 * predicted day has to sit inside the range. Everything the app marks, queues
 * and displays is built from that day, so a range that could exclude it would
 * put a marked date outside its own prediction.
 */

function profileWithGaps(settingDays: number, gaps: readonly number[]): CycleProfile {
  const records: PeriodRecord[] = [];
  let start = toISODate('2026-01-01');

  records.push({ id: `period-${start}`, startDate: start, isOngoing: false });

  for (const gap of gaps) {
    start = addDays(start, gap);
    records.push({ id: `period-${start}`, startDate: start, isOngoing: false });
  }

  return {
    settings: { averageCycleLengthDays: settingDays, averagePeriodLengthDays: 5 },
    periodRecords: records,
  };
}

function rangeOf(settingDays: number, gaps: readonly number[]) {
  const profile = profileWithGaps(settingDays, gaps);

  return predictNextPeriodRange(profile, observeCycleLengths(profile));
}

describe('when there is no range to draw', () => {
  it('is null with nothing recorded', () => {
    const empty: CycleProfile = {
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [],
    };

    expect(predictNextPeriodRange(empty, observeCycleLengths(empty))).toBeNull();
  });

  it('is null when one period is recorded and nothing can be measured', () => {
    expect(rangeOf(28, [])).toBeNull();
  });

  it('is null when every gap was discarded as implausible', () => {
    expect(rangeOf(28, [200])).toBeNull();
  });
});

describe('the range itself', () => {
  it('counts from the latest recorded start', () => {
    const range = rangeOf(28, [26, 32]);
    const latestStart = toISODate('2026-01-01');
    const actualLatest = addDays(addDays(latestStart, 26), 32);

    expect(range).not.toBeNull();
    expect(daysBetween(actualLatest, range!.earliest)).toBe(26);
    expect(daysBetween(actualLatest, range!.latest)).toBe(32);
  });

  it('carries the single prediction rather than deriving a second one', () => {
    const profile = profileWithGaps(28, [26, 32]);
    const range = predictNextPeriodRange(profile, observeCycleLengths(profile));

    expect(range?.expected).toBe(predictNextPeriodStart(profile));
  });
});

describe('the setting is always inside the range', () => {
  it('widens past a setting shorter than everything recorded', () => {
    // Setting 20, cycles 30-34. Clamping to the observations would put the
    // marked day five days before the range it belongs to.
    const range = rangeOf(20, [30, 32, 34]);
    const latestStart = addDays(addDays(addDays(toISODate('2026-01-01'), 30), 32), 34);

    expect(daysBetween(latestStart, range!.earliest)).toBe(20);
    expect(daysBetween(latestStart, range!.latest)).toBe(34);
  });

  it('widens past a setting longer than everything recorded', () => {
    const range = rangeOf(50, [26, 28, 30]);
    const latestStart = addDays(addDays(addDays(toISODate('2026-01-01'), 26), 28), 30);

    expect(daysBetween(latestStart, range!.earliest)).toBe(26);
    expect(daysBetween(latestStart, range!.latest)).toBe(50);
  });

  it('holds for every setting across the allowed span', () => {
    // The property, asserted rather than illustrated. If this ever fails, the
    // calendar is marking a day the home screen says is impossible.
    for (let settingDays = 15; settingDays <= 90; settingDays += 1) {
      const profile = profileWithGaps(settingDays, [26, 30, 34]);
      const range = predictNextPeriodRange(profile, observeCycleLengths(profile));

      expect(range).not.toBeNull();
      expect(daysBetween(range!.earliest, range!.expected)).toBeGreaterThanOrEqual(0);
      expect(daysBetween(range!.expected, range!.latest)).toBeGreaterThanOrEqual(0);
    }
  });
});
