import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';

import type { CloudBackupEnvelopeV1 } from '../domain/cloud-backup-envelope-v1';
import {
  LEGACY_CLOUD_BACKUP_REVISION,
  buildCloudBackupEnvelopeV1,
  cloudBackupDocumentFields,
  parseCloudBackupEnvelopeV1,
} from '../domain/cloud-backup-envelope-v1';

import { AuthError } from '@/features/auth/domain/auth-error';
import {
  BACKUP_COLLECTION,
  BACKUP_DOCUMENT_ID,
  BACKUP_ROOT_COLLECTION,
} from '@/features/backup/data/cloud-backup-repository';
import { requireFirestore } from '@/features/backup/infrastructure/firestore';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { validateCloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { describeValue } from '@/shared/logging';

/**
 * Reading and writing the stored backup as a sync sees it.
 *
 * The same document the "Yedek oluştur" button writes — `users/{uid}/backups/
 * current` — read and written through the envelope, so a revision comes back
 * with it and a write can be refused when somebody else got there first.
 *
 * Separate from `cloud-backup-repository`, which stays exactly as it is. That
 * one is two buttons: replace what is stored, read what is stored. This one has
 * to answer a harder question — *is what is stored still what I think it is?* —
 * and mixing the two would put a transaction and a revision check in the path
 * of a button that neither needs nor wants one.
 *
 * The path constants are imported from that file rather than written again
 * here. Two constants that were meant to be the same document and drifted would
 * be a sync that syncs a different document from the one the button writes, and
 * neither test would notice.
 *
 * Nothing here runs on its own. There is no listener, no timer, no sync on
 * start: every function in this file is called by something that decided to
 * call it, and until a later stage wires that up, nothing calls them at all.
 */

/**
 * The revision an account has before anything has been written under one.
 *
 * Both for a document that is not there and for one written before revisions
 * existed: neither has been counted, and a caller that wants to make the first
 * counted write passes this as its `expectedRevision`.
 */
export const NO_REMOTE_REVISION = LEGACY_CLOUD_BACKUP_REVISION;

/**
 * A stored document this app cannot read.
 *
 * Its own type because the three things that can go wrong here have to be told
 * apart by the caller, and only one of them is worth retrying:
 *
 *   - this: the document is there and is not what it claims to be. Retrying
 *     will read the same bytes again.
 *   - `CloudSyncPushResult` of kind `conflict`: somebody else wrote first. The
 *     caller re-reads and decides; it is not a failure.
 *   - `AuthError`: the network, the rules, or a build with no project.
 *
 * Collapsing the first into an `AuthError` would tell someone their connection
 * failed while their backup quietly stayed unreadable.
 */
export class CloudSyncDocumentError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'CloudSyncDocumentError';
  }
}

/**
 * What a push did.
 *
 * `conflict` is a result rather than a throw because it is an ordinary thing
 * for two phones to do, and it carries the one fact the caller needs to carry
 * on: what the revision actually is now.
 *
 * The `stored` envelope is what was written, with `updatedAt` still `null` —
 * the server stamps that, and this device does not learn the stamp without
 * reading the document back.
 */
export type CloudSyncPushResult =
  | { readonly kind: 'stored'; readonly envelope: CloudBackupEnvelopeV1 }
  | { readonly kind: 'conflict'; readonly actualRevision: number };

/** What a push needs to know. */
export type CloudSyncPushInput = {
  /** The account, named by the caller. This module has no idea of a current user. */
  readonly uid: string;
  /** The revision the caller believes is stored. `NO_REMOTE_REVISION` for a first write. */
  readonly expectedRevision: number;
  readonly payload: CloudSyncPayloadV1;
  readonly deviceId: string;
};

/**
 * The path for one account's backup.
 *
 * The uid is the only thing in it, and it has to be there: `users//backups/
 * current` is a path nobody owns, and a read of it is a read of whatever
 * happens to be there.
 */
function syncDocumentPath(uid: string): readonly [string, string, string, string] {
  if (typeof uid !== 'string' || uid.trim() === '') {
    throw new AuthError('unknown');
  }

  return [BACKUP_ROOT_COLLECTION, uid, BACKUP_COLLECTION, BACKUP_DOCUMENT_ID];
}

function assertExpectedRevision(expectedRevision: unknown): void {
  if (
    typeof expectedRevision !== 'number' ||
    !Number.isInteger(expectedRevision) ||
    expectedRevision < NO_REMOTE_REVISION
  ) {
    throw new Error(
      `pushRemoteSyncState needs a whole revision of at least ${NO_REMOTE_REVISION}: ` +
        `${describeValue(expectedRevision)}.`
    );
  }
}

/**
 * The device id, checked here rather than left to the envelope builder.
 *
 * The builder checks it too, but it runs inside the transaction, where a throw
 * comes back out through the SDK and would be mapped as a failed request. A
 * caller's own mistake is not a network failure, and it should not cost a round
 * trip to find out.
 */
function assertDeviceId(deviceId: unknown): void {
  if (typeof deviceId !== 'string' || deviceId.trim() === '') {
    throw new Error(
      `pushRemoteSyncState needs a device id: received ${describeValue(deviceId)}.`
    );
  }
}

/**
 * The envelope a stored document describes.
 *
 * The parser's own message is kept — those messages are written to name no
 * stored value, which is what makes them safe to carry — and only the type
 * changes, so a caller can tell an unreadable document from a failed request.
 */
function readEnvelope(document: unknown): CloudBackupEnvelopeV1 {
  try {
    return parseCloudBackupEnvelopeV1(document);
  } catch (error) {
    throw new CloudSyncDocumentError(
      error instanceof Error ? error.message : 'The stored backup could not be read.'
    );
  }
}

