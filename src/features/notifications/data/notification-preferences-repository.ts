import type { SQLiteDatabase } from 'expo-sqlite';

import {
  DEFAULT_DISCREET_NOTIFICATIONS,
  validateDiscreetNotifications,
} from '../domain/discreet-notifications';
import type { NotificationPreferences } from '../domain/notification-preferences';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  validateNotificationPreferences,
} from '../domain/notification-preferences';
import { describeValue } from '@/shared/logging';
import { notifyLocalDataChanged } from '@/shared/data-change/local-data-change';

/**
 * Persistence for the `notification_preferences` row.
 *
 * The only notification layer that knows SQL. It speaks domain types on both
 * sides and never lets a row shape escape upwards — including SQLite's integers,
 * which would otherwise arrive as a `1` that is truthy everywhere and a boolean
 * nowhere.
 *
 * Every value crossing into SQL goes through parameter binding; no stored value
 * is ever interpolated into a statement string.
 *
 * ## One row, two audiences
 *
 * The row holds the two reminder switches, which cloud sync carries, and
 * `discreet_notifications`, which stays on this device — see
 * `domain/discreet-notifications.ts` for why.
 *
 * They are kept apart by never naming each other's columns. The preferences
 * statements list their two columns and no more, so a restore from an account
 * cannot reach the discreet column even though it writes the same row; the
 * discreet statements do the same in the other direction. Column lists are the
 * whole mechanism, which is why they are spelled out rather than `SELECT *`.
 */

/** `notification_preferences` holds a single row, pinned by a CHECK constraint. */
const PREFERENCES_ROW_ID = 1;

type PreferencesRow = {
  readonly period_reminder_enabled: unknown;
  readonly pregnancy_weekly_reminder_enabled: unknown;
};

type DiscreetRow = {
  readonly discreet_notifications: unknown;
};

/**
 * The two synced switches, and only those.
 *
 * The insert omits `discreet_notifications` so it takes the column default, and
 * the update omits it so an incoming sync leaves this phone's answer where it
 * was. A person restoring on a new phone has not said anything about that
 * phone's lock screen.
 */
const UPSERT_PREFERENCES = `
  INSERT INTO notification_preferences (
    id,
    period_reminder_enabled,
    pregnancy_weekly_reminder_enabled
  )
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    period_reminder_enabled = excluded.period_reminder_enabled,
    pregnancy_weekly_reminder_enabled = excluded.pregnancy_weekly_reminder_enabled
`;

const SELECT_PREFERENCES = `
  SELECT period_reminder_enabled, pregnancy_weekly_reminder_enabled
  FROM notification_preferences
  WHERE id = ?
`;

/** The mirror image: the one device column, and neither of the synced ones. */
const UPSERT_DISCREET = `
  INSERT INTO notification_preferences (id, discreet_notifications)
  VALUES (?, ?)
  ON CONFLICT(id) DO UPDATE SET
    discreet_notifications = excluded.discreet_notifications
`;

const SELECT_DISCREET = `
  SELECT discreet_notifications
  FROM notification_preferences
  WHERE id = ?
`;

/**
 * The column stores 0 or 1, and nothing else means anything.
 *
 * The database has a CHECK for the same thing, but a row can predate a
 * constraint or arrive from a restored file. A 2 here would be read as "on" by
 * anything that only tested truthiness, so it raises instead.
 */
function toStoredFlag(column: string, value: unknown): boolean {
  if (value === 0 || value === 1) {
    return value === 1;
  }

  throw new Error(
    `Stored notification preferences have an invalid ${column}: ${describeValue(value)}. ` +
      'Expected 0 or 1.'
  );
}

/**
 * Writes the preferences.
 *
 * Validated before anything is bound, so a value the domain would refuse never
 * reaches the database.
 *
 * A single upsert on the pinned row: there is one set of these, so saving
 * replaces it rather than adding to a list.
 */
export async function saveNotificationPreferences(
  db: SQLiteDatabase,
  preferences: NotificationPreferences
): Promise<void> {
  validateNotificationPreferences(preferences);

  await db.runAsync(
    UPSERT_PREFERENCES,
    PREFERENCES_ROW_ID,
    preferences.periodReminderEnabled ? 1 : 0,
    preferences.pregnancyWeeklyReminderEnabled ? 1 : 0
  );

  notifyLocalDataChanged();
}

/**
 * Reads the stored preferences, or the defaults when nothing has been saved.
 *
 * Defaults rather than `null`, because there is no difference worth telling
 * apart: someone who has never opened the notification settings wants exactly
 * what someone who turned everything off wants, and a caller forced to handle
 * `null` would have to invent the same answer.
 *
 * A corrupt row raises rather than being repaired or replaced with the defaults.
 * Quietly switching a reminder off would look identical to the person switching
 * it off themselves, and quietly switching one on is worse.
 */
export async function loadNotificationPreferences(
  db: SQLiteDatabase
): Promise<NotificationPreferences> {
  const row = await db.getFirstAsync<PreferencesRow>(SELECT_PREFERENCES, PREFERENCES_ROW_ID);

  if (!row) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  const preferences: NotificationPreferences = {
    periodReminderEnabled: toStoredFlag(
      'period_reminder_enabled',
      row.period_reminder_enabled
    ),
    pregnancyWeeklyReminderEnabled: toStoredFlag(
      'pregnancy_weekly_reminder_enabled',
      row.pregnancy_weekly_reminder_enabled
    ),
  };

  validateNotificationPreferences(preferences);

  return preferences;
}

/**
 * Whether this phone's reminders should keep their wording to themselves.
 *
 * Defaults to off when no row has been written, for the same reason the
 * preferences do: there is no difference worth telling apart between somebody
 * who has never opened the notification settings and somebody who looked and
 * left this alone.
 *
 * A corrupt value raises rather than being read as `false`. Falling back here
 * would put the full sentence back on a lock screen belonging to somebody who
 * had asked for the opposite, which is the one failure this setting exists to
 * prevent.
 */
export async function loadDiscreetNotifications(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<DiscreetRow>(SELECT_DISCREET, PREFERENCES_ROW_ID);

  if (!row) {
    return DEFAULT_DISCREET_NOTIFICATIONS;
  }

  const enabled = toStoredFlag('discreet_notifications', row.discreet_notifications);

  validateDiscreetNotifications(enabled);

  return enabled;
}

/**
 * Writes it, touching neither reminder switch.
 *
 * `notifyLocalDataChanged` is deliberately not called. That signal is what tells
 * the sync machinery this phone has something the account has not seen, and this
 * column never leaves the phone: raising it here would schedule an upload of a
 * payload that is byte for byte what the account already holds.
 */
export async function saveDiscreetNotifications(
  db: SQLiteDatabase,
  enabled: boolean
): Promise<void> {
  validateDiscreetNotifications(enabled);

  await db.runAsync(UPSERT_DISCREET, PREFERENCES_ROW_ID, enabled ? 1 : 0);
}
