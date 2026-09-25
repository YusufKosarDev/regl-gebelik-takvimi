/**
 * The weekly nudge about a pregnancy.
 *
 * Facts about the reminder rather than about anyone: what it says, when in the
 * week it lands, and how it is recognised again later. No clock and no `Date` —
 * a weekly trigger is described by its day and time, and the system works out
 * the moments.
 *
 * It is a pointer back into the app, not a piece of information in itself.
 * Nothing about a pregnancy is stated in a notification: what a given week
 * brings is on a screen with its sources next to it, where it can be read in
 * context rather than on a lock screen.
 */

/**
 * Stamped on every one of these, and how they are found again.
 *
 * Versioned for the same reason the period reminder's is: a later change to the
 * day, the time or the wording can be a new type beside this one, leaving
 * anything already queued recognisable as the old thing. It is also what keeps
 * cancelling surgical — everything with this type goes and nothing else does.
 */
export const PREGNANCY_WEEKLY_REMINDER_TYPE = 'pregnancy-weekly-reminder-v1';

/**
 * The Android channel these are delivered on, separate from the period one.
 *
 * Separate so that switching one off in system settings leaves the other alone:
 * somebody tracking a pregnancy may well want the weekly note and nothing else.
 *
 * The id is identity and lives here; what the channel is *called* lives with
 * the rest of the wording in `presentation/reminder-messages.ts`.
 */
export const PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID = 'pregnancy-reminders';

/**
 * Monday morning, every week.
 *
 * `weekday` follows the platform's numbering, where Sunday is 1, so Monday is 2.
 * Fixed for now and deliberately not configurable: a day and a time worth
 * choosing is worth choosing properly, and offering the setting before there is
 * anything else to tune would be a control with nothing behind it.
 */
export const PREGNANCY_WEEKLY_REMINDER_WEEKDAY = 2;
export const PREGNANCY_WEEKLY_REMINDER_HOUR = 9;
export const PREGNANCY_WEEKLY_REMINDER_MINUTE = 0;

/** The payload, which is what makes a queued reminder recognisable. */
export function pregnancyWeeklyReminderData(): { readonly type: string } {
  return { type: PREGNANCY_WEEKLY_REMINDER_TYPE };
}

/**
 * Whether a queued notification is one of these.
 *
 * Matched on the type rather than the words: the words are wording, and
 * translating them would quietly orphan everything already scheduled.
 */
export function isPregnancyWeeklyReminderData(data: unknown): boolean {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }

  return (data as { type?: unknown }).type === PREGNANCY_WEEKLY_REMINDER_TYPE;
}
