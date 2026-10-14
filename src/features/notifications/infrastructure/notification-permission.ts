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
 * in system settings. The prompt happens when a reminder is switched on, or when
 * somebody presses the button on a notice saying a reminder cannot reach them,
 * and only then.
 */

/**
 * What the system will do with a queued reminder right now.
 *
 * - `'granted'` — it will arrive.
 * - `'denied'` — it will not, and no dialog can change that. Only system
 *   settings can.
 * - `'undetermined'` — it will not, but the dialog is still available. Read the
 *   long note on `toStatus` before assuming this means nobody has been asked.
 */
export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * The three answers that matter, from a response that reports more than three.
 *
 * ## `status` decides whether anything will be delivered
 *
 * Not `granted`. On Android 13+ that field is the POST_NOTIFICATIONS bit alone
 * and says nothing about whether notifications are switched on for the app.
 * The library folds both facts into `status` — it reports 'granted' only when
 * the permission is held *and* `areNotificationsEnabled()` is true — so that is
 * the single signal worth trusting for "will a queued reminder arrive". A
 * `granted` bit under a non-granted status is a state no dialog can fix, so it
 * falls through to 'denied' rather than being believed; that combination is
 * what used to make the app certain it was permitted while Android dropped
 * every reminder.
 *
 * ## `canAskAgain` is still a signal, but it is no longer the decision
 *
 * It earns its place for one case: on Android, POST_NOTIFICATIONS comes back as
 * "denied" before it has ever been asked for — a refusal nobody made — and
 * treating that as a real no means never showing the dialog at all. What tells
 * those apart is whether the system will still show it.
 *
 * What it cannot do is tell an unasked permission from a revoked one. It is a
 * flag `expo-modules-core` persists when the app asks, and a successful grant
 * writes it false and leaves it false for good. Revoke that grant in system
 * settings afterwards and the response is field for field the one an app that
 * has never asked receives. That is not a library bug: the platform does not
 * distinguish them at query time either, which is why the library records a
 * flag of its own and says as much where it does.
 *
 * ## Read 'undetermined' as "not delivering, and the dialog is still available"
 *
 * Never as "never asked". It covers three situations at once, and the platform
 * will not separate them: a permission nobody has been asked for, a refusal
 * Android is still willing to re-ask, and a grant the person has since taken
 * away. Code that reads it as only the first will conclude there is nothing to
 * explain — which is how a switch reading on, a queue holding nothing and a
 * screen saying nothing all shipped together.
 *
 * So nothing here can answer "is somebody waiting for a reminder that will not
 * come". That question is answered by the stored preference beside this, and
 * `NotificationsSection` keys its notice off exactly that.
 */
function toStatus(response: {
  status: string;
  granted?: boolean;
  canAskAgain?: boolean;
}): NotificationPermissionStatus {
  if (response.status === 'granted') {
    return 'granted';
  }

  if (response.granted === true) {
    return 'denied';
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
 *
 * It does ask when the status is 'undetermined', which — see `toStatus` — now
 * includes somebody who granted the permission and later took it away. That is
 * deliberate: the dialog is two taps and system settings is a trip, and when
 * Android has stopped offering the dialog it reports the refusal rather than
 * showing nothing.
 */
export async function ensureNotificationPermission(): Promise<NotificationPermissionStatus> {
  const current = await getNotificationPermissionStatus();

  if (current !== 'undetermined') {
    return current;
  }

  return toStatus(await Notifications.requestPermissionsAsync());
}
