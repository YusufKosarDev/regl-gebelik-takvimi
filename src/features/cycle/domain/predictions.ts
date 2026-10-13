import type { CycleProfile } from './types';
import { validateCycleProfile } from './validation';

import type { ISODate } from '@/types/iso-date';
import { addDays, daysBetween } from '@/utils/date';

/**
 * The most recent recorded period start, or `null` with nothing on record.
 *
 * Lifted out of `predictNextPeriodStart` unchanged. Three other things now need
 * the same anchor - the predicted range, the staleness check and anything that
 * asks how long it has been since the last period - and a second scan written
 * somewhere else is how two parts of the app end up disagreeing about which
 * record is the latest.
 *
 * Scans rather than sorts: the records belong to the caller and nothing here
 * may reorder them. Ties cannot happen, because `validateCycleProfile` refuses
 * two records with the same start date.
 */
export function latestRecordedPeriodStart(profile: CycleProfile): ISODate | null {
  validateCycleProfile(profile);

  let latestStart: ISODate | null = null;

  for (const record of profile.periodRecords) {
    if (latestStart === null || daysBetween(latestStart, record.startDate) > 0) {
      latestStart = record.startDate;
    }
  }

  return latestStart;
}

/**
 * Predicts the next period start date from the most recent recorded period and
 * the average cycle length.
 *
 * Pure: the profile is read, never sorted or mutated, and nothing here reads the
 * clock or touches a `Date`. The same profile always yields the same answer.
 *
 * Returns `null` when there is no period on record to count forward from.
 *
 * ## It counts from the setting, not from what the records show
 *
 * That is deliberate and it stays that way. `observeCycleLengths` can say the
 * recorded cycles average something else, and the app offers that as a
 * suggestion - but until the person accepts it, the number they entered is the
 * number they are owed. This function is the single predicted day the calendar
 * marks and the reminder is queued from, and both have to agree with the
 * setting the person can see in front of them.
 *
 * ## Two consumers, not three
 *
 * This said "the calendar marks, the reminder is queued from and the widget
 * shows". The widget does not show it: `WidgetSnapshotV1` carries `cycleDay`
 * and `phase` and no predicted date, and `buildWidgetSnapshotV1` copies only
 * those from the dashboard. The spirit survived - the widget's cycle day is
 * counted from the same setting - but the claim named a consumer that does not
 * consume this, and a documented decision resting on a member that does not
 * exist is one that gets overturned later for the wrong reason.
 *
 * ## What the single day does not decide
 *
 * It is the first day of the predicted period, not the whole of it. The
 * calendar draws the days after it from this one plus
 * `averagePeriodLengthDays`, which is arithmetic rather than a second
 * prediction - see `build-cycle-calendar-month.ts`, which also has the note on
 * why those days cannot be read off `cycleDay`.
 */
export function predictNextPeriodStart(profile: CycleProfile): ISODate | null {
  const latestStart = latestRecordedPeriodStart(profile);

  if (latestStart === null) {
    return null;
  }

  return addDays(latestStart, profile.settings.averageCycleLengthDays);
}

/**
 * A predicate for "is this date past the last day of the predicted period",
 * built once for a profile.
 *
 * ## Why this is here and not in the calendar
 *
 * It was in `build-cycle-calendar-month.ts`, because the calendar is what
 * needed it first. That is also how it came to be missed: the dashboard
 * derives today's phase straight from `getCyclePhase`, so the home screen went
 * on saying "Luteal" for a day the calendar had already stopped speaking
 * about. Found by paging on a device with a clean diff and 6,973 green tests.
 *
 * The horizon belongs to the prediction, not to any one screen drawn from it.
 * Anything that turns a cycle day into a phase or a fertility level asks here
 * first, and a fourth consumer has one place to look.
 *
 * ## What it decides
 *
 * Past it the app stops inferring and keeps counting. A cycle day is
 * arithmetic from a record and stays true however far out it is asked; a phase
 * read off that count is a claim about a cycle that has not happened, because
 * `getCycleDay` never rolls over at a predicted start and `cycle-phase.ts`
 * gives the luteal window no upper bound.
 *
 * The count's usefulness does decay with distance. Measured on a device: today,
 * ten days overdue, came back as day 39 - the number somebody in that state
 * opens the app for. Paging to 18 December gave day 105, which is equally true
 * and is a counter rather than information.
 *
 * That is recorded rather than fixed. A cutoff would be a new threshold with its
 * own arbitrariness, and the days it would be wrong about are the ones somebody
 * is actually living through.
 *
 * ## No end date is materialised
 *
 * Measured forward from the predicted start, like the calendar's own span and
 * for the same reason: `addDays` on a start in the last days of year 9999
 * walks off the supported range and `formatLocalDate` refuses it.
 *
 * `false` when nothing is predicted at all - with no record there is no
 * horizon to be past, and every day is simply unknown.
 */
export function predictionHorizonFrom(
  predictedStart: ISODate | null,
  periodLengthDays: number
): (date: ISODate) => boolean {
  if (predictedStart === null) {
    return () => false;
  }

  return (date) => daysBetween(predictedStart, date) > periodLengthDays - 1;
}

/**
 * The same predicate for a caller that does not already hold the prediction.
 *
 * The calendar does hold it - it marks the predicted days from the same start -
 * so it builds the predicate with `predictionHorizonFrom` and pays for one
 * prediction rather than two. `phase-lookup-cost.test.ts` counts those scans
 * and caught the second one.
 */
export function predictionHorizonFor(profile: CycleProfile): (date: ISODate) => boolean {
  return predictionHorizonFrom(
    predictNextPeriodStart(profile),
    profile.settings.averagePeriodLengthDays
  );
}

/**
 * The same question for a caller with one date to ask about.
 *
 * A loop asks `predictionHorizonFor` once and keeps the answer.
 * `predictNextPeriodStart` validates the whole profile, so asking per day puts
 * a validation on every square - which `phase-lookup-cost.test.ts` measures and
 * refuses, and which it caught when this was first written the other way round.
 */
export function isBeyondPredictionHorizon(profile: CycleProfile, date: ISODate): boolean {
  return predictionHorizonFor(profile)(date);
}
