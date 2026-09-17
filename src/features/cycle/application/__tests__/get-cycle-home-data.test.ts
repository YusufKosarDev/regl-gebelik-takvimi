import type { SQLiteDatabase } from 'expo-sqlite';

import { buildCycleDashboard } from '../get-cycle-dashboard';
import { getCycleHomeData } from '../get-cycle-home-data';

import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

// Only the database read is faked. The dashboard builder stays real, so this
// pins the wiring rather than a restatement of it.
jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const loadCycleProfile = repository.loadCycleProfile as jest.Mock;

const db = {} as SQLiteDatabase;

/** Cycle 28, period 5 -> ovulation on day 14, fertile window days 9-15. */
function profile(startDates: string[] = ['2026-09-01']): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: startDates.map((startDate, index) => ({
      id: `record-${index}`,
      startDate: startDate as ISODate,
    })),
  };
}

beforeEach(() => {
  loadCycleProfile.mockReset();
  repository.saveCycleProfile.mockReset();
});

describe('getCycleHomeData without a saved profile', () => {
  it('returns null', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await expect(getCycleHomeData(db, '2026-09-17' as ISODate)).resolves.toBeNull();
  });

  it('returns no profile to build a calendar from', async () => {
    loadCycleProfile.mockResolvedValue(null);

    const result = await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(result?.profile).toBeUndefined();
  });
});

describe('getCycleHomeData database reads', () => {
  it('reads the profile exactly once', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(loadCycleProfile).toHaveBeenCalledWith(db);
  });

  it('reads once for both the summary and the profile', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(result?.dashboard).toBeDefined();
    expect(result?.profile).toBeDefined();
    expect(loadCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('writes nothing', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('getCycleHomeData dashboard', () => {
  it('matches what the dashboard builder produces', async () => {
    const subject = profile();
    loadCycleProfile.mockResolvedValue(subject);

    const result = await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(result?.dashboard).toEqual(buildCycleDashboard(subject, '2026-09-17' as ISODate));
  });

  it('summarises the day it was asked about', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(result?.dashboard).toEqual({
      today: '2026-09-17',
      cycleDay: 17,
      phase: 'luteal',
      fertilityLevel: 'low',
      nextPeriodStart: '2026-09-29',
    });
  });
});

describe('getCycleHomeData profile', () => {
  it('hands back what the repository loaded', async () => {
    const subject = profile();
    loadCycleProfile.mockResolvedValue(subject);

    const result = await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(result?.profile).toBe(subject);
  });

  it('does not mutate it', async () => {
    const subject = profile(['2026-09-20', '2026-09-01']);
    const snapshot = JSON.parse(JSON.stringify(subject));
    loadCycleProfile.mockResolvedValue(subject);

    await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(subject).toEqual(snapshot);
  });
});

describe('getCycleHomeData failures', () => {
  it('lets a repository error through', async () => {
    loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    await expect(getCycleHomeData(db, '2026-09-17' as ISODate)).rejects.toThrow('corrupt row');
  });

  it('lets a domain validation error through', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    await expect(getCycleHomeData(db, '2026-02-30' as ISODate)).rejects.toThrow();
  });
});
