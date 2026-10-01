import type { CycleLengthObservations } from './observed-cycle-lengths';
import { latestRecordedPeriodStart, predictNextPeriodStart } from './predictions';
import type { CycleProfile } from './types';

import type { ISODate } from '@/types/iso-date';
import { addDays } from '@/utils/date';

/**
 * When the next period might start, when one day would overstate the case.
 *
 * `expected` is not a third opinion. It is exactly what
 * `predictNextPeriodStart` returns, carried here so a screen showing the range
 * and a calendar marking the day cannot be reading two different numbers.
 */
export type PredictedPeriodRange = {
  readonly earliest: ISODate;
  readonly expected: ISODate;
  readonly latest: ISODate;
};

/**
 * Widens the single prediction into a range the recorded cycles support.
 *
 * Pure. `null` when there is no recorded start to count from, or when the
 * records say nothing about length - in both cases there is no range to draw
 * and the caller should keep showing whatever it shows today.
 *
 * ## The setting is always inside the range, by construction
 *
 * The offsets are taken as `min(setting, shortest)` and `max(setting, longest)`
 * - widened to include the setting, never clamped to the observations. That one
 * choice is what makes it safe to ship the range alongside the suggestion:
 *
 *   - The calendar marks `predictNextPeriodStart`, which counts from the
 *     setting.
 *   - The reminder is queued from the same day.
 *   - The widget shows the same day.
 *
 * If the range were built from the observations alone, all three could fall
 * outside the range the home screen is showing, and the person would be looking
 * at a marked day sitting outside its own prediction. Widening costs a day or
 * two of width and removes that possibility entirely.
 *
 * ## Why integer offsets rather than comparing dates
 *
 * `@/utils/date` has no minimum or maximum helper and does not need one. Cycle
 * lengths are counts of days; `Math.min` on two integers is exact, needs no
 * calendar reasoning, and `addDays` is applied once at the end.
 */
export function predictNextPeriodRange(
  profile: CycleProfile,
  observations: CycleLengthObservations
): PredictedPeriodRange | null {
  const latestStart = latestRecordedPeriodStart(profile);

  if (latestStart === null) {
    return null;
  }

  const { shortestDays, longestDays } = observations;

  if (shortestDays === null || longestDays === null) {
    return null;
  }

  const expected = predictNextPeriodStart(profile);

  if (expected === null) {
    return null;
  }

  const settingDays = profile.settings.averageCycleLengthDays;

  return {
    earliest: addDays(latestStart, Math.min(settingDays, shortestDays)),
    expected,
    latest: addDays(latestStart, Math.max(settingDays, longestDays)),
  };
}
