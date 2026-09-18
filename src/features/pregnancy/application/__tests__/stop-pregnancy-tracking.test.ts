import type { SQLiteDatabase } from 'expo-sqlite';

import type { PregnancyProfile } from '../../domain/types';
import { stopPregnancyTracking } from '../stop-pregnancy-tracking';

import type { ISODate } from '@/types/iso-date';

jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  savePregnancyProfile: jest.fn(),
  loadPregnancyProfile: jest.fn(),
  clearPregnancyProfile: jest.fn(),
}));

// The cycle repository is mocked only so the test can prove nothing calls it.
jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const loadPregnancyProfile = repository.loadPregnancyProfile as jest.Mock;
const savePregnancyProfile = repository.savePregnancyProfile as jest.Mock;
const clearPregnancyProfile = repository.clearPregnancyProfile as jest.Mock;

const cycleRepository = jest.requireMock('@/features/cycle/data/cycle-repository');

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
  loadPregnancyProfile.mockResolvedValue(profile());
  savePregnancyProfile.mockReset();
  clearPregnancyProfile.mockReset();
  clearPregnancyProfile.mockResolvedValue(undefined);

  cycleRepository.loadCycleProfile.mockReset();
  cycleRepository.saveCycleProfile.mockReset();
});

describe('stopPregnancyTracking when nothing is tracked', () => {
  it('refuses rather than deleting nothing', async () => {
    loadPregnancyProfile.mockResolvedValue(null);

    await expect(stopPregnancyTracking(db)).rejects.toThrow(/no tracked pregnancy/);
  });

  it('clears nothing', async () => {
    loadPregnancyProfile.mockResolvedValue(null);

    await expect(stopPregnancyTracking(db)).rejects.toThrow();

    expect(clearPregnancyProfile).not.toHaveBeenCalled();
  });
});

describe('stopPregnancyTracking', () => {
  it('clears the stored pregnancy', async () => {
    await stopPregnancyTracking(db);

    expect(clearPregnancyProfile).toHaveBeenCalledTimes(1);
    expect(clearPregnancyProfile).toHaveBeenCalledWith(db);
  });

  it('resolves without a value', async () => {
    await expect(stopPregnancyTracking(db)).resolves.toBeUndefined();
  });

  it('checks there is something to stop before clearing', async () => {
    await stopPregnancyTracking(db);

    expect(loadPregnancyProfile.mock.invocationCallOrder[0]).toBeLessThan(
      clearPregnancyProfile.mock.invocationCallOrder[0]
    );
  });

  it('writes no pregnancy on the way out', async () => {
    await stopPregnancyTracking(db);

    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('leaves the cycle data alone', async () => {
    await stopPregnancyTracking(db);

    expect(cycleRepository.loadCycleProfile).not.toHaveBeenCalled();
    expect(cycleRepository.saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('stopPregnancyTracking when it fails', () => {
  it('passes a delete failure on', async () => {
    clearPregnancyProfile.mockRejectedValue(new Error('disk is full'));

    await expect(stopPregnancyTracking(db)).rejects.toThrow('disk is full');
  });

  it('does not retry the delete', async () => {
    clearPregnancyProfile.mockRejectedValue(new Error('disk is full'));

    await expect(stopPregnancyTracking(db)).rejects.toThrow();

    expect(clearPregnancyProfile).toHaveBeenCalledTimes(1);
  });

  it('passes a read failure on without clearing', async () => {
    loadPregnancyProfile.mockRejectedValue(new Error('database is locked'));

    await expect(stopPregnancyTracking(db)).rejects.toThrow(/database is locked/);

    expect(clearPregnancyProfile).not.toHaveBeenCalled();
  });
});
