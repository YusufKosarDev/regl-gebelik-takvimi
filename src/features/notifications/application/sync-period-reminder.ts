import type { SQLiteDatabase } from 'expo-sqlite';

import { loadNotificationPreferences } from '../data/notification-preferences-repository';
import { periodReminderDate } from '../domain/period-reminder';
import { getNotificationPermissionStatus } from '../infrastructure/notification-permission';
import {
  cancelPeriodReminders,
  schedulePeriodReminder,
} from '../infrastructure/period-reminder-scheduler';

import { getCycleDashboard } from '@/features/cycle/application/get-cycle-dashboard';
import type { ISODate } from '@/types/iso-date';
import { logEvent } from '@/shared/logging';

/**
 * What the queue holds afterwards.
 *
 * `scheduled` is the date a reminder now sits on, or `null` when there is none —
 * which covers the reminder being off, there being no prediction to be early
 * about, and the moment having already passed.
 */
export type PeriodReminderSyncResult = {
  readonly scheduled: ISODate | null;
  readonly cancelled: number;
};

/**
 * Brings the queued period reminder in line with the database.
 *
 * Rebuilt rather than patched: everything of this type is cancelled and at most
 * one is scheduled again. A queue is not something this app owns — the system
 * can empty it, a restore can refill it, and another build may have left
 * something behind — so the only reliable way to end up with exactly one is to
 * stop counting on what was there before.
 *
 * Only this app's period reminders are touched. They are found by the type in
 * their payload, so a pregnancy reminder or anything else scheduled later is
 * neither cancelled nor counted.
 *
 * Nothing is recalculated: the predicted start comes back from
 * `getCycleDashboard`, which is the one place that decides it, so a reminder and
 * the screen cannot end up disagreeing about when a period is expected.
 *
 * Permission is checked as well as the preference. A preference can only be
 * turned on with permission, but permission can be taken away afterwards in
 * system settings, and scheduling into a queue the system will not deliver from
 * would leave someone waiting for a reminder that cannot arrive.
 */
export async function syncPeriodReminder(
  db: SQLiteDatabase,
  today: ISODate
): Promise<PeriodReminderSyncResult> {
  const preferences = await loadNotificationPreferences(db);

  if (!preferences.periodReminderEnabled) {
    return { scheduled: null, cancelled: await cancelPeriodReminders() };
  }

  if ((await getNotificationPermissionStatus()) !== 'granted') {
    return { scheduled: null, cancelled: await cancelPeriodReminders() };
  }

  const dashboard = await getCycleDashboard(db, today);
  const reminderDate = periodReminderDate(dashboard?.nextPeriodStart ?? null);

  const cancelled = await cancelPeriodReminders();

  if (reminderDate === null) {
    return { scheduled: null, cancelled };
  }

  // `null` back means the moment has already gone. Nothing is scheduled and no
  // hour is invented to replace it; the next cycle change looks again.
  const identifier = await schedulePeriodReminder(reminderDate);

  return { scheduled: identifier === null ? null : reminderDate, cancelled };
}

/**
 * The same sync, for callers whose own work must not fail because of it.
 *
 * Every screen that changes something the reminder is derived from calls this
 * after its write has already succeeded. The write is what the person asked for
 * and it is already durable; refusing it because a notification could not be
 * queued would throw away real data over a reminder about it.
 */
export async function syncPeriodReminderQuietly(
  db: SQLiteDatabase,
  today: ISODate
): Promise<PeriodReminderSyncResult | null> {
  try {
    return await syncPeriodReminder(db, today);
  } catch (error) {
    logEvent('notification sync failed', error);

    return null;
  }
}
