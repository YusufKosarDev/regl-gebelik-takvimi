import type { SQLiteDatabase } from 'expo-sqlite';

import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { serializeCloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import type { ISODate } from '@/types/iso-date';

import type { SyncState } from '../../domain/sync-state';
import {
  clearAllSyncState,
  clearSyncState,
  loadSyncState,
  saveSyncState,
} from '../sync-state-repository';

type DatabaseSpy = {
  readonly db: SQLiteDatabase;
  readonly runAsync: jest.Mock;
  readonly getFirstAsync: jest.Mock;
  readonly getAllAsync: jest.Mock;
  readonly execAsync: jest.Mock;
  readonly withTransactionAsync: jest.Mock;
};

function createDatabaseSpy(row: unknown = null, runError?: Error): DatabaseSpy {
  const runAsync = runError
    ? jest.fn().mockRejectedValue(runError)
    : jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
  const getFirstAsync = jest.fn().mockResolvedValue(row);
  const getAllAsync = jest.fn().mockResolvedValue([]);
  const execAsync = jest.fn().mockResolvedValue(undefined);
  const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
    await task();
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

/**
 * A stand-in for the table itself.
 *
 * Keyed by uid, driven by the repository's own calls, so what it demonstrates
 * is the repository's behaviour — which account it touches, what an upsert
 * replaces, what a delete leaves alone. The SQL that makes SQLite behave the
 * same way is asserted separately.
 */
function createFakeTable(): DatabaseSpy {
  const rows = new Map<string, Record<string, unknown>>();

  const runAsync = jest.fn(async (sql: string, ...params: unknown[]) => {
    if (sql.includes('INSERT INTO sync_state')) {
      const [uid, revision, contentHash, basePayload, updatedAt] = params;

      rows.set(String(uid), {
        uid,
        revision,
        content_hash: contentHash,
        base_payload: basePayload,
        updated_at: updatedAt,
      });

      return { changes: 1, lastInsertRowId: 1 };
    }

    if (sql.includes('DELETE FROM sync_state')) {
      const [uid] = params;
      const existed = rows.delete(String(uid));

      return { changes: existed ? 1 : 0, lastInsertRowId: 0 };
    }

    throw new Error(`the fake table was asked something it does not know: ${sql}`);
  });

  const getFirstAsync = jest.fn(async (_sql: string, ...params: unknown[]) => {
    const [uid] = params;

    return rows.get(String(uid)) ?? null;
  });

  const db = {
    runAsync,
    getFirstAsync,
    getAllAsync: jest.fn().mockResolvedValue([]),
    execAsync: jest.fn().mockResolvedValue(undefined),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
      await task();
    }),
  } as unknown as SQLiteDatabase;

  return {
    db,
    runAsync,
    getFirstAsync,
    getAllAsync: jest.fn(),
    execAsync: jest.fn(),
    withTransactionAsync: jest.fn(),
  };
}

/** Collapses whitespace so assertions do not depend on SQL formatting. */
function normalize(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').trim();
}

const date = (value: string) => value as ISODate;

const UID_A = 'firebase-uid-a';
const UID_B = 'firebase-uid-b';

function payload(overrides: Partial<CloudSyncPayloadV1> = {}): CloudSyncPayloadV1 {
  return {
    version: 1,
    cycleSettings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [
      {
        id: 'period-2026-09-02',
        startDate: date('2026-09-02'),
        endDate: date('2026-09-07'),
        isOngoing: false,
      },
      { id: 'period-2026-10-02', startDate: date('2026-10-02'), isOngoing: true },
    ],
    pregnancyProfile: {
      lastMenstrualPeriodStartDate: date('2026-09-02'),
      estimatedDueDate: date('2027-06-09'),
      dueDateSource: 'lmp',
    },
    avatarConfig: {
      skinToneId: 'skin-tone-3',
      hairStyleId: 'wavy',
      hairColorId: 'dark-brown',
      outfitId: 'shirt',
      accessoryId: 'earrings',
    },
    notificationPreferences: {
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    },
    dailyEntries: [],
    ...overrides,
  };
}

