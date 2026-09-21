import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Emptying every table this app keeps health data in.
 *
 * The one place that knows the full list. A wipe assembled from each feature's
 * own `clearX` would be a list maintained in a screen, and the table somebody
 * forgot to add would be the table that quietly survived "delete everything" —
 * which for `sync_state` means a complete copy of a period history left behind
 * in a column nobody thinks of as records.
 *
 * Rows, not the file. The database is opened once per JS runtime and the
 * connection is never closed (see `src/storage/db.ts`); deleting the file would
 * mean closing and reopening it, and opening the same database a second time is
 * the documented way to hit the upstream `expo-sqlite` crash that the single
 * connection exists to avoid. The schema is already current, so emptying the
 * tables leaves exactly what a fresh install has: the right shape, and nothing
 * in it.
 *
 * `user_version` is deliberately left where it is. Resetting it would make the
 * next open replay every migration against tables that already exist.
 */

/**
 * Every table, ordered child-before-parent.
 *
 * Nothing here declares a foreign key today, so the order changes nothing yet.
 * It is written this way so that adding one later cannot turn this into a
 * constraint failure halfway through a delete.
 */
const TABLES_TO_CLEAR = [
  'sync_state',
  'notification_preferences',
  'avatar_config',
  'pregnancy_profile',
  'period_records',
  'cycle_settings',
] as const;

/** The tables a wipe empties, for a test to compare against the schema. */
export const WIPED_TABLES: readonly string[] = TABLES_TO_CLEAR;

/**
 * Empties every table, all at once or not at all.
 *
 * One transaction, because half a wipe is worse than none: a phone holding
 * period records with no cycle settings is a state no screen is written for,
 * and the person asked for everything to go, not for some of it.
 *
 * The statements are built from a fixed list in this module and never from
 * anything a caller passes, so there is no path from input to SQL here.
 */
export async function clearAllLocalTables(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of TABLES_TO_CLEAR) {
      await db.execAsync(`DELETE FROM ${table}`);
    }
  });
}
