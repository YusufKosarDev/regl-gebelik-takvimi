import type { CycleProfile } from './types';
import { validateCycleProfile } from './validation';

/**
 * Luteal phase length assumed when estimating ovulation.
 *
 * Kept private on purpose: callers should ask for the estimated cycle day rather
 * than rebuild the arithmetic from the constant.
 */
const ASSUMED_LUTEAL_LENGTH_DAYS = 14;

/**
 * The cycle day ovulation is expected to fall on, counting the period start as
 * day 1.
 *
 * This is the single place the luteal-length assumption lives, so the phase
 * rules that depend on it cannot drift apart. It is an estimate with no claim to
 * medical accuracy, and it returns a cycle day only — no calendar date.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function getEstimatedOvulationCycleDay(profile: CycleProfile): number {
  validateCycleProfile(profile);

  return profile.settings.averageCycleLengthDays - ASSUMED_LUTEAL_LENGTH_DAYS;
}
