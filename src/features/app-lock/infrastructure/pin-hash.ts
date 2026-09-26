import * as Crypto from 'expo-crypto';

import { assertPin } from '../domain/pin';

/**
 * Turning a PIN into something that can be written down.
 *
 * ## What this does and does not buy, plainly
 *
 * A six-digit PIN is about twenty bits. `expo-crypto` offers SHA-2 and AES and
 * **no key-derivation function at all** — no PBKDF2, no scrypt, no argon2 — and
 * iterating a hash across the JS bridge is far too slow to stand in for one. So
 * there is no arrangement of this file that makes a six-digit PIN survive an
 * offline attack. A million candidates is milliseconds of work.
 *
 * What the hash buys is that the PIN is not stored in the clear, so it cannot
 * leak through a log line, a crash report, a backup or somebody reading
 * `shared_prefs` over a cable.
 *
 * What actually keeps the record out of reach is SecureStore and the Android
 * Keystore: getting at it needs code running as this app. And anyone who has
 * that can read the unencrypted database instead, which is the shorter path to
 * the same information.
 *
 * None of this is a reason to skip the salt or the iterations. It is a reason
 * not to describe them as more than they are.
 */

/**
 * How many rounds a new PIN is hashed through.
 *
 * Every round is a bridge call, so this is bounded by what a person will wait
 * for at the lock screen rather than by what an attacker would have to spend.
 * Measured on the slowest device to hand and set so unlocking stays under about
 * a quarter of a second.
 *
 * Raising it later needs no migration: the count is stored in each record, an
 * old record verifies with the count it was written with, and
 * `needsRehash` says when to write a new one.
 */
export const PIN_HASH_ITERATIONS = 24;

/** A fresh salt. Never reused between PINs, so two identical PINs differ. */
export async function newSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The hash of this PIN with this salt.
 *
 * The salt goes in on every round rather than only the first, so a round's
 * output cannot be reused across salts.
 */
export async function hashPin(pin: string, salt: string, iterations: number): Promise<string> {
  assertPin(pin);

  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error('hashPin needs at least one iteration.');
  }

  let digest = pin;

  for (let round = 0; round < iterations; round++) {
    digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${salt}:${digest}`,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
  }

  return digest;
}

/**
 * Whether this PIN is the one behind that hash.
 *
 * A plain string comparison. Not timing-safe, and it does not need to be: the
 * comparison happens in this process on a device somebody is holding, with no
 * remote attacker able to measure anything — and the wait schedule, not the
 * comparison, is what stands between them and a second guess.
 */
export async function verifyPin(
  pin: string,
  salt: string,
  iterations: number,
  expectedHash: string
): Promise<boolean> {
  const actual = await hashPin(pin, salt, iterations);

  return actual === expectedHash;
}

/** Whether a record was written with fewer rounds than this build now uses. */
export function needsRehash(iterations: number): boolean {
  return iterations < PIN_HASH_ITERATIONS;
}
