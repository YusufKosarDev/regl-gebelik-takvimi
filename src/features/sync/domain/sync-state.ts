import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { validateCloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { describeValue } from '@/shared/logging';

/**
 * What this device last agreed with one account.
 *
 * The base a sync measures from: the payload as it stood when the phone and the
 * account last held the same thing, the revision it was stored under, and the
 * hash of that payload so "has this phone changed since?" is one comparison
 * rather than a full re-read.
 *
 * Keeping the payload itself is what makes a real three-way merge possible. A
 * device that has been offline for a week can tell what *it* changed apart from
 * what the other device changed, and only ask about the parts that truly
 * collide. Without a base, every difference looks like a conflict.
 *
 * One of these per account. Two people can share a phone, and an answer about
 * one account's sync state must never be assembled from another's.
 *
 * Having no state at all is a real answer and the ordinary one: an account this
 * device has never synced has no base, and the decision engine already knows
 * what to do with that.
 */
export type SyncState = {
  /** The Firebase account this base belongs to. */
  readonly uid: string;
  /** The remote revision this base was taken from. */
  readonly revision: number;
  /** `cloudSyncContentHash(basePayload)`, stored rather than recomputed. */
  readonly contentHash: string;
  readonly basePayload: CloudSyncPayloadV1;
  /** When this row was last written, ISO 8601, as the caller's clock read it. */
  readonly updatedAt: string;
};

/** A revision of 0 records an account whose backup has never been written. */
export const INITIAL_SYNC_REVISION = 0;

function assertText(field: string, value: unknown): void {
  if (typeof value !== 'string') {
    throw new Error(`SyncState has a ${field} that is not text: ${describeValue(value)}.`);
  }

  if (value.trim() === '') {
    throw new Error(`SyncState has a blank ${field}.`);
  }
}

/**
 * Checks one sync state, throwing on the first rule it breaks.
 *
 * The payload is checked by the validator the app already uses for it, so a
 * base cannot hold something the app itself would refuse to store — which
 * matters here because this one is read back from a database and handed to a
 * merge that will decide what to keep.
 *
 * No message names a value. A base is a whole period history.
 *
 * Pure: nothing is mutated and the state is read exactly as given.
 */
export function validateSyncState(state: SyncState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new Error(
      `validateSyncState received something that is not a sync state: ${describeValue(state)}.`
    );
  }

  assertText('uid', state.uid);
  assertText('contentHash', state.contentHash);
  assertText('updatedAt', state.updatedAt);

  if (
    typeof state.revision !== 'number' ||
    !Number.isInteger(state.revision) ||
    state.revision < INITIAL_SYNC_REVISION
  ) {
    throw new Error(
      `SyncState has a revision that is not a whole number of at least ` +
        `${INITIAL_SYNC_REVISION}: ${describeValue(state.revision)}.`
    );
  }

  validateCloudSyncPayloadV1(state.basePayload);
}
