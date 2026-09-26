import type { AttemptState } from './attempt-policy';
import { NO_FAILED_ATTEMPTS } from './attempt-policy';

import { describeValue } from '@/shared/logging';

/**
 * What is written down about the lock, and what it is allowed to say.
 *
 * Pure: the shape and the check. Reading and writing it is
 * `infrastructure/lock-record-store`'s job, and hashing is
 * `application/hash-pin`'s — both of those need a platform, and this does not.
 *
 * ## The PIN is not in here
 *
 * Only a salt and a hash of the PIN with that salt. The hash is not what makes
 * this safe: six digits is twenty bits, and no hash function available on this
 * device survives an offline attack over a space that small. What makes it safe
 * is where the record lives — SecureStore, wrapped by the Android Keystore —
 * so that reaching it needs code running as this app. And anybody who can do
 * that can read the unencrypted database instead, which is the more direct
 * route to the same thing.
 *
 * What the hash does buy is that the PIN is not sitting in a file in the clear,
 * where it could leak through a log line, a crash report or somebody reading
 * `shared_prefs` over a cable.
 *
 * `iterations` is stored rather than assumed so the number can be raised later
 * without a migration: an old record verifies with the count it was written
 * with, and is rewritten with the new one on the next successful unlock.
 */

/** The only version this build reads or writes. */
export const LOCK_RECORD_VERSION = 1;

export type LockRecord = {
  readonly version: 1;
  /** Hex, from the platform random source. Never reused between PINs. */
  readonly salt: string;
  /** Hex. The PIN hashed with the salt, `iterations` times. */
  readonly hash: string;
  readonly iterations: number;
  /**
   * The account that may reset this lock by password, or `null`.
   *
   * `null` is the person who set a lock without an account, who was warned at
   * setup that there would be no way back. The recovery route is not offered
   * when this is `null` — offering it and then failing would be worse than not
   * offering it.
   */
  readonly boundUid: string | null;
  /** Whether a fingerprint or face may stand in for the PIN. */
  readonly biometricsEnabled: boolean;
  readonly attempts: AttemptState;
};

function fail(field: string, value: unknown): never {
  throw new Error(`LockRecord ${field} is not usable: ${describeValue(value)}.`);
}

function assertHex(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.length === 0 || !/^[0-9a-f]+$/.test(value)) {
    fail(field, value);
  }
}

/**
 * Checks a record read back from storage.
 *
 * Everything is checked, because what comes back was not necessarily written by
 * this build: a newer one may have stored a shape this does not know, and a
 * half-written record is a thing that happens. Anything unreadable is refused
 * here and the caller decides — which, for this feature, means failing open and
 * saying so, never shutting somebody out of their own records over a bad read.
 */
export function validateLockRecord(record: unknown): asserts record is LockRecord {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    throw new Error(`validateLockRecord received something that is not a record.`);
  }

  const candidate = record as Partial<LockRecord>;

  if (candidate.version !== LOCK_RECORD_VERSION) {
    fail('version', candidate.version);
  }

  assertHex(candidate.salt, 'salt');
  assertHex(candidate.hash, 'hash');

  if (
    typeof candidate.iterations !== 'number' ||
    !Number.isInteger(candidate.iterations) ||
    candidate.iterations < 1
  ) {
    fail('iterations', candidate.iterations);
  }

  if (candidate.boundUid !== null && (typeof candidate.boundUid !== 'string' || candidate.boundUid === '')) {
    fail('boundUid', candidate.boundUid);
  }

  if (typeof candidate.biometricsEnabled !== 'boolean') {
    fail('biometricsEnabled', candidate.biometricsEnabled);
  }

  const attempts = candidate.attempts as Partial<AttemptState> | undefined;

  if (typeof attempts !== 'object' || attempts === null || Array.isArray(attempts)) {
    fail('attempts', attempts);
  }

  if (
    typeof attempts.failedAttempts !== 'number' ||
    !Number.isInteger(attempts.failedAttempts) ||
    attempts.failedAttempts < 0
  ) {
    fail('attempts.failedAttempts', attempts.failedAttempts);
  }

  if (
    attempts.lockedUntil !== null &&
    (typeof attempts.lockedUntil !== 'number' || !Number.isFinite(attempts.lockedUntil))
  ) {
    fail('attempts.lockedUntil', attempts.lockedUntil);
  }
}

/** A record for a PIN that has just been set. */
export function newLockRecord(input: {
  readonly salt: string;
  readonly hash: string;
  readonly iterations: number;
  readonly boundUid: string | null;
  readonly biometricsEnabled: boolean;
}): LockRecord {
  return {
    version: LOCK_RECORD_VERSION,
    salt: input.salt,
    hash: input.hash,
    iterations: input.iterations,
    boundUid: input.boundUid,
    biometricsEnabled: input.biometricsEnabled,
    attempts: NO_FAILED_ATTEMPTS,
  };
}

/** Whether this lock can be reset with an account password. */
export function isRecoverable(record: LockRecord): boolean {
  return record.boundUid !== null;
}
