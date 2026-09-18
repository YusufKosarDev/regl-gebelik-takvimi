import type { SQLiteDatabase } from 'expo-sqlite';

import { loadPregnancyProfile } from '../data/pregnancy-repository';
import type { PregnancyProfile } from '../domain/types';

/**
 * The pregnancy being tracked, or `null` when none is.
 *
 * A thin wrapper over the repository so screens ask the application layer rather
 * than reaching for SQL themselves. `null` is an ordinary answer — most of the
 * time nobody is pregnant — and not an error.
 */
export async function getPregnancyProfile(
  db: SQLiteDatabase
): Promise<PregnancyProfile | null> {
  return loadPregnancyProfile(db);
}
