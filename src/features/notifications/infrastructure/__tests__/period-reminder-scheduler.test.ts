import { Platform } from 'react-native';

import {
  DISCREET_REMINDER_BODY,
  DISCREET_REMINDER_TITLE,
  PERIOD_REMINDER_CHANNEL_DESCRIPTION,
} from '../../presentation/reminder-messages';

import {
  cancelPeriodReminders,
  ensurePeriodReminderChannel,
  periodReminderMoment,
  schedulePeriodReminder,
} from '../period-reminder-scheduler';

import type { ISODate } from '@/types/iso-date';

jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2 },
  // Still here, and deliberately unused. The enum exists in the real library,
  // and a mock without it would make re-adding the visibility option fail as a
  // missing export rather than as the thing it is: an option Android discards.
  AndroidNotificationVisibility: { UNKNOWN: 0, PUBLIC: 1, PRIVATE: 2, SECRET: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const notifications = jest.requireMock('expo-notifications');
const date = (value: string) => value as ISODate;

/**
 * jest-expo runs each file under several platforms, so the one under test is
 * stated rather than inherited.
 */
const originalPlatform = Platform.OS;

function runningOn(os: string) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

/** A queued notification, as the system hands it back. */
function queued(identifier: string, type?: string) {
  return {
    identifier,
    content: { title: 'x', body: 'y', data: type === undefined ? {} : { type } },
    trigger: { type: 'date' },
  };
}

beforeEach(() => {
  notifications.setNotificationChannelAsync.mockReset();
  notifications.setNotificationChannelAsync.mockResolvedValue(null);
  notifications.scheduleNotificationAsync.mockReset();
  notifications.scheduleNotificationAsync.mockResolvedValue('new-id');
  notifications.cancelScheduledNotificationAsync.mockReset();
  notifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  notifications.getAllScheduledNotificationsAsync.mockReset();
  notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);

  runningOn('android');

  jest.useFakeTimers();
  // Well before any date these tests schedule for.
  jest.setSystemTime(new Date(2026, 8, 18, 12, 0, 0));
});

afterEach(() => {
  runningOn(originalPlatform);
  jest.useRealTimers();
});

