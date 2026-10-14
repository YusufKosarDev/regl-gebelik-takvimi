import { PERIOD_REMINDER_CHANNEL_ID } from './period-reminder';
import { PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID } from './pregnancy-weekly-reminder';

/**
 * Which page of Android's settings answers the problem the panel is reporting.
 *
 * The panel has one button, and until now it went to one place for every
 * reason it could appear. That place was the App info page — `openSettings()`
 * is documented as "the app's custom settings", and on Android that is App
 * info, not notifications. So somebody told "telefonun bildirim ayarlarında
 * kapatılmış, oradan tekrar açabilirsin" was handed a page with Uninstall and
 * Force stop on it and left to find Notifications themselves.
 *
 * Android has an action for each of the two things this app can be reporting,
 * and both were measured on a device before this was written:
 *
 * - `APP_NOTIFICATION_SETTINGS` opens the app's notification page, where the
 *   master switch is and where it says "You haven't allowed notifications from
 *   this app" when it is off.
 * - `CHANNEL_NOTIFICATION_SETTINGS` opens one reminder's own page, titled with
 *   the channel's name as the app wrote it — "Regl hatırlatıcıları" — with its
 *   description underneath and "Show notifications" at the top.
 *
 * The second also settles something the first does not. A channel nothing has
 * ever been posted on is collapsed under "Show unused categories" on the app's
 * notification page, so a freshly installed app shows no reminders there at
 * all. The channel page opens regardless: Android does not hide a page it was
 * asked for by name.
 */
export type NotificationSettingsTarget =
  | { readonly kind: 'app' }
  | { readonly kind: 'channel'; readonly channelId: string };

export const APP_NOTIFICATION_SETTINGS_TARGET: NotificationSettingsTarget = { kind: 'app' };

/**
 * What the panel's button should open, given what the panel is saying.
 *
 * ## Why the permission wins
 *
 * The panel already prefers the permission when both are wrong, for the reason
 * written beside that choice: when nothing is being delivered at all, which
 * channel is silenced is beside the point. The button has to agree with the
 * sentence above it, or it sends somebody to fix the smaller of two problems —
 * and worse, to a page whose switch is already on.
 *
 * ## Why two silenced channels go to the app page
 *
 * There is one button and there would be two channels to open. The app's
 * notification page lists both, and a channel that has been silenced is shown
 * there at the top level rather than under the collapsed section — being
 * switched off is what makes Android count it as used. So the page that cannot
 * name either one is the only one that reaches both.
 */
export function notificationSettingsTargetFor(input: {
  /** The panel is reporting that nothing will be delivered at all. */
  readonly permissionIsTheProblem: boolean;
  readonly periodChannelSilenced: boolean;
  readonly pregnancyChannelSilenced: boolean;
}): NotificationSettingsTarget {
  if (input.permissionIsTheProblem) {
    return APP_NOTIFICATION_SETTINGS_TARGET;
  }

  if (input.periodChannelSilenced && !input.pregnancyChannelSilenced) {
    return { kind: 'channel', channelId: PERIOD_REMINDER_CHANNEL_ID };
  }

  if (input.pregnancyChannelSilenced && !input.periodChannelSilenced) {
    return { kind: 'channel', channelId: PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID };
  }

  return APP_NOTIFICATION_SETTINGS_TARGET;
}
