import { Platform } from 'react-native';

import { PERIOD_REMINDER_CHANNEL_DESCRIPTION } from '../../domain/period-reminder';
import { PREGNANCY_WEEKLY_REMINDER_CHANNEL_DESCRIPTION } from '../../domain/pregnancy-weekly-reminder';

import {
  cancelPregnancyWeeklyReminders,
  ensurePregnancyWeeklyReminderChannel,
  schedulePregnancyWeeklyReminder,
} from '../pregnancy-weekly-reminder-scheduler';

jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
}));

const notifications = jest.requireMock('expo-notifications');

/** jest-expo runs each file under several platforms, so this one is stated. */
const originalPlatform = Platform.OS;

function runningOn(os: string) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

function queued(identifier: string, type?: string) {
  return {
    identifier,
    content: { title: 'x', body: 'y', data: type === undefined ? {} : { type } },
    trigger: { type: 'weekly' },
  };
}

beforeEach(() => {
  notifications.setNotificationChannelAsync.mockReset();
  notifications.setNotificationChannelAsync.mockResolvedValue(null);
  notifications.scheduleNotificationAsync.mockReset();
  notifications.scheduleNotificationAsync.mockResolvedValue('weekly-id');
  notifications.cancelScheduledNotificationAsync.mockReset();
  notifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  notifications.getAllScheduledNotificationsAsync.mockReset();
  notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);

  runningOn('android');
});

afterEach(() => {
  runningOn(originalPlatform);
});

describe('ensurePregnancyWeeklyReminderChannel', () => {
  it('creates the channel with the agreed id, name and importance', async () => {
    await ensurePregnancyWeeklyReminderChannel();

    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'pregnancy-reminders',
      {
        name: 'Gebelik hatırlatıcıları',
        description: PREGNANCY_WEEKLY_REMINDER_CHANNEL_DESCRIPTION,
        importance: notifications.AndroidImportance.DEFAULT,
      }
    );
  });

  it('describes what arrives and when, in Turkish', async () => {
    expect(PREGNANCY_WEEKLY_REMINDER_CHANNEL_DESCRIPTION).toContain('pazartesi');
    expect(PREGNANCY_WEEKLY_REMINDER_CHANNEL_DESCRIPTION).toContain('9:00');
  });

  it('keeps its own channel, so one can be silenced without the other', async () => {
    // Somebody tracking a pregnancy may well want the weekly note and nothing
    // else, and Android only lets them say so per channel.
    expect(PREGNANCY_WEEKLY_REMINDER_CHANNEL_DESCRIPTION).not.toBe(
      PERIOD_REMINDER_CHANNEL_DESCRIPTION
    );
  });

  it('can be called again without complaint', async () => {
    await ensurePregnancyWeeklyReminderChannel();
    await ensurePregnancyWeeklyReminderChannel();

    expect(notifications.setNotificationChannelAsync.mock.calls[0]).toEqual(
      notifications.setNotificationChannelAsync.mock.calls[1]
    );
  });

  it('asks for no channel where there are none', async () => {
    runningOn('ios');

    await ensurePregnancyWeeklyReminderChannel();

    expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('asks for no exact alarm permission', async () => {
    await ensurePregnancyWeeklyReminderChannel();

    expect(Object.keys(notifications)).not.toContain('requestExactAlarmPermission');
  });
});

describe('cancelPregnancyWeeklyReminders', () => {
  it('cancels nothing when the queue is empty', async () => {
    await expect(cancelPregnancyWeeklyReminders()).resolves.toBe(0);
    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels every one it finds', async () => {
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      queued('a', 'pregnancy-weekly-reminder-v1'),
      queued('b', 'pregnancy-weekly-reminder-v1'),
    ]);

    await expect(cancelPregnancyWeeklyReminders()).resolves.toBe(2);
  });

  it('leaves the period reminder exactly where it is', async () => {
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      queued('keep-period', 'period-reminder-v1'),
      queued('ours', 'pregnancy-weekly-reminder-v1'),
      queued('keep-other-app'),
      queued('keep-future-version', 'pregnancy-weekly-reminder-v2'),
    ]);

    await expect(cancelPregnancyWeeklyReminders()).resolves.toBe(1);
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('ours');
  });

  it('survives a queued entry with no content at all', async () => {
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'odd' },
      queued('ours', 'pregnancy-weekly-reminder-v1'),
    ]);

    await expect(cancelPregnancyWeeklyReminders()).resolves.toBe(1);
  });

  it('passes a failure on', async () => {
    notifications.getAllScheduledNotificationsAsync.mockRejectedValue(new Error('queue is gone'));

    await expect(cancelPregnancyWeeklyReminders()).rejects.toThrow('queue is gone');
  });
});

describe('schedulePregnancyWeeklyReminder', () => {
  it('schedules exactly one', async () => {
    await expect(schedulePregnancyWeeklyReminder()).resolves.toBe('weekly-id');
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('says what it says, and nothing medical', async () => {
    await schedulePregnancyWeeklyReminder();
    const { content } = notifications.scheduleNotificationAsync.mock.calls[0][0];

    expect(content.title).toBe('Gebelik takibi');
    expect(content.body).toBe('Bu haftaki gebelik gelişim bilgilerine göz atabilirsin.');
    expect(content.data).toEqual({ type: 'pregnancy-weekly-reminder-v1' });
  });

  it('repeats weekly on Monday at nine, on its own channel', async () => {
    await schedulePregnancyWeeklyReminder();
    const { trigger } = notifications.scheduleNotificationAsync.mock.calls[0][0];

    expect(trigger).toEqual({
      type: 'weekly',
      weekday: 2,
      hour: 9,
      minute: 0,
      channelId: 'pregnancy-reminders',
    });
  });

  it('carries no date, because the system decides which Monday', async () => {
    await schedulePregnancyWeeklyReminder();
    const { trigger } = notifications.scheduleNotificationAsync.mock.calls[0][0];

    expect(trigger).not.toHaveProperty('date');
  });

  it('makes sure of the channel first', async () => {
    await schedulePregnancyWeeklyReminder();

    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
  });

  it('cancels nothing by itself', async () => {
    await schedulePregnancyWeeklyReminder();

    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('passes a failure on', async () => {
    notifications.scheduleNotificationAsync.mockRejectedValue(new Error('queue is full'));

    await expect(schedulePregnancyWeeklyReminder()).rejects.toThrow('queue is full');
  });
});

describe('what a queued pregnancy reminder carries', () => {
  async function queuedRequest() {
    await schedulePregnancyWeeklyReminder();

    return notifications.scheduleNotificationAsync.mock.calls[0][0];
  }

  it('carries no pregnancy data at all', async () => {
    const request = await queuedRequest();

    expect(JSON.stringify(request)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(JSON.stringify(request)).not.toMatch(/hafta \d|due|lmp|skin-tone/i);
  });

  it('carries only the fields it was written with', async () => {
    const request = await queuedRequest();

    expect(Object.keys(request).sort()).toEqual(['content', 'trigger']);
    expect(Object.keys(request.content).sort()).toEqual(['body', 'data', 'title']);
    expect(request.content.data).toEqual({ type: 'pregnancy-weekly-reminder-v1' });
  });
});
