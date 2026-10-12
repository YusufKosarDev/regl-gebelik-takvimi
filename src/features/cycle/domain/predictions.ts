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
