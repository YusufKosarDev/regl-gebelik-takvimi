import type { SQLiteDatabase } from 'expo-sqlite';

import { withLocalDataChangeSuppressed } from '@/shared/data-change/local-data-change';

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
  // The symptoms first: they point at a day, and a wipe should not leave rows
  // hanging off a date that no longer exists even for the length of a
  // transaction.
  'daily_entry_symptoms',
  'daily_entries',
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
  // Nothing to announce: there is no data left to send, and the account is
  // deliberately not being touched by a wipe.
  await withLocalDataChangeSuppressed(async () => {
    // A DELETE normally moves pages to the freelist with their contents
    // intact, which would leave every record readable in the file after
    // "delete everything". `secure_delete` makes SQLite zero what it frees.
    // On for the wipe only - everyday deletes do not need its write cost -
    // and back off whatever the transaction does, which is why both pragmas
    // sit outside it.
    await db.execAsync('PRAGMA secure_delete = ON');

    try {
      await db.withTransactionAsync(async () => {
        for (const table of TABLES_TO_CLEAR) {
          await db.execAsync(`DELETE FROM ${table}`);
        }
      });
    } finally {
      await db.execAsync('PRAGMA secure_delete = OFF');
    }
  });
}

/**
 * Empties the write-ahead log the deletes just went through.
 *
 * The transaction's pages land in the `-wal` file first and stay there until
 * a checkpoint, so without this the wipe leaves a copy of the pre-delete
 * pages on disk beside a database that claims to be empty. TRUNCATE both
 * checkpoints and cuts the file to zero bytes.
 *
 * Separate from `clearAllLocalTables` because the two fail differently: rows
 * that would not delete mean nothing was wiped, a log that would not truncate
 * means the wipe happened and one copy lingers - the caller reports the first
 * as `failed` and the second as `partial`.
 */
export async function checkpointWalAfterWipe(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');
}
