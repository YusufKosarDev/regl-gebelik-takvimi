import type { CycleProfile, CycleSettings, PeriodRecord } from '../types';
import {
  validateCycleProfile,
  validateCycleSettings,
  validatePeriodRecord,
} from '../validation';

import type { ISODate } from '@/types/iso-date';
import { toISODate } from '@/utils/date';

function settings(
  averageCycleLengthDays: number,
  averagePeriodLengthDays: number
): CycleSettings {
  return { averageCycleLengthDays, averagePeriodLengthDays };
}

function record(id: string, startDate: string, endDate?: string): PeriodRecord {
  return endDate === undefined
    ? { id, startDate: toISODate(startDate) }
    : { id, startDate: toISODate(startDate), endDate: toISODate(endDate) };
}

describe('validateCycleSettings', () => {
  it('accepts a typical profile', () => {
    expect(() => validateCycleSettings(settings(28, 5))).not.toThrow();
  });

  it('accepts the range boundaries', () => {
    expect(() => validateCycleSettings(settings(15, 1))).not.toThrow();
    expect(() => validateCycleSettings(settings(90, 20))).not.toThrow();
  });

  it('rejects a cycle length below the minimum', () => {
    expect(() => validateCycleSettings(settings(14, 5))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
  });

  it('rejects a cycle length above the maximum', () => {
    expect(() => validateCycleSettings(settings(91, 5))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
  });

  it('rejects a period length below the minimum', () => {
    expect(() => validateCycleSettings(settings(28, 0))).toThrow(
      /averagePeriodLengthDays must be between 1 and 20/
    );
  });

  it('rejects a period length above the maximum', () => {
    expect(() => validateCycleSettings(settings(28, 21))).toThrow(
      /averagePeriodLengthDays must be between 1 and 20/
    );
  });

  it('rejects a period longer than the cycle', () => {
    expect(() => validateCycleSettings(settings(15, 16))).toThrow(
      /cannot exceed averageCycleLengthDays/
    );
  });

  it('rejects non-integer values', () => {
    expect(() => validateCycleSettings(settings(28.5, 5))).toThrow(
      /averageCycleLengthDays must be an integer/
    );
    expect(() => validateCycleSettings(settings(28, 5.5))).toThrow(
      /averagePeriodLengthDays must be an integer/
    );
  });
});

describe('validatePeriodRecord', () => {
  it('accepts a record with only a start date', () => {
    expect(() => validatePeriodRecord(record('a', '2026-01-01'))).not.toThrow();
  });

  it('accepts a record with a start and an end date', () => {
    expect(() => validatePeriodRecord(record('a', '2026-01-01', '2026-01-05'))).not.toThrow();
  });

  it('accepts a single-day record', () => {
    expect(() => validatePeriodRecord(record('a', '2026-01-01', '2026-01-01'))).not.toThrow();
  });

  it('rejects an empty id', () => {
    expect(() => validatePeriodRecord(record('', '2026-01-01'))).toThrow(
      /id must be a non-empty string/
    );
  });

  it('rejects a whitespace-only id', () => {
    expect(() => validatePeriodRecord(record('   ', '2026-01-01'))).toThrow(
      /id must be a non-empty string/
    );
  });

  it('rejects an end date before the start date', () => {
    expect(() => validatePeriodRecord(record('a', '2026-01-05', '2026-01-01'))).toThrow(
      /ends before it starts/
    );
  });

  it('accepts a 20 day period', () => {
    expect(() => validatePeriodRecord(record('a', '2026-01-01', '2026-01-20'))).not.toThrow();
  });

  it('rejects a 21 day period', () => {
    expect(() => validatePeriodRecord(record('a', '2026-01-01', '2026-01-21'))).toThrow(
      /spans 21 days, which exceeds the maximum of 20/
    );
  });

  it('rejects a start date that is not a real calendar date', () => {
    const invalid: PeriodRecord = { id: 'a', startDate: '2026-02-30' as ISODate };

    expect(() => validatePeriodRecord(invalid)).toThrow(/invalid startDate/);
  });

  it('rejects an end date that is not a real calendar date', () => {
    const invalid: PeriodRecord = {
      id: 'a',
      startDate: toISODate('2026-01-01'),
      endDate: '2026-13-01' as ISODate,
    };

    expect(() => validatePeriodRecord(invalid)).toThrow(/invalid endDate/);
  });
});

describe('validateCycleProfile', () => {
  it('accepts a profile with no period records', () => {
    const profile: CycleProfile = { settings: settings(28, 5), periodRecords: [] };

    expect(() => validateCycleProfile(profile)).not.toThrow();
  });

  it('accepts several valid records', () => {
    const profile: CycleProfile = {
      settings: settings(28, 5),
      periodRecords: [
        record('a', '2026-01-01', '2026-01-05'),
        record('b', '2026-01-29', '2026-02-02'),
        record('c', '2026-02-26'),
      ],
    };

    expect(() => validateCycleProfile(profile)).not.toThrow();
  });

  it('accepts records that are not in chronological order', () => {
    const profile: CycleProfile = {
      settings: settings(28, 5),
      periodRecords: [record('c', '2026-02-26'), record('a', '2026-01-01'), record('b', '2026-01-29')],
    };

    expect(() => validateCycleProfile(profile)).not.toThrow();
  });

  it('rejects a duplicate id', () => {
    const profile: CycleProfile = {
      settings: settings(28, 5),
      periodRecords: [record('a', '2026-01-01'), record('a', '2026-01-29')],
    };

    expect(() => validateCycleProfile(profile)).toThrow(/Duplicate PeriodRecord id: "a"/);
  });

  it('rejects a duplicate start date', () => {
    const profile: CycleProfile = {
      settings: settings(28, 5),
      periodRecords: [record('a', '2026-01-01'), record('b', '2026-01-01')],
    };

    expect(() => validateCycleProfile(profile)).toThrow(
      /Duplicate PeriodRecord startDate: "2026-01-01"/
    );
  });

  it('propagates invalid settings', () => {
    const profile: CycleProfile = { settings: settings(14, 5), periodRecords: [] };

    expect(() => validateCycleProfile(profile)).toThrow(/averageCycleLengthDays/);
  });

  it('propagates an invalid record', () => {
    const profile: CycleProfile = {
      settings: settings(28, 5),
      periodRecords: [record('', '2026-01-01')],
    };

    expect(() => validateCycleProfile(profile)).toThrow(/non-empty string/);
  });

  it('does not sort or otherwise mutate the input', () => {
    const records = [
      record('c', '2026-02-26'),
      record('a', '2026-01-01'),
      record('b', '2026-01-29'),
    ];
    const profile: CycleProfile = { settings: settings(28, 5), periodRecords: records };
    const snapshot = JSON.parse(JSON.stringify(records));

    validateCycleProfile(profile);

    expect(records).toHaveLength(3);
    expect(records.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(JSON.parse(JSON.stringify(records))).toEqual(snapshot);
    expect(profile.periodRecords).toBe(records);
  });
});
