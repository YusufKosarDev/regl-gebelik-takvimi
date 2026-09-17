import { MAX_CYCLE_LENGTH_DAYS, MIN_CYCLE_LENGTH_DAYS } from '@/features/cycle/domain/limits';

/**
 * Reads the `cycleLength` route param.
 *
 * Route params arrive as loose strings and can legally be an array, so the value
 * is checked rather than trusted: anything that is not a single whole number in
 * the domain's allowed range comes back as `null`. Callers are expected to stop,
 * not to substitute a default — a wrong cycle length would silently distort
 * every later prediction.
 */

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
