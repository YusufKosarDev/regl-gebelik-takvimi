import type { CycleLengthSuggestion } from '../domain/cycle-length-suggestion';
import { suggestCycleLength } from '../domain/cycle-length-suggestion';
import type { CycleRegularity } from '../domain/cycle-regularity';
import { assessCycleRegularity } from '../domain/cycle-regularity';
import type { CycleLengthObservations } from '../domain/observed-cycle-lengths';
import { observeCycleLengths } from '../domain/observed-cycle-lengths';
import type { PredictedPeriodRange } from '../domain/predicted-period-range';
import { predictNextPeriodRange } from '../domain/predicted-period-range';
import type { PredictionConfidence } from '../domain/prediction-confidence';
import { assessPredictionConfidence } from '../domain/prediction-confidence';
import type { CycleProfile } from '../domain/types';

import type { ISODate } from '@/types/iso-date';

/**
 * Everything the recorded cycles have to say, gathered once.
 *
 * ## Why this is not on `CycleDashboard`
 *
 * It would fit there, and that was the first design. `CycleDashboard` is built
 * by object literal in six existing test files, so a required field on it is a
 * compile error in six files whose assertions are protected - not an assertion
 * edit, but still six protected files touched for plumbing.
 *
 * Nothing here needs to be on the dashboard anyway. Every value is a pure,
 * synchronous function of `(profile, today)`, and the home screen already holds
 * `profile` and calls `buildCycleCalendarGridForMonth` on every render for
 * exactly that reason. So this is assembled beside the dashboard instead of
 * inside it, and nothing existing has to change shape.
 *
 * ## Why one function rather than four calls at the call site
 *
 * `observeCycleLengths` walks the records, sorts a copy and filters the gaps.
 * Three of the four answers below are derived from that one measurement, and a
 * screen calling each of them separately would do that work four times - and,
 * worse, could end up showing a median in one place that disagreed with the
 * range in another if the calls ever drifted apart. One measurement, passed in.
 */
export type CycleOutlook = {
  /** What the gaps between recorded starts measure. */
  readonly observations: CycleLengthObservations;
  /** Whether those gaps agree with each other. */
  readonly regularity: CycleRegularity;
  /** How much the app should claim about the next period. */
  readonly predictionConfidence: PredictionConfidence;
  /**
   * The range to show instead of a single day.
   *
   * Non-null only when the confidence is `'ranged'`. The underlying function
   * returns a range whenever it can build one; deciding whether it is worth
   * showing is this layer's job, so the domain stays a set of single-purpose
   * answers and the policy lives in one place.
   */
  readonly nextPeriodRange: PredictedPeriodRange | null;
  /** The records disagreeing with the stored setting by enough to mention. */
  readonly cycleLengthSuggestion: CycleLengthSuggestion | null;
};

/**
 * Reads the outlook off a profile and a date.
 *
 * Pure and synchronous: no database, no clock. `today` arrives as an argument
 * like everywhere else in this layer, so the same profile on the same day
 * always gives the same answer.
 */
export function buildCycleOutlook(profile: CycleProfile, today: ISODate): CycleOutlook {
  const observations = observeCycleLengths(profile);
  const regularity = assessCycleRegularity(observations);
  const predictionConfidence = assessPredictionConfidence(profile, observations, today);

  return {
    observations,
    regularity,
    predictionConfidence,
    nextPeriodRange:
      predictionConfidence === 'ranged' ? predictNextPeriodRange(profile, observations) : null,
    cycleLengthSuggestion: suggestCycleLength(profile, observations),
  };
}
