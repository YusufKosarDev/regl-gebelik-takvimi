import type { SQLiteDatabase } from 'expo-sqlite';

import { getCycleSettings } from '../get-cycle-settings';

import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const loadCycleProfile = repository.loadCycleProfile as jest.Mock;
const saveCycleProfile = repository.saveCycleProfile as jest.Mock;

const db = {} as SQLiteDatabase;

function profile(): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
    periodRecords: [
      {
        id: 'onboarding-initial-period',
        startDate: '2026-09-02' as ISODate,
        endDate: '2026-09-07' as ISODate,
        isOngoing: false,
      },
    ],
  };
}

beforeEach(() => {
  loadCycleProfile.mockReset();
  saveCycleProfile.mockReset();
});

describe('getCycleSettings', () => {
  it('returns null when nothing has been saved yet', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await expect(getCycleSettings(db)).resolves.toBeNull();
  });

  it('returns the stored settings', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    await expect(getCycleSettings(db)).resolves.toEqual({
      averageCycleLengthDays: 30,
      averagePeriodLengthDays: 6,
    });
  });

  it('hands back the settings the profile holds, not a copy', async () => {
    const stored = profile();
    loadCycleProfile.mockResolvedValue(stored);

    await expect(getCycleSettings(db)).resolves.toBe(stored.settings);
  });

  it('reads through the repository once, with the database it was given', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    await getCycleSettings(db);

    expect(loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(loadCycleProfile).toHaveBeenCalledWith(db);
  });

  it('writes nothing', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    await getCycleSettings(db);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('passes a read failure on', async () => {
    loadCycleProfile.mockRejectedValue(new Error('database is locked'));

    await expect(getCycleSettings(db)).rejects.toThrow(/database is locked/);
  });
});
