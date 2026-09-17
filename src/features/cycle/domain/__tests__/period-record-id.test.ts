import { canonicalPeriodRecordId, getUpdatedPeriodRecordId } from '../period-record-id';
import type { PeriodRecord } from '../types';

import type { ISODate } from '@/types/iso-date';

function record(id: string, startDate: string, endDate?: string): PeriodRecord {
  const built: PeriodRecord = { id, startDate: startDate as ISODate, isOngoing: false };

  return endDate === undefined ? built : { ...built, endDate: endDate as ISODate };
}

describe('canonicalPeriodRecordId', () => {
  it('names a record after the day it starts', () => {
    expect(canonicalPeriodRecordId('2026-09-17' as ISODate)).toBe('period-2026-09-17');
  });

  it('is derived from the date alone, with no clock or random source', () => {
    expect(canonicalPeriodRecordId('2026-01-01' as ISODate)).toBe(
      canonicalPeriodRecordId('2026-01-01' as ISODate)
    );
  });
});

describe('getUpdatedPeriodRecordId on a record the app named itself', () => {
  it('renames it to the new day', () => {
    const target = record('period-2026-09-17', '2026-09-17');

    expect(getUpdatedPeriodRecordId(target, '2026-09-16' as ISODate)).toBe('period-2026-09-16');
  });

  it('renames it across a month boundary', () => {
    const target = record('period-2026-09-01', '2026-09-01');

    expect(getUpdatedPeriodRecordId(target, '2026-08-31' as ISODate)).toBe('period-2026-08-31');
  });

  it('renames it when the record has an end date too', () => {
    const target = record('period-2026-09-17', '2026-09-17', '2026-09-20');

    expect(getUpdatedPeriodRecordId(target, '2026-09-15' as ISODate)).toBe('period-2026-09-15');
  });

  it('returns the same id when the date has not moved', () => {
    const target = record('period-2026-09-17', '2026-09-17');

    expect(getUpdatedPeriodRecordId(target, '2026-09-17' as ISODate)).toBe('period-2026-09-17');
  });
});

describe('getUpdatedPeriodRecordId on a record named by something else', () => {
  it('leaves the onboarding record its own id', () => {
    const target = record('onboarding-initial-period', '2026-09-02');

    expect(getUpdatedPeriodRecordId(target, '2026-09-01' as ISODate)).toBe(
      'onboarding-initial-period'
    );
  });

  it('leaves an imported id alone', () => {
    const target = record('custom-import-123', '2026-09-02');

    expect(getUpdatedPeriodRecordId(target, '2026-09-01' as ISODate)).toBe('custom-import-123');
  });

  it('leaves an id that only looks canonical alone', () => {
    // It names a day the record does not start on, so it was not derived from
    // this record's start date and rewriting it would be a guess.
    const target = record('period-2026-01-01', '2026-02-01');

    expect(getUpdatedPeriodRecordId(target, '2026-02-02' as ISODate)).toBe('period-2026-01-01');
  });

  it('leaves an empty id alone', () => {
    const target = record('', '2026-09-02');

    expect(getUpdatedPeriodRecordId(target, '2026-09-01' as ISODate)).toBe('');
  });

  it('leaves a differently prefixed id alone', () => {
    const target = record('periods-2026-09-02', '2026-09-02');

    expect(getUpdatedPeriodRecordId(target, '2026-09-01' as ISODate)).toBe('periods-2026-09-02');
  });
});

describe('getUpdatedPeriodRecordId purity', () => {
  it('does not touch the record it was given', () => {
    const target = record('period-2026-09-17', '2026-09-17', '2026-09-20');
    const before = JSON.stringify(target);

    getUpdatedPeriodRecordId(target, '2026-09-10' as ISODate);

    expect(JSON.stringify(target)).toBe(before);
  });
});
