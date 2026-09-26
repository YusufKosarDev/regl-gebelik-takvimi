import { readLockRecord } from '../infrastructure/lock-record-store';

import { removeAppLock } from './remove-app-lock';

import { AuthError } from '@/features/auth/domain/auth-error';
import { signInWithEmail } from '@/features/auth/data/auth-repository';
import { logEvent } from '@/shared/logging';

/**
 * Opening a lock whose PIN has been forgotten.
 *
 * ## Why sign-in rather than re-authentication
 *
 * `reauthenticateWithPassword` needs a live `auth.currentUser` and throws
 * `signed-out` without one. Somebody who signed out, or who reinstalled and
 * restored, still needs a way back — and they are exactly the person most
 * likely to be locked out. `signInWithEmail` works with or without a session.
 *
 * ## The uid check is the whole security of this path
 *
 * A valid password for *some* account must not open *this* phone. The account
 * that may reset a lock is recorded when the lock is set, and the uid that
 * comes back from signing in has to be that one. Without this, anybody could
 * unlock anybody's phone with their own account.
 *
 * ## Afterwards the lock is off, not reset
 *
 * Not "set to a new PIN": the person would not know what it was. Off is a state
 * they can see and reason about, and the screen offers to set a new one.
 *
 * Nothing here touches the database. Recovering a lock is not a reason to lose
 * anything, and the one thing this deletes is the lock record itself.
 */

export type RecoveryOutcome =
  | { readonly kind: 'recovered' }
  | { readonly kind: 'wrong-account' }
  | { readonly kind: 'not-recoverable' }
  | { readonly kind: 'failed'; readonly code: string };

export async function recoverWithAccountPassword(
  email: string,
  password: string
): Promise<RecoveryOutcome> {
  const read = await readLockRecord();

  if (read.kind !== 'record') {
    // No lock, or one that could not be read and has already been turned off.
    // Either way there is nothing left to recover from.
    return { kind: 'recovered' };
  }

  const boundUid = read.record.boundUid;

  if (boundUid === null) {
    // The person who was warned at setup. The screen does not offer this route
    // to them at all; reaching here means something else went wrong.
    return { kind: 'not-recoverable' };
  }

  let uid: string;

  try {
    const user = await signInWithEmail(email, password);

    uid = user.uid;
  } catch (error: unknown) {
    logEvent('app lock recovery failed', error);

    return { kind: 'failed', code: error instanceof AuthError ? error.code : 'unknown' };
  }

  if (uid !== boundUid) {
    return { kind: 'wrong-account' };
  }

  await removeAppLock();

  return { kind: 'recovered' };
}
