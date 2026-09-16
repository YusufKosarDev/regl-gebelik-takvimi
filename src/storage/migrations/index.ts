import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Schema versioning.
 *
 * The version lives in SQLite's own `user_version` pragma rather than a table of
 * our own, so there is nothing to bootstrap: a brand new database reports 0.
 *
 * No schema exists yet, so this runner reads and checks the version but applies
 * nothing and never writes `user_version` back.
 */

export const LATEST_SCHEMA_VERSION = 0;

type UserVersionRow = {
  readonly user_version: number;
};

/**
 * Brings the database schema up to `LATEST_SCHEMA_VERSION`.
 *
 * Refuses to run against a database written by a newer build: silently
 * continuing there risks reading columns that have changed meaning, so it throws
 * instead.
 *
 * Not wired into `openAppDatabase` yet — callers invoke it explicitly.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  const currentVersion = row?.user_version;

  if (typeof currentVersion !== 'number' || !Number.isInteger(currentVersion) || currentVersion < 0) {
    throw new Error(
      `Could not read a schema version from PRAGMA user_version (received ${JSON.stringify(row)}).`
    );
  }

  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than supported version ` +
        `${LATEST_SCHEMA_VERSION}.`
    );
  }

  // At or below the latest version. While LATEST_SCHEMA_VERSION is 0 there is
  // nothing to apply; stepwise migrations and the matching `PRAGMA user_version`
  // write belong here once a real schema exists.
}
