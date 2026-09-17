import type { SQLiteDatabase } from 'expo-sqlite';

import { getCycleDashboard } from '../get-cycle-dashboard';

import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

// Only the repository is faked. The domain functions stay real, so these tests
// pin the wiring against the rules that actually ship.
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

describe('getCycleDashboard without a saved profile', () => {
  it('returns null', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await expect(getCycleDashboard(db, '2026-09-17' as ISODate)).resolves.toBeNull();
  });

  it('reads the profile through the repository', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await getCycleDashboard(db, '2026-09-17' as ISODate);

    expect(loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(loadCycleProfile).toHaveBeenCalledWith(db);
  });
});

describe('getCycleDashboard with a saved profile', () => {
  it('summarises a day in the luteal phase', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    await expect(getCycleDashboard(db, '2026-09-17' as ISODate)).resolves.toEqual({
      today: '2026-09-17',
      cycleDay: 17,
      phase: 'luteal',
      fertilityLevel: 'low',
      nextPeriodStart: '2026-09-29',
    });
  });

  it('counts the period start itself as day 1', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const dashboard = await getCycleDashboard(db, '2026-09-01' as ISODate);

    expect(dashboard).toMatchObject({ cycleDay: 1, phase: 'menstrual', fertilityLevel: 'low' });
  });

  it('reports the last menstrual day', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    expect(await getCycleDashboard(db, '2026-09-05' as ISODate)).toMatchObject({
      cycleDay: 5,
      phase: 'menstrual',
    });
  });

  it('reports the follicular phase with an elevated estimate', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    expect(await getCycleDashboard(db, '2026-09-10' as ISODate)).toMatchObject({
      cycleDay: 10,
      phase: 'follicular',
      fertilityLevel: 'elevated',
    });
  });

  it('reports the ovulatory day at peak', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    expect(await getCycleDashboard(db, '2026-09-14' as ISODate)).toMatchObject({
      cycleDay: 14,
      phase: 'ovulatory',
      fertilityLevel: 'peak',
    });
  });

  it('echoes back the date it was asked about', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const dashboard = await getCycleDashboard(db, '2026-09-10' as ISODate);

    expect(dashboard?.today).toBe('2026-09-10');
  });

  it('counts from the latest record on or before today', async () => {
    loadCycleProfile.mockResolvedValue(profile(['2026-07-06', '2026-09-01', '2026-08-04']));

    expect(await getCycleDashboard(db, '2026-09-17' as ISODate)).toMatchObject({
      cycleDay: 17,
      nextPeriodStart: '2026-09-29',
    });
  });

  it('ignores records that start after today for the day count', async () => {
    loadCycleProfile.mockResolvedValue(profile(['2026-09-01']));

    expect(await getCycleDashboard(db, '2026-08-31' as ISODate)).toEqual({
      today: '2026-08-31',
      cycleDay: null,
      phase: null,
      fertilityLevel: null,
      // The prediction looks at every record, not only past ones.
      nextPeriodStart: '2026-09-29',
    });
  });

  it('reports nothing knowable when no period has been recorded', async () => {
    loadCycleProfile.mockResolvedValue(profile([]));

    expect(await getCycleDashboard(db, '2026-09-17' as ISODate)).toEqual({
      today: '2026-09-17',
      cycleDay: null,
      phase: null,
      fertilityLevel: null,
      nextPeriodStart: null,
    });
  });

  it('follows the saved cycle length when predicting', async () => {
    loadCycleProfile.mockResolvedValue({
      settings: { averageCycleLengthDays: 35, averagePeriodLengthDays: 7 },
      periodRecords: [{ id: 'a', startDate: '2026-09-01' as ISODate , isOngoing: false }],
    });

    expect(await getCycleDashboard(db, '2026-09-17' as ISODate)).toMatchObject({
      nextPeriodStart: '2026-10-06',
      // Ovulation moves to day 21, so day 17 is still follicular here.
      phase: 'follicular',
    });
  });

  it('crosses a month boundary correctly', async () => {
    loadCycleProfile.mockResolvedValue(profile(['2026-12-20']));

    expect(await getCycleDashboard(db, '2027-01-02' as ISODate)).toMatchObject({
      cycleDay: 14,
      nextPeriodStart: '2027-01-17',
    });
  });

  it('writes nothing', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    await getCycleDashboard(db, '2026-09-17' as ISODate);

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('getCycleDashboard failures', () => {
  it('lets a repository error through', async () => {
    loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    await expect(getCycleDashboard(db, '2026-09-17' as ISODate)).rejects.toThrow('corrupt row');
  });

  it('lets a domain validation error through', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    await expect(getCycleDashboard(db, '2026-02-30' as ISODate)).rejects.toThrow();
  });
});
