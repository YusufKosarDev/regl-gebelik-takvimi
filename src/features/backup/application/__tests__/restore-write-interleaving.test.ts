import type { SQLiteDatabase } from 'expo-sqlite';

import { recordDay } from '@/features/daily-log/application/record-day';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { resetLocalDataChangeListenersForTests } from '@/shared/data-change/local-data-change';
import { resetLocalDbWriteLockForTests } from '@/storage/local-db-write-lock';
import type { ISODate } from '@/types/iso-date';

import { restoreCloudBackup } from '../restore-cloud-backup';

/**
 * A restore and another write, on the one connection this app has.
 *
 * ## Why this file exists beside `restore-cloud-backup.test.ts`
 *
 * That file fakes the repositories, which is right for what it asks: the order
 * of the writes, which field does what, and that the whole thing is one
 * transaction. It cannot ask this question, and neither can the
 * `createDatabaseSpy()` fakes the repository tests use, because both stand in
 * for `withTransactionAsync` with something like
 *
 *     jest.fn(async (task) => { order.push('begin'); await task(); … })
 *
 * which has no transaction state. A nested `BEGIN` cannot fail against it and a
 * `ROLLBACK` cannot destroy anything, so a test written on it passes before the
 * lock exists and after, and proves nothing either way.
 *
 * So the connection here models the three things that actually produced the
 * bug: whether a transaction is open, where a statement lands while one is, and
 * expo-sqlite's own `withTransactionAsync` body — copied from the installed
 * source rather than approximated, because the bug *is* that body meeting
 * itself.
 *
 * The repositories and the use cases are real. Faking any of them would hide
 * the statement placement that is the whole subject.
 *
 * ## What it is not
 *
 * Not a SQLite test. `pending` and `committed` are a model of two things —
 * "written but revocable" and "written and kept" — not of a database. It is
 * accurate about the one behaviour under test and silent about everything else,
 * which is why the statements are compared as a list of SQL rather than queried
 * back.
 */

/** Taken verbatim from `node_modules/expo-sqlite/build/SQLiteDatabase.js`. */
type TransactionTask = () => Promise<void>;

type FakeConnection = {
  readonly db: SQLiteDatabase;
  /** Statements that are kept. */
  readonly committed: () => readonly string[];
  /** Stops the next statement matching `match` until `release` is called. */
  readonly gateOn: (match: RegExp) => void;
  readonly gateReached: () => Promise<void>;
  readonly release: () => void;
};

function createConnection(): FakeConnection {
  let committed: string[] = [];
  let pending: string[] = [];
  let inTransaction = false;

  let gate: RegExp | null = null;
  let reached!: () => void;
  const reachedPromise = new Promise<void>((resolve) => {
    reached = resolve;
  });
  let release!: () => void;
  const releasePromise = new Promise<void>((resolve) => {
    release = resolve;
  });

  /**
   * The statement itself, with SQLite's own refusals for the three cases the
   * bug walks through. The messages are SQLite's wording because the point of
   * the test is that a real connection says exactly this.
   */
  const execAsync = async (sql: string): Promise<void> => {
    if (sql === 'BEGIN') {
      if (inTransaction) {
        throw new Error('cannot start a transaction within a transaction');
      }

      inTransaction = true;

      return;
    }

    if (sql === 'COMMIT') {
      if (!inTransaction) {
        throw new Error('cannot commit - no transaction is active');
      }

      committed = [...committed, ...pending];
      pending = [];
      inTransaction = false;

      return;
    }

    if (sql === 'ROLLBACK') {
      if (!inTransaction) {
        throw new Error('cannot rollback - no transaction is active');
      }

      // Discards whatever is open, whoever opened it. This is the line the
      // whole bug turns on.
      pending = [];
      inTransaction = false;

      return;
    }

    if (inTransaction) {
      pending = [...pending, sql];
    } else {
      committed = [...committed, sql];
    }
  };

  const runAsync = async (sql: string): Promise<{ changes: number; lastInsertRowId: number }> => {
    if (gate !== null && gate.test(sql)) {
      gate = null;
      reached();
      await releasePromise;
    }

    await execAsync(sql);

    return { changes: 1, lastInsertRowId: 0 };
  };

  const withTransactionAsync = async (task: TransactionTask): Promise<void> => {
    try {
      await execAsync('BEGIN');
      await task();
      await execAsync('COMMIT');
    } catch (error) {
      await execAsync('ROLLBACK');
      throw error;
    }
  };

  const unexpectedRead = () => {
    throw new Error('This test expected no reads; a read means the write path changed.');
  };

  return {
    db: {
      runAsync,
      execAsync,
      withTransactionAsync,
      getFirstAsync: unexpectedRead,
      getAllAsync: unexpectedRead,
    } as unknown as SQLiteDatabase,
    committed: () => committed,
    gateOn: (match: RegExp) => {
      gate = match;
    },
    gateReached: () => reachedPromise,
    release,
  };
}

const date = (value: string) => value as ISODate;

