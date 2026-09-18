import type { SQLiteDatabase } from 'expo-sqlite';

import { calculateEstimatedDueDate } from '../../domain/due-date';
import { startPregnancyTracking } from '../start-pregnancy-tracking';

import type { ISODate } from '@/types/iso-date';

// Only the database is faked. The domain rules and the due-date formula stay
// real, so what is saved is what the app would really store.
jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  savePregnancyProfile: jest.fn(),
  loadPregnancyProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const savePregnancyProfile = repository.savePregnancyProfile as jest.Mock;

const db = {} as SQLiteDatabase;
const date = (value: string) => value as ISODate;

const TODAY = date('2026-09-18');

beforeEach(() => {
  savePregnancyProfile.mockReset();
  savePregnancyProfile.mockResolvedValue(undefined);
});

describe('startPregnancyTracking with a usable date', () => {
  it('returns a profile dated from the last menstrual period', async () => {
    const profile = await startPregnancyTracking(db, { lmp: date('2026-09-02'), today: TODAY });

    expect(profile.lastMenstrualPeriodStartDate).toBe('2026-09-02');
  });

  it('calculates the due date rather than asking for one', async () => {
    const profile = await startPregnancyTracking(db, { lmp: date('2026-09-02'), today: TODAY });

    expect(profile.estimatedDueDate).toBe(calculateEstimatedDueDate(date('2026-09-02')));
    expect(profile.estimatedDueDate).toBe('2027-06-09');
  });

  it('records that the due date was calculated', async () => {
    const profile = await startPregnancyTracking(db, { lmp: date('2026-09-02'), today: TODAY });

    expect(profile.dueDateSource).toBe('lmp');
  });

  it('accepts a last menstrual period of today', async () => {
    const profile = await startPregnancyTracking(db, { lmp: TODAY, today: TODAY });

    expect(profile.lastMenstrualPeriodStartDate).toBe(TODAY);
  });

  it('accepts one well in the past', async () => {
    const profile = await startPregnancyTracking(db, { lmp: date('2026-01-15'), today: TODAY });

    expect(profile.estimatedDueDate).toBe(calculateEstimatedDueDate(date('2026-01-15')));
  });

  it('counts a leap day in the due date', async () => {
    const profile = await startPregnancyTracking(db, {
      lmp: date('2028-02-20'),
      today: date('2028-03-01'),
    });

    expect(profile.estimatedDueDate).toBe('2028-11-26');
  });

  it('saves the profile it returns', async () => {
    const profile = await startPregnancyTracking(db, { lmp: date('2026-09-02'), today: TODAY });

    expect(savePregnancyProfile).toHaveBeenCalledTimes(1);
    expect(savePregnancyProfile).toHaveBeenCalledWith(db, profile);
  });

  it('saves the whole profile, source included', async () => {
    await startPregnancyTracking(db, { lmp: date('2026-09-02'), today: TODAY });

    expect(savePregnancyProfile.mock.calls[0][1]).toEqual({
      lastMenstrualPeriodStartDate: '2026-09-02',
      estimatedDueDate: '2027-06-09',
      dueDateSource: 'lmp',
    });
  });
});

describe('startPregnancyTracking with a date it refuses', () => {
  it('refuses a last menstrual period in the future', async () => {
    await expect(
      startPregnancyTracking(db, { lmp: date('2026-09-19'), today: TODAY })
    ).rejects.toThrow(/cannot start from a date in the future/);

    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('refuses one well in the future', async () => {
    await expect(
      startPregnancyTracking(db, { lmp: date('2027-01-01'), today: TODAY })
    ).rejects.toThrow(/in the future/);

    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('refuses a date that does not exist', async () => {
    await expect(
      startPregnancyTracking(db, { lmp: date('2026-02-30'), today: TODAY })
    ).rejects.toThrow(/invalid lmp/);

    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('refuses something that is not a date at all', async () => {
    await expect(
      startPregnancyTracking(db, { lmp: date('dün'), today: TODAY })
    ).rejects.toThrow(/invalid lmp/);

    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('refuses a malformed today', async () => {
    await expect(
      startPregnancyTracking(db, { lmp: date('2026-09-02'), today: date('bugün') })
    ).rejects.toThrow(/invalid today/);

    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });
});

describe('startPregnancyTracking when saving fails', () => {
  it('passes the failure on', async () => {
    const failure = new Error('disk is full');
    savePregnancyProfile.mockRejectedValue(failure);

    await expect(
      startPregnancyTracking(db, { lmp: date('2026-09-02'), today: TODAY })
    ).rejects.toThrow(failure);
  });

  it('does not retry the write', async () => {
    savePregnancyProfile.mockRejectedValue(new Error('disk is full'));

    await expect(
      startPregnancyTracking(db, { lmp: date('2026-09-02'), today: TODAY })
    ).rejects.toThrow();

    expect(savePregnancyProfile).toHaveBeenCalledTimes(1);
  });
});

describe('startPregnancyTracking purity', () => {
  it('leaves the input alone', async () => {
    const input = { lmp: date('2026-09-02'), today: TODAY };
    const before = JSON.stringify(input);

    await startPregnancyTracking(db, input);

    expect(JSON.stringify(input)).toBe(before);
  });

  it('builds a fresh profile each time', async () => {
    const first = await startPregnancyTracking(db, { lmp: date('2026-09-02'), today: TODAY });
    const second = await startPregnancyTracking(db, { lmp: date('2026-09-02'), today: TODAY });

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
