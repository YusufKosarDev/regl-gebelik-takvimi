import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

import {
  APP_NOTIFICATION_SETTINGS_TARGET,
  type NotificationSettingsTarget,
} from '../domain/notification-settings-target';

/**
 * Opens the page of Android's settings that holds the switch being talked about.
 *
 * `Linking.openSettings()` opens App info. That is what it is for — "the app's
 * custom settings" — and it is the wrong page for every sentence this app
 * attaches it to. Measured on a device: it lands on a screen whose first row
 * is Archive / Uninstall / Force stop, with Notifications below that, and the
 * notification page is a further tap away.
 *
 * `Linking.sendIntent` takes an Android action by name and needs no new
 * dependency. Both actions used here were opened by hand on a device first.
 */
const APP_NOTIFICATION_SETTINGS = 'android.settings.APP_NOTIFICATION_SETTINGS';
const CHANNEL_NOTIFICATION_SETTINGS = 'android.settings.CHANNEL_NOTIFICATION_SETTINGS';

const EXTRA_APP_PACKAGE = 'android.provider.extra.APP_PACKAGE';
const EXTRA_CHANNEL_ID = 'android.provider.extra.CHANNEL_ID';

/**
 * The package the settings pages are asked about.
 *
 * From the embedded config, like `getAppVersion` reads the version — the same
 * `app.json` the build is made from rather than a second copy to keep in step.
 * It can come back empty where `expoConfig` is null, which is a reason to fall
 * back rather than to throw: App info is a worse page, not a broken one.
 */
function applicationId(): string | null {
  const packageName = Constants.expoConfig?.android?.package;

  return typeof packageName === 'string' && packageName.trim() !== '' ? packageName : null;
}

function intentFor(
  target: NotificationSettingsTarget,
  packageName: string
): { readonly action: string; readonly extras: { key: string; value: string }[] } {
  if (target.kind === 'channel') {
    return {
      action: CHANNEL_NOTIFICATION_SETTINGS,
      extras: [
        { key: EXTRA_APP_PACKAGE, value: packageName },
        { key: EXTRA_CHANNEL_ID, value: target.channelId },
      ],
    };
  }

  return {
    action: APP_NOTIFICATION_SETTINGS,
    extras: [{ key: EXTRA_APP_PACKAGE, value: packageName }],
  };
}

/**
 * Tries the page that was asked for, then the ones that are nearer than nothing.
 *
 * Three steps, narrowest first. A channel page falls back to the app's
 * notification page — which lists that channel, since a silenced one is not
 * hidden under "Show unused categories" — and that falls back to App info,
 * which is where this used to start.
 *
 * Every step is a real possibility rather than defensive habit.
 * `sendIntent` rejects when nothing on the device resolves the action, and a
 * manufacturer's settings app is free not to carry either one; `expoConfig` is
 * null in some hosting situations; and iOS has none of this, which is why the
 * platform is checked before anything else. Only when all of them fail does
 * the caller hear about it, and the screen says so rather than leaving a
 * button that looks like it did nothing.
 */
export async function openNotificationSettings(
  target: NotificationSettingsTarget = APP_NOTIFICATION_SETTINGS_TARGET
): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();

    return;
  }

  const packageName = applicationId();

  if (packageName !== null) {
    const attempts: NotificationSettingsTarget[] =
      target.kind === 'channel' ? [target, APP_NOTIFICATION_SETTINGS_TARGET] : [target];

    for (const attempt of attempts) {
      const { action, extras } = intentFor(attempt, packageName);

      try {
        await Linking.sendIntent(action, extras);

        return;
      } catch {
        // The next one is nearer than nothing. If this was the last, App info
        // below is still a page with the word Notifications on it.
      }
    }
  }

  await Linking.openSettings();
}
