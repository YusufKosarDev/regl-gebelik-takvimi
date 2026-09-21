import AsyncStorage from '@react-native-async-storage/async-storage';

import { describeValue } from '@/shared/logging';

/**
 * A note that a sync found a disagreement nobody has settled yet.
 *
 * Without it, an automatic sync would find the same conflict on every trigger
 * and announce it again each time — a notice that reappears every five minutes
 * and that pressing nothing makes go away. With it, the conflict is discovered
 * once, automatic sync stops for that account, and the person is asked once.
 *
 * The uid is stored rather than a flag, for the same reason the deletion note
 * stores one: two accounts can be used on one phone, and a conflict in one must
 * not stop the other syncing.
 *
 * It holds no health data — an account id — and it never leaves the device: it
 * is not in `CloudSyncPayloadV1` and cannot be, because the payload builder
 * reads the health tables and this is not one of them.
 */

export const UNRESOLVED_CONFLICT_STORAGE_KEY = 'sync-unresolved-conflict';

/** Records that this account has a conflict waiting for a person. */
export async function markConflictUnresolved(uid: string): Promise<void> {
  if (typeof uid !== 'string' || uid.trim() === '') {
    throw new Error(`markConflictUnresolved expects a uid, received ${describeValue(uid)}.`);
  }

  await AsyncStorage.setItem(UNRESOLVED_CONFLICT_STORAGE_KEY, uid);
}

/**
 * The account with an unsettled conflict, or `null`.
 *
 * Anything unusable is read as none. This gates syncing, and a guard that threw
 * on a value it wrote itself would stop the account screen loading.
 */
export async function getUnresolvedConflict(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(UNRESOLVED_CONFLICT_STORAGE_KEY);

  if (stored === null || stored === undefined || stored.trim() === '') {
    return null;
  }

  return stored;
}

/** Whether this particular account is the one waiting. */
export async function isConflictUnresolved(uid: string): Promise<boolean> {
  if (typeof uid !== 'string' || uid.trim() === '') {
    return false;
  }

  return (await getUnresolvedConflict()) === uid;
}

/** Forgets the note, which lets automatic sync start again. */
export async function clearUnresolvedConflict(): Promise<void> {
  await AsyncStorage.removeItem(UNRESOLVED_CONFLICT_STORAGE_KEY);
}
