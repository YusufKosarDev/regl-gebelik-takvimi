import type { SQLiteDatabase } from 'expo-sqlite';

import { syncPeriodReminder } from '../sync-period-reminder';

import { STALE_PREDICTION_DAYS } from '@/features/cycle/domain/prediction-confidence';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { addDays, toISODate } from '@/utils/date';

/**
 * What the queue holds when the records are too old to predict from.
 *
 * ## Why this is its own file
 *
 * `sync-period-reminder.test.ts` beside it pins the wiring and is left alone.
 * This is about one rule added later, and it is worth having because the
 * failure it prevents is invisible: a reminder scheduled from a stale
 * prediction either arrives at the wrong time or never arrives at all, and
 * either way the person has no way of knowing the app had stopped standing
 * behind the date it used.
 *
 * The home screen already withholds a stale date. Without this the notification
 * would still be queued from it, which is the app contradicting itself in the
 * one place the reasoning is not visible.
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

jest.mock('@/features/notifications/infrastructure/period-reminder-scheduler', () => ({
  cancelPeriodReminders: jest.fn(),
  schedulePeriodReminder: jest.fn(),
  ensurePeriodReminderChannel: jest.fn(),
  periodReminderMoment: jest.fn(),
}));

const cycleRepository = jest.requireMock('@/features/cycle/data/cycle-repository');
const preferences = jest.requireMock(
  '@/features/notifications/data/notification-preferences-repository'
);
const permission = jest.requireMock(
  '@/features/notifications/infrastructure/notification-permission'
);
const scheduler = jest.requireMock(
  '@/features/notifications/infrastructure/period-reminder-scheduler'
);

const db = {} as SQLiteDatabase;
const LAST_START = toISODate('2026-01-05');

const PROFILE: CycleProfile = {
  settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
  periodRecords: [{ id: 'record-0', startDate: LAST_START, isOngoing: false }],
};

beforeEach(() => {
  jest.clearAllMocks();
  cycleRepository.loadCycleProfile.mockResolvedValue(PROFILE);
  preferences.loadNotificationPreferences.mockResolvedValue({
    periodReminderEnabled: true,
    pregnancyWeeklyReminderEnabled: false,
  });
  preferences.loadDiscreetNotifications.mockResolvedValue(false);
  permission.getNotificationPermissionStatus.mockResolvedValue('granted');
  scheduler.cancelPeriodReminders.mockResolvedValue(0);
  scheduler.schedulePeriodReminder.mockResolvedValue(undefined);
  scheduler.periodReminderMoment.mockReturnValue(new Date('2026-02-01T09:00:00Z'));
});

describe('a record the app still stands behind', () => {
  it('queues a reminder as usual', async () => {
    const result = await syncPeriodReminder(db, addDays(LAST_START, 10) as ISODate);

    expect(result.scheduled).not.toBeNull();
    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledTimes(1);
  });

  it('still queues one on the last day before the record counts as stale', async () => {
    // The boundary, so the rule is a decision rather than something that
    // happens to hold for the dates this file picked.
    const result = await syncPeriodReminder(
      db,
      addDays(LAST_START, STALE_PREDICTION_DAYS) as ISODate
    );

    expect(result.scheduled).not.toBeNull();
  });
});

describe('a record too old to predict from', () => {
  it('queues nothing', async () => {
    const result = await syncPeriodReminder(
      db,
      addDays(LAST_START, STALE_PREDICTION_DAYS + 1) as ISODate
    );

    expect(result.scheduled).toBeNull();
    expect(scheduler.schedulePeriodReminder).not.toHaveBeenCalled();
  });

  it('still clears whatever was already queued', async () => {
    // The important half. Somebody who stops logging has a reminder sitting in
    // the queue from before; leaving it there would deliver the stale date the
    // rest of this is about refusing to show.
    scheduler.cancelPeriodReminders.mockResolvedValue(2);

    const result = await syncPeriodReminder(
      db,
      addDays(LAST_START, STALE_PREDICTION_DAYS + 1) as ISODate
    );

    expect(result.cancelled).toBe(2);
    expect(result.scheduled).toBeNull();
  });

  it('queues nothing after a pregnancy, knowing nothing about pregnancies', async () => {
    // Nine months with no periods recorded and the pre-pregnancy records still
    // on file. Nothing in the rule mentions pregnancy; it only knows the last
    // record is old, which is why it also covers the person who simply stopped.
    const result = await syncPeriodReminder(db, addDays(LAST_START, 280) as ISODate);

    expect(result.scheduled).toBeNull();
  });
});
