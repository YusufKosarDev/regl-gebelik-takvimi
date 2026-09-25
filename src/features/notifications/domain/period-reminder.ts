import type { ISODate } from '@/types/iso-date';
import { addDays } from '@/utils/date';

/**
 * The one reminder this app sends about a period.
 *
 * Everything here is a fact about the reminder rather than about a person: what
 * it says, when it lands relative to the estimate, and how it is recognised
 * again later. No clock is read and no `Date` is constructed — the calendar date
 * is worked out here and turned into a moment at the scheduling boundary, which
 * is the only place that needs one.
 */

/**
 * Stamped on every reminder this app schedules, and how they are found again.
 *
 * Carrying the version means a later change to what a reminder says or when it
 * lands can be a new type beside this one, leaving anything already sitting in
 * the queue recognisable as the old thing rather than silently re-read as the
 * new one.
 *
 * It is also how cancelling stays surgical: everything with this type goes,
 * everything without it is somebody else's and is left alone.
 */
export const PERIOD_REMINDER_TYPE = 'period-reminder-v1';

/**
 * The Android channel these are delivered on.
 *
 * The id is identity and lives here; what the channel is *called* is Turkish
 * somebody reads in Android's own settings, and lives with the rest of the
 * wording in `presentation/reminder-messages.ts`.
 */
export const PERIOD_REMINDER_CHANNEL_ID = 'period-reminders';

/**
 * A day before the estimate, at nine in the morning.
 *
 * The day before rather than the day of, because the point is to be told while
 * there is still time to do something about it. Nine because it is a reminder,
 * not news: it should arrive during a morning rather than wake anyone.
 */
export const PERIOD_REMINDER_DAYS_BEFORE = 1;
export const PERIOD_REMINDER_HOUR = 9;

/** The payload, which is what makes a queued reminder recognisable. */
export function periodReminderData(): { readonly type: string } {
  return { type: PERIOD_REMINDER_TYPE };
}

/**
 * Whether a queued notification is one of these.
 *
 * Checked on the `type` in the payload rather than on the words, because the
 * words are wording and a translation of them would quietly orphan every
 * reminder already scheduled.
 */
export function isPeriodReminderData(data: unknown): boolean {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }

  return (data as { type?: unknown }).type === PERIOD_REMINDER_TYPE;
}

/**
 * The day a reminder for this estimate belongs on, or `null` when there is none.
 *
 * `null` in, `null` out: without a predicted start there is nothing to be early
 * about, and picking a day anyway would be inventing a date the app does not
 * have.
 *
 * Pure: the date is read, no clock is touched.
 */
export function periodReminderDate(nextPeriodStart: ISODate | null): ISODate | null {
  if (nextPeriodStart === null) {
    return null;
  }

  return addDays(nextPeriodStart, -PERIOD_REMINDER_DAYS_BEFORE);
}