describe('ensurePeriodReminderChannel', () => {
  it('creates the channel with the agreed id, name, description and importance', async () => {
    await ensurePeriodReminderChannel();

    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith('period-reminders', {
      name: 'Regl hatırlatıcıları',
      description: PERIOD_REMINDER_CHANNEL_DESCRIPTION,
      importance: notifications.AndroidImportance.DEFAULT,
    });
  });

  /**
   * ## This test is here to stop `lockscreenVisibility` coming back
   *
   * It used to be called "hides the notification from the lock screen" and it
   * asserted that `setNotificationChannelAsync` was called with
   * `lockscreenVisibility: SECRET`. It passed for as long as it existed, and
   * the notification was printed in full on the lock screen the whole time.
   *
   * Android does not let an app choose a channel's lock screen visibility.
   * When the owning app creates the channel, the platform replaces whatever was
   * asked for with the *package's* visibility — the person's setting, which
   * defaults to "not set". Measured on a clean install with a device PIN set:
   * `mLockscreenVisibility=-1000`, while the name, description and importance
   * from the same call all landed.
   *
   * The lesson is the reason this is worded the way it is. A test that asserts
   * what we asked a platform for proves we asked. It says nothing about whether
   * anything happened, and naming it after the effect turns that gap into a
   * false guarantee that survives review.
   *
   * What replaced the option is `discreetNotifications`, which changes the
   * words rather than trying to hide them — see `set-discreet-notifications.ts`.
   */
  it('asks for no lock screen visibility, because Android discards it', async () => {
    await ensurePeriodReminderChannel();

    const [, options] = notifications.setNotificationChannelAsync.mock.calls[0];

    expect(options).not.toHaveProperty('lockscreenVisibility');
  });

  it('describes what arrives and when, in Turkish', async () => {
    // This is read in Android's own notification settings, beside every other
    // app's. A name alone does not say whether it is one a month or one a day.
    expect(PERIOD_REMINDER_CHANNEL_DESCRIPTION).toContain('bir gün önce');
    expect(PERIOD_REMINDER_CHANNEL_DESCRIPTION).toContain('sabah saatlerinde');
    expect(PERIOD_REMINDER_CHANNEL_DESCRIPTION.length).toBeGreaterThan(20);
  });

  it('promises no exact minute, because the app cannot keep one', async () => {
    // Without the exact-alarm permission Android schedules these inexactly —
    // the alarm carries a one-hour window — so naming a clock time would be a
    // promise the app has no way to keep.
    expect(PERIOD_REMINDER_CHANNEL_DESCRIPTION).not.toMatch(/d{1,2}[:.]d{2}/);
  });

  it('can be called again without complaint', async () => {
    // `setNotificationChannelAsync` creates it if it is not there, so calling it
    // again is how you make sure of it rather than a mistake.
    await ensurePeriodReminderChannel();
    await ensurePeriodReminderChannel();

    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(2);
    expect(notifications.setNotificationChannelAsync.mock.calls[0]).toEqual(
      notifications.setNotificationChannelAsync.mock.calls[1]
    );
  });

  it('asks for no exact alarm permission', async () => {
    await ensurePeriodReminderChannel();

    expect(Object.keys(notifications)).not.toContain('requestExactAlarmPermission');
  });

  it('asks for no channel where there are none', async () => {
    runningOn('ios');

    await ensurePeriodReminderChannel();

    expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});

describe('periodReminderMoment', () => {
  it('is nine in the morning, local, on that day', () => {
    const moment = new Date(periodReminderMoment(date('2026-10-14')));

    expect(moment.getFullYear()).toBe(2026);
    expect(moment.getMonth()).toBe(9);
    expect(moment.getDate()).toBe(14);
    expect(moment.getHours()).toBe(9);
    expect(moment.getMinutes()).toBe(0);
    expect(moment.getSeconds()).toBe(0);
  });

  it('is the same moment every time', () => {
    expect(periodReminderMoment(date('2026-10-14'))).toBe(periodReminderMoment(date('2026-10-14')));
  });
});

describe('cancelPeriodReminders', () => {
  it('cancels nothing when the queue is empty', async () => {
    await expect(cancelPeriodReminders()).resolves.toBe(0);
    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels every period reminder it finds', async () => {
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      queued('a', 'period-reminder-v1'),
      queued('b', 'period-reminder-v1'),
    ]);

    await expect(cancelPeriodReminders()).resolves.toBe(2);
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('a');
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('b');
  });

  it('leaves everything else alone', async () => {
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      queued('keep-pregnancy', 'pregnancy-weekly-reminder-v1'),
      queued('ours', 'period-reminder-v1'),
      queued('keep-other-app'),
      queued('keep-future-version', 'period-reminder-v2'),
    ]);

    await expect(cancelPeriodReminders()).resolves.toBe(1);
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('ours');
  });

  it('survives a queued entry with no content at all', async () => {
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'odd' },
      queued('ours', 'period-reminder-v1'),
    ]);

    await expect(cancelPeriodReminders()).resolves.toBe(1);
  });

  it('passes a failure on', async () => {
    notifications.getAllScheduledNotificationsAsync.mockRejectedValue(new Error('queue is gone'));

    await expect(cancelPeriodReminders()).rejects.toThrow('queue is gone');
  });
});