function payload(): CloudSyncPayloadV1 {
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
    ],
    pregnancyProfile: null,
    avatarConfig: {
      skinToneId: 'skin-tone-3',
      hairStyleId: 'wavy',
      hairColorId: 'dark-brown',
      outfitId: 'shirt',
    },
    notificationPreferences: {
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    },
    dailyEntries: [],
  };
}

/** Lets pending microtasks run without resolving anything of our own. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) {
    await Promise.resolve();
  }
}

/**
 * How a promise turned out, as a value.
 *
 * Attached straight away so a rejection always has a handler. A test that
 * awaits later reports a dead worker instead of a failed expectation, and the
 * whole point of this file is that it fails *legibly* without the lock.
 */
function settled<T>(promise: Promise<T>): Promise<{ ok: true } | { ok: false; error: string }> {
  return promise.then(
    () => ({ ok: true }) as const,
    (error: unknown) => ({ ok: false, error: String(error) }) as const
  );
}

beforeEach(() => {
  resetLocalDbWriteLockForTests();
  resetLocalDataChangeListenersForTests();
});

describe('a restore with another write arriving mid-transaction', () => {
  it('does not let the other write tear the restore down', async () => {
    const connection = createConnection();

    // Paused on the pregnancy step, so the cycle settings and the period
    // records are already inside the restore's open transaction.
    connection.gateOn(/pregnancy_profile/);

    const restore = restoreCloudBackup(connection.db, payload());

    await connection.gateReached();

    // What a tap on "save" in the daily-entry screen looks like from here,
    // while a sync-driven restore is part-way through.
    //
    // Both outcomes are captured the moment the promises exist, rather than
    // awaited after the gate opens. Without the lock this one rejects while the
    // restore is still paused, and a rejection nobody is holding yet takes the
    // whole worker down with it — which is red, but it reports a crash instead
    // of naming which of the three things below went wrong.
    const other = settled(
      recordDay(connection.db, {
        date: date('2026-09-18'),
        flowId: 'light',
        moodId: 'okay',
        symptomIds: ['cramps'],
      })
    );
    const restored = settled(restore);

    await settle();
    connection.release();

    // Neither side is told something untrue. Without the lock: the tap fails
    // with `cannot start a transaction within a transaction` — an error about
    // somebody else's work — and the restore fails with
    // `cannot commit - no transaction is active`.
    expect(await other).toEqual({ ok: true });
    expect(await restored).toEqual({ ok: true });

    const committed = connection.committed();

    // The restore landed whole. Without the lock the other write's `BEGIN`
    // fails inside the restore's transaction, its `ROLLBACK` throws these two
    // away, and the restore's later statements auto-commit without them.
    expect(committed).toEqual(
      expect.arrayContaining([
        expect.stringContaining('cycle_settings'),
        expect.stringContaining('period_records'),
      ])
    );

    // And it landed before the other write rather than around it: the day is
    // recorded after the last statement the restore made.
    //
    // Matched on `INSERT INTO daily_entries` rather than on the table name: the
    // restore clears that table too, so the name alone would find its own
    // `DELETE` and the assertion would pass for the wrong reason.
    const lastRestoreStatement = committed.findIndex((sql) =>
      sql.includes('notification_preferences')
    );
    const recordedDay = committed.findIndex((sql) =>
      sql.includes('INSERT INTO daily_entries')
    );

    expect(lastRestoreStatement).toBeGreaterThanOrEqual(0);
    expect(recordedDay).toBeGreaterThan(lastRestoreStatement);
  });

  it('reports a failure only when nothing was written', async () => {
    const connection = createConnection();

    connection.gateOn(/pregnancy_profile/);

    // A precondition that refuses is the restore's own way of writing nothing.
    // It throws from inside the transaction, which is the shape a mid-restore
    // failure takes.
    const restore = restoreCloudBackup(connection.db, payload(), {
      precondition: async () => false,
    });

    await expect(restore).rejects.toThrow();

    // Nothing kept. The gate was never reached, because the precondition is the
    // first statement of the span.
    expect(connection.committed()).toEqual([]);
  });
});

describe('the queue itself', () => {
  it('runs a restore and a day record one after the other, in order', async () => {
    const connection = createConnection();

    const restore = restoreCloudBackup(connection.db, payload());
    const other = recordDay(connection.db, {
      date: date('2026-09-18'),
      flowId: 'light',
      moodId: null,
      symptomIds: [],
    });

    await Promise.all([restore, other]);

    const committed = connection.committed();

    // One `BEGIN`/`COMMIT` pair each, never interleaved, so no statement of
    // one sits between two of the other. `INSERT INTO daily_entries` is the
    // recorded day; the restore only ever `DELETE`s from that table.
    const recordedDay = committed.findIndex((sql) =>
      sql.includes('INSERT INTO daily_entries')
    );
    const lastPreference = committed.findIndex((sql) =>
      sql.includes('notification_preferences')
    );

    expect(lastPreference).toBeGreaterThanOrEqual(0);
    expect(recordedDay).toBeGreaterThan(lastPreference);
  });
});
