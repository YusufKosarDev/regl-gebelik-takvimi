import type { CycleProfile } from '../domain/types';
import type { CycleCalendarGrid } from '../presentation/build-cycle-calendar-grid';
import { buildCycleCalendarGrid } from '../presentation/build-cycle-calendar-grid';

import { buildCycleCalendarMonth } from './build-cycle-calendar-month';

/**
 * One month's laid-out calendar, from a profile the caller already holds.
 *
 * Pure and synchronous, which is what lets the screen move between months
 * without going back to the database for a profile that has not changed.
 */
export function buildCycleCalendarGridForMonth(
  profile: CycleProfile,
  year: number,
  month: number
): CycleCalendarGrid {
  return buildCycleCalendarGrid(buildCycleCalendarMonth(profile, year, month));
}
