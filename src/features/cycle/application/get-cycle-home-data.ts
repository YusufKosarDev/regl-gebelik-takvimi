import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile } from '../data/cycle-repository';
import type { CycleCalendarGrid } from '../presentation/build-cycle-calendar-grid';
import { buildCycleCalendarGrid } from '../presentation/build-cycle-calendar-grid';

import { buildCycleCalendarMonth } from './build-cycle-calendar-month';
import type { CycleDashboard } from './get-cycle-dashboard';
import { buildCycleDashboard } from './get-cycle-dashboard';

import type { ISODate } from '@/types/iso-date';
import { getYearMonth } from '@/utils/date';

/** Everything the home screen shows, from one read of the profile. */
export type CycleHomeData = {
  readonly dashboard: CycleDashboard;
  readonly calendarGrid: CycleCalendarGrid;
};

/**
 * Loads the profile once and derives both the summary and this month's calendar
 * from it.
 *
 * One read rather than two: the summary and the calendar describe the same
 * profile, so fetching it twice would cost a second query and leave room for the
 * two halves of the screen to disagree if a write landed in between.
 *
 * Returns `null` when nothing has been saved yet.
 */
export async function getCycleHomeData(
  db: SQLiteDatabase,
  today: ISODate
): Promise<CycleHomeData | null> {
  const profile = await loadCycleProfile(db);

  if (profile === null) {
    return null;
  }

  const { year, month } = getYearMonth(today);

  return {
    dashboard: buildCycleDashboard(profile, today),
    calendarGrid: buildCycleCalendarGrid(buildCycleCalendarMonth(profile, year, month)),
  };
}
