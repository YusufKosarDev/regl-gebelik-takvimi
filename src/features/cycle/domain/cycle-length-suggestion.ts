import { MAX_CYCLE_LENGTH_DAYS, MIN_CYCLE_LENGTH_DAYS } from './limits';
import { MIN_OBSERVATIONS, type CycleLengthObservations } from './observed-cycle-lengths';
import type { CycleProfile } from './types';

/**
 * How far the records must be from the setting before it is worth mentioning.
 *
 * One day is inside the noise of when somebody notices a period started and
 * gets round to recording it. Offering to change a setting over it would train
 * the person to dismiss the card, and a card that is always dismissed is worse
 * than no card - it costs the attention that the useful version would need.
 */
export const MIN_SUGGESTION_DIFFERENCE_DAYS = 2;

/**
 * The records and the setting disagreeing by enough to say so.
 *
 * Both numbers are carried, not just the new one. The person is being asked to
 * change something they typed, and the only honest way to ask is to show what
 * they typed next to what the app saw.
 */
export type CycleLengthSuggestion = {
  readonly observedMedianDays: number;
  readonly settingDays: number;
  /** Signed: observed minus setting. Negative means the records are shorter. */
  readonly differenceDays: number;
  /** How many gaps the median came from, so the claim can be sized honestly. */
  readonly observationCount: number;
};

/**
 * Whether the recorded cycles are worth offering as a new setting.
 *
 * Pure, and takes the observations rather than recomputing them: everything
 * that needs them in a given render gets them from one call, so two parts of a
 * screen cannot show two different medians.
 *
 * ## It only suggests
 *
 * Nothing here writes. The setting stays exactly what the person entered until
 * they press the button, and `predictNextPeriodStart` keeps counting from it in
 * the meantime. This app does not change a number somebody typed on the
 * strength of its own arithmetic, and a suggestion that quietly applied itself
 * would be doing that.
 *
 * ## Every suggestion it makes can actually be accepted
 *
 * `observeCycleLengths` has already dropped any gap outside the bounds a
 * setting may hold, so a median built from what survives is always writable.
 * The assertion below states that rather than trusting it: if the filter were
 * ever loosened, this would start returning `null` instead of offering a number
 * that `validateCycleSettings` would refuse - a dead end the person could not
 * get out of.
 */
export function suggestCycleLength(
  profile: CycleProfile,
  observations: CycleLengthObservations
): CycleLengthSuggestion | null {
  const { medianDays, lengths } = observations;

  if (medianDays === null || lengths.length < MIN_OBSERVATIONS) {
    return null;
  }

  if (medianDays < MIN_CYCLE_LENGTH_DAYS || medianDays > MAX_CYCLE_LENGTH_DAYS) {
    return null;
  }

  const settingDays = profile.settings.averageCycleLengthDays;
  const differenceDays = medianDays - settingDays;

  if (Math.abs(differenceDays) < MIN_SUGGESTION_DIFFERENCE_DAYS) {
    return null;
  }

  return {
    observedMedianDays: medianDays,
    settingDays,
    differenceDays,
    observationCount: lengths.length,
  };
}
