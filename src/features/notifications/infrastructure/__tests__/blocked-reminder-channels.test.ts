import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { PERIOD_REMINDER_CHANNEL_ID } from '../../domain/period-reminder';
import { PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID } from '../../domain/pregnancy-weekly-reminder';
import {
  isReminderChannelBlocked,
  loadBlockedReminderChannels,
} from '../blocked-reminder-channels';

/**
 * Whether the app can tell that Android is discarding one of its reminders.
 *
 * ## What this is for
 *
 * A channel is the one part of this feature the app creates and then stops
 * owning. `areNotificationsEnabled()` stays true when only a channel is
 * silenced, so the permission read reports 'granted' and the sync queues a
 * reminder nothing will deliver. This is the read that sees it, and these are
 * the three answers it has to tell apart.
 *
 * `expo-notifications` is faked, which is the right boundary here: this module
 * is the thing under test and the library is what it talks to. The screen tests
 * fake *this* module for the same reason, one layer up.
 */

jest.mock('expo-notifications', () => ({
  getNotificationChannelAsync: jest.fn(),
  // The real numbering, not Android's. `IMPORTANCE_NONE` is 0 natively and 2
  // here, and a mock that used the platform values would make a wrong
  // comparison look right.
  AndroidImportance: {
    UNKNOWN: 0,
    UNSPECIFIED: 1,
    NONE: 2,
    MIN: 3,
    LOW: 4,
    DEFAULT: 5,
    HIGH: 6,
    MAX: 7,
  },
}));

const notifications = jest.requireMock('expo-notifications');

/** jest-expo runs each file under several platforms, so state the one meant. */
const originalPlatform = Platform.OS;

function runningOn(os: string) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

/** A channel as the system hands it back, at a given importance. */
function channel(importance: number) {
  return {
    id: PERIOD_REMINDER_CHANNEL_ID,
    name: 'Regl hatırlatıcıları',
    importance,
  };
}

beforeEach(() => {
  runningOn('android');
  notifications.getNotificationChannelAsync.mockReset();
  notifications.getNotificationChannelAsync.mockResolvedValue(
    channel(Notifications.AndroidImportance.DEFAULT)
  );
});

afterAll(() => {
  runningOn(originalPlatform);
});

describe('one channel', () => {
  it('reports a silenced channel', async () => {
    notifications.getNotificationChannelAsync.mockResolvedValue(
      channel(Notifications.AndroidImportance.NONE)
    );

    await expect(isReminderChannelBlocked(PERIOD_REMINDER_CHANNEL_ID)).resolves.toBe(true);
  });

  it('reports a channel the person has left alone', async () => {
    await expect(isReminderChannelBlocked(PERIOD_REMINDER_CHANNEL_ID)).resolves.toBe(false);
  });

  /**
   * The case that would have made this a new defect rather than a fix.
   *
   * Both channels are created lazily, inside the schedule call, so anybody who
   * has never had a reminder queued has no channel at all. Reading `null` as
   * silenced would tell somebody who just installed the app that they had
   * switched something off.
   */
  it('does not call a channel that does not exist yet a silenced one', async () => {
    notifications.getNotificationChannelAsync.mockResolvedValue(null);

    await expect(isReminderChannelBlocked(PERIOD_REMINDER_CHANNEL_ID)).resolves.toBe(false);
  });

  /**
   * `AndroidImportance.NONE` is 2, and reads like the platform constant 0.
   *
   * The conversion is in `ExpoNotificationsChannelSerializer.java`, which
   * serialises `fromNativeValue(...).getEnumValue()`. A comparison written
   * against 0 from Android's own documentation would match `UNKNOWN` instead,
   * so a channel at `UNKNOWN` must not read as silenced and one at the
   * library's `NONE` must.
   */
  it('reads the library enum rather than the platform number', async () => {
    notifications.getNotificationChannelAsync.mockResolvedValue(channel(0));

    await expect(isReminderChannelBlocked(PERIOD_REMINDER_CHANNEL_ID)).resolves.toBe(false);

    notifications.getNotificationChannelAsync.mockResolvedValue(channel(2));

    await expect(isReminderChannelBlocked(PERIOD_REMINDER_CHANNEL_ID)).resolves.toBe(true);
  });

  it.each([
    ['min', Notifications.AndroidImportance.MIN],
    ['low', Notifications.AndroidImportance.LOW],
    ['high', Notifications.AndroidImportance.HIGH],
  ])('leaves a channel the person merely quietened at %s alone', async (_label, importance) => {
    // Turning the importance down is not turning the channel off, and the app
    // has no business second-guessing it: a silent reminder still arrives.
    notifications.getNotificationChannelAsync.mockResolvedValue(channel(importance));

    await expect(isReminderChannelBlocked(PERIOD_REMINDER_CHANNEL_ID)).resolves.toBe(false);
  });

  it('asks about the channel it was given', async () => {
    await isReminderChannelBlocked(PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID);

    expect(notifications.getNotificationChannelAsync).toHaveBeenCalledWith(
      PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID
    );
  });

  it('asks nothing off Android, where there are no channels', async () => {
    runningOn('ios');

    await expect(isReminderChannelBlocked(PERIOD_REMINDER_CHANNEL_ID)).resolves.toBe(false);

    expect(notifications.getNotificationChannelAsync).not.toHaveBeenCalled();
  });
});

describe('both channels', () => {
  it('reports them apart, because they are switched apart', async () => {
    // Somebody tracking a pregnancy may well silence period reminders and keep
    // the weekly note. One answer for both would make the screen say the wrong
    // thing about one of them.
    notifications.getNotificationChannelAsync.mockImplementation(async (id: string) =>
      channel(
        id === PERIOD_REMINDER_CHANNEL_ID
          ? Notifications.AndroidImportance.NONE
          : Notifications.AndroidImportance.DEFAULT
      )
    );

    await expect(loadBlockedReminderChannels()).resolves.toEqual({
      periodReminder: true,
      pregnancyWeeklyReminder: false,
    });
  });

  it('reports neither when both are left alone', async () => {
    await expect(loadBlockedReminderChannels()).resolves.toEqual({
      periodReminder: false,
      pregnancyWeeklyReminder: false,
    });
  });

  it('reports both when both are silenced', async () => {
    notifications.getNotificationChannelAsync.mockResolvedValue(
      channel(Notifications.AndroidImportance.NONE)
    );

    await expect(loadBlockedReminderChannels()).resolves.toEqual({
      periodReminder: true,
      pregnancyWeeklyReminder: true,
    });
  });

  it('passes a failure on rather than reporting nothing blocked', async () => {
    // The caller decides what to do with an unanswerable question. The settings
    // screen falls back to "nothing blocked"; swallowing it here would take
    // that decision away from every caller at once.
    notifications.getNotificationChannelAsync.mockRejectedValue(new Error('no module'));

    await expect(loadBlockedReminderChannels()).rejects.toThrow('no module');
  });
});
