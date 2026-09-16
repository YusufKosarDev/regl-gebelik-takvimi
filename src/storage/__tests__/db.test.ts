import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME, openAppDatabase } from '../db';
import { runMigrations } from '../migrations';

// The native SQLite module cannot load under Jest, so the smallest possible
// stand-in: one mocked entry point.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  deleteDatabaseAsync: jest.fn(),
}));

jest.mock('../migrations', () => ({
  runMigrations: jest.fn(),
}));

const openDatabaseAsync = SQLite.openDatabaseAsync as jest.Mock;
const deleteDatabaseAsync = SQLite.deleteDatabaseAsync as jest.Mock;
const runMigrationsMock = runMigrations as jest.Mock;

let execAsync: jest.Mock;
let fakeDatabase: SQLiteDatabase;

beforeEach(() => {
  execAsync = jest.fn().mockResolvedValue(undefined);
  fakeDatabase = { execAsync } as unknown as SQLiteDatabase;

  openDatabaseAsync.mockReset();
  openDatabaseAsync.mockResolvedValue(fakeDatabase);
  deleteDatabaseAsync.mockReset();
  deleteDatabaseAsync.mockResolvedValue(undefined);
  runMigrationsMock.mockReset();
  runMigrationsMock.mockResolvedValue(undefined);
});

describe('DATABASE_NAME', () => {
  it('is the app database file name', () => {
    expect(DATABASE_NAME).toBe('regl-gebelik.db');
  });
});

describe('openAppDatabase', () => {
  it('opens the database under DATABASE_NAME', async () => {
    await openAppDatabase();

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(openDatabaseAsync).toHaveBeenCalledWith(DATABASE_NAME);
  });

  it('turns foreign key enforcement on', async () => {
    await openAppDatabase();

    expect(execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
  });

  it('puts the journal into WAL mode', async () => {
    await openAppDatabase();

    expect(execAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
  });

  it('applies foreign_keys before WAL', async () => {
    await openAppDatabase();

    expect(execAsync.mock.calls.map(([sql]) => sql)).toEqual([
      'PRAGMA foreign_keys = ON',
      'PRAGMA journal_mode = WAL',
    ]);
  });

  it('runs migrations on the database it opened', async () => {
    await openAppDatabase();

    expect(runMigrationsMock).toHaveBeenCalledTimes(1);
    expect(runMigrationsMock).toHaveBeenCalledWith(fakeDatabase);
  });

  it('runs migrations after both pragmas', async () => {
    await openAppDatabase();

    const lastPragmaOrder = Math.max(...execAsync.mock.invocationCallOrder);
    const migrationOrder = runMigrationsMock.mock.invocationCallOrder[0];

    expect(migrationOrder).toBeGreaterThan(lastPragmaOrder);
  });

  it('returns the opened database once migrations are done', async () => {
    await expect(openAppDatabase()).resolves.toBe(fakeDatabase);
  });

  it('runs no statements of its own beyond the two pragmas', async () => {
    await openAppDatabase();

    const statements: string[] = execAsync.mock.calls.map(([sql]) => String(sql).toUpperCase());

    for (const keyword of ['CREATE TABLE', 'INSERT', 'UPDATE', 'DELETE', 'SELECT', 'DROP']) {
      expect(statements.some((sql) => sql.includes(keyword))).toBe(false);
    }
  });

  it('opens a fresh connection on each call rather than caching one', async () => {
    await openAppDatabase();
    await openAppDatabase();

    expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
    expect(runMigrationsMock).toHaveBeenCalledTimes(2);
  });
});

describe('openAppDatabase when migrations fail', () => {
  const migrationError = new Error('Database schema version 9 is newer than supported version 1.');

  beforeEach(() => {
    runMigrationsMock.mockRejectedValue(migrationError);
  });

  it('rejects with the migration error', async () => {
    await expect(openAppDatabase()).rejects.toThrow(migrationError);
  });

  it('does not swallow the failure and return a database anyway', async () => {
    let resolvedWith: unknown = 'not-resolved';

    try {
      resolvedWith = await openAppDatabase();
    } catch {
      // expected
    }

    expect(resolvedWith).toBe('not-resolved');
  });

  it('never deletes or resets the database', async () => {
    await expect(openAppDatabase()).rejects.toThrow();

    expect(deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('issues no recovery statements', async () => {
    await expect(openAppDatabase()).rejects.toThrow();

    const statements = execAsync.mock.calls.map(([sql]) => String(sql));

    expect(statements).toEqual(['PRAGMA foreign_keys = ON', 'PRAGMA journal_mode = WAL']);
  });

  it('does not retry the migration', async () => {
    await expect(openAppDatabase()).rejects.toThrow();

    expect(runMigrationsMock).toHaveBeenCalledTimes(1);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  });
});
