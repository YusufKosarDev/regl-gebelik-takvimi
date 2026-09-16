import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrations';

/**
 * Local database connection.
 *
 * This module owns two things: opening the app database with the pragmas we want
 * every connection to have, and bringing its schema up to date. It defines no
 * tables of its own and holds no cached instance — data access belongs to layers
 * above it.
 */

export const DATABASE_NAME = 'regl-gebelik.db';

/**
 * Opens the app database, applies the connection pragmas and migrates the schema.
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
export async function openAppDatabase(): Promise<SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await database.execAsync('PRAGMA foreign_keys = ON');
  await database.execAsync('PRAGMA journal_mode = WAL');

  await runMigrations(database);

  return database;
}
