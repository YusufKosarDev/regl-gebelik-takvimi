import type { SQLiteDatabase } from 'expo-sqlite';

import { PREGNANCY_WEEKLY_CONTENT } from '../../data/pregnancy-weekly-content';
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

describe('getPregnancyDashboard weekly content', () => {
  it('carries the content written for the week the pregnancy is in', async () => {
    // 2 September is day 1, so 18 September is day 17: week 3.
    const dashboard = await getPregnancyDashboard(db, date('2026-09-18'));

    expect(dashboard?.weeklyContent?.week).toBe(3);
    expect(dashboard?.weeklyContent?.developmentSummary).toMatch(/Döllenme/);
  });

  it('agrees with the week it reports', async () => {
    for (const day of ['2026-09-02', '2026-09-18', '2026-11-01', '2027-04-01']) {
      const dashboard = await getPregnancyDashboard(db, date(day));

      expect(dashboard?.weeklyContent?.week).toBe(dashboard?.pregnancyWeek?.week);
    }
  });

  it('carries no size for a week that has none', async () => {
    const dashboard = await getPregnancyDashboard(db, date(LMP));

    expect(dashboard?.weeklyContent?.week).toBe(1);
    expect(dashboard?.weeklyContent?.size).toBeUndefined();
  });

  it('carries the size for a week that has one', async () => {
    // Day 22 is week 4, the first week with a size.
    const dashboard = await getPregnancyDashboard(db, date('2026-09-23'));

    expect(dashboard?.weeklyContent?.week).toBe(4);
    expect(dashboard?.weeklyContent?.size).toEqual({
      label: 'yaklaşık 2 mm',
      comparison: 'haşhaş tohumu',
    });
  });

  it('lists what is developing', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2026-09-18'));

    expect(dashboard?.weeklyContent?.developingFeatures.length).toBeGreaterThan(0);
  });

  it('keeps the sources on the content it carries', async () => {
    // They are not shown yet, but the dashboard does not strip them out.
    const dashboard = await getPregnancyDashboard(db, date('2026-09-18'));

    expect(dashboard?.weeklyContent?.sources.length).toBeGreaterThan(0);
  });

  it('hands back the entry the data holds rather than a copy', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2026-09-18'));

    expect(dashboard?.weeklyContent).toBe(PREGNANCY_WEEKLY_CONTENT[2]);
  });

  it('reaches the last written week', async () => {
    // Day 274 is week 40 day 1.
    const dashboard = await getPregnancyDashboard(db, date('2027-06-02'));

    expect(dashboard?.pregnancyWeek?.week).toBe(40);
    expect(dashboard?.weeklyContent?.week).toBe(40);
  });
});

describe('getPregnancyDashboard when there is nothing written', () => {
  it('carries no content before the pregnancy began', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2026-09-01'));

    expect(dashboard?.pregnancyWeek).toBeNull();
    expect(dashboard?.weeklyContent).toBeNull();
  });

  it('carries no content past the last written week', async () => {
    // Day 281 is week 41, past where the sources stop.
    const dashboard = await getPregnancyDashboard(db, date('2027-06-09'));

    expect(dashboard?.pregnancyWeek?.week).toBe(41);
    expect(dashboard?.weeklyContent).toBeNull();
  });

  it('does not throw for a pregnancy well past term', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2027-12-31'));

    expect(dashboard?.weeklyContent).toBeNull();
    expect(dashboard?.estimatedDueDate).toBe('2027-06-09');
  });

  it('still reports the day, the week and the due date past term', async () => {
    const dashboard = await getPregnancyDashboard(db, date('2027-06-09'));

    expect(dashboard?.pregnancyDay).toBe(281);
    expect(dashboard?.estimatedDueDate).toBe('2027-06-09');
  });
});
