import type { SQLiteDatabase } from 'expo-sqlite';

// The native SQLite module cannot load under Jest, so the smallest possible
// stand-in: one mocked entry point.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  deleteDatabaseAsync: jest.fn(),
}));

jest.mock('../migrations', () => ({
  runMigrations: jest.fn(),
}));

type SQLiteModule = {
  openDatabaseAsync: jest.Mock;
  deleteDatabaseAsync: jest.Mock;
};

let openDatabaseAsync: jest.Mock;
let deleteDatabaseAsync: jest.Mock;
let runMigrationsMock: jest.Mock;
let execAsync: jest.Mock;
let fakeDatabase: SQLiteDatabase;
let DATABASE_NAME: string;
let openAppDatabase: () => Promise<SQLiteDatabase>;

beforeEach(() => {
  // The module under test caches one connection for the life of the module, so
  // each test gets its own module registry and therefore its own connection.
  // Clearing the mocks alone would not be enough — the cached connection would
  // survive from the previous test — and the alternative, exporting a reset
  // function, would put a test-only API into production code.
  jest.resetModules();

  const sqlite = require('expo-sqlite') as SQLiteModule;
  const migrations = require('../migrations') as { runMigrations: jest.Mock };

  execAsync = jest.fn().mockResolvedValue(undefined);
  fakeDatabase = { execAsync } as unknown as SQLiteDatabase;

  openDatabaseAsync = sqlite.openDatabaseAsync;
  openDatabaseAsync.mockResolvedValue(fakeDatabase);

  deleteDatabaseAsync = sqlite.deleteDatabaseAsync;
  deleteDatabaseAsync.mockResolvedValue(undefined);

  runMigrationsMock = migrations.runMigrations;
  runMigrationsMock.mockResolvedValue(undefined);

  const db = require('../db') as typeof import('../db');
  DATABASE_NAME = db.DATABASE_NAME;
  openAppDatabase = db.openAppDatabase;
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
});

describe('openAppDatabase called more than once', () => {
  it('hands back the same connection to sequential callers', async () => {
    const first = await openAppDatabase();
    const second = await openAppDatabase();

    expect(first).toBe(second);
  });

  it('opens the native database only once across sequential calls', async () => {
    await openAppDatabase();
    await openAppDatabase();
    await openAppDatabase();

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('does not re-run migrations for later callers', async () => {
    await openAppDatabase();
    await openAppDatabase();
    await openAppDatabase();

    expect(runMigrationsMock).toHaveBeenCalledTimes(1);
  });

  it('does not re-apply the pragmas for later callers', async () => {
    await openAppDatabase();
    await openAppDatabase();

    expect(execAsync.mock.calls.map(([sql]) => sql)).toEqual([
      'PRAGMA foreign_keys = ON',
      'PRAGMA journal_mode = WAL',
    ]);
  });

  it('stays at one native open across a long run of calls', async () => {
    // A realistic session: dozens of reads and writes, each asking for the
    // database, none of them opening a second one.
    for (let call = 0; call < 25; call += 1) {
      await openAppDatabase();
    }

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(runMigrationsMock).toHaveBeenCalledTimes(1);
  });
});

describe('openAppDatabase called concurrently', () => {
  it('opens the native database once for five callers arriving together', async () => {
    await Promise.all([
      openAppDatabase(),
      openAppDatabase(),
      openAppDatabase(),
      openAppDatabase(),
      openAppDatabase(),
    ]);

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('gives all five concurrent callers the same connection', async () => {
    const connections = await Promise.all([
      openAppDatabase(),
      openAppDatabase(),
      openAppDatabase(),
      openAppDatabase(),
      openAppDatabase(),
    ]);

    for (const connection of connections) {
      expect(connection).toBe(connections[0]);
    }
  });

  it('runs migrations once even when callers race the first open', async () => {
    // Without a shared in-flight promise both callers would read the schema
    // version before either had written it, and both would migrate.
    await Promise.all([openAppDatabase(), openAppDatabase(), openAppDatabase()]);

    expect(runMigrationsMock).toHaveBeenCalledTimes(1);
    expect(execAsync.mock.calls.map(([sql]) => sql)).toEqual([
      'PRAGMA foreign_keys = ON',
      'PRAGMA journal_mode = WAL',
    ]);
  });

  it('keeps one connection when a concurrent burst follows an earlier call', async () => {
    const first = await openAppDatabase();

    const rest = await Promise.all([openAppDatabase(), openAppDatabase(), openAppDatabase()]);

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    for (const connection of rest) {
      expect(connection).toBe(first);
    }
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

  it('does not retry the migration on its own', async () => {
    await expect(openAppDatabase()).rejects.toThrow();

    expect(runMigrationsMock).toHaveBeenCalledTimes(1);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('rejects every caller that was waiting on the failed attempt', async () => {
    const attempts = [openAppDatabase(), openAppDatabase(), openAppDatabase()];

    await Promise.all(attempts.map((attempt) => expect(attempt).rejects.toThrow(migrationError)));

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('lets the next caller try again instead of replaying the failure', async () => {
    await expect(openAppDatabase()).rejects.toThrow(migrationError);

    runMigrationsMock.mockResolvedValue(undefined);

    await expect(openAppDatabase()).resolves.toBe(fakeDatabase);
  });

  it('starts the retry from scratch, pragmas included', async () => {
    await expect(openAppDatabase()).rejects.toThrow(migrationError);

    runMigrationsMock.mockResolvedValue(undefined);
    await openAppDatabase();

    expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
    expect(runMigrationsMock).toHaveBeenCalledTimes(2);
    expect(execAsync.mock.calls.map(([sql]) => sql)).toEqual([
      'PRAGMA foreign_keys = ON',
      'PRAGMA journal_mode = WAL',
      'PRAGMA foreign_keys = ON',
      'PRAGMA journal_mode = WAL',
    ]);
  });

  it('caches the connection once a retry finally succeeds', async () => {
    await expect(openAppDatabase()).rejects.toThrow(migrationError);

    runMigrationsMock.mockResolvedValue(undefined);
    const first = await openAppDatabase();
    const second = await openAppDatabase();

    expect(second).toBe(first);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
  });
});

describe('openAppDatabase when the native open fails', () => {
  const openError = new Error('Call to function NativeDatabase.open has been rejected.');

  beforeEach(() => {
    openDatabaseAsync.mockRejectedValue(openError);
  });

  it('rejects with the native error', async () => {
    await expect(openAppDatabase()).rejects.toThrow(openError);
  });

  it('never reaches the pragmas or the migrations', async () => {
    await expect(openAppDatabase()).rejects.toThrow();

    expect(execAsync).not.toHaveBeenCalled();
    expect(runMigrationsMock).not.toHaveBeenCalled();
  });

  it('is not permanent — a later call opens the database normally', async () => {
    await expect(openAppDatabase()).rejects.toThrow(openError);

    openDatabaseAsync.mockResolvedValue(fakeDatabase);

    await expect(openAppDatabase()).resolves.toBe(fakeDatabase);
    expect(runMigrationsMock).toHaveBeenCalledTimes(1);
  });
});
