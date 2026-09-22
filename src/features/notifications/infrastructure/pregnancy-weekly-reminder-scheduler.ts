import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  PREGNANCY_WEEKLY_REMINDER_BODY,
  PREGNANCY_WEEKLY_REMINDER_CHANNEL_DESCRIPTION,
  PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID,
  PREGNANCY_WEEKLY_REMINDER_CHANNEL_NAME,
  PREGNANCY_WEEKLY_REMINDER_HOUR,
  PREGNANCY_WEEKLY_REMINDER_MINUTE,
  PREGNANCY_WEEKLY_REMINDER_TITLE,
  PREGNANCY_WEEKLY_REMINDER_TYPE,
  PREGNANCY_WEEKLY_REMINDER_WEEKDAY,
  pregnancyWeeklyReminderData,
} from '../domain/pregnancy-weekly-reminder';

import { cancelScheduledRemindersOfType } from './scheduled-reminders';

/**
 * The scheduling side of the weekly pregnancy reminder.
 *
 * The only place in this feature that touches the notification queue. Unlike the
 * period reminder there is no moment to compute: a weekly trigger is a day and a
 * time, and the system decides which Monday. That also means there is no "this
 * has already passed" case — the next one is always ahead.
 *
 * Nothing here decides whether a reminder should exist. That is the use case's
 * question; this answers "make it so" and reports what it managed.
 */

/**
 * Creates the channel, or leaves the existing one as it is.
 *
 * Its own channel rather than the period one, so a person can silence weekly
 * pregnancy nudges without also silencing a reminder about their period.
 *
 * Android only, and safe to call again: `setNotificationChannelAsync` creates
 * the channel when it is not there, and Android refuses to change an existing
 * channel's importance because that belongs to the person.
 */
export async function ensurePregnancyWeeklyReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID, {
    name: PREGNANCY_WEEKLY_REMINDER_CHANNEL_NAME,
    description: PREGNANCY_WEEKLY_REMINDER_CHANNEL_DESCRIPTION,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Removes every weekly pregnancy reminder already queued, and nothing else.
 *
 * Period reminders are a different type and are not touched, in either
 * direction.
 */
export async function cancelPregnancyWeeklyReminders(): Promise<number> {
  return cancelScheduledRemindersOfType(PREGNANCY_WEEKLY_REMINDER_TYPE);
}

/**
 * Schedules the weekly reminder.
 *
 * One repeating trigger rather than a queue of dated ones: the system keeps it
 * firing, which is the whole point of a weekly trigger, and means nothing has to
 * top it up while the app is closed.
 */
export async function schedulePregnancyWeeklyReminder(): Promise<string> {
  await ensurePregnancyWeeklyReminderChannel();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: PREGNANCY_WEEKLY_REMINDER_TITLE,
      body: PREGNANCY_WEEKLY_REMINDER_BODY,
      data: pregnancyWeeklyReminderData(),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: PREGNANCY_WEEKLY_REMINDER_WEEKDAY,
      hour: PREGNANCY_WEEKLY_REMINDER_HOUR,
      minute: PREGNANCY_WEEKLY_REMINDER_MINUTE,
      channelId: PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID,
    },
  });
}
