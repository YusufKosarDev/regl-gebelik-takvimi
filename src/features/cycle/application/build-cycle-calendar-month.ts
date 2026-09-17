import { getCycleDay } from '../domain/cycle-day';
import { getCyclePhase } from '../domain/cycle-phase';
import { getEstimatedFertilityLevel } from '../domain/fertility-level';
import type { FertilityLevel } from '../domain/fertility-level';
import type { CyclePhase } from '../domain/phases';
import { predictNextPeriodStart } from '../domain/predictions';
import type { CycleProfile } from '../domain/types';
import { validateCycleProfile } from '../domain/validation';

import type { ISODate } from '@/types/iso-date';
import { formatLocalDate, getDaysInMonth } from '@/utils/date';

const MIN_YEAR = 0;
const MAX_YEAR = 9999;

/** One real calendar day, with whatever the domain knows about it. */
export type CycleCalendarDay = {
  readonly date: ISODate;
  readonly cycleDay: number | null;
  readonly phase: CyclePhase | null;
  readonly fertilityLevel: FertilityLevel | null;
  readonly isPredictedPeriodStart: boolean;
};

/** Every day of one month, chronological, with nothing padded or trimmed. */
export type CycleCalendarMonth = {
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  readonly days: readonly CycleCalendarDay[];
};

/**
 * Turns the domain's per-day answers into one month-shaped list.
 *
 * Nothing is computed here: every field comes from the domain function that owns
 * that rule, so the calendar and the rest of the app can never disagree. A day
 * the domain cannot place — one before the first recorded period — stays `null`
 * rather than being guessed at.
 *
 * `days` holds the month's real days only. No leading or trailing days from the
 * neighbouring months, because grid layout is a view concern and padding here
 * would make the list lie about what month it describes.
 *
 * Pure: the profile is read, never mutated or reordered, and no clock is read.
 * The caller decides which month to ask about.
 */
export function buildCycleCalendarMonth(
  profile: CycleProfile,
  year: number,
  month: number
): CycleCalendarMonth {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new Error(
      `buildCycleCalendarMonth expects a year between ${MIN_YEAR} and ${MAX_YEAR}, ` +
        `received ${year}.`
    );
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(
      `buildCycleCalendarMonth expects a month between 1 and 12, received ${month}.`
    );
  }

  validateCycleProfile(profile);

  // Once per month, not once per day: the prediction depends on the profile
  // alone, so asking again for each date would repeat the same work 28-31 times.
  const predictedPeriodStart = predictNextPeriodStart(profile);

  const dayCount = getDaysInMonth(year, month);
  const days: CycleCalendarDay[] = [];

  for (let dayOfMonth = 1; dayOfMonth <= dayCount; dayOfMonth += 1) {
    const date = formatLocalDate(year, month, dayOfMonth);

    days.push({
      date,
      cycleDay: getCycleDay(profile, date),
      phase: getCyclePhase(profile, date),
      fertilityLevel: getEstimatedFertilityLevel(profile, date),
      isPredictedPeriodStart: predictedPeriodStart !== null && predictedPeriodStart === date,
    });
  }

  return { year, month, days };
}
