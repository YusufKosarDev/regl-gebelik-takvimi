import * as Notifications from 'expo-notifications';

/**
 * What happens to a reminder that arrives while the app is open.
 *
 * Without a handler, nothing does. expo-notifications says so in as many words:
 * "The default behavior when the handler is not set or does not respond in time
 * is not to show the notification." So a period reminder timed for 09:00 that
 * found somebody already looking at the app was dropped — no banner, and not
 * even a line in the notification list to find later. The one case where the
 * app could be sure the person was reachable was the one case it said nothing.
 *
 * The behaviour returned here is the same in the foreground as out of it:
 *
 *   - banner and list, because a reminder is worth interrupting for once and
 *     worth finding again afterwards;
 *   - sound on, which on Android means the channel's own sound and, per the
 *     library's own note, is also what allows the heads-up banner at all —
 *     `shouldPlaySound: false` suppresses the drop-down alert whatever the
 *     priority says;
 *   - no badge, because this app keeps no unread count and a number nothing
 *     ever clears is a number that only goes up.
 *
 * No `priority` override: the channel decides, and on Android the channel's
 * importance is the person's to change in system settings.
 */

/**
 * Whether the handler has been installed in this JS runtime.
 *
 * `setNotificationHandler` replaces whatever was there, so calling it twice is
 * harmless — but it also removes and re-adds native subscriptions, and a second
 * caller is a sign that two places think they own this. One place does.
 */
let registered = false;

/** The behaviour, as its own value so a test can assert on it directly. */
export const FOREGROUND_NOTIFICATION_BEHAVIOR: Notifications.NotificationBehavior = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false,
};

/**
 * Installs the handler, once per app start.
 *
 * Called from the root layout rather than a screen: a reminder can fire while
 * any screen is open, including one that has never heard of notifications.
 */
export function registerForegroundNotificationHandler(): void {
  if (registered) {
    return;
  }

  registered = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => FOREGROUND_NOTIFICATION_BEHAVIOR,
  });
}

/** Lets a test start from nothing. */
export function resetForegroundNotificationHandlerForTests(): void {
  registered = false;
}
