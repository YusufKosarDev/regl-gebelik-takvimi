import type { SQLiteDatabase } from 'expo-sqlite';

import { clearPregnancyProfile } from '../data/pregnancy-repository';

import { getPregnancyProfile } from './get-pregnancy-profile';

import { withLocalDbWriteLock } from '@/storage/local-db-write-lock';

/**
 * Stops tracking the pregnancy and removes what was stored about it.
 *
 * Refuses when there is nothing tracked. Deleting nothing would look like it
 * worked, and a screen that offered to stop something that was not running has
 * gone wrong somewhere worth hearing about.
 *
 * Only the pregnancy goes. The cycle settings and the recorded periods are a
 * different record of a different thing, and ending a pregnancy is not a reason
 * to lose them.
 */
export function stopPregnancyTracking(db: SQLiteDatabase): Promise<void> {
  // One local database write at a time, and the read belongs inside it: the
  // check below and the delete that depends on it have to see the same stored
  // state. See `storage/local-db-write-lock.ts`.
  return withLocalDbWriteLock(() => runStopPregnancyTracking(db));
}

async function runStopPregnancyTracking(db: SQLiteDatabase): Promise<void> {
  const profile = await getPregnancyProfile(db);

  if (profile === null) {
    throw new Error('stopPregnancyTracking found no tracked pregnancy to stop.');
  }

  await clearPregnancyProfile(db);
}
