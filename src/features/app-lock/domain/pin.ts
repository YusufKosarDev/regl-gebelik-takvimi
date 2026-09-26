import { describeValue } from '@/shared/logging';

/**
 * What counts as a PIN, and nothing about where one is kept.
 *
 * Pure: reads its argument and answers. No storage, no clock, no hashing — the
 * hash needs a platform random source and belongs a layer out.
 *
 * ## Nothing here ever repeats a PIN
 *
 * Not in a thrown message, not in a returned reason, not in a comment example.
 * A message that quoted one could reach a log, a crash report or a screenshot
 * of a red box, and the whole point of this feature is that the PIN is the one
 * thing nobody else gets to see. `describeValue` says what kind of thing
 * arrived and stops there.
 */

/**
 * Six digits.
 *
 * Six rather than four: the same effort to type and a hundred times the space
 * to guess through. It is not the length that protects anyone — a six-digit
 * space falls to an offline attack in milliseconds — but against somebody
 * standing there typing, backed by the wait schedule, it is the difference
 * between ten thousand tries and a million.
 */
export const PIN_LENGTH = 6;

/** Why a PIN was refused, in terms a screen can turn into a sentence. */
export type PinProblem = 'wrong-length' | 'not-digits';

/**
 * Whether this is a usable PIN, and why not when it is not.
 *
 * `null` means it is fine. The caller decides what to say; this decides what is
 * true.
 */
export function checkPin(pin: string): PinProblem | null {
  if (typeof pin !== 'string') {
    return 'wrong-length';
  }

  if (pin.length !== PIN_LENGTH) {
    return 'wrong-length';
  }

  // `\d` would also accept Arabic-Indic and other Unicode digits, which the pad
  // cannot produce and a stored hash would not match on a later build.
  if (!/^[0-9]+$/.test(pin)) {
    return 'not-digits';
  }

  return null;
}

/** Whether this is a usable PIN. */
export function isValidPin(pin: string): boolean {
  return checkPin(pin) === null;
}

/**
 * Refuses anything that is not a PIN, without saying what arrived.
 *
 * For the boundaries where a bad PIN is a programming error rather than
 * something a person typed — the pad cannot produce one, so reaching here means
 * a caller built one itself.
 */
export function assertPin(pin: string): void {
  if (!isValidPin(pin)) {
    throw new Error(`Expected a ${PIN_LENGTH}-digit PIN, received ${describeValue(pin)}.`);
  }
}

/**
 * Whether the two entries at setup match.
 *
 * A plain comparison, and deliberately not a timing-safe one: both sides are in
 * this process, typed seconds apart by the same person on the same screen.
 * There is no remote attacker to measure anything.
 */
export function pinsMatch(first: string, second: string): boolean {
  return first === second;
}
