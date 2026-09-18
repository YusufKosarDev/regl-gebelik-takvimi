import * as Notifications from 'expo-notifications';

/**
 * Whether the operating system will deliver a notification.
 *
 * Kept apart from whether the person wants one. Android can refuse, and a
 * refusal has to stay visible: folding the two together would make "I asked for
 * this and Android said no" look exactly like "I never asked".
 *
 * Nothing here is called on launch. A permission dialog that appears before a
 * person has asked for anything is a question they have no way to answer, and
 * the only safe answer to an unexplained one is no — which then has to be undone
 * in system settings. The prompt happens when a reminder is switched on, and
 * only then.
 */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * The three answers that matter, from a response that reports more than three.
 *
 * `canAskAgain` decides, not `status`. On Android, POST_NOTIFICATIONS comes back
 * as "denied" before it has ever been asked for — a refusal nobody made — and
 * treating that as a real no means never showing the dialog at all. What tells
 * the two apart is whether the system will still show it.
 *
 * So: granted is granted; not granted but still askable is undetermined; and
 * not granted with no way to ask is the only thing worth calling denied,
 * because that one can only be undone in system settings.
 */
function toStatus(response: {
  status: string;
  granted?: boolean;
  canAskAgain?: boolean;
}): NotificationPermissionStatus {
  if (response.granted === true || response.status === 'granted') {
    return 'granted';
  }

  return response.canAskAgain === false ? 'denied' : 'undetermined';
}

/**
 * What the system currently says, without asking anyone anything.
 *
 * Safe to call on a screen opening: it reads, it never prompts.
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  return toStatus(await Notifications.getPermissionsAsync());
}

/**
 * Asks, but only if the answer is not already known.
 *
 * A granted permission is not asked for again — the dialog would not appear and
 * the round trip is wasted. A denied one is not asked for again either: Android
 * does not show the dialog a second time, so the call would return the same
 * refusal while looking to the caller like a fresh question. In both cases the
 * existing answer is returned, and the screen decides what to say about it.
 */
export async function ensureNotificationPermission(): Promise<NotificationPermissionStatus> {
  const current = await getNotificationPermissionStatus();

  if (current !== 'undetermined') {
    return current;
  }

  return toStatus(await Notifications.requestPermissionsAsync());
}
