/**
 * Reads the `cycleLength` route param.
 *
 * Route params arrive as loose strings and can legally be an array, so the value
 * is checked rather than trusted: anything that is not a single whole number in
 * the domain's 15–90 range comes back as `null`. Callers are expected to stop,
 * not to substitute a default — a wrong cycle length would silently distort
 * every later prediction.
 */

const MIN_CYCLE_LENGTH_DAYS = 15;
const MAX_CYCLE_LENGTH_DAYS = 90;

/** Digits only: rejects '28.5', '-1', '+28', ' 28' and the empty string. */
const WHOLE_NUMBER_PATTERN = /^\d+$/;

export function parseCycleLengthParam(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !WHOLE_NUMBER_PATTERN.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (parsed < MIN_CYCLE_LENGTH_DAYS || parsed > MAX_CYCLE_LENGTH_DAYS) {
    return null;
  }

  return parsed;
}
