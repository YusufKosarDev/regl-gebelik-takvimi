import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  PERIOD_REMINDER_CHANNEL_ID,
  PERIOD_REMINDER_HOUR,
  PERIOD_REMINDER_TYPE,
  periodReminderData,
} from '../domain/period-reminder';
import {
  PERIOD_REMINDER_BODY,
  PERIOD_REMINDER_CHANNEL_DESCRIPTION,
  PERIOD_REMINDER_CHANNEL_NAME,
  PERIOD_REMINDER_TITLE,
} from '../presentation/reminder-messages';

import { cancelScheduledRemindersOfType } from './scheduled-reminders';

import type { ISODate } from '@/types/iso-date';

/**
 * The scheduling side of the period reminder.
 *
 * The only place in this feature that touches the notification queue or builds a
 * `Date`. A trigger is a moment rather than a calendar date, so one has to be
 * constructed somewhere; keeping it here means the rest of the feature stays on
 * `ISODate` and stays testable without a clock.
 *
 * Nothing here decides whether a reminder should exist. That is the use case's
 * question; this answers "make it so" and reports what it managed.
 */

/**
 * Creates the channel, or leaves the existing one as it is.
 *
 * `setNotificationChannelAsync` creates the channel if it is not there, so
 * calling it again is how you make sure of it rather than a mistake. Android
 * also refuses to change an existing channel's importance — that belongs to the
 * person, not the app — so this is safe to call before every schedule.
 *
 * Android only: there are no channels anywhere else, and asking for one is a
 * no-op that still costs a bridge round trip.
 */
export async function ensurePeriodReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(PERIOD_REMINDER_CHANNEL_ID, {
    name: PERIOD_REMINDER_CHANNEL_NAME,
    description: PERIOD_REMINDER_CHANNEL_DESCRIPTION,
    importance: Notifications.AndroidImportance.DEFAULT,
    // Hidden from the lock screen, always, with or without an app lock.
    //
    // PRIVATE would show "Regl & Gebelik Takvimi - content hidden", which
    // announces that this person uses a period tracker to anybody who glances
    // at the phone. SECRET shows nothing there and the notification still
    // appears in the shade after unlocking.
    //
    // Set at creation because Android will not let a channel's visibility
    // change afterwards: altering it later means deleting and recreating the
    // channel and losing whatever the person customised. This app is not
    // released yet, so it is free now and would not be later.
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
  });
}

/**
 * Removes every period reminder already in the queue, and nothing else.
 *
 * Found by the `type` in the payload rather than by an identifier this app
 * remembered. An identifier would have to be stored, kept in step with a queue
 * the system can empty on its own, and would still be wrong after a restore —
 * whereas the queue already knows what is in it.
 *
 * Returns how many went, which is what makes "exactly one reminder" testable.
 */
export async function cancelPeriodReminders(): Promise<number> {
  return cancelScheduledRemindersOfType(PERIOD_REMINDER_TYPE);
}

/**
 * The moment a reminder for this day should arrive, as epoch milliseconds.
 *
 * Built in local time on purpose: nine in the morning means nine where the
 * person is, and a reminder that respected a stored offset instead would drift
 * by an hour twice a year.
 */
export function periodReminderMoment(date: ISODate): number {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(year, month - 1, day, PERIOD_REMINDER_HOUR, 0, 0, 0).getTime();
}

/**
 * Schedules one reminder for this day, or `null` when that moment has passed.
 *
 * A moment in the past is not moved to a safe-looking hour later the same day.
 * That hour would be invented rather than chosen, and it would put a reminder
 * about tomorrow in front of someone at a time nothing was decided for. Nothing
 * is scheduled, and the next cycle change reconsiders it with a fresh estimate.
 *
 * The queue is left with at most one of these: existing ones are cancelled
 * first, so a second call cannot leave two.
 */
export async function schedulePeriodReminder(date: ISODate): Promise<string | null> {
  const moment = periodReminderMoment(date);

  if (moment <= Date.now()) {
    return null;
  }

  await ensurePeriodReminderChannel();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: PERIOD_REMINDER_TITLE,
      body: PERIOD_REMINDER_BODY,
      data: periodReminderData(),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: moment,
      channelId: PERIOD_REMINDER_CHANNEL_ID,
    },
  });
}
