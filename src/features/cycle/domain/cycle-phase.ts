import { getFollicularPhase } from './follicular-phase';
import { getLutealPhase } from './luteal-phase';
import { getMenstrualPhase } from './menstrual-phase';
import { getOvulatoryPhase } from './ovulatory-phase';
import type { CyclePhase } from './phases';
import type { CycleProfile } from './types';

import type { ISODate } from '@/types/iso-date';

/**
 * Resolves the four independent phase checks into a single phase.
 *
 * Each phase function applies its own rule without knowing about the others, so
 * on a short cycle their windows can overlap: with a 15 day cycle the estimated
 * ovulation day falls on cycle day 1, which is also an expected menstrual day.
 * The order below breaks those ties — menstrual first, so predicted bleeding is
 * what the user sees, then ovulatory as the more specific single-day signal,
 * then the two broader windows.
 *
 * No formula is reimplemented here and no validation is repeated: the phase
 * functions each run the existing `getCycleDay` chain, so an invalid profile or
 * target date throws before any phase is reported.
 *
 * Late cycles keep their existing behaviour and stay luteal past the average
 * cycle length; this resolver adds no delayed, overdue, unknown or confidence
 * state of its own.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function getCyclePhase(profile: CycleProfile, targetDate: ISODate): CyclePhase | null {
  if (getMenstrualPhase(profile, targetDate) !== null) {
    return 'menstrual';
  }

  if (getOvulatoryPhase(profile, targetDate) !== null) {
    return 'ovulatory';
  }

  if (getFollicularPhase(profile, targetDate) !== null) {
    return 'follicular';
  }

  if (getLutealPhase(profile, targetDate) !== null) {
    return 'luteal';
  }

  return null;
}
