import { IRREGULAR_SPREAD_DAYS, assessCycleRegularity } from '../cycle-regularity';
import { MIN_OBSERVATIONS, observeCycleLengths } from '../observed-cycle-lengths';
import type { CycleProfile, PeriodRecord } from '../types';

import { addDays, toISODate } from '@/utils/date';

/**
 * How much the recorded cycles agree with each other.
 *
 * The one case worth labouring is `'unknown'`: it is not a polite way of saying
 * regular. Somebody with two recorded periods has not been shown to be regular,
 * and treating the two as the same answer is how an app ends up showing a
 * confident date to somebody it knows nothing about.
 */

function regularityOf(gaps: readonly number[]) {
  const records: PeriodRecord[] = [];
  let start = toISODate('2026-01-01');

  records.push({ id: `period-${start}`, startDate: start, isOngoing: false });

  for (const gap of gaps) {
    start = addDays(start, gap);
    records.push({ id: `period-${start}`, startDate: start, isOngoing: false });
  }

  const profile: CycleProfile = {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: records,
  };

  return assessCycleRegularity(observeCycleLengths(profile));
}

describe('unknown is its own answer', () => {
  it('is unknown with nothing recorded', () => {
    expect(regularityOf([])).toBe('unknown');
  });

  it('is unknown below the minimum number of observations', () => {
    expect(regularityOf([28])).toBe('unknown');
    expect(regularityOf([28, 29])).toBe('unknown');
    expect(MIN_OBSERVATIONS).toBe(3);
  });

  it('becomes an opinion at the minimum', () => {
    expect(regularityOf([28, 29, 30])).toBe('regular');
  });
});

describe('the threshold', () => {
  it('calls a tight spread regular', () => {
    expect(regularityOf([28, 29, 30])).toBe('regular');
  });

  it('calls a wide spread irregular', () => {
    expect(regularityOf([24, 30, 36])).toBe('irregular');
  });

  it('is irregular at exactly the threshold', () => {
    // Stated so the boundary is a decision rather than an accident.
    expect(regularityOf([25, 28, 32])).toBe('irregular');
    expect(IRREGULAR_SPREAD_DAYS).toBe(7);
  });

  it('is regular one day below the threshold', () => {
    expect(regularityOf([26, 28, 32])).toBe('regular');
  });

  it('reads the spread, not how scattered the middle is', () => {
    // Eleven cycles at 28 and one at 40 is still a wide spread, and a single
    // date would still be the wrong thing to show.
    expect(regularityOf([28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 40])).toBe('irregular');
  });
});
