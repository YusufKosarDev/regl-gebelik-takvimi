import { MAX_CYCLE_LENGTH_DAYS, MIN_CYCLE_LENGTH_DAYS } from './limits';
import type { CycleProfile } from './types';
import { validateCycleProfile } from './validation';

import { daysBetween } from '@/utils/date';

/**
 * How many of the most recent gaps are counted.
 *
 * Cycle length drifts - with age, after a pregnancy, with a change in
 * contraception. A gap from three years ago is a fact about the person's past,
 * not evidence about what their next cycle will be, and averaging it in makes
 * the answer slower to follow a real change.
 */
export const OBSERVATION_WINDOW = 12;

/**
 * How many gaps before the observations are worth acting on.
 *
 * Two gaps give a median that is just the mean of two numbers. Three is the
 * smallest count where the middle value is a choice between observations rather
 * than an average of all of them.
 */
export const MIN_OBSERVATIONS = 3;

/**
 * What the recorded periods say about cycle length.
 *
 * `null` everywhere there is nothing to say, rather than a zero or a default:
 * "no observations" and "an observed length of zero" are different facts and
 * the difference matters to everything downstream.
 */
export type CycleLengthObservations = {
  /** The counted gaps, ascending. Empty with fewer than two usable starts. */
  readonly lengths: readonly number[];
  readonly medianDays: number | null;
  readonly shortestDays: number | null;
  readonly longestDays: number | null;
  /** `longest - shortest`, or `null` with fewer than two observations. */
  readonly spreadDays: number | null;
  /** Gaps discarded as implausible, so a caller can state the count honestly. */
  readonly discardedCount: number;
};

const EMPTY: CycleLengthObservations = {
  lengths: [],
  medianDays: null,
  shortestDays: null,
  longestDays: null,
  spreadDays: null,
  discardedCount: 0,
};

/**
 * Measures the gaps between consecutive recorded period starts.
 *
 * Pure: the profile is read, a copy is sorted, nothing reads the clock. The
 * same profile always yields the same answer.
 *
 * ## Implausible gaps are discarded, and that is load-bearing
 *
 * Somebody who stops logging for four months and starts again leaves a 120-day
 * gap between two starts. That is not a 120-day cycle, it is a hole in the
 * record. Without the filter it becomes the median, the app offers "update your
 * setting to 120 days?", and `validateCycleProfile` then refuses the write
 * because the setting must be within `[15, 90]` - a suggestion the person
 * physically cannot accept.
 *
 * So gaps outside the same bounds the settings are held to are dropped, and the
 * bounds are imported from `limits.ts` rather than restated. That makes
 * accepting a suggestion safe by construction: anything this function can
 * report is something `validateCycleSettings` will take.
 *
 * `discardedCount` is kept because the difference between "your last 5 cycles"
 * and "5 of your 9 recorded gaps" is the difference between a true sentence and
 * a misleading one.
 *
 * ## Why the lower median rather than the mean of the two middle values
 *
 * The stored setting is an integer. The mean of two middle values can be a
 * half, which would need a rounding rule, which is a second rule to get wrong
 * and a second place for the suggestion to drift from what gets written. The
 * lower median is an integer by construction and still does what a median is
 * for - one unusually long cycle moves it by at most one position.
 */
export function observeCycleLengths(profile: CycleProfile): CycleLengthObservations {
  validateCycleProfile(profile);

  if (profile.periodRecords.length < 2) {
    return EMPTY;
  }

  // Copied before sorting: these records belong to the rest of the app, and
  // `get-period-history.ts` takes the same care for the same reason.
  //
  // Note the argument order. `daysBetween(start, end)` is `end - start`, so
  // `daysBetween(a, b)` as a comparator sorts newest first - which is exactly
  // what `get-period-history.ts` wants and the opposite of what this needs.
  // Oldest first here, so that each gap is a step forwards in time and comes
  // out positive.
  const starts = [...profile.periodRecords]
    .sort((a, b) => daysBetween(b.startDate, a.startDate))
    .map((record) => record.startDate);

  const plausible: number[] = [];
  let discardedCount = 0;

  for (let index = 1; index < starts.length; index += 1) {
    const gap = daysBetween(starts[index - 1], starts[index]);

    if (gap < MIN_CYCLE_LENGTH_DAYS || gap > MAX_CYCLE_LENGTH_DAYS) {
      discardedCount += 1;
      continue;
    }

    plausible.push(gap);
  }

  // The window is taken from the end, because the records are in date order and
  // the most recent gaps are the ones that describe now.
  const counted = plausible.slice(-OBSERVATION_WINDOW);

  if (counted.length === 0) {
    return { ...EMPTY, discardedCount };
  }

  const ascending = [...counted].sort((a, b) => a - b);

  return {
    lengths: ascending,
    medianDays: ascending[(ascending.length - 1) >> 1],
    shortestDays: ascending[0],
    longestDays: ascending[ascending.length - 1],
    spreadDays: ascending.length < 2 ? null : ascending[ascending.length - 1] - ascending[0],
    discardedCount,
  };
}
