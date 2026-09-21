import type { SQLiteDatabase } from 'expo-sqlite';

import {
  checkAccountStillExists,
  deleteAuthUser,
  reauthenticateWithPassword,
  signOut,
} from '@/features/auth/data/auth-repository';
import type { AuthUser } from '@/features/auth/domain/auth-user';
import { toAuthError } from '@/features/auth/domain/auth-error';
import { deleteCloudBackup } from '@/features/backup/data/cloud-backup-repository';
import { withAutomaticSyncSuspended } from '@/features/sync/application/automatic-sync-suspension';
import { clearAllSyncState } from '@/features/sync/data/sync-state-repository';
import { clearLastSyncAt } from '@/features/sync/infrastructure/last-sync-at';
import { clearUnresolvedConflict } from '@/features/sync/infrastructure/unresolved-conflict';
import { clearDeviceId } from '@/features/sync/infrastructure/device-id';
import { clearSyncPreferences } from '@/features/sync/infrastructure/sync-preferences';
import { logEvent } from '@/shared/logging';

import type { AccountDeletionOutcome, DeletionFailure } from '../domain/deletion-outcome';
import {
  clearPendingAccountDeletion,
  isAccountDeletionPending,
  markAccountDeletionPending,
} from '../infrastructure/pending-account-deletion';

import { wipeLocalData } from './wipe-local-data';

/**
 * Deleting an account, in the only order that is safe.
 *
 *   1. prove it is them, with the password
 *   2. write down that a deletion has started
 *   3. delete the cloud backup
 *   4. delete the account
 *   5. forget the sync bookkeeping the account left behind
 *   6. if asked, wipe the phone too
 *
 * Step 3 before step 4, always. An account deleted first would leave its backup
 * in Firestore with no way to reach it: every rule in this project is written
 * as `request.auth.uid == userId`, and a uid that no longer exists satisfies
 * nothing. The document would sit there, unreadable and undeletable, holding a
 * period history — the exact opposite of what was asked for.
 *
 * Step 2 is what makes the gap between 3 and 4 safe. In it the backup is gone
 * but the session is still good, and `decideSync` answers `push` for an account
 * with no backup, so one tap on "Şimdi senkronize et" would put it straight
 * back. While the note is set, both paths that can write a backup refuse.
 *
 * Step 5 runs whether or not the phone is being wiped. The records themselves
 * are the person's and they said to keep them; the sync base is not records, it
 * is a copy of them filed under an account that no longer exists.
 *
 * Every step is safe to run again. Re-deleting an absent document succeeds,
 * re-deleting an account that is already gone reports `signed-out`, and the
 * clears are all idempotent — so a failure anywhere can be retried from the top
 * rather than needing to be resumed from the middle.
 */

export type DeleteAccountInput = {
  readonly db: SQLiteDatabase;
  readonly user: AuthUser;
  /** Confirmed on this screen, used once, never stored. */
  readonly password: string;
  /** Whether the records on this phone go too. */
  readonly wipeLocalDataToo: boolean;
  /** Resets the store and the onboarding flag; only used when wiping. */
  readonly resetAppState: () => Promise<void>;
};

/** Auth codes this flow can show, mapped to its own vocabulary. */
function toDeletionFailure(error: unknown): DeletionFailure {
  const { code } = toAuthError(error);

  switch (code) {
    case 'not-configured':
    case 'invalid-credentials':
    case 'requires-recent-login':
    case 'network-failed':
    case 'too-many-requests':
      return code;
    case 'signed-out':
      return 'signed-out';
    default:
      return 'unknown';
  }
}

/** Clears what the deleted account left on this phone. Never fatal. */
async function forgetAccountTraces(db: SQLiteDatabase): Promise<void> {
  try {
    await clearAllSyncState(db);
  } catch (error: unknown) {
    logEvent('sync state clear failed', error);
  }

  try {
    await clearSyncPreferences();
  } catch (error: unknown) {
    logEvent('sync state clear failed', error);
  }

  try {
    await clearDeviceId();
  } catch (error: unknown) {
    logEvent('sync state clear failed', error);
  }

  try {
    await clearLastSyncAt();
  } catch (error: unknown) {
    logEvent('sync state clear failed', error);
  }

  // Scoped to a uid that no longer exists, so it could never match again — but
  // a stale marker is still a thing somebody could be shown, and there is no
  // conflict left to resolve.
  try {
    await clearUnresolvedConflict();
  } catch (error: unknown) {
    logEvent('sync state clear failed', error);
  }
}

