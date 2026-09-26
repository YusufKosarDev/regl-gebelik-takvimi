import type { AttemptState } from '../domain/attempt-policy';
import { afterSuccess, afterWrongPin, mayAttempt, remainingWaitMs } from '../domain/attempt-policy';
import type { LockRecord } from '../domain/lock-record';
import { isValidPin } from '../domain/pin';
import { readLockRecord, writeLockRecord } from '../infrastructure/lock-record-store';
import { PIN_HASH_ITERATIONS, hashPin, needsRehash, verifyPin } from '../infrastructure/pin-hash';

import { logEvent } from '@/shared/logging';

/**
 * Trying a PIN.
 *
 * The counters are written **before** the answer is returned, so killing the
 * app on a wrong PIN does not undo the wait. That is the whole reason this is a
 * use case rather than a comparison on a screen.
 *
 * Nothing here deletes anything, and there is no branch that could. A wrong PIN
 * costs a wait, and the longest wait is half an hour.
 */

export type UnlockOutcome =
  | { readonly kind: 'unlocked' }
  | { readonly kind: 'wrong'; readonly attempts: AttemptState }
  | { readonly kind: 'waiting'; readonly remainingMs: number }
  | { readonly kind: 'no-lock' }
  | { readonly kind: 'unreadable' };

/**
 * Persists the counters, and says so rather than throwing when it cannot.
 *
 * A wait that failed to save is worse than a wait that was never counted: the
 * screen would show one that the next launch has forgotten. It is logged and
 * the attempt is still reported as wrong, because what the person typed was
 * wrong either way.
 */
async function rememberAttempts(record: LockRecord, attempts: AttemptState): Promise<void> {
  try {
    await writeLockRecord({ ...record, attempts });
  } catch (error: unknown) {
    logEvent('app lock save failed', error);
  }
}

export async function unlockWithPin(pin: string, now: number = Date.now()): Promise<UnlockOutcome> {
  const read = await readLockRecord();

  if (read.kind === 'none') {
    return { kind: 'no-lock' };
  }

  if (read.kind === 'unreadable') {
    return { kind: 'unreadable' };
  }

  const record = read.record;

  // Checked against the stored counters rather than what the screen believes,
  // so a reload cannot hand somebody a fresh set of tries.
  if (!mayAttempt(record.attempts, now)) {
    return { kind: 'waiting', remainingMs: remainingWaitMs(record.attempts, now) };
  }

  // A PIN the pad could not have produced is wrong without being hashed. It
  // still costs an attempt: this is the same wrong answer either way.
  if (!isValidPin(pin)) {
    const attempts = afterWrongPin(record.attempts, now);

    await rememberAttempts(record, attempts);

    return { kind: 'wrong', attempts };
  }

  const correct = await verifyPin(pin, record.salt, record.iterations, record.hash);

  if (!correct) {
    const attempts = afterWrongPin(record.attempts, now);

    await rememberAttempts(record, attempts);

    return { kind: 'wrong', attempts };
  }

  // Right. Clear the counters, and take the chance to bring an old record up to
  // the current number of rounds while the PIN is in hand — the only moment it
  // can be done, since the stored hash cannot be re-derived without it.
  const attempts = afterSuccess();

  try {
    if (needsRehash(record.iterations)) {
      const hash = await hashPin(pin, record.salt, PIN_HASH_ITERATIONS);

      await writeLockRecord({ ...record, hash, iterations: PIN_HASH_ITERATIONS, attempts });
    } else {
      await writeLockRecord({ ...record, attempts });
    }
  } catch (error: unknown) {
    // The PIN was right. Refusing to open the app because the counters could
    // not be written would be punishing somebody for a storage fault.
    logEvent('app lock save failed', error);
  }

  return { kind: 'unlocked' };
}
