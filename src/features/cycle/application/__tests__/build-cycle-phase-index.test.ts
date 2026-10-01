import { getCyclePhase } from '../../domain/cycle-phase';
import type { CycleProfile } from '../../domain/types';
import { MAX_INDEXED_MONTHS, buildCyclePhaseIndex } from '../build-cycle-phase-index';

import type { ISODate } from '@/types/iso-date';
import { addDays, toISODate } from '@/utils/date';

/**
 * Which phase each date between two days falls in.
 *
 * The one assertion that really matters is the agreement check: this takes a
 * faster route to the same answer `getCyclePhase` gives, and a faster route
 * that disagrees would put a symptom summary and the calendar it sits next to
 * in different phases.
 */

const PROFILE: CycleProfile = {
  settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
  periodRecords: [
    { id: 'period-2026-03-02', startDate: toISODate('2026-03-02'), isOngoing: false },
    { id: 'period-2026-03-30', startDate: toISODate('2026-03-30'), isOngoing: false },
  ],
};

describe('what it covers', () => {
  it('holds every date in the range, ends included', () => {
    const index = buildCyclePhaseIndex(PROFILE, toISODate('2026-03-10'), toISODate('2026-03-20'));

    expect(index.size).toBe(11);
    expect(index.has(toISODate('2026-03-10'))).toBe(true);
    expect(index.has(toISODate('2026-03-20'))).toBe(true);
    expect(index.has(toISODate('2026-03-09'))).toBe(false);
    expect(index.has(toISODate('2026-03-21'))).toBe(false);
  });

  it('spans month and year boundaries', () => {
    const index = buildCyclePhaseIndex(PROFILE, toISODate('2026-12-30'), toISODate('2027-01-02'));

    expect([...index.keys()]).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('is empty when the range runs backwards', () => {
    // A caller asking for this has its dates the wrong way round; answering with
    // a silently empty map is better than walking to the year 9999.
    expect(
      buildCyclePhaseIndex(PROFILE, toISODate('2026-03-20'), toISODate('2026-03-10')).size
    ).toBe(0);
  });

  it('covers a single day', () => {
    const index = buildCyclePhaseIndex(PROFILE, toISODate('2026-03-10'), toISODate('2026-03-10'));

    expect(index.size).toBe(1);
  });
});

describe('what it says about each day', () => {
  it('agrees with asking the domain one day at a time', () => {
    // The whole justification for the faster route.
    const from = toISODate('2026-02-01');
    const to = toISODate('2026-05-31');
    const index = buildCyclePhaseIndex(PROFILE, from, to);

    for (let date = from; date <= to; date = addDays(date, 1)) {
      expect(index.get(date as ISODate)).toBe(getCyclePhase(PROFILE, date as ISODate));
    }
  });

  it('says null for a day before the first recorded period', () => {
    // Present in the map with no opinion, rather than missing from it. A caller
    // has to be able to tell "not placed" from "not asked about".
    const index = buildCyclePhaseIndex(PROFILE, toISODate('2026-01-05'), toISODate('2026-01-07'));

    expect(index.get(toISODate('2026-01-06'))).toBeNull();
    expect(index.has(toISODate('2026-01-06'))).toBe(true);
  });

  it('says null for every day of a profile with no records', () => {
    const empty: CycleProfile = {
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [],
    };

    const index = buildCyclePhaseIndex(empty, toISODate('2026-03-01'), toISODate('2026-03-03'));

    expect([...index.values()]).toEqual([null, null, null]);
  });
});

describe('the guard', () => {
  it('refuses a range no real record could span', () => {
    // Not a performance limit. `toISODate` accepts any year up to 9999, so a
    // corrupt row could otherwise ask this to walk a hundred thousand months.
    expect(() =>
      buildCyclePhaseIndex(PROFILE, toISODate('1900-01-01'), toISODate('2200-01-01'))
    ).toThrow(/months/);

    expect(MAX_INDEXED_MONTHS).toBe(1200);
  });
});
