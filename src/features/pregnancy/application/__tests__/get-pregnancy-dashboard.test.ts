import type { SQLiteDatabase } from 'expo-sqlite';

import type { PregnancyProfile } from '../../domain/types';
import { getPregnancyDashboard } from '../get-pregnancy-dashboard';

import type { ISODate } from '@/types/iso-date';

// Only the database is faked. The progress arithmetic stays real, so the week
// and day are what the domain actually computes.
jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  savePregnancyProfile: jest.fn(),
  loadPregnancyProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const loadPregnancyProfile = repository.loadPregnancyProfile as jest.Mock;

const db = {} as SQLiteDatabase;
const date = (value: string) => value as ISODate;

const LMP = '2026-09-02';

function profile(overrides: Partial<PregnancyProfile> = {}): PregnancyProfile {
  return {
    lastMenstrualPeriodStartDate: date(LMP),
    estimatedDueDate: date('2027-06-09'),
    dueDateSource: 'lmp',
    ...overrides,
  };
}

beforeEach(() => {
  loadPregnancyProfile.mockReset();
  loadPregnancyProfile.mockResolvedValue(profile());
});

describe('getPregnancyDashboard when nothing is tracked', () => {
  it('returns null', async () => {
    loadPregnancyProfile.mockResolvedValue(null);

    await expect(getPregnancyDashboard(db, date('2026-09-18'))).resolves.toBeNull();
  });
});

describe('getPregnancyDashboard', () => {
  it('carries the day it was asked about', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2026-09-18'));

    expect(dashboard?.today).toBe('2026-09-18');
  });

  it('counts the pregnancy day from the last menstrual period', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2026-09-18'));

    // 2 September is day 1, so 18 September is day 17.
    expect(dashboard?.pregnancyDay).toBe(17);
  });

  it('splits that into a week and a day', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2026-09-18'));

    expect(dashboard?.pregnancyWeek).toEqual({ week: 3, day: 3 });
  });

  it('reads the last menstrual period itself as week 1 day 1', async () => {
    const dashboard = await getPregnancyDashboard(db, date(LMP));

    expect(dashboard?.pregnancyDay).toBe(1);
    expect(dashboard?.pregnancyWeek).toEqual({ week: 1, day: 1 });
  });

  it('agrees with itself about the day and the week', async () => {
    for (const day of ['2026-09-08', '2026-09-09', '2026-11-01', '2027-05-01']) {
      const dashboard = await getPregnancyDashboard(db, date(day));
      const week = dashboard?.pregnancyWeek as { week: number; day: number };

      expect((week.week - 1) * 7 + week.day).toBe(dashboard?.pregnancyDay);
    }
  });

  it('carries the stored due date', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2026-09-18'));

    expect(dashboard?.estimatedDueDate).toBe('2027-06-09');
  });

  it('carries a calculated source', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2026-09-18'));

    expect(dashboard?.dueDateSource).toBe('lmp');
  });

  it('carries an adjusted due date and its source', async () => {
    loadPregnancyProfile.mockResolvedValue(
      profile({ estimatedDueDate: date('2027-06-04'), dueDateSource: 'adjusted' })
    );

    const dashboard = await getPregnancyDashboard(db, date('2026-09-18'));

    expect(dashboard?.estimatedDueDate).toBe('2027-06-04');
    expect(dashboard?.dueDateSource).toBe('adjusted');
  });

  it('counts across a leap day', async () => {
    loadPregnancyProfile.mockResolvedValue(
      profile({
        lastMenstrualPeriodStartDate: date('2028-02-27'),
        estimatedDueDate: date('2028-12-03'),
      })
    );

    const dashboard = await getPregnancyDashboard(db, date('2028-03-01'));

    expect(dashboard?.pregnancyDay).toBe(4);
  });

  it('reads through the repository once', async () => {
    await getPregnancyDashboard(db, date('2026-09-18'));

    expect(loadPregnancyProfile).toHaveBeenCalledTimes(1);
    expect(loadPregnancyProfile).toHaveBeenCalledWith(db);
  });
});

describe('getPregnancyDashboard before the pregnancy began', () => {
  it('reports no day', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2026-09-01'));

    expect(dashboard?.pregnancyDay).toBeNull();
  });

  it('reports no week', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2026-09-01'));

    expect(dashboard?.pregnancyWeek).toBeNull();
  });

  it('still reports the due date', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2026-08-01'));

    expect(dashboard?.estimatedDueDate).toBe('2027-06-09');
    expect(dashboard?.dueDateSource).toBe('lmp');
  });

  it('does not throw', async () => {
    await expect(getPregnancyDashboard(db, date('2025-01-01'))).resolves.toBeDefined();
  });
});

describe('getPregnancyDashboard with an unusable date', () => {
  it('refuses a date that does not exist', async () => {
    await expect(getPregnancyDashboard(db, date('2026-02-30'))).rejects.toThrow(
      /invalid targetDate/
    );
  });
});

describe('getPregnancyDashboard purity', () => {
  it('leaves the stored profile alone', async () => {
    const stored = profile();
    const before = JSON.stringify(stored);
    loadPregnancyProfile.mockResolvedValue(stored);

    await getPregnancyDashboard(db, date('2026-09-18'));

    expect(JSON.stringify(stored)).toBe(before);
  });

  it('passes a read failure on', async () => {
    loadPregnancyProfile.mockRejectedValue(new Error('database is locked'));

    await expect(getPregnancyDashboard(db, date('2026-09-18'))).rejects.toThrow(
      /database is locked/
    );
  });
});
