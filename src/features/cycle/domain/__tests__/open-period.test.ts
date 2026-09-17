import { getOpenPeriodRecord } from '../open-period';
import type { CycleProfile } from '../types';

import type { ISODate } from '@/types/iso-date';

function profile(
  records: { id: string; startDate: string; endDate?: string }[]
): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
    periodRecords: records.map((record) => ({
      id: record.id,
      startDate: record.startDate as ISODate,
      ...(record.endDate === undefined ? {} : { endDate: record.endDate as ISODate }),
    })),
  };
}

describe('getOpenPeriodRecord with nothing open', () => {
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
});

describe('getOpenPeriodRecord with one open', () => {
  it('returns the record', () => {
    const subject = profile([{ id: 'a', startDate: '2026-09-17' }]);

    expect(getOpenPeriodRecord(subject)).toEqual({ id: 'a', startDate: '2026-09-17' });
  });

  it('finds it among closed records', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-08-02', endDate: '2026-08-07' },
      { id: 'b', startDate: '2026-09-17' },
      { id: 'c', startDate: '2026-07-04', endDate: '2026-07-09' },
    ]);

    expect(getOpenPeriodRecord(subject)?.id).toBe('b');
  });

  it('returns the record itself, not a copy', () => {
    const subject = profile([{ id: 'a', startDate: '2026-09-17' }]);

    expect(getOpenPeriodRecord(subject)).toBe(subject.periodRecords[0]);
  });
});

describe('getOpenPeriodRecord with several open', () => {
  it('refuses to choose', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-09-02' },
      { id: 'b', startDate: '2026-09-17' },
    ]);

    expect(() => getOpenPeriodRecord(subject)).toThrow(/found 2 periods without an end date/);
  });

  it('names the dates it found', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-09-02' },
      { id: 'b', startDate: '2026-09-17' },
    ]);

    expect(() => getOpenPeriodRecord(subject)).toThrow(/2026-09-02, 2026-09-17/);
  });

  it('refuses even with closed records alongside', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-08-02', endDate: '2026-08-07' },
      { id: 'b', startDate: '2026-09-02' },
      { id: 'c', startDate: '2026-09-17' },
    ]);

    expect(() => getOpenPeriodRecord(subject)).toThrow(/found 2 periods/);
  });
});

describe('getOpenPeriodRecord purity', () => {
  it('does not mutate the profile', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-08-02', endDate: '2026-08-07' },
      { id: 'b', startDate: '2026-09-17' },
    ]);
    const snapshot = JSON.parse(JSON.stringify(subject));

    getOpenPeriodRecord(subject);

    expect(subject).toEqual(snapshot);
  });

  it('does not reorder the records', () => {
    const subject = profile([
      { id: 'a', startDate: '2026-09-17' },
      { id: 'b', startDate: '2026-08-02', endDate: '2026-08-07' },
    ]);

    getOpenPeriodRecord(subject);

    expect(subject.periodRecords.map((record) => record.id)).toEqual(['a', 'b']);
  });
});
