import { newLockRecord } from '../domain/lock-record';
import { assertPin } from '../domain/pin';
import { writeLockRecord } from '../infrastructure/lock-record-store';
import { PIN_HASH_ITERATIONS, hashPin, newSalt } from '../infrastructure/pin-hash';

/**
 * Sets, or replaces, the lock.
 *
 * One use case for both because the difference is entirely the caller's: a new
 * lock and a changed PIN write the same record with the same fields, and
 * splitting them would mean two functions that had to be kept identical.
 *
 * A new salt every time. Changing a PIN back to a previous one has to produce a
 * different hash, or the stored record says which PINs have been used before.
 *
 * The attempt counters start clean, which is the right answer for both cases:
 * somebody who just proved they know the PIN is not partway through being
 * locked out.
 *
 * `boundUid` is who may reset this by password later, and `null` is the person
 * who was told at setup that there would be no way back. It is recorded here
 * rather than read at recovery time, so signing into a different account cannot
 * open somebody else's phone.
 */
export async function setAppLock(input: {
  readonly pin: string;
  readonly boundUid: string | null;
  readonly biometricsEnabled: boolean;
}): Promise<void> {
  assertPin(input.pin);

  const salt = await newSalt();
  const hash = await hashPin(input.pin, salt, PIN_HASH_ITERATIONS);

  await writeLockRecord(
    newLockRecord({
      salt,
      hash,
      iterations: PIN_HASH_ITERATIONS,
      boundUid: input.boundUid,
      biometricsEnabled: input.biometricsEnabled,
    })
  );
}
