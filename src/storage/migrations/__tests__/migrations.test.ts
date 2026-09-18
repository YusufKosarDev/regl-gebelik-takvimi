import type { SQLiteDatabase } from 'expo-sqlite';

import { LATEST_SCHEMA_VERSION, runMigrations } from '../index';

type SpyOptions = {
  /** When false, the transaction callback is never invoked. */
  readonly runTransactionTask?: boolean;
  /** When set, every execAsync call rejects with this error. */
  readonly execError?: Error;
};

type DatabaseSpy = {
  readonly db: SQLiteDatabase;
  readonly getFirstAsync: jest.Mock;
  readonly execAsync: jest.Mock;
  readonly runAsync: jest.Mock;
  readonly getAllAsync: jest.Mock;
  readonly withTransactionAsync: jest.Mock;
};

/** A stand-in database that records every call, so nothing can slip through. */
function createDatabaseSpy(userVersionResult: unknown, options: SpyOptions = {}): DatabaseSpy {
  const { runTransactionTask = true, execError } = options;

  const getFirstAsync = jest.fn().mockResolvedValue(userVersionResult);
  const execAsync = execError
    ? jest.fn().mockRejectedValue(execError)
    : jest.fn().mockResolvedValue(undefined);
  const runAsync = jest.fn().mockResolvedValue(undefined);
  const getAllAsync = jest.fn().mockResolvedValue([]);
  const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
    if (runTransactionTask) {
      await task();
    }
  });

  const db = {
    getFirstAsync,
    execAsync,
    runAsync,
    getAllAsync,
    withTransactionAsync,
  } as unknown as SQLiteDatabase;

  return { db, getFirstAsync, execAsync, runAsync, getAllAsync, withTransactionAsync };
}

/** Collapses whitespace so assertions do not depend on SQL formatting. */
function normalize(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').trim();
}

/** Every statement handed to execAsync, whitespace-normalized. */
function statementsFrom(spy: DatabaseSpy): string[] {
  return spy.execAsync.mock.calls.map(([sql]) => normalize(sql));
}

describe('LATEST_SCHEMA_VERSION', () => {
  it('is 4', () => {
    expect(LATEST_SCHEMA_VERSION).toBe(4);
  });
});

describe('runMigrations when the database is already current', () => {
  it('resolves without error', async () => {
    const spy = createDatabaseSpy({ user_version: 4 });

    await expect(runMigrations(spy.db)).resolves.toBeUndefined();
  });

  it('reads the version with PRAGMA user_version', async () => {
    const spy = createDatabaseSpy({ user_version: 4 });

    await runMigrations(spy.db);

    expect(spy.getFirstAsync).toHaveBeenCalledTimes(1);
    expect(spy.getFirstAsync).toHaveBeenCalledWith('PRAGMA user_version');
  });

  it('runs no statements and opens no transaction', async () => {
    const spy = createDatabaseSpy({ user_version: 4 });

    await runMigrations(spy.db);

    expect(spy.execAsync).not.toHaveBeenCalled();
    expect(spy.runAsync).not.toHaveBeenCalled();
    expect(spy.getAllAsync).not.toHaveBeenCalled();
    expect(spy.withTransactionAsync).not.toHaveBeenCalled();
  });
});

describe('runMigrations when the database is newer than this build', () => {
  it('throws rather than continuing', async () => {
    const spy = createDatabaseSpy({ user_version: 5 });

    await expect(runMigrations(spy.db)).rejects.toThrow(/newer than supported version/);
  });

  it('names both the found and the supported version', async () => {
    const spy = createDatabaseSpy({ user_version: 7 });

    await expect(runMigrations(spy.db)).rejects.toThrow(
      'Database schema version 7 is newer than supported version 4.'
    );
  });

  it('runs no statements before throwing', async () => {
    const spy = createDatabaseSpy({ user_version: 5 });

    await expect(runMigrations(spy.db)).rejects.toThrow();

    expect(spy.execAsync).not.toHaveBeenCalled();
    expect(spy.withTransactionAsync).not.toHaveBeenCalled();
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
    expect(spy.withTransactionAsync).not.toHaveBeenCalled();
  });
});