/**
 * What a refused password means when a deletion was already under way.
 *
 * `auth/invalid-credential` covers both "that is not the password" and "there
 * is no such user any more", because email enumeration protection makes the two
 * answer alike. Guessing between them is not acceptable in either direction:
 * calling a live account gone signs somebody out for a typo, and calling a gone
 * account live leaves them retyping a password against nothing.
 *
 * So it is asked rather than guessed, and only when there is reason to: the
 * pending note means this device already deleted the backup and was part-way
 * through deleting the account, which is the one situation where "it is already
 * gone" is a real possibility. `reload()` carries no password and so has only
 * one thing it can be refused for.
 *
 * Returns `null` when the caller should carry on treating it as a wrong
 * password — including when the note is not set, and including when the check
 * could not be made confidently.
 */
async function resolveRefusedPassword(
  db: SQLiteDatabase,
  uid: string
): Promise<AccountDeletionOutcome | null> {
  let pending = false;

  try {
    pending = await isAccountDeletionPending(uid);
  } catch (error: unknown) {
    logEvent('account delete failed', error);

    return null;
  }

  if (!pending) {
    return null;
  }

  const presence = await checkAccountStillExists();

  if (presence === 'unreachable') {
    // The password may well be right; we simply could not reach anything.
    return { kind: 'failed', reason: 'network-failed' };
  }

  if (presence === 'present') {
    // The account is there, so the password really was wrong. Nothing is
    // cleared and the session is left alone.
    return null;
  }

  // Gone. Finish what the interrupted deletion started.
  await forgetAccountTraces(db);

  try {
    await clearPendingAccountDeletion();
  } catch (error: unknown) {
    logEvent('account delete failed', error);
  }

  try {
    await signOut();
  } catch (error: unknown) {
    // The session points at nothing either way.
    logEvent('account delete failed', error);
  }

  return { kind: 'already-deleted' };
}

/**
 * Deletes the account, and on request this phone with it.
 *
 * Suspended throughout. The pending-deletion marker already stops the
 * scheduler, but it is only written after the password is accepted, and a sync
 * that started before that would still be in the air — pushing data to an
 * account that is about to stop existing, or pulling into one being wiped.
 */
export async function deleteAccount(input: DeleteAccountInput): Promise<AccountDeletionOutcome> {
  return withAutomaticSyncSuspended(() => runDeleteAccount(input));
}

async function runDeleteAccount(input: DeleteAccountInput): Promise<AccountDeletionOutcome> {
  const { db, user, password, wipeLocalDataToo, resetAppState } = input;

  if (typeof user !== 'object' || user === null || typeof user.uid !== 'string' || user.uid.trim() === '') {
    return { kind: 'failed', reason: 'signed-out' };
  }

  // 1. Them, now. Nothing has been touched if this refuses.
  try {
    await reauthenticateWithPassword(user.email ?? '', password);
  } catch (error: unknown) {
    const reason = toDeletionFailure(error);

    if (reason === 'invalid-credentials') {
      const resolved = await resolveRefusedPassword(db, user.uid);

      if (resolved !== null) {
        return resolved;
      }
    }

    return { kind: 'failed', reason };
  }

  // 2. From here until the account is gone, no backup may be created.
  try {
    await markAccountDeletionPending(user.uid);
  } catch (error: unknown) {
    logEvent('account delete failed', error);

    return { kind: 'failed', reason: 'local-failed' };
  }

  // 3. The cloud copy. The note above is already set, so a failure here leaves
  //    syncing blocked rather than leaving a deleted backup to be re-uploaded.
  try {
    await deleteCloudBackup(user);
  } catch (error: unknown) {
    logEvent('cloud backup delete failed', error);

    const mapped = toDeletionFailure(error);

    return {
      kind: 'failed',
      reason: mapped === 'unknown' ? 'cloud-delete-failed' : mapped,
    };
  }

  // 4. The account. Only now, and only because step 3 succeeded.
  try {
    await deleteAuthUser();
  } catch (error: unknown) {
    logEvent('account delete failed', error);

    const mapped = toDeletionFailure(error);

    return {
      kind: 'failed',
      reason: mapped === 'unknown' ? 'account-delete-failed' : mapped,
    };
  }

  // The account is gone. Nothing below this line may report failure of the
  // deletion itself, because the deletion happened.
  try {
    await clearPendingAccountDeletion();
  } catch (error: unknown) {
    logEvent('account delete failed', error);
  }

  await forgetAccountTraces(db);

  if (!wipeLocalDataToo) {
    return { kind: 'deleted' };
  }

  const wipe = await wipeLocalData({ db, resetAppState });

  if (wipe.kind === 'failed') {
    return { kind: 'deleted-wipe-failed' };
  }

  return { kind: 'deleted-and-wiped' };
}
