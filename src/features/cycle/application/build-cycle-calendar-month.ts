import { getCycleDay } from '../domain/cycle-day';
import { resolveCyclePhase } from '../domain/cycle-phase';
import { resolveFertilityLevel } from '../domain/fertility-level';
import type { FertilityLevel } from '../domain/fertility-level';
import type { CyclePhase } from '../domain/phases';
import { predictNextPeriodStart } from '../domain/predictions';
import type { CycleProfile } from '../domain/types';
import { validateCycleProfile } from '../domain/validation';

import type { ISODate } from '@/types/iso-date';
import { daysBetween, formatLocalDate, getDaysInMonth } from '@/utils/date';

const MIN_YEAR = 0;
const MAX_YEAR = 9999;

/** One real calendar day, with whatever the domain knows about it. */
export type CycleCalendarDay = {
  readonly date: ISODate;
  readonly cycleDay: number | null;
  readonly phase: CyclePhase | null;
  readonly fertilityLevel: FertilityLevel | null;
  readonly isPredictedPeriodStart: boolean;
  /**
   * Any day of the predicted next period, its first day included.
   *
   * ## Why this is not `phase`
   *
   * A predicted day is a guess and `phase` is a record. `buildCyclePhaseIndex`
   * reads `phase` off these days and hands it to the daily-log history and the
   * export, where it becomes "you logged cramps in the luteal phase" - a
   * sentence about something that happened. Writing a prediction into that
   * field would put guesses into a correlation summary and a CSV, which is the
   * one place they must never appear.
   *
   * ## Why it is not derived from `cycleDay` either
   *
   * `getCycleDay` counts from the latest *recorded* start, and nothing in it
   * rolls over at a predicted one. Nine days after a 12 October start with a
   * 28-day setting, the cycle day is 29 and keeps climbing; it never returns
   * to 1. See the note on the field below.
   */
  readonly isPredictedPeriodDay: boolean;
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

  /**
   * The last day the predicted period is expected to cover.
   *
   * ## The trap this closes, for whoever extends this calendar next
   *
   * `getCycleDay` counts from the latest **recorded** period start on or
   * before a date, and nothing anywhere rolls that count over at a predicted
   * start. With a 12 October start and a 28-day setting, 9 November is cycle
   * day 29 rather than day 1, 10 November is day 30, and December runs into
   * the fifties. `isMenstrualCycleDay` is `cycleDay <= averagePeriodLengthDays`
   * and `cycle-phase.ts` says in as many words that "the luteal window has no
   * upper bound" - so every day past the predicted start resolves to luteal
   * and the calendar draws nothing for it.
   *
   * That is why the calendar used to mark one predicted day and stop. It was
   * not showing an absence of prediction: it was showing one October cycle
   * extended into late luteal forever, and the predicted start was a single
   * boolean sitting on top of it that the cycle-day count knew nothing about.
   *
   * So the span is computed here from the start and the setting, not read off
   * `cycleDay`. Anybody tempted to derive a future phase from `cycleDay`
   * should know that it never comes back round.
   *
   * ## Measured forward from the start, never materialised as an end date
   *
   * `addDays(start, periodLength - 1)` reads better and throws: a predicted
   * start in the last days of year 9999 walks off the supported range and
   * `formatLocalDate` refuses it. Counting the offset from the start instead
   * cannot overflow, because every date compared against it is a real day of
   * the month being built.
   */
  const predictedPeriodLength = profile.settings.averagePeriodLengthDays;

  const dayCount = getDaysInMonth(year, month);
  const days: CycleCalendarDay[] = [];

  for (let dayOfMonth = 1; dayOfMonth <= dayCount; dayOfMonth += 1) {
    const date = formatLocalDate(year, month, dayOfMonth);

    // Once per day, not three times. The phase and the fertility level are both
    // functions of the cycle day, and the date-shaped versions of them each
    // worked that day out again from the record list - the fertility one twice
    // more inside itself. A month cost thirty-one dates times five walks of
    // every period ever recorded, which is unnoticeable with a handful of them
    // and the slowest thing on the screen with five years of them.
    const cycleDay = getCycleDay(profile, date);

    days.push({
      date,
      cycleDay,
      phase: cycleDay === null ? null : resolveCyclePhase(profile.settings, cycleDay),
      fertilityLevel:
        cycleDay === null ? null : resolveFertilityLevel(profile.settings, cycleDay),
      isPredictedPeriodStart: predictedPeriodStart !== null && predictedPeriodStart === date,
      // Inclusive at both ends: the first day of the predicted period is one
      // of its days as well as its start.
      isPredictedPeriodDay:
        predictedPeriodStart !== null &&
        daysBetween(predictedPeriodStart, date) >= 0 &&
        daysBetween(predictedPeriodStart, date) <= predictedPeriodLength - 1,
    });
  }

  return { year, month, days };
}
