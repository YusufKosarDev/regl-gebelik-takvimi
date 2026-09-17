import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrations';

/**
 * Local database connection.
 *
 * This module owns three things: opening the app database with the pragmas we
 * want, bringing its schema up to date, and handing every caller the same
 * connection for the lifetime of the JS runtime. It defines no tables of its own
 * — data access belongs to layers above it.
 */

export const DATABASE_NAME = 'regl-gebelik.db';

/**
 * The one connection, kept as the in-flight promise rather than the resolved
 * database, so callers that arrive while it is still opening wait for that same
 * attempt instead of starting another one.
 *
 * Cleared on failure, so a first attempt that fails does not poison every later
 * one: the next caller gets a fresh try rather than the old rejection.
 */
let connection: Promise<SQLiteDatabase> | null = null;

/**
 * Opens the database, applies the connection pragmas and migrates the schema.
 *
 * `foreign_keys` is off by default in SQLite and has to be set per connection.
 * `journal_mode = WAL` is persisted with the database file, but setting it here
 * keeps the guarantee in one place rather than depending on when the file was
 * first created. Both run before migrations so the schema is created under the
 * same guarantees every later connection gets.
 *
 * A failing migration rejects. It is deliberately not caught, retried or
 * recovered from by wiping the database: health data is not something to discard
 * because a schema step failed, and the caller has to decide what to do.
 */
async function openAndInitialize(): Promise<SQLiteDatabase> {
  // `useNewConnection` is left at its default of false on purpose: expo-sqlite
  // already caches a native connection per database name, and asking for a new
  // one would add connections rather than reuse the single one we want.
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await database.execAsync('PRAGMA foreign_keys = ON');
  await database.execAsync('PRAGMA journal_mode = WAL');

  await runMigrations(database);

  return database;
}

/**
 * The app database, opened once per JS runtime.
 *
 * Every caller gets the same connection. Opening per call used to mean a new
 * wrapper, both pragmas and a full migration check on every read and write —
 * dozens of them in a normal session — and two callers arriving together could
 * race each other through the migration.
 *
 * The connection is never closed here. It lives as long as the runtime does, so
 * navigating between screens or finishing a write leaves it open for the next
 * caller.
 */
export function openAppDatabase(): Promise<SQLiteDatabase> {
  if (connection === null) {
    connection = openAndInitialize().catch((error: unknown) => {
      connection = null;
      throw error;
    });
  }

  return connection;
}
