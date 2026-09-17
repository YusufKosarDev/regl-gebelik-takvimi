import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile } from '../data/cycle-repository';
import { getCycleDay } from '../domain/cycle-day';
import { getCyclePhase } from '../domain/cycle-phase';
import { getEstimatedFertilityLevel } from '../domain/fertility-level';
import type { FertilityLevel } from '../domain/fertility-level';
import type { CyclePhase } from '../domain/phases';
import { predictNextPeriodStart } from '../domain/predictions';
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
};

/**
 * The summary for one profile and one day.
 *
 * Separate from the read so a caller that already holds the profile can build
 * this without going back to the database for it.
 */
export function buildCycleDashboard(profile: CycleProfile, today: ISODate): CycleDashboard {
  return {
    today,
    cycleDay: getCycleDay(profile, today),
    phase: getCyclePhase(profile, today),
    fertilityLevel: getEstimatedFertilityLevel(profile, today),
    nextPeriodStart: predictNextPeriodStart(profile),
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
