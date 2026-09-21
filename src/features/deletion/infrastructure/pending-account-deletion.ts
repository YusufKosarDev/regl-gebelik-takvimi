import AsyncStorage from '@react-native-async-storage/async-storage';

import { describeValue } from '@/shared/logging';

/**
 * A note that somebody started deleting an account and it has not finished.
 *
 * Account deletion has an unavoidable gap in the middle. The cloud backup must
 * go before the account does — deleting the account first would strand a
 * document nobody can reach or remove — so between those two steps the backup
 * is gone while the session is still valid and still signed in.
 *
 * In that gap, `decideSync` sees an account with no backup and answers `push`,
 * which is exactly right in every other circumstance and exactly wrong in this
 * one: one tap on "Şimdi senkronize et" would put the deleted backup straight
 * back. "Yedek oluştur" would do the same, more directly.
 *
 * So the gap is written down. It is set before the cloud delete and cleared
 * when the deletion finishes or when the person says they have changed their
 * mind, and while it is set the two paths that can create a backup refuse.
 *
 * The uid is stored rather than a flag. Two accounts can be used on one phone,
 * and a half-deleted one must not block syncing the other.
 *
 * It holds no health data — an account id and nothing else — and it never
 * leaves the device: it is not in `CloudSyncPayloadV1` and cannot be, because
 * the payload builder reads the health tables and this is not one of them.
 */

export const PENDING_ACCOUNT_DELETION_STORAGE_KEY = 'pending-account-deletion';

/**
 * Records that this account's deletion is under way.
 *
 * The uid has to be a real one: an empty string stored here would compare equal
 * to nothing and block nothing, which is the failure mode worth refusing
 * outright rather than discovering from a re-created backup.
 */
export async function markAccountDeletionPending(uid: string): Promise<void> {
  if (typeof uid !== 'string' || uid.trim() === '') {
    throw new Error(
      `markAccountDeletionPending expects a uid, received ${describeValue(uid)}.`
    );
  }

  await AsyncStorage.setItem(PENDING_ACCOUNT_DELETION_STORAGE_KEY, uid);
}

/**
 * The account whose deletion is unfinished, or `null` when there is none.
 *
 * Anything stored but unusable is treated as none. This is a guard, and a guard
 * that throws on a value it wrote itself would turn a stuck deletion into a
 * screen that cannot load — the opposite of protective. A blank string is the
 * only unusable shape `AsyncStorage` can return here, since it stores strings.
 */
export async function getPendingAccountDeletion(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(PENDING_ACCOUNT_DELETION_STORAGE_KEY);

  if (stored === null || stored === undefined || stored.trim() === '') {
    return null;
  }

  return stored;
}

/** Whether this particular account has a deletion part-way through. */
export async function isAccountDeletionPending(uid: string): Promise<boolean> {
  if (typeof uid !== 'string' || uid.trim() === '') {
    return false;
  }

  return (await getPendingAccountDeletion()) === uid;
}

/** Forgets the note, which lets backups be created again. */
export async function clearPendingAccountDeletion(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_ACCOUNT_DELETION_STORAGE_KEY);
}
