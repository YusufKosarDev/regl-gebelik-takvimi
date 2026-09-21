import type { SQLiteDatabase } from 'expo-sqlite';

import type { NotificationPreferences } from '../domain/notification-preferences';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  validateNotificationPreferences,
} from '../domain/notification-preferences';
import { describeValue } from '@/shared/logging';
import { notifyLocalDataChanged } from '@/shared/data-change/local-data-change';

/**
 * Persistence for `NotificationPreferences`.
 *
 * The only notification layer that knows SQL. It speaks domain types on both
 * sides and never lets a row shape escape upwards — including SQLite's integers,
 * which would otherwise arrive as a `1` that is truthy everywhere and a boolean
 * nowhere.
 *
 * Every value crossing into SQL goes through parameter binding; no stored value
 * is ever interpolated into a statement string.
 */

/** `notification_preferences` holds a single row, pinned by a CHECK constraint. */
const PREFERENCES_ROW_ID = 1;

type PreferencesRow = {
  readonly period_reminder_enabled: unknown;
  readonly pregnancy_weekly_reminder_enabled: unknown;
};

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
