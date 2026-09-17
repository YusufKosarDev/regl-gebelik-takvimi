import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Schema versioning.
 *
 * The version lives in SQLite's own `user_version` pragma rather than a table of
 * our own, so there is nothing to bootstrap: a brand new database reports 0.
 */

export const LATEST_SCHEMA_VERSION = 2;

type UserVersionRow = {
  readonly user_version: number;
};

/**
 * Schema for version 1: the two tables behind `CycleProfile`.
 *
 * Constraints mirror the domain rules so a corrupt write is rejected by the
 * database as well as by validation. Date *format* is not checked here — that
 * stays in the domain layer, which owns the `YYYY-MM-DD` contract.
 */
const MIGRATION_V1 = `
  CREATE TABLE cycle_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    average_cycle_length_days INTEGER NOT NULL
      CHECK (average_cycle_length_days BETWEEN 15 AND 90),
    average_period_length_days INTEGER NOT NULL
      CHECK (average_period_length_days BETWEEN 1 AND 20),
    CHECK (average_period_length_days <= average_cycle_length_days)
  );

  CREATE TABLE period_records (
    id TEXT PRIMARY KEY NOT NULL,
    start_date TEXT NOT NULL UNIQUE CHECK (length(start_date) > 0),
    end_date TEXT NULL CHECK (end_date IS NULL OR length(end_date) > 0)
  );
`;

/**
 * Creates the version 1 schema.
 *
 * The DDL and the version bump share one transaction, so a failure part-way
 * leaves the database untouched and still reporting its old version rather than
 * a half-built schema that claims to be current.
 */
async function migrateToVersion1(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(MIGRATION_V1);
    await db.execAsync('PRAGMA user_version = 1');
  });
}

/**
 * Schema for version 2: says outright whether a period is still running.
 *
 * A missing `end_date` alone could not tell "still bleeding" from "history, end
 * never recorded", so the column carries that instead of it being guessed.
 *
 * Existing rows default to 0. This is a pre-release app, and reading an old
 * development row as ongoing would be a guess about someone's body rather than a
 * fact, so the safe reading wins.
 */
const MIGRATION_V2 = `
  ALTER TABLE period_records
  ADD COLUMN is_ongoing INTEGER NOT NULL DEFAULT 0 CHECK (is_ongoing IN (0, 1));
`;

/**
 * Adds the ongoing flag.
 *
 * Same bargain as version 1: the column and the version bump share one
 * transaction, so a failure leaves the database still reporting version 1 rather
 * than claiming a column it does not have.
 */
async function migrateToVersion2(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(MIGRATION_V2);
    await db.execAsync('PRAGMA user_version = 2');
  });
}

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

  if (currentVersion === LATEST_SCHEMA_VERSION) {
    return;
  }

  // Each step commits its own version, so an interrupted upgrade resumes from
  // where it stopped rather than replaying a migration that already ran.
  if (currentVersion < 1) {
    await migrateToVersion1(db);
  }

  if (currentVersion < 2) {
    await migrateToVersion2(db);
  }
}
