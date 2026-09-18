import type { SQLiteDatabase } from 'expo-sqlite';

import type { CycleProfile, PeriodRecord } from '../../domain/types';
import { validateCycleProfile } from '../../domain/validation';
import { loadCycleProfile, saveCycleProfile } from '../cycle-repository';

import type { ISODate } from '@/types/iso-date';
import { toISODate } from '@/utils/date';

type SpyOptions = {
  readonly settingsRow?: unknown;
  readonly periodRows?: unknown[];
  readonly runTransactionTask?: boolean;
  readonly runError?: Error;
};

type DatabaseSpy = {
  readonly db: SQLiteDatabase;
  readonly runAsync: jest.Mock;
  readonly getFirstAsync: jest.Mock;
  readonly getAllAsync: jest.Mock;
  readonly execAsync: jest.Mock;
  readonly withTransactionAsync: jest.Mock;
};

function createDatabaseSpy(options: SpyOptions = {}): DatabaseSpy {
  const {
    settingsRow = null,
    periodRows = [],
    runTransactionTask = true,
    runError,
  } = options;

  const runAsync = runError
    ? jest.fn().mockRejectedValue(runError)
    : jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 });
  const getFirstAsync = jest.fn().mockResolvedValue(settingsRow);
  const getAllAsync = jest.fn().mockResolvedValue(periodRows);
  const execAsync = jest.fn().mockResolvedValue(undefined);
  const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
    if (runTransactionTask) {
      await task();
    }
  });

  const db = {
    runAsync,
    getFirstAsync,
    getAllAsync,
    execAsync,
    withTransactionAsync,
  } as unknown as SQLiteDatabase;

  return { db, runAsync, getFirstAsync, getAllAsync, execAsync, withTransactionAsync };
}

function normalize(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').trim();
}

/** [normalizedSql, ...boundParams] for every runAsync call. */
function runCalls(spy: DatabaseSpy): { sql: string; params: unknown[] }[] {
  return spy.runAsync.mock.calls.map(([sql, ...params]) => ({
    sql: normalize(sql),
    params,
  }));
}

function record(id: string, startDate: string, endDate?: string): PeriodRecord {
  return endDate === undefined
    ? { id, startDate: toISODate(startDate), isOngoing: false }
    : { id, startDate: toISODate(startDate), endDate: toISODate(endDate), isOngoing: false };
}

function profile(periodRecords: readonly PeriodRecord[] = []): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords,
  };
}

