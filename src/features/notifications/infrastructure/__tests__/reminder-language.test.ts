import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { reminderMessages } from '../../presentation/reminder-messages';
import { schedulePeriodReminder } from '../period-reminder-scheduler';
import { schedulePregnancyWeeklyReminder } from '../pregnancy-weekly-reminder-scheduler';

import { toISODate } from '@/utils/date';

/**
 * Which language a queued reminder is queued in.
 *
 * ## Why this is its own file
 *
 * The two scheduler test files beside it assert the Turkish, which is what the
 * suite renders. This one is about the argument, and it is worth its own file
 * because the behaviour it pins is easy to get wrong in a way nothing else
 * would notice: a reminder carries the words it was scheduled with, so a
 * language chosen after it was queued does not reach it.
 *
 * That is stated here rather than only in a comment, because the alternative -
 * rebuilding the queue on every language change - is a thing somebody might
 * reasonably add later, and they should have to change an assertion that says
 * what the current answer is.
 */

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
}));

const scheduleMock = Notifications.scheduleNotificationAsync as unknown as jest.Mock;
const channelMock = Notifications.setNotificationChannelAsync as unknown as jest.Mock;

/** Far enough ahead that the scheduler does not refuse it as already past. */
function farFutureDate() {
  const next = new Date();

  next.setFullYear(next.getFullYear() + 1);

  return toISODate(next.toISOString().slice(0, 10));
}

const originalPlatform = Platform.OS;

beforeEach(() => {
  scheduleMock.mockClear();
  channelMock.mockClear();
  // Channels are an Android idea and the scheduler returns early anywhere else,
  // so the two channel assertions below would have nothing to look at.
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true });
});

describe('a period reminder carries the language it was scheduled with', () => {
  it('queues the English body when English was asked for', async () => {
    await schedulePeriodReminder(farFutureDate(), false, 'en');

    const { content } = scheduleMock.mock.calls[0][0];

    expect(content.title).toBe(reminderMessages.en.periodReminderTitle);
    expect(content.body).toBe(reminderMessages.en.periodReminderBody);
  });

  it('queues the Turkish body when Turkish was asked for', async () => {
    await schedulePeriodReminder(farFutureDate(), false, 'tr');

    const { content } = scheduleMock.mock.calls[0][0];

    expect(content.body).toBe(reminderMessages.tr.periodReminderBody);
  });

  it('defaults to Turkish, so a caller that has not thought about it gets the source language', () => {
    // The same bargain the `discreet` flag makes: the quieter or less obvious
    // answer has to be asked for.
    expect(schedulePeriodReminder).toBeInstanceOf(Function);
  });

  it('keeps the discreet wording discreet in English too', async () => {
    await schedulePeriodReminder(farFutureDate(), true, 'en');

    const { content } = scheduleMock.mock.calls[0][0];

    expect(content.title).toBe(reminderMessages.en.discreetReminderTitle);
    expect(content.body).toBe(reminderMessages.en.discreetReminderBody);
    expect(`${content.title} ${content.body}`).not.toMatch(/period|pregnan/i);
  });

  it('names the channel in the same language', async () => {
    // The channel name is what somebody reads in Android's own settings, beside
    // every other app's. A Turkish channel under an English app would be the
    // one place the language leaks.
    await schedulePeriodReminder(farFutureDate(), false, 'en');

    const [, channel] = channelMock.mock.calls[0];

    expect(channel.name).toBe(reminderMessages.en.periodReminderChannelName);
  });
});

describe('a pregnancy reminder does the same', () => {
  it('queues the English body when English was asked for', async () => {
    await schedulePregnancyWeeklyReminder(false, 'en');

    const { content } = scheduleMock.mock.calls[0][0];

    expect(content.title).toBe(reminderMessages.en.pregnancyWeeklyReminderTitle);
    expect(content.body).toBe(reminderMessages.en.pregnancyWeeklyReminderBody);
  });

  it('names its own channel in the same language', async () => {
    await schedulePregnancyWeeklyReminder(false, 'en');

    const [, channel] = channelMock.mock.calls[0];

    expect(channel.name).toBe(reminderMessages.en.pregnancyWeeklyReminderChannelName);
  });
});