describe('runMigrations applying version 1 to an empty database', () => {
  it('resolves without error', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await expect(runMigrations(spy.db)).resolves.toBeUndefined();
  });

  it('creates the cycle_settings table', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);

    expect(statementsFrom(spy).join(' ')).toMatch(/CREATE TABLE cycle_settings \(/i);
  });

  it('gives cycle_settings the expected columns', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/id INTEGER PRIMARY KEY/i);
    expect(sql).toMatch(/average_cycle_length_days INTEGER NOT NULL/i);
    expect(sql).toMatch(/average_period_length_days INTEGER NOT NULL/i);
  });

  it('constrains cycle_settings to a single row and to the domain ranges', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/CHECK \(id = 1\)/i);
    expect(sql).toMatch(/CHECK \(average_cycle_length_days BETWEEN 15 AND 90\)/i);
    expect(sql).toMatch(/CHECK \(average_period_length_days BETWEEN 1 AND 20\)/i);
    expect(sql).toMatch(
      /CHECK \(average_period_length_days <= average_cycle_length_days\)/i
    );
  });

  it('creates the period_records table', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);

    expect(statementsFrom(spy).join(' ')).toMatch(/CREATE TABLE period_records \(/i);
  });

  it('gives period_records the expected columns', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/id TEXT PRIMARY KEY NOT NULL/i);
    expect(sql).toMatch(/start_date TEXT NOT NULL/i);
    expect(sql).toMatch(/end_date TEXT NULL/i);
  });

  it('makes start_date unique', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    const hasInlineUnique = /start_date TEXT NOT NULL UNIQUE/i.test(sql);
    const hasUniqueIndex = /CREATE UNIQUE INDEX .* period_records ?\( ?start_date ?\)/i.test(sql);

    expect(hasInlineUnique || hasUniqueIndex).toBe(true);
  });

  it('rejects empty date strings', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/CHECK \(length\(start_date\) > 0\)/i);
    expect(sql).toMatch(/CHECK \(end_date IS NULL OR length\(end_date\) > 0\)/i);
  });

  it('creates no tables beyond the four', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');
    const created = [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gi)].map(
      (match) => match[1]
    );

    expect(created.sort()).toEqual([
      'avatar_config',
      'cycle_settings',
      'period_records',
      'pregnancy_profile',
    ]);
  });

  it('adds none of the columns we deliberately left out', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ').toLowerCase();

    for (const column of [
      'created_at',
      'updated_at',
      'user_id',
      'sync_status',
      'deleted_at',
      'cloud_id',
    ]) {
      expect(sql).not.toContain(column);
    }
  });

  it('writes no feature data', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ').toUpperCase();

    expect(sql).not.toMatch(/\bINSERT\b/);
    expect(sql).not.toMatch(/\bUPDATE\b/);
    expect(sql).not.toMatch(/\bDELETE\b/);
    expect(sql).not.toMatch(/\bSELECT\b/);
    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('gives each version its own transaction', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);

    // One per version, so an interrupted upgrade keeps whichever steps already
    // committed.
    expect(spy.withTransactionAsync).toHaveBeenCalledTimes(4);
  });

  it('issues no statements outside that transaction', async () => {
    // The transaction callback is never invoked, so anything still executed
    // would have to be running outside it.
    const spy = createDatabaseSpy({ user_version: 0 }, { runTransactionTask: false });

    await runMigrations(spy.db);

    expect(spy.withTransactionAsync).toHaveBeenCalledTimes(4);
    expect(spy.execAsync).not.toHaveBeenCalled();
  });

  it('sets user_version to 1 once the schema is in place', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const statements = statementsFrom(spy);

    expect(statements.some((sql) => /PRAGMA user_version = 1/i.test(sql))).toBe(true);
  });

  it('bumps the version only after the schema statements', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const statements = statementsFrom(spy);

    const schemaIndex = statements.findIndex((sql) => /CREATE TABLE/i.test(sql));
    const versionIndex = statements.findIndex((sql) => /PRAGMA user_version = 1/i.test(sql));

    expect(schemaIndex).toBeGreaterThanOrEqual(0);
    expect(versionIndex).toBeGreaterThan(schemaIndex);
  });
});

describe('runMigrations when the version 1 schema fails', () => {
  it('rejects with the underlying error', async () => {
    const spy = createDatabaseSpy(
      { user_version: 0 },
      { execError: new Error('disk I/O error') }
    );

    await expect(runMigrations(spy.db)).rejects.toThrow('disk I/O error');
  });

  it('never bumps user_version to 1', async () => {
    const spy = createDatabaseSpy(
      { user_version: 0 },
      { execError: new Error('disk I/O error') }
    );

    await expect(runMigrations(spy.db)).rejects.toThrow();
    const statements = statementsFrom(spy);

    expect(statements.some((sql) => /PRAGMA user_version = 1/i.test(sql))).toBe(false);
  });
});