function state(overrides: Partial<SyncState> = {}): SyncState {
  return {
    uid: UID_A,
    revision: 7,
    contentHash: 'aaaaaaaabbbbbbbb',
    basePayload: payload(),
    updatedAt: '2026-09-20T06:00:00.000Z',
    ...overrides,
  };
}

/** A stored row, as SQLite would hand it back. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    uid: UID_A,
    revision: 7,
    content_hash: 'aaaaaaaabbbbbbbb',
    base_payload: serializeCloudSyncPayloadV1(payload()),
    updated_at: '2026-09-20T06:00:00.000Z',
    ...overrides,
  };
}

describe('saveSyncState', () => {
  it('writes one statement', async () => {
    const spy = createDatabaseSpy();

    await saveSyncState(spy.db, state());

    expect(spy.runAsync).toHaveBeenCalledTimes(1);
  });

  it('upserts on the account, so a second sync replaces the first', async () => {
    const spy = createDatabaseSpy();

    await saveSyncState(spy.db, state());

    expect(normalize(spy.runAsync.mock.calls[0][0])).toContain('ON CONFLICT(uid) DO UPDATE SET');
  });

  it('binds every column as a parameter', async () => {
    const spy = createDatabaseSpy();

    await saveSyncState(spy.db, state());

    expect(spy.runAsync.mock.calls[0].slice(1)).toEqual([
      UID_A,
      7,
      'aaaaaaaabbbbbbbb',
      serializeCloudSyncPayloadV1(payload()),
      '2026-09-20T06:00:00.000Z',
    ]);
  });

  it('interpolates nothing into the statement', async () => {
    const spy = createDatabaseSpy();

    await saveSyncState(spy.db, state());
    const sql = normalize(spy.runAsync.mock.calls[0][0]);

    expect(sql).not.toContain(UID_A);
    expect(sql).not.toMatch(/2026-|period-|skin-tone/);
  });

  it('opens no transaction of its own', async () => {
    const spy = createDatabaseSpy();

    await saveSyncState(spy.db, state());

    expect(spy.withTransactionAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['a blank uid', { uid: '   ' }],
    ['a uid that is not text', { uid: 7 as unknown as string }],
    ['a blank hash', { contentHash: '' }],
    ['a blank timestamp', { updatedAt: '' }],
    ['a fractional revision', { revision: 1.5 }],
    ['a negative revision', { revision: -1 }],
    ['a revision that is not a number', { revision: '7' as unknown as number }],
  ])('refuses %s before writing anything', async (_label, overrides) => {
    const spy = createDatabaseSpy();

    await expect(saveSyncState(spy.db, state(overrides))).rejects.toThrow();

    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('refuses a base payload the app itself would refuse', async () => {
    const spy = createDatabaseSpy();

    await expect(
      saveSyncState(spy.db, state({ basePayload: payload({ version: 2 as 1 }) }))
    ).rejects.toThrow(/expects version 1/);

    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('refuses a base payload with a corrupt record', async () => {
    const spy = createDatabaseSpy();

    await expect(
      saveSyncState(
        spy.db,
        state({
          basePayload: payload({
            periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }],
          }),
        })
      )
    ).rejects.toThrow(/invalid startDate/);
  });

  it('names no value when it refuses', async () => {
    const spy = createDatabaseSpy();

    const error = await saveSyncState(
      spy.db,
      state({
        basePayload: payload({
          periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }],
        }),
      })
    ).then(
      () => {
        throw new Error('expected a rejection');
      },
      (thrown: unknown) => thrown as Error
    );

    expect(error.message).not.toMatch(/\d{4}-\d{2}-\d{2}|firebase-uid/);
  });
});

describe('loadSyncState', () => {
  it('says nothing is stored for an account it has not synced', async () => {
    const spy = createDatabaseSpy(null);

    await expect(loadSyncState(spy.db, UID_A)).resolves.toBeNull();
  });

  it('asks for the account it was given', async () => {
    const spy = createDatabaseSpy(row());

    await loadSyncState(spy.db, UID_A);

    expect(normalize(spy.getFirstAsync.mock.calls[0][0])).toContain('WHERE uid = ?');
    expect(spy.getFirstAsync.mock.calls[0][1]).toBe(UID_A);
  });

  it('gives back this app’s own sync state', async () => {
    const spy = createDatabaseSpy(row());

    await expect(loadSyncState(spy.db, UID_A)).resolves.toEqual(state());
  });

  it('hands out a parsed payload rather than the stored text', async () => {
    const spy = createDatabaseSpy(row());

    const loaded = await loadSyncState(spy.db, UID_A);

    expect(typeof loaded?.basePayload).toBe('object');
    expect(loaded?.basePayload).toEqual(payload());
  });

  it.each([
    ['a uid that is not text', { uid: 7 }],
    ['a hash that is not text', { content_hash: 7 }],
    ['a timestamp that is not text', { updated_at: 7 }],
    ['a revision that is not a number', { revision: '7' }],
    ['a fractional revision', { revision: 1.5 }],
  ])('refuses a row with %s', async (_label, overrides) => {
    const spy = createDatabaseSpy(row(overrides));

    await expect(loadSyncState(spy.db, UID_A)).rejects.toThrow();
  });

  it('refuses a row whose payload is not JSON', async () => {
    const spy = createDatabaseSpy(row({ base_payload: 'not json at all' }));

    await expect(loadSyncState(spy.db, UID_A)).rejects.toThrow(
      'parseCloudSyncPayloadV1 could not read the payload as JSON.'
    );
  });

  it('refuses a row whose payload is JSON but not a payload', async () => {
    const spy = createDatabaseSpy(row({ base_payload: '{"version":2}' }));

    await expect(loadSyncState(spy.db, UID_A)).rejects.toThrow(/expects version 1/);
  });

  it('refuses a row whose payload holds a corrupt record', async () => {
    const corrupt = JSON.parse(serializeCloudSyncPayloadV1(payload())) as {
      periodRecords: unknown[];
    };
    corrupt.periodRecords = [{ id: 'a', startDate: '2026-02-30', isOngoing: false }];

    const spy = createDatabaseSpy(row({ base_payload: JSON.stringify(corrupt) }));

    await expect(loadSyncState(spy.db, UID_A)).rejects.toThrow(/invalid startDate/);
  });

  it('refuses a row that belongs to another account', async () => {
    const spy = createDatabaseSpy(row({ uid: UID_B }));

    await expect(loadSyncState(spy.db, UID_A)).rejects.toThrow(
      'Stored sync state belongs to a different account than the one asked for.'
    );
  });

  it('names no stored value when it refuses', async () => {
    const spy = createDatabaseSpy(row({ base_payload: '{"version":2}' }));

    const error = await loadSyncState(spy.db, UID_A).then(
      () => {
        throw new Error('expected a rejection');
      },
      (thrown: unknown) => thrown as Error
    );

    expect(error.message).not.toMatch(/\d{4}-\d{2}-\d{2}|skin-tone|period-/);
  });
});

describe('clearSyncState', () => {
  it('deletes by account', async () => {
    const spy = createDatabaseSpy();

    await clearSyncState(spy.db, UID_A);

    expect(normalize(spy.runAsync.mock.calls[0][0])).toBe(
      'DELETE FROM sync_state WHERE uid = ?'
    );
    expect(spy.runAsync.mock.calls[0][1]).toBe(UID_A);
  });

  it('is not an error when there is nothing to delete', async () => {
    const spy = createDatabaseSpy();
    spy.runAsync.mockResolvedValue({ changes: 0, lastInsertRowId: 0 });

    await expect(clearSyncState(spy.db, UID_A)).resolves.toBeUndefined();
  });

  it('touches nothing else', async () => {
    const spy = createDatabaseSpy();

    await clearSyncState(spy.db, UID_A);

    expect(spy.runAsync).toHaveBeenCalledTimes(1);
    expect(spy.execAsync).not.toHaveBeenCalled();
  });
});

describe('two accounts on one phone', () => {
  it('keeps a state for each', async () => {
    const table = createFakeTable();

    await saveSyncState(table.db, state({ uid: UID_A, revision: 5 }));
    await saveSyncState(
      table.db,
      state({ uid: UID_B, revision: 2, basePayload: payload({ pregnancyProfile: null }) })
    );

    await expect(loadSyncState(table.db, UID_A)).resolves.toMatchObject({
      uid: UID_A,
      revision: 5,
    });
    await expect(loadSyncState(table.db, UID_B)).resolves.toMatchObject({
      uid: UID_B,
      revision: 2,
    });
  });

  it('never answers with the other account’s base', async () => {
    const table = createFakeTable();

    await saveSyncState(table.db, state({ uid: UID_A }));
    await saveSyncState(
      table.db,
      state({ uid: UID_B, basePayload: payload({ cycleSettings: null, periodRecords: [] }) })
    );

    const a = await loadSyncState(table.db, UID_A);
    const b = await loadSyncState(table.db, UID_B);

    expect(a?.basePayload).toEqual(payload());
    expect(b?.basePayload.periodRecords).toEqual([]);
  });

  it('says nothing for an account that has never synced on this phone', async () => {
    const table = createFakeTable();

    await saveSyncState(table.db, state({ uid: UID_A }));

    await expect(loadSyncState(table.db, 'firebase-uid-c')).resolves.toBeNull();
  });

  it('replaces only the account that was written again', async () => {
    const table = createFakeTable();

    await saveSyncState(table.db, state({ uid: UID_A, revision: 5 }));
    await saveSyncState(table.db, state({ uid: UID_B, revision: 2 }));
    await saveSyncState(table.db, state({ uid: UID_A, revision: 6, contentHash: 'ccccccccdddddddd' }));

    await expect(loadSyncState(table.db, UID_A)).resolves.toMatchObject({
      revision: 6,
      contentHash: 'ccccccccdddddddd',
    });
    await expect(loadSyncState(table.db, UID_B)).resolves.toMatchObject({ revision: 2 });
  });

  it('deletes only the account it was asked to', async () => {
    const table = createFakeTable();

    await saveSyncState(table.db, state({ uid: UID_A }));
    await saveSyncState(table.db, state({ uid: UID_B }));

    await clearSyncState(table.db, UID_A);

    await expect(loadSyncState(table.db, UID_A)).resolves.toBeNull();
    await expect(loadSyncState(table.db, UID_B)).resolves.not.toBeNull();
  });

  it('takes the account from the caller rather than from anywhere else', async () => {
    const table = createFakeTable();

    await saveSyncState(table.db, state({ uid: UID_A }));

    // Nothing in this module knows who is signed in; the uid is the argument.
    expect(table.runAsync.mock.calls[0][1]).toBe(UID_A);
  });
});

describe('a base payload survives the round trip', () => {
  async function roundTrip(original: CloudSyncPayloadV1): Promise<CloudSyncPayloadV1> {
    const table = createFakeTable();

    await saveSyncState(table.db, state({ basePayload: original }));
    const loaded = await loadSyncState(table.db, UID_A);

    return loaded!.basePayload;
  }

  it('comes back equal to what went in', async () => {
    await expect(roundTrip(payload())).resolves.toEqual(payload());
  });

  it('comes back equal for a payload with nothing in it', async () => {
    const empty = payload({
      cycleSettings: null,
      periodRecords: [],
      pregnancyProfile: null,
      avatarConfig: null,
    });

    await expect(roundTrip(empty)).resolves.toEqual(empty);
  });

  it('keeps a record that has no end date absent rather than null', async () => {
    const restored = await roundTrip(payload());
    const ongoing = restored.periodRecords.find((record) => record.isOngoing);

    expect(ongoing).toBeDefined();
    expect('endDate' in (ongoing as object)).toBe(false);
  });

  it('keeps a long history in order', async () => {
    const history = Array.from({ length: 24 }, (_unused, index) => {
      const month = String((index % 12) + 1).padStart(2, '0');
      const year = 2025 + Math.floor(index / 12);

      return {
        id: `period-${year}-${month}-02`,
        startDate: date(`${year}-${month}-02`),
        endDate: date(`${year}-${month}-07`),
        isOngoing: false,
      };
    });

    const restored = await roundTrip(payload({ periodRecords: history }));

    expect(restored.periodRecords).toEqual(history);
  });

  it('keeps an avatar accessory, and an avatar without one', async () => {
    const withAccessory = await roundTrip(payload());
    const withoutAccessory = await roundTrip(
      payload({
        avatarConfig: {
          skinToneId: 'skin-tone-3',
          hairStyleId: 'wavy',
          hairColorId: 'dark-brown',
          outfitId: 'shirt',
        },
      })
    );

    expect(withAccessory.avatarConfig?.accessoryId).toBe('earrings');
    expect(withoutAccessory.avatarConfig).not.toHaveProperty('accessoryId');
  });
});

describe('what the sync state repository never does', () => {
  it('writes nothing while reading', async () => {
    const spy = createDatabaseSpy(row());

    await loadSyncState(spy.db, UID_A);

    expect(spy.runAsync).not.toHaveBeenCalled();
    expect(spy.execAsync).not.toHaveBeenCalled();
  });

  it('reads nothing while writing', async () => {
    const spy = createDatabaseSpy();

    await saveSyncState(spy.db, state());

    expect(spy.getFirstAsync).not.toHaveBeenCalled();
    expect(spy.getAllAsync).not.toHaveBeenCalled();
  });

  it('touches no other table', async () => {
    const table = createFakeTable();

    await saveSyncState(table.db, state());
    await loadSyncState(table.db, UID_A);
    await clearSyncState(table.db, UID_A);

    const sql = table.runAsync.mock.calls.map(([statement]) => String(statement)).join(' ');

    expect(sql).not.toMatch(/cycle_settings|period_records|pregnancy_profile|avatar_config/);
    expect(sql).not.toMatch(/notification_preferences/);
  });

  it('changes nothing about the state it was given', async () => {
    const spy = createDatabaseSpy();
    const original = state();
    const copy = JSON.parse(JSON.stringify(original)) as SyncState;

    await saveSyncState(spy.db, original);

    expect(original).toEqual(copy);
  });
});

describe('clearing every account’s sync state', () => {
  it('deletes the whole table rather than one row', async () => {
    const { db, runAsync } = createDatabaseSpy();

    await clearAllSyncState(db);

    expect(runAsync).toHaveBeenCalledWith('DELETE FROM sync_state');
  });

  it('binds no uid, so a second account’s row cannot survive it', async () => {
    // This is the row that would otherwise be left behind by "delete
    // everything", carrying a full copy of somebody's period history.
    const { db, runAsync } = createDatabaseSpy();

    await clearAllSyncState(db);

    const [, parameters] = runAsync.mock.calls[0] as [string, unknown];

    expect(parameters).toBeUndefined();
  });

  it('issues exactly one statement', async () => {
    const { db, runAsync } = createDatabaseSpy();

    await clearAllSyncState(db);

    expect(runAsync).toHaveBeenCalledTimes(1);
  });

  it('raises when the database refuses', async () => {
    const failure = new Error('database is locked');
    const { db } = createDatabaseSpy(null, failure);

    await expect(clearAllSyncState(db)).rejects.toThrow(failure);
  });

  it('can be run twice', async () => {
    const { db, runAsync } = createDatabaseSpy();

    await clearAllSyncState(db);
    await clearAllSyncState(db);

    expect(runAsync).toHaveBeenCalledTimes(2);
  });
});
