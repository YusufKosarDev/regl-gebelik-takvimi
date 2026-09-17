/**
 * Reads the `periodLength` route param.
 *
 * Mirrors the domain rules in `validateCycleSettings`: a whole number from 1 to
 * 20 that is never longer than the cycle. Anything else comes back as `null` so
 * the caller stops rather than substituting a default.
 */

const MIN_PERIOD_LENGTH_DAYS = 1;
const MAX_PERIOD_LENGTH_DAYS = 20;

/** Digits only: rejects '5.5', '-5', '+5', ' 5' and the empty string. */
const WHOLE_NUMBER_PATTERN = /^\d+$/;

export function parsePeriodLengthParam(
  value: string | string[] | undefined,
  cycleLength: number
): number | null {
  if (typeof value !== 'string' || !WHOLE_NUMBER_PATTERN.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (parsed < MIN_PERIOD_LENGTH_DAYS || parsed > MAX_PERIOD_LENGTH_DAYS) {
    return null;
  }

  if (parsed > cycleLength) {
    return null;
  }

  return parsed;
}
