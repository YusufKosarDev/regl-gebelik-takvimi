import { remainingWaitMs } from '../domain/attempt-policy';
import { isRecoverable } from '../domain/lock-record';
import {
  deleteLockRecord,
  readLockRecord,
  writeLockRecord,
} from '../infrastructure/lock-record-store';

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

/**
 * Whether the lock on this phone is bound to this account.
 *
 * Asked by the account screen before offering to delete the account: doing so
 * makes such a lock unrecoverable, because the uid it was bound to stops
 * existing and signing in as it stops being possible.
 */
export async function isAppLockBoundTo(uid: string): Promise<boolean> {
  const read = await readLockRecord();

  return read.kind === 'record' && read.record.boundUid === uid;
}

/**
 * Cuts the lock loose from an account that has stopped existing.
 *
 * ## The lock stays on
 *
 * This writes `boundUid: null` and changes nothing else. Removing the lock
 * instead would be the app deciding that somebody who deleted an account also
 * stopped wanting a PIN in front of their records - and the records are still
 * there, which is the whole reason the lock was set. They chose it; deleting
 * an account is not a request to undo it.
 *
 * ## Why the binding cannot be left behind
 *
 * `boundUid` is the account allowed to reset this lock by password, and
 * `isRecoverable` is only `boundUid !== null`. Left pointing at a deleted uid
 * it is a yes to a question whose answer is no: the lock screen draws "I
 * forgot my PIN", the recovery screen takes an email and a password, and
 * signing in cannot succeed because there is no account to sign in to. The
 * person is told their password is wrong about an account that is gone.
 *
 * `(lock)/index.tsx` says offering a route and then refusing it is worse than
 * not offering one, and that is the state this removes. Afterwards the record
 * is the one the setup warning already describes in both languages: a lock
 * with no account behind it, no reset link, and a PIN that has to be
 * remembered.
 *
 * ## Quiet, like the rest of the clearing up
 *
 * Called after the account is already gone, where nothing may report failure
 * of a deletion that happened. A record that cannot be read is not rewritten:
 * `readLockRecord` has already deleted it and the lock is off, so there is no
 * binding left to cut.
 */
export async function unbindAppLock(): Promise<void> {
  const read = await readLockRecord();

  if (read.kind !== 'record' || read.record.boundUid === null) {
    return;
  }

  try {
    await writeLockRecord({ ...read.record, boundUid: null });
  } catch (error: unknown) {
    logEvent('app lock save failed', error);
  }
}
