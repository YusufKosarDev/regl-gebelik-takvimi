import { getOpenPeriodRecord } from '../open-period';
import type { CycleProfile, PeriodRecord } from '../types';

import type { ISODate } from '@/types/iso-date';

type Spec = {
  id: string;
  startDate: string;
  endDate?: string;
  isOngoing?: boolean;
};

function profile(records: Spec[]): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
    periodRecords: records.map((record) => {
      const built: PeriodRecord = {
        id: record.id,
        startDate: record.startDate as ISODate,
        isOngoing: record.isOngoing === true,
      };

      return record.endDate === undefined
        ? built
        : { ...built, endDate: record.endDate as ISODate };
    }),
  };
}

describe('getOpenPeriodRecord with nothing ongoing', () => {
  it('returns null for an empty profile', () => {
    expect(getOpenPeriodRecord(profile([]))).toBeNull();
  });

  it('returns null when every record has ended', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-08-02', endDate: '2026-08-07' },
      { id: 'b', startDate: '2026-09-02', endDate: '2026-09-07' },
    ]);

    expect(getOpenPeriodRecord(subject)).toBeNull();
  });

  it('returns null for a finished period whose end was never recorded', () => {
    // This is the shape onboarding leaves behind. A missing end date is not the
    // same as still bleeding, and reading it that way would offer to finish a
    // period from months ago.
    const subject = profile([{ id: 'onboarding-initial-period', startDate: '2026-09-02' }]);

    expect(getOpenPeriodRecord(subject)).toBeNull();
  });

  it('returns null with several unknown-end records', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-08-02' },
      { id: 'b', startDate: '2026-09-02' },
    ]);

    expect(getOpenPeriodRecord(subject)).toBeNull();
  });
});

describe('getOpenPeriodRecord with one ongoing', () => {
  it('returns the record', () => {
    const subject = profile([{ id: 'a', startDate: '2026-09-17', isOngoing: true }]);

    expect(getOpenPeriodRecord(subject)).toEqual({
      id: 'a',
      startDate: '2026-09-17',
      isOngoing: true,
    });
  });

  it('finds it among closed records', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-08-02', endDate: '2026-08-07' },
      { id: 'b', startDate: '2026-09-17', isOngoing: true },
      { id: 'c', startDate: '2026-07-04', endDate: '2026-07-09' },
    ]);

    expect(getOpenPeriodRecord(subject)?.id).toBe('b');
  });

  it('finds it alongside a record with no recorded end', () => {
    const subject = profile([
      { id: 'onboarding-initial-period', startDate: '2026-09-02' },
      { id: 'period-2026-09-17', startDate: '2026-09-17', isOngoing: true },
    ]);

    expect(getOpenPeriodRecord(subject)?.id).toBe('period-2026-09-17');
  });

  it('returns the record itself, not a copy', () => {
    const subject = profile([{ id: 'a', startDate: '2026-09-17', isOngoing: true }]);

    expect(getOpenPeriodRecord(subject)).toBe(subject.periodRecords[0]);
  });
});

describe('getOpenPeriodRecord with several ongoing', () => {
  it('refuses to choose', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-09-02', isOngoing: true },
      { id: 'b', startDate: '2026-09-17', isOngoing: true },
    ]);

    expect(() => getOpenPeriodRecord(subject)).toThrow(/found 2 ongoing periods/);
  });

  it('names the dates it found', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-09-02', isOngoing: true },
      { id: 'b', startDate: '2026-09-17', isOngoing: true },
    ]);

    expect(() => getOpenPeriodRecord(subject)).toThrow(/2026-09-02, 2026-09-17/);
  });

  it('refuses even with closed records alongside', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-08-02', endDate: '2026-08-07' },
      { id: 'b', startDate: '2026-09-02', isOngoing: true },
      { id: 'c', startDate: '2026-09-17', isOngoing: true },
    ]);

    expect(() => getOpenPeriodRecord(subject)).toThrow(/found 2 ongoing periods/);
  });
});

describe('getOpenPeriodRecord purity', () => {
  it('does not mutate the profile', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-08-02', endDate: '2026-08-07' },
      { id: 'b', startDate: '2026-09-17', isOngoing: true },
    ]);
    const snapshot = JSON.parse(JSON.stringify(subject));

    getOpenPeriodRecord(subject);

    expect(subject).toEqual(snapshot);
  });

  it('does not reorder the records', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-09-17', isOngoing: true },
      { id: 'b', startDate: '2026-08-02', endDate: '2026-08-07' },
    ]);

    getOpenPeriodRecord(subject);

    expect(subject.periodRecords.map((record) => record.id)).toEqual(['a', 'b']);
  });
});
