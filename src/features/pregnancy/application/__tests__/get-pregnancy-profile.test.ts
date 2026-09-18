import type { SQLiteDatabase } from 'expo-sqlite';

import type { PregnancyProfile } from '../../domain/types';
import { getPregnancyProfile } from '../get-pregnancy-profile';

import type { ISODate } from '@/types/iso-date';

jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  savePregnancyProfile: jest.fn(),
  loadPregnancyProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const loadPregnancyProfile = repository.loadPregnancyProfile as jest.Mock;
const savePregnancyProfile = repository.savePregnancyProfile as jest.Mock;

const db = {} as SQLiteDatabase;

function profile(): PregnancyProfile {
  return {
    lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
    estimatedDueDate: '2027-06-09' as ISODate,
    dueDateSource: 'lmp',
  };
}

beforeEach(() => {
  loadPregnancyProfile.mockReset();
  savePregnancyProfile.mockReset();
});

describe('getPregnancyProfile', () => {
  it('returns null when no pregnancy is being tracked', async () => {
    loadPregnancyProfile.mockResolvedValue(null);

    await expect(getPregnancyProfile(db)).resolves.toBeNull();
  });

  it('returns the stored pregnancy', async () => {
    const stored = profile();
    loadPregnancyProfile.mockResolvedValue(stored);

    await expect(getPregnancyProfile(db)).resolves.toBe(stored);
  });

  it('reads through the repository once, with the database it was given', async () => {
    loadPregnancyProfile.mockResolvedValue(null);

    await getPregnancyProfile(db);

    expect(loadPregnancyProfile).toHaveBeenCalledTimes(1);
    expect(loadPregnancyProfile).toHaveBeenCalledWith(db);
  });

  it('writes nothing', async () => {
    loadPregnancyProfile.mockResolvedValue(profile());

    await getPregnancyProfile(db);

    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('passes a read failure on', async () => {
    loadPregnancyProfile.mockRejectedValue(new Error('database is locked'));

    await expect(getPregnancyProfile(db)).rejects.toThrow(/database is locked/);
  });
});