describe('runMigrations and the database handle', () => {
  it('does not replace or mutate the handle it is given', async () => {
    const spy = createDatabaseSpy({ user_version: 2 });
    const keysBefore = Object.keys(spy.db as unknown as Record<string, unknown>).sort();
    const getFirstBefore = (spy.db as unknown as Record<string, unknown>).getFirstAsync;

    await runMigrations(spy.db);

    expect(Object.keys(spy.db as unknown as Record<string, unknown>).sort()).toEqual(keysBefore);
    expect((spy.db as unknown as Record<string, unknown>).getFirstAsync).toBe(getFirstBefore);
  });
});

describe('runMigrations applying version 2 to an empty database', () => {
  it('adds the ongoing column', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/ALTER TABLE period_records ADD COLUMN is_ongoing INTEGER/i);
  });

  it('makes the column NOT NULL with a default of 0', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/is_ongoing INTEGER NOT NULL DEFAULT 0/i);
  });

  it('constrains the column to 0 or 1', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/CHECK \(is_ongoing IN \(0, 1\)\)/i);
  });

  it('creates the table before altering it', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const statements = statementsFrom(spy);

    const created = statements.findIndex((sql) => /CREATE TABLE period_records/i.test(sql));
    const altered = statements.findIndex((sql) => /ALTER TABLE period_records/i.test(sql));

    expect(created).toBeGreaterThanOrEqual(0);
    expect(altered).toBeGreaterThan(created);
  });

  it('passes through version 2 on the way to the latest', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const statements = statementsFrom(spy);

    expect(statements).toContain('PRAGMA user_version = 1');
    expect(statements).toContain('PRAGMA user_version = 2');
    expect(statements[statements.length - 1]).toBe('PRAGMA user_version = 4');
  });
});

describe('runMigrations upgrading a version 1 database', () => {
  it('resolves without error', async () => {
    const spy = createDatabaseSpy({ user_version: 1 });

    await expect(runMigrations(spy.db)).resolves.toBeUndefined();
  });

  it('does not create the cycle tables again', async () => {
    const spy = createDatabaseSpy({ user_version: 1 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).not.toMatch(/CREATE TABLE cycle_settings/i);
    expect(sql).not.toMatch(/CREATE TABLE period_records/i);
  });

  it('adds only the ongoing column', async () => {
    const spy = createDatabaseSpy({ user_version: 1 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/ALTER TABLE period_records ADD COLUMN is_ongoing/i);
  });

  it('bumps the version to 2 and not through 1 again', async () => {
    const spy = createDatabaseSpy({ user_version: 1 });

    await runMigrations(spy.db);
    const statements = statementsFrom(spy);

    expect(statements).toContain('PRAGMA user_version = 2');
    expect(statements).not.toContain('PRAGMA user_version = 1');
  });

  it('uses one transaction per remaining version', async () => {
    const spy = createDatabaseSpy({ user_version: 1 });

    await runMigrations(spy.db);

    expect(spy.withTransactionAsync).toHaveBeenCalledTimes(3);
  });
});

describe('runMigrations when the version 2 step fails', () => {
  it('rejects with the underlying error', async () => {
    const spy = createDatabaseSpy({ user_version: 1 }, { execError: new Error('disk is full') });

    await expect(runMigrations(spy.db)).rejects.toThrow('disk is full');
  });

  it('never bumps user_version to 2', async () => {
    const spy = createDatabaseSpy({ user_version: 1 }, { execError: new Error('disk is full') });

    await expect(runMigrations(spy.db)).rejects.toThrow();

    expect(statementsFrom(spy)).not.toContain('PRAGMA user_version = 2');
  });
});

describe('runMigrations applying version 3 to an empty database', () => {
  it('creates the pregnancy table', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/CREATE TABLE pregnancy_profile/i);
  });

  it('pins it to a single row', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/id INTEGER PRIMARY KEY CHECK \(id = 1\)/i);
  });

  it('requires both dates', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/last_menstrual_period_start_date TEXT NOT NULL/i);
    expect(sql).toMatch(/estimated_due_date TEXT NOT NULL/i);
  });

  it('constrains the due date source to the two the domain knows', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(
      /due_date_source TEXT NOT NULL CHECK \(due_date_source IN \('lmp', 'adjusted'\)\)/i
    );
  });

  it('inserts nothing into it', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    // No pregnancy is invented for an existing database; the table starts empty,
    // which reads as "not tracking a pregnancy".
    expect(sql).not.toMatch(/INSERT INTO pregnancy_profile/i);
    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('passes through version 3 on the way to the latest', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const statements = statementsFrom(spy);

    expect(statements).toContain('PRAGMA user_version = 3');
  });

  it('runs the first three versions in order', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const statements = statementsFrom(spy);

    expect(
      statements
        .filter((sql) => sql.startsWith('PRAGMA user_version ='))
        .slice(0, 3)
    ).toEqual([
      'PRAGMA user_version = 1',
      'PRAGMA user_version = 2',
      'PRAGMA user_version = 3',
    ]);
  });
});

