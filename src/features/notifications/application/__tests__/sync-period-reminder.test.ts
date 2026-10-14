import type { SQLiteDatabase } from 'expo-sqlite';

import {
  syncPeriodReminder,
  syncPeriodReminderQuietly,
} from '../sync-period-reminder';

import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { addDays } from '@/utils/date';
import { getTodayLocalISODate } from '@/utils/today';

// The database reads, the permission and the queue are faked. The dashboard,
// the prediction and the reminder's own date arithmetic stay real, so this pins
// the wiring rather than restating it.
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
const date = (value: string) => value as ISODate;

/**
 * Counted from the clock, and it used to be written down.
 *
 * This file read `today` as '2026-09-18' against a record on '2026-09-01',
 * and asserted a reminder scheduled for '2026-09-28'. That was a future day
 * when it was written and a past one from 29 September, at which point the
 * real scheduler would have refused the moment - `schedulePeriodReminder`
 * returns `null` for one that has gone - and only the mock below still said
 * yes. Five assertions were naming days that had already passed.
 *
 * The mock stays, because the nineteen assertions around them are about this
 * use case's own contract: what it cancels, in what order, and which flag and
 * language it hands on. Mocking that boundary is the right shape. What was
 * wrong was naming a date as the outcome while mocking away the rule that
 * decides whether a date can be an outcome.
 *
 * So the dates move with the clock. Seventeen days into a 28-day cycle, which
 * is what the old fixture described, leaves the predicted start eleven days
 * out and the reminder ten - always ahead, on any day this suite is run.
 */
const TODAY = getTodayLocalISODate();
const CYCLE_LENGTH = 28;
const DAYS_IN = 17;

/** The record everything here counts from, seventeen days back. */
const LATEST_START = addDays(TODAY, -DAYS_IN);

/** Where that lands: the predicted start, and the day before it. */
const PREDICTED_START = addDays(LATEST_START, CYCLE_LENGTH);
const REMINDER_DAY = addDays(PREDICTED_START, -1);

/** A more recent record, for the case where the prediction moves. */
const RECENT_START = addDays(TODAY, -8);
const RECENT_REMINDER_DAY = addDays(addDays(RECENT_START, CYCLE_LENGTH), -1);

function profile(startDates: string[] = [LATEST_START]): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: startDates.map((startDate, index) => ({
      id: `record-${index}`,
      startDate: date(startDate),
      isOngoing: false,
    })),
  };
}

beforeEach(() => {
  cycleRepository.loadCycleProfile.mockReset();
  cycleRepository.loadCycleProfile.mockResolvedValue(profile());
  cycleRepository.saveCycleProfile.mockReset();

  preferences.loadNotificationPreferences.mockReset();
  preferences.loadNotificationPreferences.mockResolvedValue({
    periodReminderEnabled: true,
    pregnancyWeeklyReminderEnabled: false,
  });
  preferences.saveNotificationPreferences.mockReset();

  // Off is the app's default wording, so it is the baseline these tests read
  // against; the cases about the quiet wording set it themselves.
  preferences.loadDiscreetNotifications.mockReset();
  preferences.loadDiscreetNotifications.mockResolvedValue(false);
  preferences.saveDiscreetNotifications.mockReset();

  permission.getNotificationPermissionStatus.mockReset();
  permission.getNotificationPermissionStatus.mockResolvedValue('granted');

  scheduler.cancelPeriodReminders.mockReset();
  scheduler.cancelPeriodReminders.mockResolvedValue(0);
  scheduler.schedulePeriodReminder.mockReset();
  scheduler.schedulePeriodReminder.mockResolvedValue('new-id');
});

describe('syncPeriodReminder when the reminder is off', () => {
  beforeEach(() => {
    preferences.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: false,
      pregnancyWeeklyReminderEnabled: true,
    });
  });

  it('takes the queued reminder back out', async () => {
    scheduler.cancelPeriodReminders.mockResolvedValue(1);

    await expect(syncPeriodReminder(db, TODAY)).resolves.toEqual({
      scheduled: null,
      cancelled: 1,
    });
  });

  it('schedules nothing', async () => {
    await syncPeriodReminder(db, TODAY);

    expect(scheduler.schedulePeriodReminder).not.toHaveBeenCalled();
  });

  it('does not even read the cycle', async () => {
    await syncPeriodReminder(db, TODAY);

    expect(cycleRepository.loadCycleProfile).not.toHaveBeenCalled();
  });

  it('cancels only period reminders, which is all that function touches', async () => {
    await syncPeriodReminder(db, TODAY);

    expect(scheduler.cancelPeriodReminders).toHaveBeenCalledTimes(1);
    expect(scheduler.cancelPeriodReminders).toHaveBeenCalledWith();
  });
});

