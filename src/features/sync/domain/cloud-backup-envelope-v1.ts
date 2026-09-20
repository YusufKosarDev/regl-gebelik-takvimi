import { toUpdatedAt } from '@/features/backup/domain/cloud-backup-v1';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { validateCloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { describeValue } from '@/shared/logging';

import { cloudSyncContentHash } from './cloud-sync-hash';

/**
 * The stored backup, with what a sync needs to reason about it.
 *
 * The payload is untouched: it is the definition of "what the person entered",
 * and it is the privacy boundary. Everything added here is bookkeeping about
 * the copy rather than part of it — which is why it sits around the payload and
 * not inside it.
 *
 * What the bookkeeping is for:
 *
 *   - `revision` lets two devices agree on order without agreeing on time. A
 *     timestamp records when a write reached a server, which is not when the
 *     edit was made, and depends on clocks this app does not control.
 *   - `contentHash` lets a device ask "is this still what I last synced?"
 *     without downloading the payload to compare.
 *   - `deviceId` lets a device recognise its own write, so an echo of it is not
 *     mistaken for somebody else's change.
 *
 * Nothing here is sent anywhere yet: this is the shape, and the reader that can
 * already make sense of the documents written before it existed.
 */
export type CloudBackupEnvelopeV1 = {
  readonly version: 1;
  /** Counts up with every stored write. `0` for a document written before it. */
  readonly revision: number;
  /** `cloudSyncContentHash(payload)`, so the two can never disagree. */
  readonly contentHash: string;
  /** Which device wrote it, or `null` for a document written before this. */
  readonly deviceId: string | null;
  /** ISO 8601, or `null` while the server has not stamped it yet. */
  readonly updatedAt: string | null;
  readonly payload: CloudSyncPayloadV1;
};

/** The envelope version this file reads and writes. */
export const CLOUD_BACKUP_ENVELOPE_VERSION = 1;

/**
 * The revision of a document written before revisions existed.
 *
 * Zero rather than one, so the first real write can be 1 and "never written by
 * a build that counts" stays distinguishable from "written once".
 */
export const LEGACY_CLOUD_BACKUP_REVISION = 0;

/** The keys an envelope of this version is built from. */
export const CLOUD_BACKUP_ENVELOPE_V1_FIELDS = [
  'version',
  'revision',
  'contentHash',
  'deviceId',
  'updatedAt',
  'payload',
] as const satisfies readonly (keyof CloudBackupEnvelopeV1)[];

/**
 * The fields that go into the stored document.
 *
 * `updatedAt` is not among them: the server writes that one, and a value this
 * device put there would be its own clock pretending to be the server's. The
 * repository adds it at write time.
 */
export const CLOUD_BACKUP_DOCUMENT_FIELDS = [
  'version',
  'revision',
  'contentHash',
  'deviceId',
  'payload',
] as const;

function assertVersion(version: unknown): void {
  if (version !== CLOUD_BACKUP_ENVELOPE_VERSION) {
    throw new Error(
      `CloudBackupEnvelopeV1 expects version ${CLOUD_BACKUP_ENVELOPE_VERSION}, received ` +
        `${typeof version === 'number' ? version : describeValue(version)}.`
    );
  }
}

function assertRevision(revision: unknown): void {
  if (
    typeof revision !== 'number' ||
    !Number.isInteger(revision) ||
    revision < LEGACY_CLOUD_BACKUP_REVISION
  ) {
    throw new Error(
      `CloudBackupEnvelopeV1 has a revision that is not a whole number of at least ` +
        `${LEGACY_CLOUD_BACKUP_REVISION}: ${describeValue(revision)}.`
    );
  }
}

function assertContentHash(contentHash: unknown): void {
  if (typeof contentHash !== 'string' || contentHash.trim() === '') {
    throw new Error(
      `CloudBackupEnvelopeV1 has a contentHash that is not text: ${describeValue(contentHash)}.`
    );
  }
}

/**
 * The device id, which may be absent.
 *
 * `null` means "written before this app recorded one" and is a fact about an
 * older document rather than a fault in it. An empty string is a fault: it is a
 * device claiming an id and giving none.
 */
function assertDeviceId(deviceId: unknown): void {
  if (deviceId === null) {
    return;
  }

  if (typeof deviceId !== 'string' || deviceId.trim() === '') {
    throw new Error(
      `CloudBackupEnvelopeV1 has a deviceId that is not text: ${describeValue(deviceId)}.`
    );
  }
}

function assertUpdatedAt(updatedAt: unknown): void {
  if (updatedAt === null) {
    return;
  }

  if (typeof updatedAt !== 'string' || updatedAt.trim() === '') {
    throw new Error(
      `CloudBackupEnvelopeV1 has an updatedAt that is not text: ${describeValue(updatedAt)}.`
    );
  }
}

/**
 * Checks one envelope, throwing on the first rule it breaks.
 *
 * The payload goes through the validator the app already uses for it, so a
 * stored document cannot carry something the app itself would refuse — which
 * matters most here, because this one has been outside the device.
 *
 * The hash is not recomputed. It is a claim about the payload made by whoever
 * wrote the document, and checking it is a separate question with a separate
 * answer: `isCloudBackupEnvelopeConsistent` asks it where a caller wants it
 * asked, rather than every read paying for it.
 *
 * No message names a value. What is in here is a period history.
 *
 * Pure: nothing is mutated and the envelope is read exactly as given.
 */
export function validateCloudBackupEnvelopeV1(envelope: CloudBackupEnvelopeV1): void {
  if (typeof envelope !== 'object' || envelope === null || Array.isArray(envelope)) {
    throw new Error(
      `validateCloudBackupEnvelopeV1 received something that is not an envelope: ${describeValue(
        envelope
      )}.`
    );
  }

  assertVersion(envelope.version);
  assertRevision(envelope.revision);
  assertContentHash(envelope.contentHash);
  assertDeviceId(envelope.deviceId);
  assertUpdatedAt(envelope.updatedAt);

  validateCloudSyncPayloadV1(envelope.payload);
}

/** Whether the stored hash is the hash of the stored payload. */
export function isCloudBackupEnvelopeConsistent(envelope: CloudBackupEnvelopeV1): boolean {
  return envelope.contentHash === cloudSyncContentHash(envelope.payload);
}

/**
 * An envelope around a payload, ready to be stored.
 *
 * The hash is computed here rather than taken as an argument, so there is no
 * way to write a document whose hash describes something other than what it
 * carries.
 *
 * `updatedAt` is `null`: the server stamps it, and this has not been stored
 * yet. The revision is the caller's — working out what the next one should be
 * is a question about what is already stored, which this cannot see.
 *
 * Pure: the payload is validated and kept by reference, not copied or altered.
 */
export function buildCloudBackupEnvelopeV1(input: {
  readonly payload: CloudSyncPayloadV1;
  readonly revision: number;
  readonly deviceId: string;
}): CloudBackupEnvelopeV1 {
  const { payload, revision, deviceId } = input;

  validateCloudSyncPayloadV1(payload);
  assertRevision(revision);

  if (typeof deviceId !== 'string' || deviceId.trim() === '') {
    throw new Error(
      `buildCloudBackupEnvelopeV1 needs a device id: received ${describeValue(deviceId)}.`
    );
  }

  return {
    version: CLOUD_BACKUP_ENVELOPE_VERSION,
    revision,
    contentHash: cloudSyncContentHash(payload),
    deviceId,
    updatedAt: null,
    payload,
  };
}

/**
 * The envelope as the fields a document is written from.
 *
 * Without `updatedAt`, which the server supplies. The repository is the one
 * that knows how to ask for a server timestamp, and this stays free of
 * Firestore.
 */
export function cloudBackupDocumentFields(envelope: CloudBackupEnvelopeV1): {
  readonly version: number;
  readonly revision: number;
  readonly contentHash: string;
  readonly deviceId: string | null;
  readonly payload: CloudSyncPayloadV1;
} {
  validateCloudBackupEnvelopeV1(envelope);

  return {
    version: envelope.version,
    revision: envelope.revision,
    contentHash: envelope.contentHash,
    deviceId: envelope.deviceId,
    payload: envelope.payload,
  };
}

/**
 * The envelope a stored document describes, whichever build wrote it.
 *
 * Documents written before any of this bookkeeping existed hold a version, a
 * payload and a timestamp. They are read rather than refused: someone with a
 * backup made last month should not be told it is unreadable because a later
 * build learned to count revisions.
 *
 * What is missing is filled in rather than invented:
 *
 *   - no `revision` becomes 0, which orders it before every counted write;
 *   - no `contentHash` is computed from the payload that is there, so the two
 *     agree by construction;
 *   - no `deviceId` stays `null`, which says "unknown", not "this device".
 *
 * Nothing is written back. Normalising happens in memory, and a document that
 * is read is left exactly as it was found: a read that quietly rewrote someone's
 * backup would be a write nobody asked for, and it would do it while they were
 * only looking.
 *
 * A payload that does not validate is refused whichever shape it arrived in.
 * Age excuses missing bookkeeping; it does not excuse a period history the app
 * cannot read.
 */
export function parseCloudBackupEnvelopeV1(document: unknown): CloudBackupEnvelopeV1 {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new Error(
      `parseCloudBackupEnvelopeV1 received something that is not a document: ${describeValue(
        document
      )}.`
    );
  }

  const stored = document as {
    version?: unknown;
    revision?: unknown;
    contentHash?: unknown;
    deviceId?: unknown;
    updatedAt?: unknown;
    payload?: unknown;
  };

  assertVersion(stored.version);

  const payload = stored.payload as CloudSyncPayloadV1;

  // Before the hash, because hashing something that is not a payload would fail
  // with a worse message than the validator's.
  validateCloudSyncPayloadV1(payload);

  const envelope: CloudBackupEnvelopeV1 = {
    version: CLOUD_BACKUP_ENVELOPE_VERSION,
    revision:
      stored.revision === undefined || stored.revision === null
        ? LEGACY_CLOUD_BACKUP_REVISION
        : (stored.revision as number),
    contentHash:
      stored.contentHash === undefined || stored.contentHash === null
        ? cloudSyncContentHash(payload)
        : (stored.contentHash as string),
    deviceId:
      stored.deviceId === undefined || stored.deviceId === null
        ? null
        : (stored.deviceId as string),
    updatedAt: toUpdatedAt(stored.updatedAt),
    payload,
  };

  validateCloudBackupEnvelopeV1(envelope);

  return envelope;
}

/** Whether a stored document predates the sync bookkeeping. */
export function isLegacyCloudBackupDocument(document: unknown): boolean {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    return false;
  }

  const stored = document as { revision?: unknown; contentHash?: unknown };

  return stored.revision === undefined && stored.contentHash === undefined;
}
