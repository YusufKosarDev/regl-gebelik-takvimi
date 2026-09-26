import { remainingWaitMs } from '../domain/attempt-policy';
import { isRecoverable } from '../domain/lock-record';
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

/**
 * Whether the lock on this phone can be reset with an account password.
 *
 * Asked by the lock screen so the link is only shown when it would work. The
 * person who set a lock without an account was told at setup that there would
 * be no way back, and a link that led to a refusal would be a second, crueller
 * way of telling them.
 */
export async function isAppLockRecoverable(): Promise<boolean> {
  const read = await readLockRecord();

  return read.kind === 'record' && isRecoverable(read.record);
}

/**
 * How long the lock is still refusing attempts, in milliseconds.
 *
 * Asked by the lock screen when it mounts. Without it, a wait that survived a
 * restart is invisible until somebody has typed six digits and been refused —
 * the counters were doing their job, but the screen was letting a person spend
 * a PIN to find out.
 */
export async function remainingLockWaitMs(now: number = Date.now()): Promise<number> {
  const read = await readLockRecord();

  return read.kind === 'record' ? remainingWaitMs(read.record.attempts, now) : 0;
}
