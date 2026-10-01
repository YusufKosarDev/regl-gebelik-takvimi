import { MAX_CYCLE_LENGTH_DAYS } from './limits';
import { assessCycleRegularity } from './cycle-regularity';
import type { CycleLengthObservations } from './observed-cycle-lengths';
import { latestRecordedPeriodStart } from './predictions';
import type { CycleProfile } from './types';

import type { ISODate } from '@/types/iso-date';
import { daysBetween } from '@/utils/date';

/**
 * How long a prediction survives with nothing new recorded.
 *
 * One longest-possible cycle. Past that, the next period was due and either did
 * not come or was not recorded, and in both cases counting forward from the old
 * start produces a date in the past or a date based on nothing.
 */
export const STALE_PREDICTION_DAYS = MAX_CYCLE_LENGTH_DAYS;

/**
 * How much the app should claim about the next period.
 *
 * - `'none'` - nothing recorded to count from.
 * - `'stale'` - the last record is too old for the arithmetic to mean anything.
 * - `'ranged'` - the recorded cycles vary enough that a range is honest and a
 *   single day is not.
 * - `'single'` - one date is a fair thing to show.
 */
export type PredictionConfidence = 'none' | 'stale' | 'ranged' | 'single';

/**
 * Decides how much to claim, from the records and the date.
 *
 * ## Staleness is not a pregnancy feature
 *
 * The obvious place for this is the pregnancy slice: after a birth the old
 * period records are still there, and `predictNextPeriodStart` will cheerfully
 * report a date nine months in the past. But that is one instance of a general
 * problem, and the general problem is simply "the last record is old". Somebody
 * who stopped logging for three months, somebody who changed contraception,
 * somebody who came back to the app after a year - all of them get a prediction
 * built from a start date that no longer describes anything.
 *
 * So the rule lives here, in cycle, and is about the records rather than about
 * why they stopped. A pregnancy-specific suppression would have been a special
 * case for a problem that is not special, and would have left the other three
 * people looking at a date from last spring.
 *
 * `today` is a parameter, like everywhere else in this layer: the rule stays
 * deterministic and the clock is read in one place.
 */
export function assessPredictionConfidence(
  profile: CycleProfile,
  observations: CycleLengthObservations,
  today: ISODate
): PredictionConfidence {
  const latestStart = latestRecordedPeriodStart(profile);

  if (latestStart === null) {
    return 'none';
  }

  if (daysBetween(latestStart, today) > STALE_PREDICTION_DAYS) {
    return 'stale';
  }

  return assessCycleRegularity(observations) === 'irregular' ? 'ranged' : 'single';
}
