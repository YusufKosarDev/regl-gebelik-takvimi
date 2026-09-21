import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import type { CloudBackupV1 } from '../domain/cloud-backup-v1';
import { CLOUD_BACKUP_VERSION, parseCloudBackupV1 } from '../domain/cloud-backup-v1';
import { requireFirestore } from '../infrastructure/firestore';

import { AuthError } from '@/features/auth/domain/auth-error';
import type { AuthUser } from '@/features/auth/domain/auth-user';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { validateCloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';

/**
 * Where a backup is kept, and how it gets there.
 *
 * One document per person: `users/{uid}/backups/current`. The path holds the
 * account id and nothing else — no address, no name, no date — because a path
 * is the one part of a database that is visible in every log, index and console
 * listing whether or not anyone opens the document.
 *
 * `current` rather than a generated id: this is a backup, not a history. One
 * document means a second "Yedek oluştur" replaces the first instead of leaving
 * a trail of someone's period history to be cleaned up later.
 *
 * Nothing here runs on its own. There is no automatic upload, no sync on start
 * and no listener: both of these functions are called from a button, and health
 * data leaves the phone only when someone asks for it to.
 */

/** The collection a person's own documents live under. */
export const BACKUP_ROOT_COLLECTION = 'users';

/** The collection of backups inside one person's document. */
export const BACKUP_COLLECTION = 'backups';

/** The one document id, so a backup replaces rather than accumulates. */
export const BACKUP_DOCUMENT_ID = 'current';

/**
 * The path for one account's backup.
 *
 * A signed-in user is required, and the uid has to be there: writing to
 * `users//backups/current` would be writing to a path nobody owns, and reading
 * it would be reading whatever happens to be there.
 */
function backupPath(user: AuthUser): readonly [string, string, string, string] {
  if (typeof user !== 'object' || user === null || typeof user.uid !== 'string' || user.uid.trim() === '') {
    throw new AuthError('unknown');
  }

  return [BACKUP_ROOT_COLLECTION, user.uid, BACKUP_COLLECTION, BACKUP_DOCUMENT_ID];
}

/**
 * Writes one person's backup, replacing whatever was there.
 *
 * The payload is validated before it is sent, by the same validator the app
 * uses everywhere else, so a corrupt row is found here rather than stored and
 * found again on whatever reads it next.
 *
 * The time is the server's. A phone's clock can be wrong, can be changed, and
 * is exactly the wrong thing to date a backup by when the point of the date is
 * to compare two devices later.
 *
 * Firestore's own errors do not travel: they carry a message written for a
 * developer and, for a permission failure, the path it was refused. What comes
 * out is an `AuthError` with a code.
 */
export async function saveCloudBackup(
  user: AuthUser,
  payload: CloudSyncPayloadV1
): Promise<void> {
  const path = backupPath(user);

  validateCloudSyncPayloadV1(payload);

  try {
    await setDoc(doc(requireFirestore(), ...path), {
      version: CLOUD_BACKUP_VERSION,
      payload,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toBackupError(error);
  }
}

/**
 * Reads one person's backup, or `null` when there is none.
 *
 * `null` is the ordinary answer for somebody who has never pressed the button,
 * and it is not an error. A document that is there but unreadable is: it means
 * something wrote a shape this app does not know, and quietly treating that as
 * "no backup" would hide it right up until a restore needed it.
 *
 * The snapshot does not leave this function. What comes back is this app's own
 * `CloudBackupV1`, checked field by field, so no Firestore type and no server
 * metadata reaches anything above.
 */
export async function loadCloudBackup(user: AuthUser): Promise<CloudBackupV1 | null> {
  const path = backupPath(user);

  let data: unknown;

  try {
    const snapshot = await getDoc(doc(requireFirestore(), ...path));

    if (!snapshot.exists()) {
      return null;
    }

    data = snapshot.data();
  } catch (error) {
    throw toBackupError(error);
  }

  // Outside the try: a document that cannot be read is a real failure with its
  // own message, and wrapping it as a network error would say the wrong thing.
  return parseCloudBackupV1(data);
}

/**
 * The app's error for whatever Firestore threw.
 *
 * Firestore codes are their own set (`permission-denied`, `unavailable`), so
 * they are read here rather than through the auth mapping, and only the code is
 * read — never the message, which quotes the path and the project.
 */
function toBackupError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    return error;
  }

  const code = firestoreCodeOf(error);

  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'aborted') {
    return new AuthError('network-failed');
  }

  if (code === 'unauthenticated' || code === 'permission-denied') {
    // Signed out, or the rules refused it. Either way this is not something to
    // explain in terms of the database.
    return new AuthError('invalid-credentials');
  }

  return new AuthError('unknown');
}

/** Firestore codes are lowercase words and hyphens, chosen by the SDK. */
const FIRESTORE_CODE = /^(firestore\/)?[a-z-]{1,60}$/;

function firestoreCodeOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const { code } = error as { code?: unknown };

  if (typeof code !== 'string' || !FIRESTORE_CODE.test(code)) {
    return null;
  }

  return code.startsWith('firestore/') ? code.slice('firestore/'.length) : code;
}

/**
 * Removes one person's backup.
 *
 * Deleting a document that is not there succeeds, and that is what makes this
 * safe to call twice: an account deletion that failed after this step can be
 * retried from the top without the retry itself becoming the failure.
 *
 * Only `users/{uid}/backups/current`. There is nothing else under that account
 * today, and this deliberately does not try to walk the tree looking for more —
 * a client cannot list what the rules do not let it read, so a sweep here would
 * be a guess dressed up as a guarantee.
 */
export async function deleteCloudBackup(user: AuthUser): Promise<void> {
  const path = backupPath(user);

  try {
    await deleteDoc(doc(requireFirestore(), ...path));
  } catch (error) {
    throw toBackupError(error);
  }
}
