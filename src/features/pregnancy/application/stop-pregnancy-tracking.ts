import type { SQLiteDatabase } from 'expo-sqlite';

import { clearPregnancyProfile } from '../data/pregnancy-repository';

import { getPregnancyProfile } from './get-pregnancy-profile';

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
export async function stopPregnancyTracking(db: SQLiteDatabase): Promise<void> {
  const profile = await getPregnancyProfile(db);

  if (profile === null) {
    throw new Error('stopPregnancyTracking found no tracked pregnancy to stop.');
  }

  await clearPregnancyProfile(db);
}
