import type { SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from '@/storage/migrations';

import { WIPED_TABLES, clearAllLocalTables } from '../local-data-repository';

type DatabaseSpy = {
  readonly db: SQLiteDatabase;
  readonly execAsync: jest.Mock;
  readonly withTransactionAsync: jest.Mock;
};

function createDatabaseSpy(execError?: Error): DatabaseSpy {
  const execAsync = execError
    ? jest.fn().mockRejectedValue(execError)
    : jest.fn().mockResolvedValue(undefined);

  const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
    await task();
  });

  const db = { execAsync, withTransactionAsync } as unknown as SQLiteDatabase;

  return { db, execAsync, withTransactionAsync };
}

describe('the list of tables a wipe empties', () => {
  it('names every table the schema creates', () => {
    // The wipe is only as complete as this list. A migration that adds a table
    // without adding it here would leave that table behind on "delete
    // everything" — which for `sync_state` means a whole period history.
    expect([...WIPED_TABLES].sort()).toEqual([
      'avatar_config',
      'cycle_settings',
      'daily_entries',
      'daily_entry_symptoms',
      'notification_preferences',
      'period_records',
      'pregnancy_profile',
      'sync_state',
    ]);
  });

  it('names every table the migrations actually create', async () => {
    // This used to count tables against schema versions, which held only
    // while every migration happened to add exactly one. Version 7 adds two,
    // so the count is now read off the migrations themselves: whatever any
    // migration creates has to be in the wipe list, and a table added
    // without one fails here rather than surviving "delete everything".
    const created: string[] = [];
    const db = {
      getFirstAsync: async () => ({ user_version: 0 }),
      execAsync: async (sql: string) => {
        for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gi)) {
          created.push(match[1]);
        }
      },
      withTransactionAsync: async (task: () => Promise<void>) => {
        await task();
      },
    } as unknown as SQLiteDatabase;

    await runMigrations(db);

    expect(created.sort()).toEqual([...WIPED_TABLES].sort());
  });

  it('lists no table twice', () => {
    expect(new Set(WIPED_TABLES).size).toBe(WIPED_TABLES.length);
  });

  it('names sync_state, the one table holding a copy rather than a source', () => {
    expect(WIPED_TABLES).toContain('sync_state');
  });
});

describe('clearing every local table', () => {
  it('empties all six', async () => {
    const { db, execAsync } = createDatabaseSpy();

    await clearAllLocalTables(db);

    const statements = execAsync.mock.calls.map((call) => call[0] as string);

    for (const table of WIPED_TABLES) {
      expect(statements).toContain(`DELETE FROM ${table}`);
    }
  });

  it('issues exactly one statement per table and nothing else', async () => {
    const { db, execAsync } = createDatabaseSpy();

    await clearAllLocalTables(db);

    expect(execAsync).toHaveBeenCalledTimes(WIPED_TABLES.length);
  });

  it('does all of it inside one transaction', async () => {
    // Half a wipe is worse than none: records with no settings is a state no
    // screen is written for, and the person asked for all of it to go.
    const { db, withTransactionAsync } = createDatabaseSpy();

    await clearAllLocalTables(db);

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('runs every delete inside that transaction rather than around it', async () => {
    const order: string[] = [];
    const execAsync = jest.fn(async () => {
      order.push('delete');
    });
    const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
      order.push('begin');
      await task();
      order.push('commit');
    });

    const db = { execAsync, withTransactionAsync } as unknown as SQLiteDatabase;

    await clearAllLocalTables(db);

    expect(order[0]).toBe('begin');
    expect(order[order.length - 1]).toBe('commit');
    expect(order.filter((step) => step === 'delete')).toHaveLength(WIPED_TABLES.length);
  });

  it('raises when a delete is refused, so the caller can report nothing was lost', async () => {
    const failure = new Error('database is locked');
    const { db } = createDatabaseSpy(failure);

    await expect(clearAllLocalTables(db)).rejects.toThrow(failure);
  });

  it('leaves the schema version alone', async () => {
    // Resetting it would make the next open replay every migration against
    // tables that already exist.
    const { db, execAsync } = createDatabaseSpy();

    await clearAllLocalTables(db);

    const statements = execAsync.mock.calls.map((call) => call[0] as string).join(' ');

    expect(statements).not.toContain('user_version');
  });

  it('never drops a table or the database itself', async () => {
    // Deleting the file would mean closing and reopening the one connection,
    // which is the documented way to hit the upstream expo-sqlite crash.
    const { db, execAsync } = createDatabaseSpy();

    await clearAllLocalTables(db);

    const statements = execAsync.mock.calls.map((call) => call[0] as string).join(' ');

    expect(statements).not.toMatch(/DROP/i);
  });

  it('can be run twice, which is what makes a failed wipe safe to retry', async () => {
    const { db, execAsync } = createDatabaseSpy();

    await clearAllLocalTables(db);
    await clearAllLocalTables(db);

    expect(execAsync).toHaveBeenCalledTimes(WIPED_TABLES.length * 2);
  });
});
