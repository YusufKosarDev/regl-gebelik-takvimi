import type { SQLiteDatabase } from 'expo-sqlite';

import { clearDailyEntry, saveDailyEntry } from '../data/daily-log-repository';
import type { DailyEntry } from '../domain/catalogues';

import { withLocalDbWriteLock } from '@/storage/local-db-write-lock';
import type { ISODate } from '@/types/iso-date';

/**
 * Writing down what somebody noticed on a day.
 *
 * Two one-line use cases, and the reason they exist is the write queue rather
 * than any logic of their own. Saving a day is a transaction of several
 * statements, and on this app's single connection a transaction is not
 * exclusive: another writer landing between two of its statements used to be
 * able to roll it back. `withLocalDbWriteLock` is taken exactly once per write
 * path, at the highest layer whose work is nothing but local database work, and
 * a repository cannot be that layer — it cannot know whether its caller already
 * holds the turn. The daily-entry screen called the repository directly, so
 * there was nowhere for the turn to be taken.
 *
 * ## The names are different from the repository's on purpose
 *
 * `recordDay` and `clearDay`, not `saveDailyEntry` and `clearDailyEntry`. The
 * locked use case and the unlocked repository function would otherwise be
 * told apart only by their import path, and the cost of reaching for the wrong
 * one is not a type error: the lock is a promise chain, so taking it twice on
 * one path waits forever on a turn that cannot come. A hung app is worth two
 * distinct names.
 *
 * That is also why `clearDay` calls the **repository's** `clearDailyEntry`
 * rather than `recordDay`. Both repository functions are unlocked — one of them
 * calls the other — so this takes the turn once and nothing nests.
 */

/** Stores one day, or removes it when there is nothing left in it. */
export function recordDay(db: SQLiteDatabase, entry: DailyEntry): Promise<void> {
  return withLocalDbWriteLock(() => saveDailyEntry(db, entry));
}

/** Removes a day entirely. */
export function clearDay(db: SQLiteDatabase, date: ISODate): Promise<void> {
  return withLocalDbWriteLock(() => clearDailyEntry(db, date));
}
