import type { Fingerprint } from '@/features/backup/domain/cloud-restore-preview-v1';
import {
  fingerprintAvatarConfig,
  fingerprintCycleSettings,
  fingerprintNotificationPreferences,
  fingerprintPeriodRecord,
  fingerprintPregnancyProfile,
} from '@/features/backup/domain/cloud-restore-preview-v1';
import type { PeriodRecord } from '@/features/cycle/domain/types';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';

/**
 * A short, stable name for the contents of a payload.
 *
 * Two payloads with the same hash hold the same data as far as this app is
 * concerned; two with different hashes do not. That one question — "is what is
 * on the phone still what was last synced?" — is the whole basis of deciding
 * whether anything needs to be sent or fetched, and it has to be answerable
 * without downloading a backup to compare it against.
 *
 * `JSON.stringify` cannot answer it. That was tried, on a device, against a real
 * backup: a document that has been to Firestore and back does not come home with
 * its keys in the order they left in, and every identical value read as changed.
 * The fix there was to reduce each value to the fields this app stores, and this
 * reuses exactly those fingerprints rather than growing a second opinion.
 *
 * What the hash is blind to, deliberately:
 *   - the order keys were written in,
 *   - fields this build does not know about,
 *   - the order period records arrive in.
 *
 * What it is not blind to: any value a restore would write.
 */

/**
 * One value, written so that no two different values can produce the same text.
 *
 * Length-prefixed and typed, because plain joining is ambiguous: `["a", "b"]`
 * and `["a|b"]` would otherwise look identical, and a hash that cannot tell
 * those apart would call two different histories the same.
 */
function encode(value: string | number | boolean | null): string {
  if (value === null) {
    return 'z;';
  }

  if (typeof value === 'number') {
    // `Object.is` distinguishes -0 from 0; JSON and arithmetic do not, and a
    // cycle length of -0 is not a thing. Normalised so both read the same.
    const normalized = Object.is(value, -0) ? 0 : value;

    return `n${String(normalized).length};${String(normalized)}`;
  }

  if (typeof value === 'boolean') {
    return value ? 'b1;1' : 'b1;0';
  }

  return `s${value.length};${value}`;
}

/** One fingerprint as text, with its own length so lists cannot run together. */
function encodeFingerprint(fingerprint: Fingerprint | null): string {
  if (fingerprint === null) {
    return 'x;';
  }

  const body = fingerprint.map(encode).join('');

  return `f${fingerprint.length};${body}`;
}

/**
 * The records in a fixed order, whatever order they arrived in.
 *
 * Sorted by id, and by code unit rather than by `localeCompare`: a comparison
 * that depends on the device's language would hash the same history differently
 * on two phones, which is the one thing a content hash must never do.
 *
 * A payload cannot hold two records with the same id — the payload validator
 * refuses that — so the order this produces is total.
 */
function sortRecordsById(records: readonly PeriodRecord[]): readonly PeriodRecord[] {
  return [...records].sort((left, right) => {
    if (left.id === right.id) {
      return 0;
    }

    return left.id < right.id ? -1 : 1;
  });
}

/**
 * The payload as one canonical string.
 *
 * Every part is fingerprinted first, so only the fields this app stores reach
 * the text. An absent value is encoded as its own marker rather than skipped:
 * "no pregnancy" and "a pregnancy whose fields happen to be empty" have to hash
 * differently.
 */
function canonicalText(payload: CloudSyncPayloadV1): string {
  const parts = [
    encode(payload.version),
    encodeFingerprint(
      payload.cycleSettings === null ? null : fingerprintCycleSettings(payload.cycleSettings)
    ),
    // The count goes in as well, so a list that lost a record cannot hash the
    // same as one that never had it.
    encode(payload.periodRecords.length),
    ...sortRecordsById(payload.periodRecords).map((record) =>
      encodeFingerprint(fingerprintPeriodRecord(record))
    ),
    encodeFingerprint(
      payload.pregnancyProfile === null
        ? null
        : fingerprintPregnancyProfile(payload.pregnancyProfile)
    ),
    encodeFingerprint(
      payload.avatarConfig === null ? null : fingerprintAvatarConfig(payload.avatarConfig)
    ),
    encodeFingerprint(fingerprintNotificationPreferences(payload.notificationPreferences)),
  ];

  return parts.join('');
}

/**
 * FNV-1a, one 32-bit lane.
 *
 * Chosen because it is a dozen lines, needs nothing installed, and is stable
 * for as long as this function is: a hash written down on one device is read
 * back on another, so the algorithm is part of the contract and cannot be
 * swapped for whatever a library upgrade decides.
 *
 * `Math.imul` keeps the multiply in 32 bits; plain `*` would lose precision
 * once the product passed 2^53 and the result would stop being reproducible.
 */
function fnv1a(text: string, offsetBasis: number): number {
  let hash = offsetBasis;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  // `>>> 0` makes it an unsigned 32-bit number rather than a signed one.
  return hash >>> 0;
}

/** Two lanes, so the answer is 64 bits rather than 32. */
const FIRST_LANE = 0x811c9dc5;
const SECOND_LANE = 0x1000193;

function toHex(value: number): string {
  return value.toString(16).padStart(8, '0');
}

/**
 * The hash of one payload: 16 hexadecimal characters.
 *
 * Deterministic. The same payload gives the same answer on every device, in
 * every session, in any key order, with the records in any order — and a
 * different answer for any difference a restore would write.
 *
 * Two 32-bit lanes rather than one: this is not a security question, but a
 * collision means "nothing changed" about a change, which would silently lose a
 * day someone wrote down. 64 bits makes that vanishingly unlikely without
 * adding anything to install.
 *
 * Pure: the payload is read and not mutated, and the record order it was given
 * is not disturbed.
 */
export function cloudSyncContentHash(payload: CloudSyncPayloadV1): string {
  const text = canonicalText(payload);

  return `${toHex(fnv1a(text, FIRST_LANE))}${toHex(fnv1a(text, SECOND_LANE))}`;
}

/** Whether two payloads hold the same data, as far as this app stores it. */
export function isSameCloudSyncContent(
  left: CloudSyncPayloadV1,
  right: CloudSyncPayloadV1
): boolean {
  return cloudSyncContentHash(left) === cloudSyncContentHash(right);
}