describe('syncPeriodReminder when the reminder is on', () => {
  it('schedules one a day before the predicted start', async () => {
    const result = await syncPeriodReminder(db, TODAY);

    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledWith(REMINDER_DAY, false, 'tr');
    expect(result.scheduled).toBe(REMINDER_DAY);
  });

  it('carries the quiet wording when this phone has asked for it', async () => {
    // The words are fixed when the notification is queued, so this argument is
    // the only moment the setting can reach the reminder that arrives.
    preferences.loadDiscreetNotifications.mockResolvedValue(true);

    await syncPeriodReminder(db, TODAY);

    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledWith(REMINDER_DAY, true, 'tr');
  });

  /**
   * The wording is this device's answer, not the account's.
   *
   * `loadNotificationPreferences` is what cloud sync carries. Reading the
   * wording from there would mean a second phone, signed into the same account,
   * inheriting a decision made about somebody else's lock screen.
   */
  it('reads the wording from the device, not from the synced preferences', async () => {
    preferences.loadDiscreetNotifications.mockResolvedValue(true);

    await syncPeriodReminder(db, TODAY);

    expect(preferences.loadDiscreetNotifications).toHaveBeenCalledTimes(1);
  });

  it('takes the old one out before putting a new one in', async () => {
    scheduler.cancelPeriodReminders.mockResolvedValue(1);

    const result = await syncPeriodReminder(db, TODAY);

    expect(scheduler.cancelPeriodReminders).toHaveBeenCalledTimes(1);
    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledTimes(1);
    expect(result.cancelled).toBe(1);
  });

  it('leaves exactly one behind however many were there', async () => {
    scheduler.cancelPeriodReminders.mockResolvedValue(3);

    await syncPeriodReminder(db, TODAY);

    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledTimes(1);
  });

  it('follows the prediction when the cycle changes', async () => {
    cycleRepository.loadCycleProfile.mockResolvedValue(profile([RECENT_START]));

    await syncPeriodReminder(db, TODAY);

    // A record eight days back rather than seventeen, so the predicted start
    // and the reminder both move nine days later.
    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledWith(
      RECENT_REMINDER_DAY,
      false,
      'tr'
    );
  });

  /**
   * The order is the property here, which is why this asserts calls.
   *
   * Between cancelling and scheduling, the queue holds nothing. A kill in that
   * gap loses the reminder until the app is next opened - and for somebody who
   * logs a period and then closes the app for a month, that is the reminder
   * they needed. The discreet read used to sit inside the gap, so the gap
   * contained a SQLite round trip as well as a bridge call.
   *
   * #38 is narrowed by this, not closed: a kill between the cancel and the
   * schedule still loses it. What this refuses is anybody widening the gap
   * again by moving work into it.
   */
  it('reads the wording before emptying the queue, not inside the gap', async () => {
    await syncPeriodReminder(db, TODAY);

    const read = preferences.loadDiscreetNotifications.mock.invocationCallOrder[0];
    const cancel = scheduler.cancelPeriodReminders.mock.invocationCallOrder[0];

    expect(read).toBeLessThan(cancel);
  });

  it('still cancels before it schedules, which is the documented order', async () => {
    // Deliberately not swapped. Scheduling first would close the gap and open
    // a worse one: a failed cancel would leave a reminder queued for a date
    // the prediction has since moved off, which is the app stating something
    // it no longer believes.
    await syncPeriodReminder(db, TODAY);

    const cancel = scheduler.cancelPeriodReminders.mock.invocationCallOrder[0];
    const schedule = scheduler.schedulePeriodReminder.mock.invocationCallOrder[0];

    expect(cancel).toBeLessThan(schedule);
  });

  it('reads the prediction rather than working one out', async () => {
    await syncPeriodReminder(db, TODAY);

    expect(cycleRepository.loadCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('syncPeriodReminder with nothing to be early about', () => {
  it('schedules nothing when there is no cycle profile', async () => {
    cycleRepository.loadCycleProfile.mockResolvedValue(null);

    const result = await syncPeriodReminder(db, TODAY);

    expect(scheduler.schedulePeriodReminder).not.toHaveBeenCalled();
    expect(result.scheduled).toBeNull();
  });

  it('does not read the wording when there is nothing to schedule', async () => {
    // The claim the staleness gate's comment makes about skipping a pointless
    // read. Moving that read above the cancel must not have made it
    // unconditional.
    cycleRepository.loadCycleProfile.mockResolvedValue(null);

    await syncPeriodReminder(db, TODAY);

    expect(preferences.loadDiscreetNotifications).not.toHaveBeenCalled();
  });

  it('schedules nothing when nothing has been recorded', async () => {
    cycleRepository.loadCycleProfile.mockResolvedValue(profile([]));

    await syncPeriodReminder(db, TODAY);

    expect(scheduler.schedulePeriodReminder).not.toHaveBeenCalled();
  });

  it('still clears whatever was queued', async () => {
    cycleRepository.loadCycleProfile.mockResolvedValue(null);
    scheduler.cancelPeriodReminders.mockResolvedValue(1);

    const result = await syncPeriodReminder(db, TODAY);

    expect(result.cancelled).toBe(1);
  });

  it('reports nothing scheduled when the moment has already passed', async () => {
    // The scheduler refuses a moment in the past rather than moving it.
    scheduler.schedulePeriodReminder.mockResolvedValue(null);

    const result = await syncPeriodReminder(db, TODAY);

    expect(result.scheduled).toBeNull();
    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledTimes(1);
  });
});

describe('syncPeriodReminder without permission', () => {
  it.each(['denied', 'undetermined'] as const)('schedules nothing for %s', async (status) => {
    permission.getNotificationPermissionStatus.mockResolvedValue(status);

    const result = await syncPeriodReminder(db, TODAY);

    expect(scheduler.schedulePeriodReminder).not.toHaveBeenCalled();
    expect(result.scheduled).toBeNull();
  });

  it('clears the queue, so nothing is left that cannot be delivered', async () => {
    permission.getNotificationPermissionStatus.mockResolvedValue('denied');
    scheduler.cancelPeriodReminders.mockResolvedValue(1);

    await expect(syncPeriodReminder(db, TODAY)).resolves.toEqual({
      scheduled: null,
      cancelled: 1,
    });
  });

  it('asks for no permission of its own', async () => {
    await syncPeriodReminder(db, TODAY);

    // Reading is fine on any path; a dialog here would appear with no tap
    // behind it.
    expect(permission.ensureNotificationPermission).not.toHaveBeenCalled();
  });
});

describe('syncPeriodReminder leaves the rest of the queue alone', () => {
  it('never cancels anything by identifier of its own choosing', async () => {
    await syncPeriodReminder(db, TODAY);

    // Everything it removes goes through the one function that filters on type.
    expect(Object.keys(scheduler)).toContain('cancelPeriodReminders');
    expect(scheduler.cancelPeriodReminders).toHaveBeenCalledWith();
  });

  it('writes nothing to the database', async () => {
    await syncPeriodReminder(db, TODAY);

    expect(cycleRepository.saveCycleProfile).not.toHaveBeenCalled();
    expect(preferences.saveNotificationPreferences).not.toHaveBeenCalled();
  });
});

describe('syncPeriodReminder when something fails', () => {
  it.each([
    ['the preferences read', () => preferences.loadNotificationPreferences],
    ['the cycle read', () => cycleRepository.loadCycleProfile],
    ['the permission read', () => permission.getNotificationPermissionStatus],
    ['the cancel', () => scheduler.cancelPeriodReminders],
    ['the schedule', () => scheduler.schedulePeriodReminder],
  ])('passes a failure in %s on', async (_label, mock) => {
    mock().mockRejectedValue(new Error('something broke'));

    await expect(syncPeriodReminder(db, TODAY)).rejects.toThrow('something broke');
  });
});

describe('syncPeriodReminderQuietly', () => {
  it('returns what the sync did', async () => {
    await expect(syncPeriodReminderQuietly(db, TODAY)).resolves.toEqual({
      scheduled: REMINDER_DAY,
      cancelled: 0,
    });
  });

  it.each([
    ['the queue', () => scheduler.schedulePeriodReminder],
    ['the database', () => cycleRepository.loadCycleProfile],
  ])('swallows a failure in %s and says so with null', async (_label, mock) => {
    mock().mockRejectedValue(new Error('something broke'));

    await expect(syncPeriodReminderQuietly(db, TODAY)).resolves.toBeNull();
  });

  it('leaves the database untouched when it fails', async () => {
    scheduler.schedulePeriodReminder.mockRejectedValue(new Error('queue is full'));

    await syncPeriodReminderQuietly(db, TODAY);

    expect(cycleRepository.saveCycleProfile).not.toHaveBeenCalled();
  });
});
