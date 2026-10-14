import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

import {
  APP_NOTIFICATION_SETTINGS_TARGET,
  notificationSettingsTargetFor,
} from '../../domain/notification-settings-target';
import { openNotificationSettings } from '../open-notification-settings';

/**
 * Where the panel's button actually goes.
 *
 * ## Why this is tested on the Android branch and not the one jest runs
 *
 * `Platform.OS` is `'ios'` under this suite. Everything here is Android-only,
 * so a test that did not say so would exercise the `Linking.openSettings()`
 * fallback, pass, and say nothing at all about the code that ships — which is
 * precisely what the screen's existing "opens the system settings when that is
 * pressed" test was doing while App info was the wrong page.
 *
 * ## What is being claimed
 *
 * That the right Android action is sent with the right extras, because that
 * string *is* the behaviour: `CHANNEL_NOTIFICATION_SETTINGS` with a channel id
 * opens one reminder's own page with its switch at the top, and
 * `APP_NOTIFICATION_SETTINGS` opens the page with the master switch. Both were
 * opened by hand on a device before any of this was written; what no test can
 * check is what Android then draws.
 */

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { android: { package: 'com.example.app' } } },
}));

/**
 * Reset rather than spied on, because they are mocks already.
 *
 * `Linking.sendIntent` and `Linking.openSettings` come from jest-expo as
 * `jest.fn`s. `jest.spyOn` on a property that is already a mock function hands
 * back that same mock instead of wrapping it, and `restoreAllMocks` then has
 * nothing to restore — so calls pile up from test to test and the ones
 * asserting "not called" fail with a list of their neighbours' calls. That is
 * what the first version of this file did.
 */
const sendIntent = Linking.sendIntent as unknown as jest.Mock;
const openSettings = Linking.openSettings as unknown as jest.Mock;

const originalPlatform = Platform.OS;

/** jest-expo runs each file under several platforms, so state the one meant. */
function runningOn(os: string) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

function expoConfig(value: unknown) {
  (Constants as unknown as { expoConfig: unknown }).expoConfig = value;
}

beforeEach(() => {
  runningOn('android');

  sendIntent.mockReset();
  sendIntent.mockResolvedValue(undefined);
  openSettings.mockReset();
  openSettings.mockResolvedValue(undefined);

  expoConfig({ android: { package: 'com.example.app' } });
});

afterAll(() => {
  runningOn(originalPlatform);
});

describe('one reminder silenced in system settings', () => {
  it('opens that reminder own page rather than a list to search', async () => {
    await openNotificationSettings({ kind: 'channel', channelId: 'period-reminders' });

    expect(sendIntent).toHaveBeenCalledWith('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: 'com.example.app' },
      { key: 'android.provider.extra.CHANNEL_ID', value: 'period-reminders' },
    ]);

    expect(openSettings).not.toHaveBeenCalled();
  });

  it('falls back to the app notification page when that action is unknown', async () => {
    // A manufacturer's settings app is free not to carry it. The app's own
    // notification page lists a silenced channel at the top level, so it is
    // nearer than App info even though it cannot name the one meant.
    sendIntent.mockRejectedValueOnce(new Error('Could not launch Intent'));

    await openNotificationSettings({ kind: 'channel', channelId: 'period-reminders' });

    expect(sendIntent).toHaveBeenLastCalledWith('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: 'com.example.app' },
    ]);

    expect(openSettings).not.toHaveBeenCalled();
  });
});

describe('nothing being delivered at all', () => {
  it('opens the page the master switch is on', async () => {
    await openNotificationSettings(APP_NOTIFICATION_SETTINGS_TARGET);

    expect(sendIntent).toHaveBeenCalledWith('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: 'com.example.app' },
    ]);
  });

  it('asks for that page by default', async () => {
    await openNotificationSettings();

    expect(sendIntent).toHaveBeenCalledWith(
      'android.settings.APP_NOTIFICATION_SETTINGS',
      expect.anything()
    );
  });
});

describe('when there is no notification page to open', () => {
  it('falls back to App info rather than doing nothing', async () => {
    // Where this started. A worse page is not a broken one, and a button that
    // appears to do nothing is pressed again.
    sendIntent.mockRejectedValue(new Error('Could not launch Intent'));

    await openNotificationSettings(APP_NOTIFICATION_SETTINGS_TARGET);

    expect(openSettings).toHaveBeenCalled();
  });

  it('reports a failure nothing could recover from', async () => {
    sendIntent.mockRejectedValue(new Error('Could not launch Intent'));
    openSettings.mockRejectedValue(new Error('no activity'));

    await expect(openNotificationSettings()).rejects.toThrow('no activity');
  });

  it('falls back when the build cannot say what it is called', async () => {
    // `expoConfig` is null in some hosting situations, and both actions need a
    // package name to be about this app at all.
    expoConfig(null);

    await openNotificationSettings({ kind: 'channel', channelId: 'period-reminders' });

    expect(sendIntent).not.toHaveBeenCalled();
    expect(openSettings).toHaveBeenCalled();
  });
});

describe('anywhere that is not Android', () => {
  it('has none of this, and opens what there is', async () => {
    runningOn('ios');

    await openNotificationSettings({ kind: 'channel', channelId: 'period-reminders' });

    expect(sendIntent).not.toHaveBeenCalled();
    expect(openSettings).toHaveBeenCalled();
  });
});

describe('which page answers which problem', () => {
  it('sends a permission problem to the app page', async () => {
    expect(
      notificationSettingsTargetFor({
        permissionIsTheProblem: true,
        periodChannelSilenced: true,
        pregnancyChannelSilenced: false,
      })
    ).toEqual({ kind: 'app' });
  });

  it('names the one silenced reminder', async () => {
    expect(
      notificationSettingsTargetFor({
        permissionIsTheProblem: false,
        periodChannelSilenced: true,
        pregnancyChannelSilenced: false,
      })
    ).toEqual({ kind: 'channel', channelId: 'period-reminders' });

    expect(
      notificationSettingsTargetFor({
        permissionIsTheProblem: false,
        periodChannelSilenced: false,
        pregnancyChannelSilenced: true,
      })
    ).toEqual({ kind: 'channel', channelId: 'pregnancy-reminders' });
  });

  it('sends two silenced reminders to the page that lists both', async () => {
    // One button, two channels. The page that cannot name either is the only
    // one that reaches both.
    expect(
      notificationSettingsTargetFor({
        permissionIsTheProblem: false,
        periodChannelSilenced: true,
        pregnancyChannelSilenced: true,
      })
    ).toEqual({ kind: 'app' });
  });

  it('sends a panel with nothing silenced to the app page', async () => {
    expect(
      notificationSettingsTargetFor({
        permissionIsTheProblem: false,
        periodChannelSilenced: false,
        pregnancyChannelSilenced: false,
      })
    ).toEqual({ kind: 'app' });
  });
});
