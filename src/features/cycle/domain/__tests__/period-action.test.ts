import { resolvePeriodAction } from '../period-action';
import type { CycleProfile, PeriodRecord } from '../types';
import type { ISODate } from '@/types/iso-date';

/**
 * Which period action the home screen may offer today.
 *
 * The rule this file pins: the screen never offers a write the domain is
 * certain to refuse. A start on a day an existing record already covers is
 * exactly that - the neighbour-aware bounds put the earliest legal start at
 * the previous record's end plus one - so the day a period ends, the answer
 * is 'none', not a button that collects an error.
 */

const TODAY = '2026-09-17' as ISODate;

function profileWith(records: readonly PeriodRecord[]): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [...records],
  };
}

describe('resolvePeriodAction', () => {
  it('offers to end a running period', () => {
    const profile = profileWith([
      { id: 'a', startDate: '2026-09-15' as ISODate, isOngoing: true },
    ]);

    expect(resolvePeriodAction(profile, TODAY)).toBe('end');
  });

  it('offers to start when nothing is recorded', () => {
    expect(resolvePeriodAction(profileWith([]), TODAY)).toBe('start');
  });

  it('offers to start the day after a period ended', () => {
    const profile = profileWith([
      {
        id: 'a',
        startDate: '2026-09-12' as ISODate,
        endDate: '2026-09-16' as ISODate,
        isOngoing: false,
      },
    ]);

    expect(resolvePeriodAction(profile, TODAY)).toBe('start');
  });

  it('offers nothing on the day a period ended', () => {
    // Ending today and starting again today used to leave the start button
    // up, and pressing it could only collect the overlap refusal: the
    // earliest legal start is the end plus one.
    const profile = profileWith([
      {
        id: 'a',
        startDate: '2026-09-13' as ISODate,
        endDate: TODAY,
        isOngoing: false,
      },
    ]);

    expect(resolvePeriodAction(profile, TODAY)).toBe('none');
  });

  it('offers nothing on a day inside a closed record', () => {
    const profile = profileWith([
      {
        id: 'a',
        startDate: '2026-09-16' as ISODate,
        endDate: '2026-09-18' as ISODate,
        isOngoing: false,
      },
    ]);

    expect(resolvePeriodAction(profile, TODAY)).toBe('none');
  });

  it('treats a closed record with no end as covering only its start day', () => {
    // The same reading the CSV export wrote down: nothing is known about the
    // days after an end nobody recorded.
    const startedToday = profileWith([
      { id: 'a', startDate: TODAY, isOngoing: false },
    ]);
    const startedYesterday = profileWith([
      { id: 'a', startDate: '2026-09-16' as ISODate, isOngoing: false },
    ]);

    expect(resolvePeriodAction(startedToday, TODAY)).toBe('none');
    expect(resolvePeriodAction(startedYesterday, TODAY)).toBe('start');
  });

  it('does not count a record that starts tomorrow as covering today', () => {
    // A future start is real data here - a device in another timezone can
    // sync one in - and it says nothing about today.
    const profile = profileWith([
      {
        id: 'a',
        startDate: '2026-09-18' as ISODate,
        endDate: '2026-09-20' as ISODate,
        isOngoing: false,
      },
    ]);

    expect(resolvePeriodAction(profile, TODAY)).toBe('start');
  });

  it('offers nothing when two periods claim to be running', () => {
    // getOpenPeriodRecord refuses to choose; the screen cannot act on that
    // either, so it offers nothing instead of crashing on the way past.
    const profile = profileWith([
      { id: 'a', startDate: '2026-09-10' as ISODate, isOngoing: true },
      { id: 'b', startDate: '2026-09-15' as ISODate, isOngoing: true },
    ]);

    expect(resolvePeriodAction(profile, TODAY)).toBe('none');
  });
});
