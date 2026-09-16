import type { SQLiteDatabase } from 'expo-sqlite';

import { LATEST_SCHEMA_VERSION, runMigrations } from '../index';

type DatabaseSpy = {
  readonly db: SQLiteDatabase;
  readonly getFirstAsync: jest.Mock;
  readonly execAsync: jest.Mock;
  readonly runAsync: jest.Mock;
  readonly getAllAsync: jest.Mock;
  readonly withTransactionAsync: jest.Mock;
};

/** A stand-in database that records every call, so nothing can slip through. */
function createDatabaseSpy(userVersionResult: unknown): DatabaseSpy {
  const getFirstAsync = jest.fn().mockResolvedValue(userVersionResult);
  const execAsync = jest.fn().mockResolvedValue(undefined);
  const runAsync = jest.fn().mockResolvedValue(undefined);
  const getAllAsync = jest.fn().mockResolvedValue([]);
  const withTransactionAsync = jest.fn().mockResolvedValue(undefined);

  const db = {
    getFirstAsync,
    execAsync,
    runAsync,
    getAllAsync,
    withTransactionAsync,
  } as unknown as SQLiteDatabase;

  return { db, getFirstAsync, execAsync, runAsync, getAllAsync, withTransactionAsync };
}

describe('LATEST_SCHEMA_VERSION', () => {
  it('is 0 while no real schema exists', () => {
    expect(LATEST_SCHEMA_VERSION).toBe(0);
  });
});

describe('runMigrations when the database is already current', () => {
  it('resolves without error', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await expect(runMigrations(spy.db)).resolves.toBeUndefined();
  });

  it('reads the version with PRAGMA user_version', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);

    expect(spy.getFirstAsync).toHaveBeenCalledTimes(1);
    expect(spy.getFirstAsync).toHaveBeenCalledWith('PRAGMA user_version');
  });

  it('runs no migration statements', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);

    expect(spy.execAsync).not.toHaveBeenCalled();
    expect(spy.runAsync).not.toHaveBeenCalled();
    expect(spy.getAllAsync).not.toHaveBeenCalled();
    expect(spy.withTransactionAsync).not.toHaveBeenCalled();
  });

  it('never writes user_version back', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);

    const allStatements = [...spy.execAsync.mock.calls, ...spy.runAsync.mock.calls].map(
      ([sql]) => String(sql)
    );

    expect(allStatements).toEqual([]);
  });
});

describe('runMigrations when the database is newer than this build', () => {
  it('throws rather than continuing', async () => {
    const spy = createDatabaseSpy({ user_version: 3 });

    await expect(runMigrations(spy.db)).rejects.toThrow(/newer than supported version/);
  });

  it('names both the found and the supported version', async () => {
    const spy = createDatabaseSpy({ user_version: 7 });

    await expect(runMigrations(spy.db)).rejects.toThrow(
      'Database schema version 7 is newer than supported version 0.'
    );
  });

  it('runs no statements before throwing', async () => {
    const spy = createDatabaseSpy({ user_version: 3 });

    await expect(runMigrations(spy.db)).rejects.toThrow();

    expect(spy.execAsync).not.toHaveBeenCalled();
    expect(spy.runAsync).not.toHaveBeenCalled();
  });
});

describe('runMigrations when the version cannot be read', () => {
  it.each<[string, unknown]>([
    ['a null row', null],
    ['an undefined row', undefined],
    ['a row without the column', {}],
    ['a non-numeric value', { user_version: 'zero' }],
    ['a fractional value', { user_version: 1.5 }],
    ['a negative value', { user_version: -1 }],
    ['NaN', { user_version: Number.NaN }],
  ])('throws on %s', async (_label, result) => {
    const spy = createDatabaseSpy(result);

    await expect(runMigrations(spy.db)).rejects.toThrow(
      /Could not read a schema version from PRAGMA user_version/
    );
  });

  it('runs no statements before throwing', async () => {
    const spy = createDatabaseSpy(null);

    await expect(runMigrations(spy.db)).rejects.toThrow();

    expect(spy.execAsync).not.toHaveBeenCalled();
    expect(spy.runAsync).not.toHaveBeenCalled();
  });
});

describe('runMigrations and the database handle', () => {
  it('does not replace or mutate the handle it is given', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });
    const keysBefore = Object.keys(spy.db as unknown as Record<string, unknown>).sort();
    const getFirstBefore = (spy.db as unknown as Record<string, unknown>).getFirstAsync;

    await runMigrations(spy.db);

    expect(Object.keys(spy.db as unknown as Record<string, unknown>).sort()).toEqual(keysBefore);
    expect((spy.db as unknown as Record<string, unknown>).getFirstAsync).toBe(getFirstBefore);
  });
});
