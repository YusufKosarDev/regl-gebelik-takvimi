import type { SQLiteDatabase } from 'expo-sqlite';

import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '../data/notification-preferences-repository';
import type { NotificationPreferences } from '../domain/notification-preferences';
import { withReminder } from '../domain/notification-preferences';
import type { NotificationPermissionStatus } from '../infrastructure/notification-permission';
import { ensureNotificationPermission } from '../infrastructure/notification-permission';

/**
 * What happened when a reminder was switched.
 *
 * `preferences` is what is now stored, which is not always what was asked for:
 * turning one on without permission leaves it off. `permission` says why, so
 * the screen can explain rather than just springing back.
 */
export type SetReminderResult = {
  readonly preferences: NotificationPreferences;
  readonly permission: NotificationPermissionStatus | null;
};

/**
 * Turns one reminder on or off.
 *
 * Switching on asks for permission first, and a refusal stops there: nothing is
 * written, and the switch stays off. A preference that says "yes" while the
 * system says "no" is a promise the app cannot keep, and someone would be left
 * waiting for a reminder that can never arrive.
 *
 * Switching off asks for nothing. There is nothing to permit, and a dialog on
 * the way out would be the app negotiating over being told to stop.
 *
 * The current preferences are read rather than passed in, so two switches
 * changed in quick succession cannot overwrite each other with a stale copy.
 *
 * Nothing is scheduled here. This is the record of what someone wants; acting
 * on it comes later.
 */
export async function setReminderEnabled(
  db: SQLiteDatabase,
  field: keyof NotificationPreferences,
  enabled: boolean
): Promise<SetReminderResult> {
  const current = await loadNotificationPreferences(db);

  if (!enabled) {
    const next = withReminder(current, field, false);

    await saveNotificationPreferences(db, next);

    return { preferences: next, permission: null };
  }

  const permission = await ensureNotificationPermission();

  if (permission !== 'granted') {
    // Deliberately no write: the stored answer stays whatever it was, which for
    // a switch being turned on is off.
    return { preferences: current, permission };
  }

  const next = withReminder(current, field, true);

  await saveNotificationPreferences(db, next);

  return { preferences: next, permission };
}
