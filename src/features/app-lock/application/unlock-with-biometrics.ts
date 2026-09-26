import { afterSuccess, mayAttempt, remainingWaitMs } from '../domain/attempt-policy';
import type { BiometricOutcome } from '../infrastructure/biometrics';
import { promptForBiometrics } from '../infrastructure/biometrics';
import { readLockRecord, writeLockRecord } from '../infrastructure/lock-record-store';
import {
  LOCK_BIOMETRIC_CANCEL_LABEL,
  LOCK_BIOMETRIC_PROMPT,
} from '../presentation/app-lock-messages';

import { setAuthenticationInProgress } from './use-app-lock';

import { logEvent } from '@/shared/logging';

/**
 * Opening with a fingerprint or a face.
 *
 * ## The guard around the prompt is the whole point of this function
 *
 * On several Android devices the OS biometric sheet drives the activity to
 * `background`. The `AppState` listener reads that as "they left the app" and
 * locks — while the sheet that was going to unlock it is still up. The result
 * is a screen that re-locks itself every time somebody tries to open it.
 *
 * `setAuthenticationInProgress` is set before the prompt and cleared in a
 * `finally`, so it is cleared on a cancel, on a failure and on a throw. A flag
 * left set would be worse than the loop: coming back from the background would
 * stop locking at all.
 *
 * ## A failed fingerprint costs nothing
 *
 * It does not count as a wrong PIN. The platform runs its own lockout after too
 * many bad reads, and charging somebody a PIN attempt for a wet thumb would be
 * two penalties for one event. A biometric failure just falls back to the pad.
 */

export type BiometricUnlockOutcome =
  | { readonly kind: 'unlocked' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'waiting'; readonly remainingMs: number };

export async function unlockWithBiometrics(
  now: number = Date.now()
): Promise<BiometricUnlockOutcome> {
  const read = await readLockRecord();

  if (read.kind !== 'record' || !read.record.biometricsEnabled) {
    return { kind: 'unavailable' };
  }

  const record = read.record;

  // A wait applies to every way in, or it is a wait on one door of two.
  if (!mayAttempt(record.attempts, now)) {
    return { kind: 'waiting', remainingMs: remainingWaitMs(record.attempts, now) };
  }

  let outcome: BiometricOutcome;

  setAuthenticationInProgress(true);

  try {
    outcome = await promptForBiometrics(LOCK_BIOMETRIC_PROMPT, LOCK_BIOMETRIC_CANCEL_LABEL);
  } finally {
    // Cleared on every path, including a throw. Left set, the app would stop
    // locking on return from the background entirely.
    setAuthenticationInProgress(false);
  }

  if (outcome === 'unavailable') {
    return { kind: 'unavailable' };
  }

  if (outcome === 'failed') {
    return { kind: 'failed' };
  }

  // A fingerprint clears the PIN counters for the same reason the PIN does:
  // whoever this is has proved they are allowed in.
  try {
    await writeLockRecord({ ...record, attempts: afterSuccess() });
  } catch (error: unknown) {
    logEvent('app lock save failed', error);
  }

  return { kind: 'unlocked' };
}