describe('runMigrations upgrading a version 2 database', () => {
  it('resolves without error', async () => {
    const spy = createDatabaseSpy({ user_version: 2 });

    await expect(runMigrations(spy.db)).resolves.toBeUndefined();
  });

  it('adds only the pregnancy table', async () => {
    const spy = createDatabaseSpy({ user_version: 2 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/CREATE TABLE pregnancy_profile/i);
    expect(sql).not.toMatch(/CREATE TABLE cycle_settings/i);
    expect(sql).not.toMatch(/CREATE TABLE period_records/i);
  });

  it('leaves the cycle tables alone', async () => {
    const spy = createDatabaseSpy({ user_version: 2 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    // Nothing drops, alters, deletes from or rewrites what is already stored.
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/ALTER TABLE/i);
    expect(sql).not.toMatch(/DELETE FROM/i);
    expect(sql).not.toMatch(/UPDATE (cycle_settings|period_records)/i);
  });

  it('bumps the version to 3 without replaying the earlier steps', async () => {
    const spy = createDatabaseSpy({ user_version: 2 });

    await runMigrations(spy.db);
    const statements = statementsFrom(spy);

    expect(statements).toContain('PRAGMA user_version = 3');
    expect(statements).not.toContain('PRAGMA user_version = 1');
    expect(statements).not.toContain('PRAGMA user_version = 2');
  });

  it('uses one transaction per remaining version', async () => {
    const spy = createDatabaseSpy({ user_version: 2 });

    await runMigrations(spy.db);

    expect(spy.withTransactionAsync).toHaveBeenCalledTimes(2);
  });

  it('issues no statements outside those transactions', async () => {
    const spy = createDatabaseSpy({ user_version: 2 }, { runTransactionTask: false });

    await runMigrations(spy.db);

    expect(spy.withTransactionAsync).toHaveBeenCalledTimes(2);
    expect(spy.execAsync).not.toHaveBeenCalled();
  });
});

describe('runMigrations when the version 3 step fails', () => {
  it('rejects with the underlying error', async () => {
    const spy = createDatabaseSpy({ user_version: 2 }, { execError: new Error('disk is full') });

    await expect(runMigrations(spy.db)).rejects.toThrow('disk is full');
  });

  it('never bumps user_version to 3', async () => {
    const spy = createDatabaseSpy({ user_version: 2 }, { execError: new Error('disk is full') });

    await expect(runMigrations(spy.db)).rejects.toThrow();

    expect(statementsFrom(spy)).not.toContain('PRAGMA user_version = 3');
  });
});

describe('runMigrations applying version 4 to an empty database', () => {
  it('creates the avatar table', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/CREATE TABLE avatar_config/i);
  });

  it('pins it to a single row', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(normalize(sql)).toMatch(
      /CREATE TABLE avatar_config \( id INTEGER PRIMARY KEY CHECK \(id = 1\)/i
    );
  });

  it('requires the four ids an avatar cannot be drawn without', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    for (const column of ['skin_tone_id', 'hair_style_id', 'hair_color_id', 'outfit_id']) {
      expect(sql).toMatch(new RegExp(`${column} TEXT NOT NULL`, 'i'));
    }
  });

  it('refuses a blank required id the way the domain does', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    // trim, so an id of spaces is refused by the database as well as by
    // validation.
    for (const column of ['skin_tone_id', 'hair_style_id', 'hair_color_id', 'outfit_id']) {
      expect(sql).toMatch(new RegExp(`CHECK \\(length\\(trim\\(${column}\\)\\) > 0\\)`, 'i'));
    }
  });

  it('lets the accessory be absent, but not blank', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = normalize(statementsFrom(spy).join(' '));

    expect(sql).toMatch(
      /accessory_id TEXT NULL CHECK \(accessory_id IS NULL OR length\(trim\(accessory_id\)\) > 0\)/i
    );
  });

  it('constrains no id to a catalogue', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    // A CHECK listing the options would need migrating every time one is added,
    // and would lock a saved avatar out the moment one is dropped.
    expect(sql).not.toMatch(/skin_tone_id IN \(/i);
    expect(sql).not.toMatch(/hair_style_id IN \(/i);
    expect(sql).not.toMatch(/hair_color_id IN \(/i);
    expect(sql).not.toMatch(/outfit_id IN \(/i);
    expect(sql).not.toMatch(/accessory_id IN \(/i);
  });

  it('inserts nothing into it', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    // No avatar is invented for anyone: an empty table reads as "no avatar yet".
    expect(sql).not.toMatch(/INSERT INTO avatar_config/i);
    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('ends at version 4', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const statements = statementsFrom(spy);

    expect(statements).toContain('PRAGMA user_version = 4');
    expect(statements[statements.length - 1]).toBe('PRAGMA user_version = 4');
  });

  it('runs the four versions in order', async () => {
    const spy = createDatabaseSpy({ user_version: 0 });

    await runMigrations(spy.db);
    const statements = statementsFrom(spy);

    expect(statements.filter((sql) => sql.startsWith('PRAGMA user_version ='))).toEqual([
      'PRAGMA user_version = 1',
      'PRAGMA user_version = 2',
      'PRAGMA user_version = 3',
      'PRAGMA user_version = 4',
    ]);
  });
});

describe('runMigrations upgrading a version 3 database', () => {
  it('resolves without error', async () => {
    const spy = createDatabaseSpy({ user_version: 3 });

    await expect(runMigrations(spy.db)).resolves.toBeUndefined();
  });

  it('adds only the avatar table', async () => {
    const spy = createDatabaseSpy({ user_version: 3 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/CREATE TABLE avatar_config/i);
    expect(sql).not.toMatch(/CREATE TABLE cycle_settings/i);
    expect(sql).not.toMatch(/CREATE TABLE period_records/i);
    expect(sql).not.toMatch(/CREATE TABLE pregnancy_profile/i);
  });

  it('leaves the cycle and pregnancy tables alone', async () => {
    const spy = createDatabaseSpy({ user_version: 3 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    // Nothing drops, alters, deletes from or rewrites what is already stored.
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/ALTER TABLE/i);
    expect(sql).not.toMatch(/DELETE FROM/i);
    expect(sql).not.toMatch(/UPDATE (cycle_settings|period_records|pregnancy_profile)/i);
  });

  it('bumps the version to 4 without replaying the earlier steps', async () => {
    const spy = createDatabaseSpy({ user_version: 3 });

    await runMigrations(spy.db);
    const statements = statementsFrom(spy);

    expect(statements).toContain('PRAGMA user_version = 4');
    expect(statements).not.toContain('PRAGMA user_version = 1');
    expect(statements).not.toContain('PRAGMA user_version = 2');
    expect(statements).not.toContain('PRAGMA user_version = 3');
  });

  it('uses a single transaction', async () => {
    const spy = createDatabaseSpy({ user_version: 3 });

    await runMigrations(spy.db);

    expect(spy.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('issues no statements outside that transaction', async () => {
    const spy = createDatabaseSpy({ user_version: 3 }, { runTransactionTask: false });

    await runMigrations(spy.db);

    expect(spy.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(spy.execAsync).not.toHaveBeenCalled();
  });
});

describe('runMigrations upgrading a version 2 database to 4', () => {
  it('runs the two remaining steps in order', async () => {
    const spy = createDatabaseSpy({ user_version: 2 });

    await runMigrations(spy.db);
    const statements = statementsFrom(spy);

    expect(statements.filter((sql) => sql.startsWith('PRAGMA user_version ='))).toEqual([
      'PRAGMA user_version = 3',
      'PRAGMA user_version = 4',
    ]);
  });

  it('creates both missing tables', async () => {
    const spy = createDatabaseSpy({ user_version: 2 });

    await runMigrations(spy.db);
    const sql = statementsFrom(spy).join(' ');

    expect(sql).toMatch(/CREATE TABLE pregnancy_profile/i);
    expect(sql).toMatch(/CREATE TABLE avatar_config/i);
  });

  it('uses one transaction per step', async () => {
    const spy = createDatabaseSpy({ user_version: 2 });

    await runMigrations(spy.db);

    expect(spy.withTransactionAsync).toHaveBeenCalledTimes(2);
  });
});

describe('runMigrations when the version 4 step fails', () => {
  it('rejects with the underlying error', async () => {
    const spy = createDatabaseSpy({ user_version: 3 }, { execError: new Error('disk is full') });

    await expect(runMigrations(spy.db)).rejects.toThrow('disk is full');
  });

  it('never bumps user_version to 4', async () => {
    const spy = createDatabaseSpy({ user_version: 3 }, { execError: new Error('disk is full') });

    await expect(runMigrations(spy.db)).rejects.toThrow();

    expect(statementsFrom(spy)).not.toContain('PRAGMA user_version = 4');
  });
});
