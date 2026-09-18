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
      isOngoing: false,
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

describe('getCycleHomeData daily support', () => {
  // Cycle 28 from 2026-09-01: days 1-5 menstrual, 6-13 follicular, 14 ovulatory,
  // 15 on luteal. A date before the first record has no cycle day at all.
  it.each([
    ['2026-09-03', 'menstrual'],
    ['2026-09-10', 'follicular'],
    ['2026-09-14', 'ovulatory'],
    ['2026-09-20', 'luteal'],
  ] as const)('hands back the %s content for the %s phase', async (today, phase) => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, today as ISODate);

    expect(result?.dailySupport?.phase).toBe(phase);
  });

  it('answers with the phase the dashboard reports, not one of its own', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, '2026-09-10' as ISODate);

    expect(result?.dailySupport?.phase).toBe(result?.dashboard.phase);
  });

  it('is null on a day with no phase', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, '2026-08-25' as ISODate);

    expect(result?.dashboard.phase).toBeNull();
    expect(result?.dailySupport).toBeNull();
  });

  it('carries the sources the content was written from', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, '2026-09-20' as ISODate);

    expect(result?.dailySupport?.sources.length).toBeGreaterThan(0);
    result?.dailySupport?.sources.forEach((source) => {
      expect(source.url).toMatch(/^https?:\/\/.+/);
    });
  });

  it('leaves the ovulatory phase without moods', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, '2026-09-14' as ISODate);

    expect(result?.dailySupport?.moodLabels).toBeUndefined();
    expect(result?.dailySupport?.supportMessage).toBeTruthy();
  });

  it('still reads the database only once', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    await getCycleHomeData(db, '2026-09-20' as ISODate);

    expect(loadCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('does not look anything up when there is no profile', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await expect(getCycleHomeData(db, '2026-09-20' as ISODate)).resolves.toBeNull();
  });
});
