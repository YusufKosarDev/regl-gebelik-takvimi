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
 *     setting, and draws the rest of the predicted period from it.
 *   - The reminder is queued from the same day.
 *
 * If the range were built from the observations alone, both could fall outside
 * the range the home screen is showing, and the person would be looking at a
 * marked day sitting outside its own prediction. Widening costs a day or two of
 * width and removes that possibility entirely.
 *
 * This listed the widget as a third consumer. It is not one: `WidgetSnapshotV1`
 * carries `cycleDay` and `phase` and no predicted date. The argument holds for
 * the two that are real.
 *
 * ## Why integer offsets rather than comparing dates
 *
 * `@/utils/date` has no minimum or maximum helper and does not need one. Cycle
 * lengths are counts of days; `Math.min` on two integers is exact, needs no
 * calendar reasoning, and `addDays` is applied once at the end.
 *
 * ## Why the calendar does not draw it
 *
 * A range is honest as a statement and misleading as a mark, because a mark on
 * a square is a claim about that square. The home screen says it in words,
 * under a label, where a span is a sentence; the grid would say it in shapes,
 * where a span is eight separate assertions.
 *
 * Four things measured before that was decided, on gaps of 26, 30 and 33 days
 * - spread 7, so `irregular`, so `ranged` - with the last start on 29 August:
 *
 *   - **The latest start falls past the horizon, by construction.** The range
 *     ran 24 September to 1 October and the predicted period ends 30
 *     September, so a square marked "it might start here" is a square that
 *     answers "tahminler bir sonraki reglinden öteye geçmiyor" when tapped.
 *     `latest` is `lastStart + max(setting, longest)` and the horizon is
 *     `expected + periodLength - 1`, so the wider the range the more of it
 *     lands past the point the app stops predicting.
 *   - **Five marked squares become twelve.** Days 2..n are arithmetic from the
 *     start, so a span of eight possible starts is a span of twelve possible
 *     period days - nearly forty per cent of a month.
 *   - **It needs a fifth mark.** "Certainly inside the predicted period" and
 *     "possibly the start" are different claims, in a marker row that already
 *     carries a phase letter and `≈`, on a square 54 points wide at every font
 *     setting.
 *   - **The legend row reaches everybody.** `cycle-calendar-legend.tsx` lists
 *     every mark the calendar can draw, always, so a fifth row would appear
 *     for every user to explain something only an irregular one ever sees.
 *
 * The marks themselves would only reach irregular users - the population the
 * range serves - so the cost is not spread the way it first looks. The legend
 * is what is spread.
 *
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
