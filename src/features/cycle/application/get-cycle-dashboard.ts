import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile } from '../data/cycle-repository';
import { getCycleDay } from '../domain/cycle-day';
import { getCyclePhase } from '../domain/cycle-phase';
import { getEstimatedFertilityLevel } from '../domain/fertility-level';
import type { FertilityLevel } from '../domain/fertility-level';
import type { CyclePhase } from '../domain/phases';
import { isBeyondPredictionHorizon, predictNextPeriodStart } from '../domain/predictions';
import type { CycleProfile } from '../domain/types';

import type { ISODate } from '@/types/iso-date';

/**
 * Everything the home screen needs for one day, in one read.
 *
 * `today` is a parameter rather than something read here, so the whole summary
 * stays deterministic and the clock is touched in exactly one place in the app.
 *
 * No formula is reimplemented: each field comes from the domain function that
 * already owns that rule.
 */
export type CycleDashboard = {
  readonly today: ISODate;
  readonly cycleDay: number | null;
  readonly phase: CyclePhase | null;
  readonly fertilityLevel: FertilityLevel | null;
  readonly nextPeriodStart: ISODate | null;

  /**
   * Past the last day of the predicted period, where the app stops inferring.
   *
   * Carried rather than re-derived, for the reason `CycleCalendarDay` carries
   * it: a null fertility level means "genuinely unknown" before the first
   * record and "not estimated this far" past the horizon, and a screen reading
   * only the null cannot tell them apart. They are different facts and they
   * must not end up saying the same thing.
   */
  readonly isBeyondHorizon: boolean;
};

/**
 * The summary for one profile and one day.
 *
 * Separate from the read so a caller that already holds the profile can build
 * this without going back to the database for it.
 */
export function buildCycleDashboard(profile: CycleProfile, today: ISODate): CycleDashboard {
  // Past the predicted period the app counts and stops inferring, exactly as
  // the calendar does - `isBeyondPredictionHorizon` is the one definition, and
  // this screen missing it is why that function exists rather than the
  // arithmetic living in the calendar.
  //
  // The phase and the fertility level go; the cycle day does not. Somebody
  // whose period is overdue is past the horizon by definition and is looking
  // at this screen for a reason, and the days since their last period started
  // is the thing they came for.
  // The cycle day first, and not only for readability: `getCycleDay` is what
  // refuses a date that is not one, with a message naming the argument. Asking
  // the horizon first would reject the same input a step earlier and say
  // something vaguer about it.
  const cycleDay = getCycleDay(profile, today);
  const beyondHorizon = isBeyondPredictionHorizon(profile, today);

  return {
    today,
    cycleDay,
    phase: beyondHorizon ? null : getCyclePhase(profile, today),
    fertilityLevel: beyondHorizon ? null : getEstimatedFertilityLevel(profile, today),
    nextPeriodStart: predictNextPeriodStart(profile),
    isBeyondHorizon: beyondHorizon,
  };
}

/** Returns `null` when nothing has been saved yet. */
export async function getCycleDashboard(
  db: SQLiteDatabase,
  today: ISODate
): Promise<CycleDashboard | null> {
  const profile = await loadCycleProfile(db);

  if (profile === null) {
    return null;
  }

  return buildCycleDashboard(profile, today);
}
