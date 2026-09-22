import * as Notifications from 'expo-notifications';

import {
  FOREGROUND_NOTIFICATION_BEHAVIOR,
  registerForegroundNotificationHandler,
  resetForegroundNotificationHandlerForTests,
} from '../foreground-notification-handler';

jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn() }));

const setNotificationHandlerMock = Notifications.setNotificationHandler as jest.MockedFunction<
  typeof Notifications.setNotificationHandler
>;

beforeEach(() => {
  jest.clearAllMocks();
  resetForegroundNotificationHandlerForTests();
});

describe('installing the handler', () => {
  it('registers one', () => {
    registerForegroundNotificationHandler();

    expect(setNotificationHandlerMock).toHaveBeenCalledTimes(1);
  });

  it('registers it once however many times it is called', () => {
    // The root layout calls this on every render. Re-registering would remove
    // and re-add native subscriptions for nothing.
    registerForegroundNotificationHandler();
    registerForegroundNotificationHandler();
    registerForegroundNotificationHandler();

    expect(setNotificationHandlerMock).toHaveBeenCalledTimes(1);
  });

  it('passes something that can answer', () => {
    registerForegroundNotificationHandler();

    const handler = setNotificationHandlerMock.mock.calls[0][0];

    expect(typeof handler?.handleNotification).toBe('function');
  });
});

describe('what a reminder does while the app is open', () => {
  it('is shown, because the default is to show nothing at all', async () => {
    // expo-notifications: "The default behavior when the handler is not set or
    // does not respond in time is not to show the notification." A reminder
    // that found somebody already in the app used to be dropped silently.
    registerForegroundNotificationHandler();

    const handler = setNotificationHandlerMock.mock.calls[0][0];
    const behavior = await handler?.handleNotification({} as Notifications.Notification);

    expect(behavior).toEqual(FOREGROUND_NOTIFICATION_BEHAVIOR);
  });

  it('shows a banner and leaves it in the list', () => {
    expect(FOREGROUND_NOTIFICATION_BEHAVIOR.shouldShowBanner).toBe(true);
    expect(FOREGROUND_NOTIFICATION_BEHAVIOR.shouldShowList).toBe(true);
  });

  it('plays the sound, which on Android is also what allows the banner', () => {
    // The library's own note: `shouldPlaySound: false` suppresses the drop-down
    // alert whatever the priority says, and overrides the channel's sound.
    expect(FOREGROUND_NOTIFICATION_BEHAVIOR.shouldPlaySound).toBe(true);
  });

  it('sets no badge, because nothing in this app ever clears one', () => {
    expect(FOREGROUND_NOTIFICATION_BEHAVIOR.shouldSetBadge).toBe(false);
  });

  it('overrides no priority, leaving the channel to decide', () => {
    // On Android the channel's importance belongs to the person, and an app
    // that talked over it would be taking back a choice they made.
    expect(FOREGROUND_NOTIFICATION_BEHAVIOR.priority).toBeUndefined();
  });
});
