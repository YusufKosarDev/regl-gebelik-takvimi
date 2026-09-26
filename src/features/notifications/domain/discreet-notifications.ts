import { describeValue } from '@/shared/logging';

/**
 * How much a reminder is allowed to say.
 *
 * ## What this is for
 *
 * Android prints a notification's title and body on the lock screen, and an app
 * is not allowed to stop it. `lockscreenVisibility` looks like the lever for
 * exactly that, and the platform silently discards it — the measurement is
 * written out in `infrastructure/period-reminder-scheduler.ts`. So a reminder
 * saying "Tahminine göre regl dönemin yaklaşıyor" is readable by anybody near
 * the phone, and nothing this app does changes that.
 *
 * What is left is the wording, and that is the whole of this setting. On, the
 * reminders say that a reminder exists and to open the app. Off, they say what
 * they have always said.
 *
 * ## Why it is not a `NotificationPreferences` field
 *
 * `NotificationPreferences` is carried by cloud sync. This is not, and belongs
 * on the device for the same reason the app lock does: whether a lock screen is
 * read over your shoulder is a fact about the phone in your hand and the people
 * around it, not about you.
 *
 * The coupling is what makes that work rather than lose something. Setting the
 * app lock turns this on, and the app lock is itself per-device. Somebody who
 * signs in on a second phone and sets a lock there gets the quiet wording
 * there too, by the same act — while somebody who does not is not handed a
 * decision they made about a different phone, in a different house.
 *
 * It shares the `notification_preferences` row because it is an answer about
 * notifications and a second single-row table would need the same pinned id and
 * the same care for nothing. The repository keeps the two apart: what syncs is
 * read and written by column name, and this column is not in that list.
 */

/** What somebody has before they have chosen. */
export const DEFAULT_DISCREET_NOTIFICATIONS = false;

/**
 * Checks the stored answer, throwing rather than guessing.
 *
 * The same reason the reminder switches are checked: SQLite has no boolean, and
 * a `1` read straight out of a row is truthy everywhere and a boolean nowhere.
 * Here the cost of getting it wrong runs one way — a value that failed to be
 * `true` would quietly put the full sentence back on somebody's lock screen.
 */
export function validateDiscreetNotifications(value: unknown): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new Error(
      `Discreet notifications must be a boolean, received ${describeValue(value)}.`
    );
  }
}
