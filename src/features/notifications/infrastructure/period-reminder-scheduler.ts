import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  PERIOD_REMINDER_CHANNEL_ID,
  PERIOD_REMINDER_HOUR,
  PERIOD_REMINDER_TYPE,
  periodReminderData,
} from '../domain/period-reminder';
import {
  DISCREET_REMINDER_BODY,
  DISCREET_REMINDER_TITLE,
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
  });
}

/**
 * ## Do not add `lockscreenVisibility` back. Android throws it away.
 *
 * This channel used to be created with
 * `lockscreenVisibility: AndroidNotificationVisibility.SECRET`, so that a
 * reminder would not print "regl dönemin yaklaşıyor" on the lock screen of a
 * phone lying on a table. The call was accepted, no error was raised, and
 * nothing happened.
 *
 * Measured on a clean install — uninstall, reinstall, onboard, switch the
 * reminder on — with a device PIN set and Android's lock screen settings at
 * their defaults:
 *
 *     NotificationChannel{mId='period-reminders', mImportance=3,
 *                         mLockscreenVisibility=-1000, ...}
 *
 * `-1000` is `VISIBILITY_NO_OVERRIDE`: not set. The name, the description and
 * the importance from the same call all landed; only this one was dropped. The
 * reminder then arrived on the locked screen with its full title and body.
 *
 * The reason is that a channel's lock screen visibility is not the app's to
 * choose. When a channel is created by the app that owns it, the platform
 * replaces whatever visibility was asked for with the *package's* visibility —
 * a setting that belongs to the person, in Android's own settings, and which
 * defaults to "not set". Every expo-notifications channel on the device reads
 * `-1000`, including the ones the library creates for itself.
 *
 * So the option is gone and nothing replaces it, because nothing can. What is
 * left is the wording, and that is what `discreetNotifications` decides.
 *
 * The test that used to cover this asserted the argument rather than the
 * outcome, which is why the suite was green the whole time.
 */

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
 *
 * `discreet` picks the wording. It defaults to the sentence the app has always
 * sent, so a caller that has not thought about it cannot accidentally make
 * everybody's reminders vaguer — the quiet version is the one that has to be
 * asked for.
 */
export async function schedulePeriodReminder(
  date: ISODate,
  discreet: boolean = false
): Promise<string | null> {
  const moment = periodReminderMoment(date);

  if (moment <= Date.now()) {
    return null;
  }

  await ensurePeriodReminderChannel();

  return Notifications.scheduleNotificationAsync({
    content: {
      // Chosen here and fixed here. A queued notification carries the words it
      // was scheduled with, so changing the switch has to rebuild the queue
      // rather than expecting the pending reminder to read it later.
      title: discreet ? DISCREET_REMINDER_TITLE : PERIOD_REMINDER_TITLE,
      body: discreet ? DISCREET_REMINDER_BODY : PERIOD_REMINDER_BODY,
      data: periodReminderData(),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: moment,
      channelId: PERIOD_REMINDER_CHANNEL_ID,
    },
  });
}
