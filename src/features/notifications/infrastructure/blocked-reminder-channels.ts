import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { PERIOD_REMINDER_CHANNEL_ID } from '../domain/period-reminder';
import { PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID } from '../domain/pregnancy-weekly-reminder';

/**
 * Which reminders the person has switched off in Android's own settings.
 *
 * A channel is the one part of this feature the app creates and then does not
 * own. Somebody can open the system notification settings and silence "Regl
 * hatırlatıcıları" while leaving the weekly pregnancy note alone, and Android
 * will then drop every reminder on that channel without telling the app
 * anything.
 *
 * ## Why this is not covered by the permission read
 *
 * `areNotificationsEnabled()` — which is what `status` folds in, and so what
 * `getNotificationPermissionStatus` reports — stays true when only a channel is
 * blocked. So the permission reads 'granted', the sync queues a reminder, the
 * switch says on, and nothing arrives. That is the same shape as the three
 * routes into #34 and it needs its own read, because the one the app already
 * makes cannot see it.
 *
 * ## Nothing here changes what is queued
 *
 * This answers what to *say*. The scheduling is deliberately untouched — see
 * the note beside the permission check in `application/sync-period-reminder.ts`
 * for why cancelling would make things worse rather than better.
 */
export type BlockedReminderChannels = {
  readonly periodReminder: boolean;
  readonly pregnancyWeeklyReminder: boolean;
};

/**
 * What to assume when the question cannot be asked.
 *
 * Nothing blocked. A screen that could not read the channels should say less
 * than it knows rather than invent a warning: the cost of missing a blocked
 * channel is a reminder that does not arrive, and the cost of inventing one is
 * telling somebody their phone is wrong when it is not.
 */
export const NO_BLOCKED_REMINDER_CHANNELS: BlockedReminderChannels = {
  periodReminder: false,
  pregnancyWeeklyReminder: false,
};

/**
 * Whether this one channel has been silenced by the person.
 *
 * ## `AndroidImportance.NONE` is 2, not 0
 *
 * It reads like the platform constant and it is not. expo-notifications carries
 * its own enum and renumbers everything — `IMPORTANCE_NONE` is 0 natively and
 * arrives here as 2, `IMPORTANCE_DEFAULT` is 3 natively and arrives as 5. The
 * conversion is in `ExpoNotificationsChannelSerializer.java`, which serialises
 * `fromNativeValue(channel.getImportance()).getEnumValue()`.
 *
 * So the comparison has to be against the library's enum member and never
 * against a number. A `=== 0` written from Android's documentation would match
 * `UNKNOWN` instead and this would quietly never fire.
 *
 * ## A missing channel is not a blocked one
 *
 * Both reminder channels are created lazily, inside the schedule call, so
 * anybody who has never had a reminder successfully queued has no channel at
 * all and gets `null` back. Reading that as blocked would tell somebody who
 * just installed the app that they had switched something off — which is the
 * mistake #34 was, pointing the other way.
 *
 * Android only. There are no channels anywhere else, and the question has no
 * meaning there.
 */
export async function isReminderChannelBlocked(channelId: string): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  const channel = await Notifications.getNotificationChannelAsync(channelId);

  if (channel === null) {
    return false;
  }

  return channel.importance === Notifications.AndroidImportance.NONE;
}

/**
 * Both channels in one trip.
 *
 * Asked together because they are independent answers that are always wanted
 * at the same moment: the screen shows two switches, and either one of them can
 * be the silenced one.
 */
export async function loadBlockedReminderChannels(): Promise<BlockedReminderChannels> {
  const [periodReminder, pregnancyWeeklyReminder] = await Promise.all([
    isReminderChannelBlocked(PERIOD_REMINDER_CHANNEL_ID),
    isReminderChannelBlocked(PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID),
  ]);

  return { periodReminder, pregnancyWeeklyReminder };
}
