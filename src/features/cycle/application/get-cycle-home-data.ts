import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile } from '../data/cycle-repository';
import type { CycleProfile } from '../domain/types';

import type { CycleDashboard } from './get-cycle-dashboard';
import { buildCycleDashboard } from './get-cycle-dashboard';

import type { ISODate } from '@/types/iso-date';

/**
 * What the home screen needs from storage, in one read.
 *
 * The profile comes back alongside the summary so the screen can lay out any
 * month from it without another query. Calendars for other months are built
 * from this with `buildCycleCalendarGridForMonth`.
 */
export type CycleHomeData = {
  readonly dashboard: CycleDashboard;
  readonly profile: CycleProfile;
};

/** Returns `null` when nothing has been saved yet. */
export async function getCycleHomeData(
  db: SQLiteDatabase,
  today: ISODate
): Promise<CycleHomeData | null> {
  const profile = await loadCycleProfile(db);

  if (profile === null) {
    return null;
  }

  return { dashboard: buildCycleDashboard(profile, today), profile };
}
