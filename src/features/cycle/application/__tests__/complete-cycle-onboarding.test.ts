import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile, saveCycleProfile } from '../../data/cycle-repository';
import type { CycleOnboardingInput } from '../../domain/onboarding';
import { createInitialCycleProfile } from '../../domain/onboarding';
import type { CycleProfile } from '../../domain/types';
import { completeCycleOnboarding } from '../complete-cycle-onboarding';

import type { ISODate } from '@/types/iso-date';
import { toISODate } from '@/utils/date';

// The repository is replaced outright — this use case should never touch SQL.
jest.mock('../../data/cycle-repository', () => ({
  saveCycleProfile: jest.fn(),
  loadCycleProfile: jest.fn(),
}));

// The domain factory is spied on but keeps its real behaviour, so the tests
// exercise the actual profile it builds rather than a stand-in.
jest.mock('../../domain/onboarding', () => {
  const actual = jest.requireActual('../../domain/onboarding');

  return {
    ...actual,
    createInitialCycleProfile: jest.fn(actual.createInitialCycleProfile),
  };
});

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

const saveCycleProfileMock = saveCycleProfile as jest.Mock;
const loadCycleProfileMock = loadCycleProfile as jest.Mock;
const createInitialCycleProfileMock = createInitialCycleProfile as jest.Mock;

const openAppDatabaseMock = jest.requireMock('@/storage/db').openAppDatabase as jest.Mock;

let db: SQLiteDatabase;

function input(
  lastPeriodStartDate = '2026-09-01',
  averageCycleLengthDays = 28,
  averagePeriodLengthDays = 5
): CycleOnboardingInput {
  return {
    lastPeriodStartDate: toISODate(lastPeriodStartDate),
    averageCycleLengthDays,
    averagePeriodLengthDays,
  };
}

beforeEach(() => {
  db = { marker: 'the-one-database' } as unknown as SQLiteDatabase;

  saveCycleProfileMock.mockReset();
  saveCycleProfileMock.mockResolvedValue(undefined);
  loadCycleProfileMock.mockReset();
  createInitialCycleProfileMock.mockClear();
  openAppDatabaseMock.mockReset();
});

describe('completeCycleOnboarding with valid input', () => {
  it('builds the profile from the onboarding input', async () => {
    const onboarding = input();

    const result = await completeCycleOnboarding(db, onboarding);

    expect(createInitialCycleProfileMock).toHaveBeenCalledTimes(1);
    expect(createInitialCycleProfileMock).toHaveBeenCalledWith(onboarding);
    expect(result).toEqual({
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [
        { id: 'onboarding-initial-period', startDate: '2026-09-01' as ISODate },
      ],
    });
  });

  it('saves through the repository with the given database', async () => {
    await completeCycleOnboarding(db, input());

    expect(saveCycleProfileMock).toHaveBeenCalledTimes(1);
    expect(saveCycleProfileMock.mock.calls[0][0]).toBe(db);
  });

  it('saves exactly the profile it returns', async () => {
    const result = await completeCycleOnboarding(db, input());
    const savedProfile = saveCycleProfileMock.mock.calls[0][1] as CycleProfile;

    expect(savedProfile).toBe(result);
  });

  it('carries the onboarding values into the saved profile', async () => {
    await completeCycleOnboarding(db, input('2026-03-15', 30, 6));
    const savedProfile = saveCycleProfileMock.mock.calls[0][1] as CycleProfile;

    expect(savedProfile.settings).toEqual({
      averageCycleLengthDays: 30,
      averagePeriodLengthDays: 6,
    });
    expect(savedProfile.periodRecords[0].startDate).toBe('2026-03-15');
    expect(savedProfile.periodRecords[0].endDate).toBeUndefined();
  });

  it('does not read the profile back', async () => {
    await completeCycleOnboarding(db, input());

    expect(loadCycleProfileMock).not.toHaveBeenCalled();
  });

  it('does not open a database of its own', async () => {
    await completeCycleOnboarding(db, input());

    expect(openAppDatabaseMock).not.toHaveBeenCalled();
  });

  it('does not mutate the database handle', async () => {
    const keysBefore = Object.keys(db as unknown as Record<string, unknown>).sort();

    await completeCycleOnboarding(db, input());

    expect(Object.keys(db as unknown as Record<string, unknown>).sort()).toEqual(keysBefore);
    expect((db as unknown as Record<string, unknown>).marker).toBe('the-one-database');
  });

  it('does not mutate the input', async () => {
    const onboarding = input();
    const snapshot = JSON.parse(JSON.stringify(onboarding));

    await completeCycleOnboarding(db, onboarding);

    expect(JSON.parse(JSON.stringify(onboarding))).toEqual(snapshot);
  });
});

describe('completeCycleOnboarding with invalid input', () => {
  it.each<[string, CycleOnboardingInput]>([
    ['a cycle length below the minimum', input('2026-09-01', 14, 5)],
    ['a cycle length above the maximum', input('2026-09-01', 91, 5)],
    ['a period longer than the cycle', input('2026-09-01', 15, 16)],
  ])('propagates the validation error for %s', async (_label, invalid) => {
    await expect(completeCycleOnboarding(db, invalid)).rejects.toThrow();
  });

  it('propagates the validation error for an impossible date', async () => {
    const invalid: CycleOnboardingInput = {
      lastPeriodStartDate: '2026-02-30' as ISODate,
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    };

    await expect(completeCycleOnboarding(db, invalid)).rejects.toThrow(
      /Invalid lastPeriodStartDate/
    );
  });

  it('never reaches the repository', async () => {
    await expect(completeCycleOnboarding(db, input('2026-09-01', 14, 5))).rejects.toThrow();

    expect(saveCycleProfileMock).not.toHaveBeenCalled();
  });
});

describe('completeCycleOnboarding when the repository fails', () => {
  const saveError = new Error('constraint failed');

  beforeEach(() => {
    saveCycleProfileMock.mockRejectedValue(saveError);
  });

  it('rejects with the repository error', async () => {
    await expect(completeCycleOnboarding(db, input())).rejects.toThrow(saveError);
  });

  it('does not fall back to returning a profile anyway', async () => {
    let resolvedWith: unknown = 'not-resolved';

    try {
      resolvedWith = await completeCycleOnboarding(db, input());
    } catch {
      // expected
    }

    expect(resolvedWith).toBe('not-resolved');
  });

  it('does not retry the save', async () => {
    await expect(completeCycleOnboarding(db, input())).rejects.toThrow();

    expect(saveCycleProfileMock).toHaveBeenCalledTimes(1);
    expect(createInitialCycleProfileMock).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to reading an existing profile', async () => {
    await expect(completeCycleOnboarding(db, input())).rejects.toThrow();

    expect(loadCycleProfileMock).not.toHaveBeenCalled();
  });
});
