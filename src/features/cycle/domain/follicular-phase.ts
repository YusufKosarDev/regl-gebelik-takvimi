import { getCycleDay } from './cycle-day';
import type { CycleProfile } from './types';

import type { ISODate } from '@/types/iso-date';

/** Luteal phase length assumed when estimating the ovulation boundary. */
const ASSUMED_LUTEAL_LENGTH_DAYS = 14;

/**
 * Tells whether `targetDate` falls inside the *expected* follicular phase.
 *
 * The window opens the day after the expected period ends and closes the day
 * before the estimated ovulation day. Both bounds come from the profile
 * averages, so this is a prediction with no claim to medical accuracy, and
 * recorded `endDate` values are deliberately ignored.
 *
 * The ovulation figure here is an internal boundary only; it is not exposed and
 * is not an ovulation prediction API.
 *
 * Profile and target date validation happen inside `getCycleDay`, so invalid
 * input throws before any phase is reported.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function getFollicularPhase(
  profile: CycleProfile,
  targetDate: ISODate
): 'follicular' | null {
  const cycleDay = getCycleDay(profile, targetDate);

  if (cycleDay === null) {
    return null;
  }

  const follicularStartDay = profile.settings.averagePeriodLengthDays + 1;
  const estimatedOvulationDay =
    profile.settings.averageCycleLengthDays - ASSUMED_LUTEAL_LENGTH_DAYS;

  if (estimatedOvulationDay <= follicularStartDay) {
    return null;
  }

  const isWithinFollicularWindow =
    cycleDay >= follicularStartDay && cycleDay < estimatedOvulationDay;

  return isWithinFollicularWindow ? 'follicular' : null;
}