/**
 * What is in the account now, or `null` when there is no backup.
 *
 * `null` is the ordinary answer for an account nobody has backed up, and it is
 * not an error. A document that is there but unreadable is one, for the same
 * reason as everywhere else: calling it "no backup" would hide it until
 * something needed it.
 *
 * A document written before any of the sync bookkeeping existed reads as
 * revision 0 with a hash worked out from the payload that is there — and reads
 * that way every time, because nothing is written back. A read stays a read.
 *
 * No snapshot leaves this function. What comes back is the app's own envelope,
 * checked field by field.
 */
export async function loadRemoteSyncState(uid: string): Promise<CloudBackupEnvelopeV1 | null> {
  const path = syncDocumentPath(uid);

  let data: unknown;

  try {
    const snapshot = await getDoc(doc(requireFirestore(), ...path));

    if (!snapshot.exists()) {
      return null;
    }

    data = snapshot.data();
  } catch (error) {
    throw toSyncError(error);
  }

  // Outside the try: a document that cannot be read is its own failure, and
  // wrapping it as a network error would say the wrong thing about it.
  return readEnvelope(data);
}

/**
 * Stores the payload, but only if the account still holds the revision the
 * caller thinks it does.
 *
 * Compare-and-set, in a transaction, because the alternative is a lost write.
 * Two phones that both read revision 5 and both call `setDoc` both succeed, and
 * whichever finishes second silently replaces the other's edits with a document
 * that does not contain them. Here the second one is told `conflict` and the
 * revision it would have had to have.
 *
 * What the transaction does, in order:
 *
 *   1. reads the document, inside the transaction, so Firestore can tell
 *      whether it changed before the write lands;
 *   2. takes its revision — `NO_REMOTE_REVISION` when there is no document, and
 *      the same when the document predates revisions;
 *   3. returns `conflict` with that revision if it is not the expected one, and
 *      writes nothing;
 *   4. otherwise builds the envelope at the next revision and sets it.
 *
 * Read before write, always. A transaction that writes before reading is one
 * Firestore will refuse, and one that skipped the read would not be a
 * compare-and-set at all.
 *
 * The hash is not an argument. `buildCloudBackupEnvelopeV1` works it out from
 * the payload being stored, so there is no call that can put a hash in the
 * document describing something other than what is next to it.
 *
 * The revision is not an argument either, beyond the expected one: the next
 * revision is whatever is stored plus one, decided here, where the stored value
 * was just read.
 *
 * The time is the server's, as it is for the manual backup. A phone's clock is
 * exactly the wrong thing to date a document by when the point of the date is
 * to show a person when their other phone last wrote.
 *
 * An unreadable stored document stops the write rather than being overwritten.
 * Replacing something this app cannot read is replacing something it cannot
 * describe to the person whose data it is.
 *
 * Nothing about "should this be pushed at all" is decided here — not even when
 * the payload is identical to what is stored. That is `decideSync`, which reads
 * nothing and can be proved; a repository that quietly skipped writes would be
 * a second decision in a place nobody would look for one.
 */
export async function pushRemoteSyncState(
  input: CloudSyncPushInput
): Promise<CloudSyncPushResult> {
  const { uid, expectedRevision, payload, deviceId } = input;

  const path = syncDocumentPath(uid);

  assertExpectedRevision(expectedRevision);
  assertDeviceId(deviceId);

  // Before the network. A payload this app would refuse is not worth a round
  // trip, and finding it here means finding it before anything is stored.
  validateCloudSyncPayloadV1(payload);

  // The SDK owns the rejection path of a transaction and may retry the body, so
  // the one error that must survive unchanged is kept here rather than trusted
  // to arrive as it was thrown.
  let documentError: CloudSyncDocumentError | null = null;

  try {
    const firestore = requireFirestore();
    const reference = doc(firestore, ...path);

    return await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(reference);

      let actualRevision = NO_REMOTE_REVISION;

      if (snapshot.exists()) {
        try {
          actualRevision = readEnvelope(snapshot.data()).revision;
        } catch (error) {
          documentError = error as CloudSyncDocumentError;
          throw error;
        }
      }

      if (actualRevision !== expectedRevision) {
        return { kind: 'conflict', actualRevision } as const;
      }

      const envelope = buildCloudBackupEnvelopeV1({
        payload,
        revision: actualRevision + 1,
        deviceId,
      });

      transaction.set(reference, {
        ...cloudBackupDocumentFields(envelope),
        updatedAt: serverTimestamp(),
      });

      return { kind: 'stored', envelope } as const;
    });
  } catch (error) {
    if (documentError !== null) {
      throw documentError;
    }

    throw toSyncError(error);
  }
}

/**
 * The app's error for whatever Firestore threw.
 *
 * Firestore codes are their own set (`permission-denied`, `unavailable`), so
 * they are read here rather than through the auth mapping, and only the code is
 * read — never the message, which quotes the path and the project.
 *
 * Written out again rather than shared with the manual backup repository: that
 * file is not being touched while the sync is being built around it, and the
 * two can become one when the manual backup moves onto the envelope.
 */
function toSyncError(error: unknown): AuthError | CloudSyncDocumentError {
  if (error instanceof CloudSyncDocumentError) {
    return error;
  }

  if (error instanceof AuthError) {
    return error;
  }

  const code = firestoreCodeOf(error);

  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'aborted') {
    // `aborted` is also what a transaction gives up with after too much
    // contention. Both mean the same thing to whoever pressed the button: it
    // did not go through, try again.
    return new AuthError('network-failed');
  }

  if (code === 'unauthenticated' || code === 'permission-denied') {
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
