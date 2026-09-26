import { deleteLockRecord, readLockRecord } from '../infrastructure/lock-record-store';

import { logEvent } from '@/shared/logging';

/**
 * Takes the lock off.
 *
 * Removes the record and nothing else. No table is touched, no reminder
 * cancelled, no file deleted — turning off a lock is not a reason to lose
 * anything, and this function existing beside the wipe is exactly why that has
 * to be said out loud.
 *
 * The caller proves they know the PIN first. Without that, anybody holding an
 * unlocked phone could switch the lock off, which is the situation the lock
 * exists for.
 */
export async function removeAppLock(): Promise<void> {
  await deleteLockRecord();
}

/**
 * Whether a lock is set, for callers that only need the answer.
 *
 * An unreadable record counts as no lock — the same failing-open choice the
 * store makes, made in one place and repeated here so a caller cannot
 * accidentally treat "broken" as "on".
 */
export async function isAppLockEnabled(): Promise<boolean> {
  const read = await readLockRecord();

  if (read.kind === 'unreadable') {
    logEvent('app lock load failed');
  }

  return read.kind === 'record';
}
