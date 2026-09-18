import type { SQLiteDatabase } from 'expo-sqlite';

import { deletePeriodRecord } from '../delete-period-record';

import type { CycleProfile, PeriodRecord } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

// Only the database is faked. Domain validation stays real, so a profile this
// use case would refuse to store is refused here too.
jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const loadCycleProfile = repository.loadCycleProfile as jest.Mock;
const saveCycleProfile = repository.saveCycleProfile as jest.Mock;

const db = {} as SQLiteDatabase;

type Spec = { id: string; startDate: string; endDate?: string; isOngoing?: boolean };

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

/** Onboarding's record, a closed one and one still running. */
function mixedProfile(): CycleProfile {
  return profile([
    { id: 'onboarding-initial-period', startDate: '2026-08-02' },
    { id: 'period-2026-09-02', startDate: '2026-09-02', endDate: '2026-09-07' },
    { id: 'period-2026-09-17', startDate: '2026-09-17', isOngoing: true },
  ]);
}

beforeEach(() => {
  loadCycleProfile.mockReset();
  saveCycleProfile.mockReset();
  saveCycleProfile.mockResolvedValue(undefined);
});

describe('deletePeriodRecord input validation', () => {
  it('refuses an empty id without touching the database', async () => {
    await expect(deletePeriodRecord(db, { recordId: '' })).rejects.toThrow(/non-empty record id/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a whitespace id', async () => {
    await expect(deletePeriodRecord(db, { recordId: '   ' })).rejects.toThrow(
      /non-empty record id/
    );

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });
});

describe('deletePeriodRecord without something to delete', () => {
  it('refuses when nothing is saved', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await expect(deletePeriodRecord(db, { recordId: 'a' })).rejects.toThrow(
      /no saved cycle profile/
    );

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses an id that is not on file', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(deletePeriodRecord(db, { recordId: 'period-2026-01-01' })).rejects.toThrow(
      /no period record with that id/
    );

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('matches the id exactly', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(deletePeriodRecord(db, { recordId: 'period-2026-09-1' })).rejects.toThrow(
      /no period record/
    );
  });
});

describe('deletePeriodRecord removes what was asked for', () => {
  it('removes a record whose end was never written down', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const updated = await deletePeriodRecord(db, { recordId: 'onboarding-initial-period' });

    expect(updated.periodRecords.map((record) => record.id)).toEqual([
      'period-2026-09-02',
      'period-2026-09-17',
    ]);
  });

  it('removes a finished record', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const updated = await deletePeriodRecord(db, { recordId: 'period-2026-09-02' });

    expect(updated.periodRecords.map((record) => record.id)).toEqual([
      'onboarding-initial-period',
      'period-2026-09-17',
    ]);
  });

  it('removes the record that is still running', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const updated = await deletePeriodRecord(db, { recordId: 'period-2026-09-17' });

    expect(updated.periodRecords.map((record) => record.id)).toEqual([
      'onboarding-initial-period',
      'period-2026-09-02',
    ]);
  });

  it('leaves nothing running after deleting the running one', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const updated = await deletePeriodRecord(db, { recordId: 'period-2026-09-17' });

    // No other record is promoted to take its place.
    expect(updated.periodRecords.filter((record) => record.isOngoing)).toHaveLength(0);
  });

  it('leaves the other records exactly as they were', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const updated = await deletePeriodRecord(db, { recordId: 'period-2026-09-17' });

    expect(updated.periodRecords[0]).toEqual({
      id: 'onboarding-initial-period',
      startDate: '2026-08-02',
      isOngoing: false,
    });
    expect(updated.periodRecords[1]).toEqual({
      id: 'period-2026-09-02',
      startDate: '2026-09-02',
      endDate: '2026-09-07',
      isOngoing: false,
    });
  });

  it('keeps the order of what remains', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'c', startDate: '2026-09-17' },
        { id: 'a', startDate: '2026-07-04' },
        { id: 'b', startDate: '2026-08-02' },
      ])
    );

    const updated = await deletePeriodRecord(db, { recordId: 'a' });

    expect(updated.periodRecords.map((record) => record.id)).toEqual(['c', 'b']);
  });

  it('keeps the settings', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const updated = await deletePeriodRecord(db, { recordId: 'period-2026-09-02' });

    expect(updated.settings).toEqual({ averageCycleLengthDays: 30, averagePeriodLengthDays: 6 });
  });
});

