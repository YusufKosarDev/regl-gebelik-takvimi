import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME, openAppDatabase } from '../db';

// The native SQLite module cannot load under Jest, so the smallest possible
// stand-in: one mocked entry point.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

const openDatabaseAsync = SQLite.openDatabaseAsync as jest.Mock;

let execAsync: jest.Mock;
let fakeDatabase: SQLiteDatabase;

beforeEach(() => {
  execAsync = jest.fn().mockResolvedValue(undefined);
  fakeDatabase = { execAsync } as unknown as SQLiteDatabase;

  openDatabaseAsync.mockReset();
  openDatabaseAsync.mockResolvedValue(fakeDatabase);
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

  it('returns the opened database instance', async () => {
    await expect(openAppDatabase()).resolves.toBe(fakeDatabase);
  });

  it('runs nothing but the two pragmas', async () => {
    await openAppDatabase();

    const statements = execAsync.mock.calls.map(([sql]) => sql);

    expect(statements).toEqual(['PRAGMA foreign_keys = ON', 'PRAGMA journal_mode = WAL']);
  });

  it('does not create tables or touch data', async () => {
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
  });
});