describe('saveCycleProfile', () => {
  it('rejects an invalid profile before touching the database', async () => {
    const spy = createDatabaseSpy();
    const invalid: CycleProfile = {
      settings: { averageCycleLengthDays: 14, averagePeriodLengthDays: 5 },
      periodRecords: [],
    };

    await expect(saveCycleProfile(spy.db, invalid)).rejects.toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(spy.withTransactionAsync).not.toHaveBeenCalled();
    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('rejects a profile with duplicate start dates', async () => {
    const spy = createDatabaseSpy();
    const invalid = profile([record('a', '2026-01-01'), record('b', '2026-01-01')]);

    await expect(saveCycleProfile(spy.db, invalid)).rejects.toThrow(
      /Duplicate PeriodRecord startDate/
    );
    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('writes inside a single transaction', async () => {
    const spy = createDatabaseSpy();

    await saveCycleProfile(spy.db, profile());

    expect(spy.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('issues no statements outside the transaction', async () => {
    const spy = createDatabaseSpy({ runTransactionTask: false });

    await saveCycleProfile(spy.db, profile([record('a', '2026-01-01')]));

    expect(spy.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('upserts the settings row under id 1', async () => {
    const spy = createDatabaseSpy();

    await saveCycleProfile(spy.db, profile());
    const [settingsCall] = runCalls(spy);

    expect(settingsCall.sql).toMatch(/INSERT INTO cycle_settings/i);
    expect(settingsCall.sql).toMatch(/ON CONFLICT\(id\) DO UPDATE/i);
    expect(settingsCall.params[0]).toBe(1);
  });

  it('binds the cycle and period lengths as parameters', async () => {
    const spy = createDatabaseSpy();

    await saveCycleProfile(spy.db, profile());
    const [settingsCall] = runCalls(spy);

    expect(settingsCall.params).toEqual([1, 28, 5]);
  });

  it('clears the existing period records before inserting', async () => {
    const spy = createDatabaseSpy();

    await saveCycleProfile(spy.db, profile([record('a', '2026-01-01')]));
    const calls = runCalls(spy);

    const deleteIndex = calls.findIndex((call) => /DELETE FROM period_records/i.test(call.sql));
    const insertIndex = calls.findIndex((call) => /INSERT INTO period_records/i.test(call.sql));

    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect(insertIndex).toBeGreaterThan(deleteIndex);
  });

  it('re-inserts every record', async () => {
    const spy = createDatabaseSpy();
    const records = [
      record('a', '2026-01-01', '2026-01-05'),
      record('b', '2026-01-29'),
      record('c', '2026-02-26', '2026-03-01'),
    ];

    await saveCycleProfile(spy.db, profile(records));
    const inserts = runCalls(spy).filter((call) =>
      /INSERT INTO period_records/i.test(call.sql)
    );

    expect(inserts).toHaveLength(3);
    expect(inserts.map((call) => call.params)).toEqual([
      ['a', '2026-01-01', '2026-01-05', 0],
      ['b', '2026-01-29', null, 0],
      ['c', '2026-02-26', '2026-03-01', 0],
    ]);
  });

  it('writes NULL when endDate is undefined', async () => {
    const spy = createDatabaseSpy();

    await saveCycleProfile(spy.db, profile([record('a', '2026-01-01')]));
    const [insert] = runCalls(spy).filter((call) =>
      /INSERT INTO period_records/i.test(call.sql)
    );

    expect(insert.params[2]).toBeNull();
  });

  it('writes the value when endDate is present', async () => {
    const spy = createDatabaseSpy();

    await saveCycleProfile(spy.db, profile([record('a', '2026-01-01', '2026-01-06')]));
    const [insert] = runCalls(spy).filter((call) =>
      /INSERT INTO period_records/i.test(call.sql)
    );

    expect(insert.params[2]).toBe('2026-01-06');
  });

  it('never interpolates domain values into the SQL text', async () => {
    const spy = createDatabaseSpy();
    const records = [record('a-unique-id', '2026-01-01', '2026-01-06')];

    await saveCycleProfile(spy.db, profile(records));
    const sqlText = runCalls(spy)
      .map((call) => call.sql)
      .join(' ');

    for (const value of ['a-unique-id', '2026-01-01', '2026-01-06', '28', '5']) {
      expect(sqlText).not.toContain(value);
    }
  });

  it('rejects when a statement fails', async () => {
    const spy = createDatabaseSpy({ runError: new Error('constraint failed') });

    await expect(saveCycleProfile(spy.db, profile())).rejects.toThrow('constraint failed');
  });

  it('does not mutate the profile it is given', async () => {
    const spy = createDatabaseSpy();
    const records = [record('b', '2026-01-29'), record('a', '2026-01-01')];
    const input = profile(records);
    const snapshot = JSON.parse(JSON.stringify(input));

    await saveCycleProfile(spy.db, input);

    expect(JSON.parse(JSON.stringify(input))).toEqual(snapshot);
    expect(records.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(input.periodRecords).toBe(records);
  });
});

describe('loadCycleProfile', () => {
  const settingsRow = { average_cycle_length_days: 28, average_period_length_days: 5 };

  it('returns null when no settings row exists', async () => {
    const spy = createDatabaseSpy({ settingsRow: null });

    await expect(loadCycleProfile(spy.db)).resolves.toBeNull();
  });

  it('reads the settings row by id with a bound parameter', async () => {
    const spy = createDatabaseSpy({ settingsRow: null });

    await loadCycleProfile(spy.db);
    const [sql, ...params] = spy.getFirstAsync.mock.calls[0];

    expect(normalize(sql)).toMatch(/FROM cycle_settings WHERE id = \?/i);
    expect(params).toEqual([1]);
  });

  it('returns a valid profile when there are no period records', async () => {
    const spy = createDatabaseSpy({ settingsRow, periodRows: [] });

    const result = await loadCycleProfile(spy.db);

    expect(result).toEqual({
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [],
    });
  });

  it('maps a single period record', async () => {
    const spy = createDatabaseSpy({
      settingsRow,
      periodRows: [{ id: 'a', start_date: '2026-01-01', end_date: '2026-01-05', is_ongoing: 0 }],
    });

    const result = await loadCycleProfile(spy.db);

    expect(result?.periodRecords).toEqual([
      { id: 'a', startDate: '2026-01-01', endDate: '2026-01-05' , isOngoing: false },
    ]);
  });

  it('maps several period records', async () => {
    const spy = createDatabaseSpy({
      settingsRow,
      periodRows: [
        { id: 'a', start_date: '2026-01-01', end_date: '2026-01-05', is_ongoing: 0 },
        { id: 'b', start_date: '2026-01-29', end_date: null, is_ongoing: 0 },
        { id: 'c', start_date: '2026-02-26', end_date: '2026-03-01', is_ongoing: 0 },
      ],
    });

    const result = await loadCycleProfile(spy.db);

    expect(result?.periodRecords).toHaveLength(3);
    expect(result?.periodRecords.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('turns a NULL end_date into an undefined endDate', async () => {
    const spy = createDatabaseSpy({
      settingsRow,
      periodRows: [{ id: 'a', start_date: '2026-01-01', end_date: null, is_ongoing: 0 }],
    });

    const result = await loadCycleProfile(spy.db);

    expect(result?.periodRecords[0].endDate).toBeUndefined();
  });

  it('orders the rows by start date', async () => {
    const spy = createDatabaseSpy({ settingsRow, periodRows: [] });

    await loadCycleProfile(spy.db);

    expect(normalize(spy.getAllAsync.mock.calls[0][0])).toMatch(/ORDER BY start_date ASC/i);
  });

  it('returns a profile that passes validateCycleProfile', async () => {
    const spy = createDatabaseSpy({
      settingsRow,
      periodRows: [
        { id: 'a', start_date: '2026-01-01', end_date: '2026-01-05', is_ongoing: 0 },
        { id: 'b', start_date: '2026-01-29', end_date: null, is_ongoing: 0 },
      ],
    });

    const result = await loadCycleProfile(spy.db);

    expect(result).not.toBeNull();
    expect(() => validateCycleProfile(result as CycleProfile)).not.toThrow();
  });

  it('raises on a stored start_date that is not a real calendar date', async () => {
    const spy = createDatabaseSpy({
      settingsRow,
      periodRows: [{ id: 'a', start_date: '2026-02-30', end_date: null, is_ongoing: 0 }],
    });

    await expect(loadCycleProfile(spy.db)).rejects.toThrow(/Invalid ISO date/);
  });

  it('raises on a stored end_date that is not a real calendar date', async () => {
    const spy = createDatabaseSpy({
      settingsRow,
      periodRows: [{ id: 'a', start_date: '2026-01-01', end_date: '2026-13-01', is_ongoing: 0 }],
    });

    await expect(loadCycleProfile(spy.db)).rejects.toThrow(/Invalid ISO date/);
  });

  it('raises on stored settings outside the allowed range', async () => {
    const spy = createDatabaseSpy({
      settingsRow: { average_cycle_length_days: 400, average_period_length_days: 5 },
      periodRows: [],
    });

    await expect(loadCycleProfile(spy.db)).rejects.toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
  });

  it('raises on duplicate stored start dates', async () => {
    const spy = createDatabaseSpy({
      settingsRow,
      periodRows: [
        { id: 'a', start_date: '2026-01-01', end_date: null, is_ongoing: 0 },
        { id: 'b', start_date: '2026-01-01', end_date: null, is_ongoing: 0 },
      ],
    });

    await expect(loadCycleProfile(spy.db)).rejects.toThrow(/Duplicate PeriodRecord startDate/);
  });

  it('raises on duplicate stored ids', async () => {
    const spy = createDatabaseSpy({
      settingsRow,
      periodRows: [
        { id: 'a', start_date: '2026-01-01', end_date: null, is_ongoing: 0 },
        { id: 'a', start_date: '2026-01-29', end_date: null, is_ongoing: 0 },
      ],
    });

    await expect(loadCycleProfile(spy.db)).rejects.toThrow(/Duplicate PeriodRecord id/);
  });

  it('does not repair corrupt data silently', async () => {
    const spy = createDatabaseSpy({
      settingsRow,
      periodRows: [{ id: '', start_date: '2026-01-01', end_date: null, is_ongoing: 0 }],
    });

    await expect(loadCycleProfile(spy.db)).rejects.toThrow(/non-empty string/);
  });
});

describe('save and load round trip', () => {
  it('reads back what was written', async () => {
    const records = [
      record('a', '2026-01-01', '2026-01-05'),
      record('b', '2026-01-29'),
    ];
    const original = profile(records);

    const writeSpy = createDatabaseSpy();
    await saveCycleProfile(writeSpy.db, original);

    const periodRows = runCalls(writeSpy)
      .filter((call) => /INSERT INTO period_records/i.test(call.sql))
      .map((call) => ({
        id: call.params[0] as string,
        start_date: call.params[1] as string,
        end_date: call.params[2] as string | null,
        is_ongoing: call.params[3] as number,
      }));

    const settingsCall = runCalls(writeSpy)[0];
    const readSpy = createDatabaseSpy({
      settingsRow: {
        average_cycle_length_days: settingsCall.params[1],
        average_period_length_days: settingsCall.params[2],
      },
      periodRows,
    });

    const reloaded = await loadCycleProfile(readSpy.db);

    expect(periodRows).toHaveLength(2);
    expect(reloaded).toEqual({
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [
        { id: 'a', startDate: '2026-01-01' as ISODate, endDate: '2026-01-05' as ISODate , isOngoing: false },
        { id: 'b', startDate: '2026-01-29' as ISODate , isOngoing: false },
      ],
    });
  });
});

describe('saveCycleProfile and the ongoing flag', () => {
  it('writes 1 for an ongoing period', async () => {
    const spy = createDatabaseSpy();
    const ongoing: PeriodRecord = {
      id: 'a',
      startDate: toISODate('2026-09-17'),
      isOngoing: true,
    };

    await saveCycleProfile(spy.db, profile([ongoing]));
    const insert = runCalls(spy).find((call) => /INSERT INTO period_records/i.test(call.sql));

    expect(insert?.params[3]).toBe(1);
  });

  it('writes 0 for a finished period', async () => {
    const spy = createDatabaseSpy();

    await saveCycleProfile(spy.db, profile([record('a', '2026-09-17', '2026-09-22')]));
    const insert = runCalls(spy).find((call) => /INSERT INTO period_records/i.test(call.sql));

    expect(insert?.params[3]).toBe(0);
  });

  it('writes 0 for a finished period with no recorded end', async () => {
    const spy = createDatabaseSpy();

    await saveCycleProfile(spy.db, profile([record('a', '2026-09-17')]));
    const insert = runCalls(spy).find((call) => /INSERT INTO period_records/i.test(call.sql));

    expect(insert?.params[2]).toBeNull();
    expect(insert?.params[3]).toBe(0);
  });

  it('binds the flag rather than interpolating it', async () => {
    const spy = createDatabaseSpy();

    await saveCycleProfile(spy.db, profile([record('a', '2026-09-17')]));
    const insert = runCalls(spy).find((call) => /INSERT INTO period_records/i.test(call.sql));

    expect(insert?.sql).toMatch(/VALUES \(\?, \?, \?, \?\)/);
    expect(insert?.sql).not.toMatch(/is_ongoing\s*=/);
  });
});

describe('loadCycleProfile and the ongoing flag', () => {
  it('reads 0 as finished', async () => {
    const spy = createDatabaseSpy({
      settingsRow: { average_cycle_length_days: 28, average_period_length_days: 5 },
      periodRows: [{ id: 'a', start_date: '2026-09-17', end_date: null, is_ongoing: 0 }],
    });

    const loaded = await loadCycleProfile(spy.db);

    expect(loaded?.periodRecords[0].isOngoing).toBe(false);
  });

  it('reads 1 as ongoing', async () => {
    const spy = createDatabaseSpy({
      settingsRow: { average_cycle_length_days: 28, average_period_length_days: 5 },
      periodRows: [{ id: 'a', start_date: '2026-09-17', end_date: null, is_ongoing: 1 }],
    });

    const loaded = await loadCycleProfile(spy.db);

    expect(loaded?.periodRecords[0].isOngoing).toBe(true);
  });

  it.each<[string, unknown]>([
    ['2', 2],
    ['-1', -1],
    ['null', null],
    ['a string', '1'],
    ['a missing column', undefined],
    ['a boolean', true],
  ])('raises on %s', async (_label, value) => {
    const spy = createDatabaseSpy({
      settingsRow: { average_cycle_length_days: 28, average_period_length_days: 5 },
      periodRows: [{ id: 'a', start_date: '2026-09-17', end_date: null, is_ongoing: value }],
    });

    await expect(loadCycleProfile(spy.db)).rejects.toThrow(/invalid is_ongoing value/);
  });

  it('says what the column held without naming the record or the value', async () => {
    const spy = createDatabaseSpy({
      settingsRow: { average_cycle_length_days: 28, average_period_length_days: 5 },
      periodRows: [{ id: 'broken', start_date: '2026-09-17', end_date: null, is_ongoing: 9 }],
    });

    await expect(loadCycleProfile(spy.db)).rejects.toThrow(
      'A stored period record has an invalid is_ongoing value: a number. Expected 0 or 1.'
    );
  });

  it('refuses two ongoing records', async () => {
    const spy = createDatabaseSpy({
      settingsRow: { average_cycle_length_days: 28, average_period_length_days: 5 },
      periodRows: [
        { id: 'a', start_date: '2026-09-02', end_date: null, is_ongoing: 1 },
        { id: 'b', start_date: '2026-09-17', end_date: null, is_ongoing: 1 },
      ],
    });

    await expect(loadCycleProfile(spy.db)).rejects.toThrow(/2 ongoing period records/);
  });
});

describe('what a cycle repository error gives away', () => {
  const settingsRow = { average_cycle_length_days: 28, average_period_length_days: 5 };

  async function messageFrom(periodRows: unknown[]): Promise<string> {
    const spy = createDatabaseSpy({ settingsRow, periodRows });
    const error = await loadCycleProfile(spy.db).then(
      () => {
        throw new Error('expected a rejection');
      },
      (thrown: unknown) => thrown as Error
    );

    return error.message;
  }

  it.each([
    [
      'a corrupt ongoing flag',
      [{ id: 'period-2026-09-17', start_date: '2026-09-17', end_date: null, is_ongoing: 9 }],
    ],
    [
      'a start date that is not a date',
      [{ id: 'period-2026-09-17', start_date: '2026-02-30', end_date: null, is_ongoing: 0 }],
    ],
    [
      'an end date before the start',
      [
        {
          id: 'period-2026-09-17',
          start_date: '2026-09-17',
          end_date: '2026-09-10',
          is_ongoing: 0,
        },
      ],
    ],
    [
      'two records on the same day',
      [
        { id: 'a', start_date: '2026-09-17', end_date: null, is_ongoing: 0 },
        { id: 'b', start_date: '2026-09-17', end_date: null, is_ongoing: 0 },
      ],
    ],
  ])('names neither the date nor the record id for %s', async (_label, periodRows) => {
    const message = await messageFrom(periodRows);

    expect(message).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(message).not.toMatch(/period-2026|onboarding-initial-period/);
  });

  it('still says which column was wrong and what kind of thing was in it', async () => {
    const message = await messageFrom([
      { id: 'period-2026-09-17', start_date: '2026-09-17', end_date: null, is_ongoing: 9 },
    ]);

    expect(message).toBe(
      'A stored period record has an invalid is_ongoing value: a number. Expected 0 or 1.'
    );
  });

  it('still binds the real values, which belong in the database', async () => {
    const spy = createDatabaseSpy({ settingsRow, periodRows: [] });

    await saveCycleProfile(spy.db, {
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [
        {
          id: 'period-2026-09-17',
          startDate: '2026-09-17' as ISODate,
          isOngoing: true,
        },
      ],
    });

    expect(spy.runAsync.mock.calls.flat()).toContain('2026-09-17');
  });
});
