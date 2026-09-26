import * as SecureStore from 'expo-secure-store';

import type { LockRecord } from '../domain/lock-record';
import { validateLockRecord } from '../domain/lock-record';

import { logEvent } from '@/shared/logging';

/**
 * Where the lock is written down.
 *
 * `expo-secure-store`, which on Android is the Keystore for the key and
 * `SharedPreferences` for the ciphertext, per app and unreadable by any other.
 * That — not the hash — is what stops the record being read. The hash is there
 * so the PIN is not lying in a file in the clear where a log, a crash report or
 * somebody reading `shared_prefs` over a cable could pick it up.
 *
 * ## Reading a broken record fails open, on purpose
 *
 * A SecureStore read can fail for reasons that have nothing to do with this
 * app: an invalidated Keystore master key, an OEM quirk, a restore onto
 * different hardware. Two behaviours were possible and the choice matters.
 *
 * Failing *closed* would shut somebody out of their own health data because of
 * a bug in a key store. Failing *open* disables a lock that was never
 * encrypting anything, so nothing that was actually protected is lost — the
 * database was plaintext either way.
 *
 * So an unreadable record reads as "no lock", the screen says so plainly
 * (`LOCK_UNREADABLE_MESSAGE`), and the person can set it again. The broken
 * record is deleted rather than left to fail the same way every launch.
 */

/**
 * One key for the whole record.
 *
 * The attempt counters live inside it rather than beside it, so a wrong PIN and
 * the count of wrong PINs cannot get out of step with each other across a
 * crash.
 */
const LOCK_RECORD_KEY = 'app-lock-v1';

/** How a read turned out. `unreadable` is a state, not a failure to handle. */
export type LockRecordRead =
  | { readonly kind: 'none' }
  | { readonly kind: 'record'; readonly record: LockRecord }
  | { readonly kind: 'unreadable' };

/**
 * Reads the lock, or says there is not one.
 *
 * Never throws. Everything a caller could do with an exception here is worse
 * than what this returns.
 */
export async function readLockRecord(): Promise<LockRecordRead> {
  let raw: string | null;

  try {
    raw = await SecureStore.getItemAsync(LOCK_RECORD_KEY);
  } catch (error: unknown) {
    logEvent('app lock load failed', error);

    return { kind: 'unreadable' };
  }

  if (raw === null || raw === undefined) {
    return { kind: 'none' };
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    validateLockRecord(parsed);

    return { kind: 'record', record: parsed };
  } catch (error: unknown) {
    logEvent('app lock load failed', error);

    // Left in place it would fail the same way on every launch. Removing it
    // is what makes "set it again" actually work.
    await deleteLockRecord();

    return { kind: 'unreadable' };
  }
}

/**
 * Writes the record.
 *
 * Throws on failure, unlike the read: a save that did not happen must not look
 * like one that did, or somebody sets a PIN that was never stored and finds out
 * the next time they open the app.
 */
export async function writeLockRecord(record: LockRecord): Promise<void> {
  validateLockRecord(record);

  await SecureStore.setItemAsync(LOCK_RECORD_KEY, JSON.stringify(record));
}

/**
 * Removes the lock.
 *
 * Quiet by contract. Called from the wipe, from recovery and from a failed
 * read, and in all three the caller has already decided what happens next.
 */
export async function deleteLockRecord(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LOCK_RECORD_KEY);
  } catch (error: unknown) {
    logEvent('app lock save failed', error);
  }
}
