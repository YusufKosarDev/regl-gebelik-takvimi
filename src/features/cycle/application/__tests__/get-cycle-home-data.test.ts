import type { SQLiteDatabase } from 'expo-sqlite';

import { buildCycleCalendarMonth } from '../build-cycle-calendar-month';
import { buildCycleDashboard } from '../get-cycle-dashboard';
import { getCycleHomeData } from '../get-cycle-home-data';

import { buildCycleCalendarGrid } from '@/features/cycle/presentation/build-cycle-calendar-grid';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

// Only the database read is faked. The dashboard, calendar and grid builders
// stay real, so this pins the wiring rather than a restatement of it.
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

  it('builds no calendar', async () => {
    loadCycleProfile.mockResolvedValue(null);

    const result = await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(result?.calendarGrid).toBeUndefined();
  });
});

describe('getCycleHomeData database reads', () => {
  it('reads the profile exactly once', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(loadCycleProfile).toHaveBeenCalledWith(db);
  });

  it('reads once even though both halves need the profile', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(result?.dashboard).toBeDefined();
    expect(result?.calendarGrid).toBeDefined();
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

describe('getCycleHomeData calendar', () => {
  it('builds the month that today falls in', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(result?.calendarGrid.year).toBe(2026);
    expect(result?.calendarGrid.month).toBe(9);
  });

  it('matches what the calendar builders produce', async () => {
    const subject = profile();
    loadCycleProfile.mockResolvedValue(subject);

    const result = await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(result?.calendarGrid).toEqual(
      buildCycleCalendarGrid(buildCycleCalendarMonth(subject, 2026, 9))
    );
  });

  it('follows today into another month', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, '2026-10-05' as ISODate);

    expect(result?.calendarGrid.year).toBe(2026);
    expect(result?.calendarGrid.month).toBe(10);
  });

  it('handles a leap February', async () => {
    const subject = profile(['2024-02-03']);
    loadCycleProfile.mockResolvedValue(subject);

    const result = await getCycleHomeData(db, '2024-02-17' as ISODate);

    expect(result?.calendarGrid.month).toBe(2);
    expect(result?.calendarGrid.cells.filter((cell) => cell.kind === 'day')).toHaveLength(29);
    expect(result?.calendarGrid).toEqual(
      buildCycleCalendarGrid(buildCycleCalendarMonth(subject, 2024, 2))
    );
  });

  it('handles the first day of a month', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, '2026-09-01' as ISODate);

    expect(result?.calendarGrid.month).toBe(9);
  });

  it('handles the last day of a year', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, '2026-12-31' as ISODate);

    expect(result?.calendarGrid.year).toBe(2026);
    expect(result?.calendarGrid.month).toBe(12);
  });

  it('holds every day of the month in whole rows', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const result = await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(result?.calendarGrid.cells.length ?? 0).toBeGreaterThan(0);
    expect((result?.calendarGrid.cells.length ?? 0) % 7).toBe(0);
  });
});

describe('getCycleHomeData purity and failures', () => {
  it('does not mutate the profile', async () => {
    const subject = profile(['2026-09-20', '2026-09-01']);
    const snapshot = JSON.parse(JSON.stringify(subject));
    loadCycleProfile.mockResolvedValue(subject);

    await getCycleHomeData(db, '2026-09-17' as ISODate);

    expect(subject).toEqual(snapshot);
  });

  it('lets a repository error through', async () => {
    loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    await expect(getCycleHomeData(db, '2026-09-17' as ISODate)).rejects.toThrow('corrupt row');
  });

  it('lets a domain validation error through', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    await expect(getCycleHomeData(db, '2026-02-30' as ISODate)).rejects.toThrow();
  });
});