describe('schedulePeriodReminder', () => {
  it('schedules one on the given day', async () => {
    await expect(schedulePeriodReminder(date('2026-10-14'))).resolves.toBe('new-id');
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('says what it says, and nothing more certain', async () => {
    await schedulePeriodReminder(date('2026-10-14'));
    const { content } = notifications.scheduleNotificationAsync.mock.calls[0][0];

    expect(content.title).toBe('Regl hatırlatıcısı');
    expect(content.body).toBe('Tahminine göre regl dönemin yaklaşıyor.');
    expect(content.data).toEqual({ type: 'period-reminder-v1' });
  });

  it('triggers on the date, at nine, on its own channel', async () => {
    await schedulePeriodReminder(date('2026-10-14'));
    const { trigger } = notifications.scheduleNotificationAsync.mock.calls[0][0];

    expect(trigger.type).toBe('date');
    expect(trigger.channelId).toBe('period-reminders');
    expect(new Date(trigger.date).getHours()).toBe(9);
    expect(new Date(trigger.date).getDate()).toBe(14);
  });

  it('makes sure of the channel first', async () => {
    await schedulePeriodReminder(date('2026-10-14'));

    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
  });

  it('schedules nothing for a moment that has passed', async () => {
    // No safe-looking hour is invented later the same day: that hour would be
    // picked rather than chosen, and the next cycle change looks again.
    jest.setSystemTime(new Date(2026, 9, 14, 9, 0, 1));

    await expect(schedulePeriodReminder(date('2026-10-14'))).resolves.toBeNull();
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules nothing when the moment is exactly now', async () => {
    jest.setSystemTime(new Date(2026, 9, 14, 9, 0, 0));

    await expect(schedulePeriodReminder(date('2026-10-14'))).resolves.toBeNull();
  });

  it('schedules one a minute before the moment', async () => {
    jest.setSystemTime(new Date(2026, 9, 14, 8, 59, 0));

    await expect(schedulePeriodReminder(date('2026-10-14'))).resolves.toBe('new-id');
  });

  it('schedules nothing for a day already gone', async () => {
    jest.setSystemTime(new Date(2026, 9, 20, 0, 0, 0));

    await expect(schedulePeriodReminder(date('2026-10-14'))).resolves.toBeNull();
  });

  it('touches no channel when it schedules nothing', async () => {
    jest.setSystemTime(new Date(2026, 9, 20, 0, 0, 0));

    await schedulePeriodReminder(date('2026-10-14'));

    expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('cancels nothing by itself', async () => {
    await schedulePeriodReminder(date('2026-10-14'));

    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('passes a failure on', async () => {
    notifications.scheduleNotificationAsync.mockRejectedValue(new Error('queue is full'));

    await expect(schedulePeriodReminder(date('2026-10-14'))).rejects.toThrow('queue is full');
  });
});

describe('what a queued period reminder carries', () => {
  /** The whole request, as the system would store it until it fires. */
  async function queuedRequest() {
    await schedulePeriodReminder(date('2026-10-15'));

    return notifications.scheduleNotificationAsync.mock.calls[0][0];
  }

  it('carries no cycle data beyond the moment it should arrive', async () => {
    const request = await queuedRequest();
    const withoutTrigger = JSON.stringify({ ...request, trigger: undefined });

    // The date it fires on is the point of the thing; nothing else about the
    // cycle goes with it, and a notification tray is not a private place.
    expect(withoutTrigger).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(withoutTrigger).not.toMatch(/cycleDay|phase|fertility|skin-tone/i);
  });

  it('carries only the fields it was written with', async () => {
    const request = await queuedRequest();

    expect(Object.keys(request).sort()).toEqual(['content', 'trigger']);
    expect(Object.keys(request.content).sort()).toEqual(['body', 'data', 'title']);
    expect(request.content.data).toEqual({ type: 'period-reminder-v1' });
  });

  it('says nothing certain about a body it cannot know', async () => {
    const request = await queuedRequest();

    expect(request.content.body).not.toMatch(/bugün başlayacak|kesin|hamile|gebe/i);
  });
});

describe('schedulePeriodReminder and the discreet wording', () => {
  it('says nothing about a period when the phone has asked for that', async () => {
    await schedulePeriodReminder(date('2026-10-14'), true);
    const { content } = notifications.scheduleNotificationAsync.mock.calls[0][0];

    expect(content.title).toBe(DISCREET_REMINDER_TITLE);
    expect(content.body).toBe(DISCREET_REMINDER_BODY);
  });

  /**
   * The lock screen prints whatever is here, so this is the assertion that
   * matters: not that the neutral strings were used, but that nothing about a
   * cycle survives into them.
   */
  it('carries none of the words the full version does', async () => {
    await schedulePeriodReminder(date('2026-10-14'), true);
    const { content } = notifications.scheduleNotificationAsync.mock.calls[0][0];
    const shown = `${content.title} ${content.body}`.toLocaleLowerCase('tr-TR');

    for (const word of ['regl', 'döngü', 'gebelik', 'adet', 'period']) {
      expect(shown).not.toContain(word);
    }
  });

  it('says the full sentence when it has not', async () => {
    await schedulePeriodReminder(date('2026-10-14'), false);
    const { content } = notifications.scheduleNotificationAsync.mock.calls[0][0];

    expect(content.title).toBe('Regl hatırlatıcısı');
    expect(content.body).toBe('Tahminine göre regl dönemin yaklaşıyor.');
  });

  /**
   * The loud version is the default, so a caller that has not thought about it
   * cannot make everybody's reminders vaguer by omission. The quiet one has to
   * be asked for.
   */
  it('says the full sentence when nobody says otherwise', async () => {
    await schedulePeriodReminder(date('2026-10-14'));
    const { content } = notifications.scheduleNotificationAsync.mock.calls[0][0];

    expect(content.title).toBe('Regl hatırlatıcısı');
  });

  it('changes nothing else about the reminder', async () => {
    // Same type, same channel, same moment: this is a rewording, and anything
    // that found the reminder by its payload must still find it.
    await schedulePeriodReminder(date('2026-10-14'), true);
    const { content, trigger } = notifications.scheduleNotificationAsync.mock.calls[0][0];

    expect(content.data).toEqual({ type: 'period-reminder-v1' });
    expect(trigger.channelId).toBe('period-reminders');
    expect(new Date(trigger.date).getHours()).toBe(9);
  });
});
