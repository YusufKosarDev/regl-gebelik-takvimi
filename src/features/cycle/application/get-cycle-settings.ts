import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile } from '../data/cycle-repository';
import type { CycleSettings } from '../domain/types';

/**
 * The stored cycle settings on their own.
 *
 * A screen that only edits the two averages has no business holding the period
 * records as well: reading less means there is less it could accidentally write
 * back.
 *
 * Returns `null` when nothing has been saved yet, which is the same answer the
 * other reads give and means "onboarding has not finished", not "an error".
 */
export async function getCycleSettings(db: SQLiteDatabase): Promise<CycleSettings | null> {
  const profile = await loadCycleProfile(db);

  return profile === null ? null : profile.settings;
}
