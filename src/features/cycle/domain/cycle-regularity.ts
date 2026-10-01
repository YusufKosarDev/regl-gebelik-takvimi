import { MIN_OBSERVATIONS, type CycleLengthObservations } from './observed-cycle-lengths';

/**
 * How much the recorded cycles may vary before a single predicted day stops
 * being an honest thing to show.
 *
 * Seven days, because that is roughly where the medical literature puts the
 * line between normal variation and a cycle worth calling irregular, and
 * because below it a single date is still the most useful thing to say. The
 * number is a display decision, not a diagnosis: nothing here tells anybody
 * their cycle is abnormal, it only decides whether to show one day or a range.
 */
export const IRREGULAR_SPREAD_DAYS = 7;

/**
 * How much the recorded cycles agree with each other.
 *
 * `'unknown'` is its own answer and not a synonym for `'regular'`. Somebody
 * with two recorded periods has not been observed to be regular; they have not
 * been observed at all, and showing them a confident single date would be
 * claiming otherwise.
 */
export type CycleRegularity = 'unknown' | 'regular' | 'irregular';

/**
 * Reads regularity off the observations.
 *
 * Pure and trivially so, which is the point: the threshold lives in one place
 * and the decision it feeds is made somewhere else. Spread rather than standard
 * deviation because spread is what the person is shown - "between 26 and 34
 * days" is a sentence; a standard deviation is not.
 */
export function assessCycleRegularity(
  observations: CycleLengthObservations
): CycleRegularity {
  if (observations.lengths.length < MIN_OBSERVATIONS || observations.spreadDays === null) {
    return 'unknown';
  }

  return observations.spreadDays >= IRREGULAR_SPREAD_DAYS ? 'irregular' : 'regular';
}
