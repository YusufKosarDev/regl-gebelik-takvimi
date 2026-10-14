import type { SQLiteDatabase } from 'expo-sqlite';

import { syncPeriodReminder } from '../sync-period-reminder';

import { periodReminderDate } from '../../domain/period-reminder';
import { schedulePeriodReminder } from '../../infrastructure/period-reminder-scheduler';

import { STALE_PREDICTION_DAYS } from '@/features/cycle/domain/prediction-confidence';
import { predictNextPeriodStart } from '@/features/cycle/domain/predictions';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { addDays, daysBetween } from '@/utils/date';
import { getTodayLocalISODate } from '@/utils/today';

/**
 * What the queue holds when the records are too old to predict from.
 *
 * ## Why this is its own file
 *
 * `sync-period-reminder.test.ts` beside it pins the wiring and is left alone.
 * This is about one rule added later.
 *
 * ## It does not mock the scheduler, and it used to
 *
 * Every assertion below ran against a faked `period-reminder-scheduler`, which
 * is why this file reported a reminder "scheduled" for 1 February on a `today`
 * in April without complaint, and why it claimed one would still be queued on
 * the last day before a record counts as stale. A test file that mocks the
 * thing whose behaviour it depends on cannot fail for the reason it exists.
 *
 * So the real scheduler runs here and only `expo-notifications` is faked. The
 * dates are counted from the real clock rather than written down, because the
 * scheduler reads `Date.now()` and a fixture pinned to a calendar date quietly
 * stops meaning what it meant once that date goes by.
 *
 * ## What that exposed, and what this file now says
 *
 * The gate cannot change what the queue holds. `STALE_PREDICTION_DAYS` is
 * `MAX_CYCLE_LENGTH_DAYS`, and `averageCycleLengthDays` is validated into
 * `[15, 90]`, so by the time a record is stale the day it predicts has already
 * gone - and `schedulePeriodReminder` refuses a moment in the past. There is
 * no profile for which the gate is the thing that prevents a reminder.
 *
 * It stays, because it says in the use case what the arithmetic only implies,
 * and skips a read there is no point making. But the protection is the
 * scheduler's refusal, and this file pins that where it lives rather than
 * asserting the gate and believing a mock.
 */

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

jest.mock('@/features/notifications/data/notification-preferences-repository', () => ({
  loadNotificationPreferences: jest.fn(),
  saveNotificationPreferences: jest.fn(),
  loadDiscreetNotifications: jest.fn(),
  saveDiscreetNotifications: jest.fn(),
}));

jest.mock('@/features/notifications/infrastructure/notification-permission', () => ({
  getNotificationPermissionStatus: jest.fn(),
  ensureNotificationPermission: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const cycleRepository = jest.requireMock('@/features/cycle/data/cycle-repository');
const preferences = jest.requireMock(
  '@/features/notifications/data/notification-preferences-repository'
);
const permission = jest.requireMock(
  '@/features/notifications/infrastructure/notification-permission'
);
const notifications = jest.requireMock('expo-notifications');

const db = {} as SQLiteDatabase;
const TODAY = getTodayLocalISODate();
const CYCLE_LENGTH = 28;

/** A profile whose one record started this many days before today. */
function startedDaysAgo(days: number): CycleProfile {
  return {
    settings: { averageCycleLengthDays: CYCLE_LENGTH, averagePeriodLengthDays: 5 },
    periodRecords: [
      { id: 'record-0', startDate: addDays(TODAY, -days), isOngoing: false },
    ],
  };
}

/** A queued notification of ours, as the system hands it back. */
function queuedReminder(identifier: string) {
  return {
    identifier,
    content: { title: 'x', body: 'y', data: { type: 'period-reminder-v1' } },
    trigger: { type: 'date' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  cycleRepository.loadCycleProfile.mockResolvedValue(startedDaysAgo(10));

  preferences.loadNotificationPreferences.mockResolvedValue({
    periodReminderEnabled: true,
    pregnancyWeeklyReminderEnabled: false,
  });
  preferences.loadDiscreetNotifications.mockResolvedValue(false);

  permission.getNotificationPermissionStatus.mockResolvedValue('granted');

  notifications.setNotificationChannelAsync.mockResolvedValue(null);
  notifications.scheduleNotificationAsync.mockResolvedValue('new-id');
  notifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
});

describe('a record the app still stands behind', () => {
  it('queues a reminder the day before the predicted start', async () => {
    // Ten days in, so the predicted start is eighteen days out and the real
    // scheduler has a future moment to work with.
    const result = await syncPeriodReminder(db, TODAY);

    expect(result.scheduled).toBe(addDays(TODAY, CYCLE_LENGTH - 10 - 1));
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});

describe('a record too old to predict from', () => {
  beforeEach(() => {
    cycleRepository.loadCycleProfile.mockResolvedValue(
      startedDaysAgo(STALE_PREDICTION_DAYS + 1)
    );
  });

  it('queues nothing', async () => {
    const result = await syncPeriodReminder(db, TODAY);

    expect(result.scheduled).toBeNull();
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('still clears whatever was already queued', async () => {
    // The important half, and the one the gate does not cover: somebody who
    // stops logging has a reminder sitting in the queue from before, and
    // leaving it there would deliver the stale date the rest of this refuses
    // to show.
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      queuedReminder('old-1'),
      queuedReminder('old-2'),
    ]);

    const result = await syncPeriodReminder(db, TODAY);

    expect(result.cancelled).toBe(2);
    expect(result.scheduled).toBeNull();
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('queues nothing after a pregnancy, knowing nothing about pregnancies', async () => {
    // Nine months with no periods recorded and the pre-pregnancy records still
    // on file. Nothing in the rule mentions pregnancy; it only knows the last
    // record is old, which is why it also covers the person who simply stopped.
    cycleRepository.loadCycleProfile.mockResolvedValue(startedDaysAgo(280));

    const result = await syncPeriodReminder(db, TODAY);

    expect(result.scheduled).toBeNull();
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

/**
 * Where the protection actually is.
 *
 * These are the assertions the old file could not make, because the thing they
 * are about was the thing it replaced with a mock.
 */
describe('what stops a stale reminder, as opposed to what documents it', () => {
  it('refuses a day that has already gone', async () => {
    await expect(schedulePeriodReminder(addDays(TODAY, -1))).resolves.toBeNull();

    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('has nothing left to refuse by the time a record counts as stale', () => {
    // The old version of this file asserted the opposite - that a reminder was
    // still queued on the last day before the threshold - which only a mocked
    // scheduler could report. `STALE_PREDICTION_DAYS` is the longest cycle the
    // app accepts, so at the threshold the predicted day is already
    // `STALE_PREDICTION_DAYS - averageCycleLengthDays` days behind.
    const atThreshold = startedDaysAgo(STALE_PREDICTION_DAYS);
    const reminderDay = periodReminderDate(predictNextPeriodStart(atThreshold));

    expect(reminderDay).not.toBeNull();
    expect(daysBetween(reminderDay as ISODate, TODAY)).toBeGreaterThan(0);
  });

  it('queues nothing at the threshold either, so the boundary is not a cliff', async () => {
    cycleRepository.loadCycleProfile.mockResolvedValue(
      startedDaysAgo(STALE_PREDICTION_DAYS)
    );

    const result = await syncPeriodReminder(db, TODAY);

    expect(result.scheduled).toBeNull();
  });
});
