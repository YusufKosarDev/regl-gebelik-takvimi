import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { validateCloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { describeValue } from '@/shared/logging';

/**
 * One stored backup, as this app reads it back.
 *
 * A wrapper around the payload rather than the payload itself, because a stored
 * copy has one thing the payload does not: when it was written. That is the
 * server's answer, not this device's, so it is the only honest way to tell two
 * backups apart later.
 *
 * `updatedAt` is nothing but a record for now. No code decides anything from
 * it: choosing between a local state and a stored one is what a sync does, and
 * there is no sync here — only a backup somebody asked for and a check that it
 * is there.
 */
export type CloudBackupV1 = {
  readonly version: 1;
  readonly payload: CloudSyncPayloadV1;
  /** ISO 8601, or `null` while the server has not stamped it yet. */
  readonly updatedAt: string | null;
};

/** The version this file reads and writes. */
export const CLOUD_BACKUP_VERSION = 1;

/** The keys a backup of this version is built from. */
export const CLOUD_BACKUP_V1_FIELDS = [
  'version',
  'payload',
  'updatedAt',
] as const satisfies readonly (keyof CloudBackupV1)[];

function assertVersion(version: unknown): void {
  if (version !== CLOUD_BACKUP_VERSION) {
    throw new Error(
      `CloudBackupV1 expects version ${CLOUD_BACKUP_VERSION}, received ` +
        `${typeof version === 'number' ? version : describeValue(version)}.`
    );
  }
}

/**
 * What a server timestamp looks like once it has been written.
 *
 * Firestore hands back a `Timestamp`, which is two numbers and a `toDate`. It
 * is read structurally rather than by class, so nothing above this file has to
 * know the SDK's types — and a document written by an older build, or read from
 * the offline cache before the server has answered, still parses.
 */
type TimestampLike = {
  readonly seconds?: unknown;
  readonly nanoseconds?: unknown;
  readonly toDate?: unknown;
};

/**
 * The stamp as an ISO string, or `null`.
 *
 * `null` is a real answer twice over: a document can be read back from the
 * local cache in the moment between the write and the server's reply, and a
 * stored document from another build may have no stamp at all. Neither is
 * corruption, and neither is worth refusing a backup over.
 *
 * `Date` appears here, which it does not in the cycle domain. This is a moment
 * in time recorded by a server, not a day in someone's cycle: there is no
 * calendar arithmetic to get wrong, and an instant is exactly what `Date`
 * represents.
 */
export function toUpdatedAt(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    // Already an ISO string, which is what this app's own type holds.
    return Number.isNaN(Date.parse(value)) ? null : value;
  }

  const stamp = value as TimestampLike;

  if (typeof stamp.toDate === 'function') {
    const date = (stamp.toDate as () => unknown)();

    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }

  if (typeof stamp.seconds === 'number' && Number.isFinite(stamp.seconds)) {
    return new Date(stamp.seconds * 1000).toISOString();
  }

  return null;
}

/**
 * Checks one backup, throwing on the first rule it breaks.
 *
 * The payload is checked by the validator the app already uses for it, so a
 * stored document cannot carry something the app itself would refuse — which
 * matters more here than anywhere else, because this one has been outside the
 * device and come back.
 *
 * No message names a value. What is in here is a period history and a due date.
 *
 * Pure: nothing is mutated and the backup is read exactly as given.
 */
export function validateCloudBackupV1(backup: CloudBackupV1): void {
  if (typeof backup !== 'object' || backup === null || Array.isArray(backup)) {
    throw new Error(
      `validateCloudBackupV1 received something that is not a backup: ${describeValue(backup)}.`
    );
  }

  assertVersion(backup.version);

  if (backup.updatedAt !== null && typeof backup.updatedAt !== 'string') {
    throw new Error(`CloudBackupV1 has an updatedAt that is not text: ${describeValue(backup.updatedAt)}.`);
  }

  validateCloudSyncPayloadV1(backup.payload);
}

/**
 * The backup a stored document claims to be.
 *
 * Everything is checked on the way in. A document that has been sitting in a
 * database, readable by whatever else has the project's credentials, is not
 * something this app wrote a moment ago, and trusting it because the app wrote
 * it once is how a restore ends up writing someone else's history — or
 * nonsense — over their own.
 *
 * The timestamp is mapped before the check, so a `Timestamp` from the SDK
 * becomes a string here and no Firestore type travels any further.
 */
export function parseCloudBackupV1(document: unknown): CloudBackupV1 {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new Error(
      `parseCloudBackupV1 received something that is not a document: ${describeValue(document)}.`
    );
  }

  const stored = document as { version?: unknown; payload?: unknown; updatedAt?: unknown };

  const backup: CloudBackupV1 = {
    version: stored.version as 1,
    payload: stored.payload as CloudSyncPayloadV1,
    updatedAt: toUpdatedAt(stored.updatedAt),
  };

  validateCloudBackupV1(backup);

  return backup;
}
