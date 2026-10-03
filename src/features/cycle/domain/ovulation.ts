import type { CycleProfile, CycleSettings } from './types';
import { validateCycleProfile, validateCycleSettings } from './validation';

/**
 * Luteal phase length assumed when estimating ovulation.
 *
 * Kept private on purpose: callers should ask for the estimated cycle day rather
 * than rebuild the arithmetic from the constant.
 */
const ASSUMED_LUTEAL_LENGTH_DAYS = 14;

/**
 * The same estimate, from the settings alone.
 *
 * The arithmetic never needed the record list - only `averageCycleLengthDays` -
 * but the profile-shaped function below validates the whole profile, which
 * walks every recorded period. Three of the four phase rules call it, so
 * answering one phase question used to validate the records seven times over.
 *
 * The settings are still validated: this is a domain function and a caller may
 * hold settings that never went through a repository.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function estimatedOvulationCycleDay(settings: CycleSettings): number {
  validateCycleSettings(settings);

  return settings.averageCycleLengthDays - ASSUMED_LUTEAL_LENGTH_DAYS;
}

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

  return estimatedOvulationCycleDay(profile.settings);
}
