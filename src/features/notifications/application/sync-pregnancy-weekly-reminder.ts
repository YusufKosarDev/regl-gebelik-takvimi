import type { SQLiteDatabase } from 'expo-sqlite';

import { loadNotificationPreferences } from '../data/notification-preferences-repository';
import { getNotificationPermissionStatus } from '../infrastructure/notification-permission';
import {
  cancelPregnancyWeeklyReminders,
  schedulePregnancyWeeklyReminder,
} from '../infrastructure/pregnancy-weekly-reminder-scheduler';

import { loadPregnancyProfile } from '@/features/pregnancy/data/pregnancy-repository';

/**
 * What the queue holds afterwards.
 *
 * `scheduled` says whether a weekly reminder is now in place. It is `false` for
 * the reminder being off, for permission having been taken away, and for there
 * being no pregnancy to be reminded about.
 */
export type PregnancyWeeklyReminderSyncResult = {
  readonly scheduled: boolean;
  readonly cancelled: number;
};

/**
 * Brings the queued weekly pregnancy reminder in line with the database.
 *
 * Rebuilt rather than patched: everything of this type is cancelled and at most
 * one is scheduled again. The queue is not something this app owns — the system
 * can empty it and a restore can refill it — so the only reliable way to end up
 * with exactly one is to stop counting on what was there before.
 *
 * Only this app's weekly pregnancy reminders are touched. Period reminders are
 * a different type and survive every path through this function, including the
 * ones that cancel.
 *
 * No date is taken. Unlike the period reminder there is nothing to be early
 * about: the trigger is a weekday and a time, and which Monday it lands on is
 * the system's to work out.
 *
 * A pregnancy that has been stopped takes the reminder with it. Continuing to
 * nudge someone weekly about a pregnancy they have told the app about the end of
 * would be the worst thing this feature could do.
 */
export async function syncPregnancyWeeklyReminder(
  db: SQLiteDatabase
): Promise<PregnancyWeeklyReminderSyncResult> {
  const preferences = await loadNotificationPreferences(db);

  if (!preferences.pregnancyWeeklyReminderEnabled) {
    return { scheduled: false, cancelled: await cancelPregnancyWeeklyReminders() };
  }

  // Permission can be taken away in system settings after a reminder was turned
  // on, and queueing into something the system will not deliver from leaves
  // someone waiting for a nudge that cannot arrive.
  if ((await getNotificationPermissionStatus()) !== 'granted') {
    return { scheduled: false, cancelled: await cancelPregnancyWeeklyReminders() };
  }

  const pregnancy = await loadPregnancyProfile(db);
  const cancelled = await cancelPregnancyWeeklyReminders();

  if (pregnancy === null) {
    return { scheduled: false, cancelled };
  }

  await schedulePregnancyWeeklyReminder();

  return { scheduled: true, cancelled };
}

/**
 * The same sync, for callers whose own work must not fail because of it.
 *
 * Starting or stopping a pregnancy is what the person asked for and it is
 * already durable by the time this runs; refusing it because a notification
 * could not be queued would throw away real data over a reminder about it.
 */
export async function syncPregnancyWeeklyReminderQuietly(
  db: SQLiteDatabase
): Promise<PregnancyWeeklyReminderSyncResult | null> {
  try {
    return await syncPregnancyWeeklyReminder(db);
  } catch (error) {
    if (__DEV__) {
      console.error('[notifications] could not sync the pregnancy weekly reminder', error);
    }

    return null;
  }
}
