import type { SQLiteDatabase } from 'expo-sqlite';

import type { DailyEntry } from '../../domain/catalogues';
import { clearDay, recordDay } from '../record-day';

import {
  resetLocalDbWriteLockForTests,
  withLocalDbWriteLock,
} from '@/storage/local-db-write-lock';
import type { ISODate } from '@/types/iso-date';

/**
 * Recording a day waits its turn.
 *
 * Saving a day is a transaction of several statements, and on this app's single
 * connection a transaction is not exclusive — another writer landing between
 * two of its statements used to be able to roll it back. The daily-entry screen
 * called the repository straight, so there was nowhere for
 * `withLocalDbWriteLock` to be taken. These two use cases are that layer.
 *
 * ## What the last test is really about
 *
 * `clearDay` calls the **repository's** `clearDailyEntry`, not `recordDay`.
 * Both repository functions are unlocked and one of them calls the other, so
 * routing through `recordDay` instead would take the lock twice on one path —
 * and because the lock is a promise chain, the second acquisition would wait
 * forever on the first's own unsettled result. Not an error, not a timeout: a
 * hung screen. The test pins which function is called so that mistake cannot
 * be made quietly.
 */

jest.mock('../../data/daily-log-repository', () => ({
  saveDailyEntry: jest.fn(),
  clearDailyEntry: jest.fn(),
}));

const repository = jest.requireMock('../../data/daily-log-repository');
const saveDailyEntry = repository.saveDailyEntry as jest.Mock;
const clearDailyEntry = repository.clearDailyEntry as jest.Mock;

const db = {} as SQLiteDatabase;
const date = (value: string) => value as ISODate;

const ENTRY: DailyEntry = {
  date: date('2026-09-18'),
  flowId: 'light',
  moodId: 'okay',
  symptomIds: ['cramps'],
};

/** Several turns, so "not yet" means the queue rather than a race. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) {
    await Promise.resolve();
  }
}

/** Holds the queue until the returned release is called. */
function holdTheQueue(): { readonly held: Promise<void>; readonly release: () => void } {
  let release!: () => void;
  const held = withLocalDbWriteLock(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      })
  );

  return { held, release: () => release() };
}

beforeEach(() => {
  resetLocalDbWriteLockForTests();
  saveDailyEntry.mockReset();
  saveDailyEntry.mockResolvedValue(undefined);
  clearDailyEntry.mockReset();
  clearDailyEntry.mockResolvedValue(undefined);
});

describe('recording a day', () => {
  it('writes it', async () => {
    await recordDay(db, ENTRY);

    expect(saveDailyEntry).toHaveBeenCalledWith(db, ENTRY);
  });

  it('waits for a write already in flight', async () => {
    const { held, release } = holdTheQueue();

    const saving = recordDay(db, ENTRY);

    await settle();

    expect(saveDailyEntry).not.toHaveBeenCalled();

    release();
    await held;
    await saving;

    expect(saveDailyEntry).toHaveBeenCalledWith(db, ENTRY);
  });
});

describe('clearing a day', () => {
  it('removes it', async () => {
    await clearDay(db, date('2026-09-18'));

    expect(clearDailyEntry).toHaveBeenCalledWith(db, date('2026-09-18'));
  });

  it('waits for a write already in flight', async () => {
    const { held, release } = holdTheQueue();

    const clearing = clearDay(db, date('2026-09-18'));

    await settle();

    expect(clearDailyEntry).not.toHaveBeenCalled();

    release();
    await held;
    await clearing;

    expect(clearDailyEntry).toHaveBeenCalledWith(db, date('2026-09-18'));
  });

  it('goes through the repository rather than through recordDay', async () => {
    await clearDay(db, date('2026-09-18'));

    // Taking the lock twice on one path hangs rather than throws, so the only
    // thing that can catch it is an assertion about which function was called.
    expect(clearDailyEntry).toHaveBeenCalledTimes(1);
    expect(saveDailyEntry).not.toHaveBeenCalled();
  });
});
