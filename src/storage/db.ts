import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Local database connection.
 *
 * This module owns one thing: opening the app database with the pragmas we want
 * every connection to have. It defines no tables, runs no migrations and holds
 * no cached instance — schema and data access belong to layers above it.
 */

export const DATABASE_NAME = 'regl-gebelik.db';

/**
 * Opens the app database and applies the connection pragmas.
 *
 * `foreign_keys` is off by default in SQLite and has to be set per connection.
 * `journal_mode = WAL` is persisted with the database file, but setting it here
 * keeps the guarantee in one place rather than depending on when the file was
 * first created.
 */
export async function openAppDatabase(): Promise<SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await database.execAsync('PRAGMA foreign_keys = ON');
  await database.execAsync('PRAGMA journal_mode = WAL');

  return database;
}