describe('deletePeriodRecord emptying the list', () => {
  it('accepts removing the only record', async () => {
    loadCycleProfile.mockResolvedValue(profile([{ id: 'a', startDate: '2026-09-02' }]));

    const updated = await deletePeriodRecord(db, { recordId: 'a' });

    expect(updated.periodRecords).toEqual([]);
  });

  it('stores the profile with no records', async () => {
    loadCycleProfile.mockResolvedValue(profile([{ id: 'a', startDate: '2026-09-02' }]));

    await deletePeriodRecord(db, { recordId: 'a' });

    const [, saved] = saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords).toEqual([]);
    expect(saved.settings).toEqual({ averageCycleLengthDays: 30, averagePeriodLengthDays: 6 });
  });

  it('invents no replacement record', async () => {
    loadCycleProfile.mockResolvedValue(profile([{ id: 'a', startDate: '2026-09-02' }]));

    const updated = await deletePeriodRecord(db, { recordId: 'a' });

    expect(updated.periodRecords).toHaveLength(0);
  });
});

describe('deletePeriodRecord storage', () => {
  beforeEach(() => {
    loadCycleProfile.mockResolvedValue(mixedProfile());
  });

  it('stores exactly what it returns', async () => {
    const updated = await deletePeriodRecord(db, { recordId: 'period-2026-09-02' });

    expect(saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(saveCycleProfile).toHaveBeenCalledWith(db, updated);
  });

  it('reads before it writes', async () => {
    const order: string[] = [];
    loadCycleProfile.mockImplementation(async () => {
      order.push('load');
      return mixedProfile();
    });
    saveCycleProfile.mockImplementation(async () => {
      order.push('save');
    });

    await deletePeriodRecord(db, { recordId: 'period-2026-09-02' });

    expect(order).toEqual(['load', 'save']);
  });

  it('lets a failed write through', async () => {
    saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    await expect(deletePeriodRecord(db, { recordId: 'period-2026-09-02' })).rejects.toThrow(
      'disk is full'
    );
  });

  it('lets a failed read through', async () => {
    loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    await expect(deletePeriodRecord(db, { recordId: 'period-2026-09-02' })).rejects.toThrow(
      'corrupt row'
    );
  });

  it('runs the profile through domain validation', async () => {
    // Two records with the same start date would never be stored; validation
    // fires before the write rather than after it.
    loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'a', startDate: '2026-09-02' },
        { id: 'b', startDate: '2026-09-02' },
        { id: 'c', startDate: '2026-09-17' },
      ])
    );

    await expect(deletePeriodRecord(db, { recordId: 'c' })).rejects.toThrow(
      /Duplicate PeriodRecord startDate/
    );

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('deletePeriodRecord purity', () => {
  it('does not mutate the stored profile', async () => {
    const stored = mixedProfile();
    const snapshot = JSON.parse(JSON.stringify(stored));
    loadCycleProfile.mockResolvedValue(stored);

    await deletePeriodRecord(db, { recordId: 'period-2026-09-17' });

    expect(stored).toEqual(snapshot);
    expect(stored.periodRecords).toHaveLength(3);
  });

  it('returns a new records array', async () => {
    const stored = mixedProfile();
    loadCycleProfile.mockResolvedValue(stored);

    const updated = await deletePeriodRecord(db, { recordId: 'period-2026-09-17' });

    expect(updated.periodRecords).not.toBe(stored.periodRecords);
  });

  it('leaves the surviving records as the same objects', async () => {
    const stored = mixedProfile();
    loadCycleProfile.mockResolvedValue(stored);

    const updated = await deletePeriodRecord(db, { recordId: 'period-2026-09-17' });

    expect(updated.periodRecords[0]).toBe(stored.periodRecords[0]);
  });
});
