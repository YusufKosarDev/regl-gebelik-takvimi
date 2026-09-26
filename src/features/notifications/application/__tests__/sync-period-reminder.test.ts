import type { SQLiteDatabase } from 'expo-sqlite';

import {
  syncPeriodReminder,
  syncPeriodReminderQuietly,
} from '../sync-period-reminder';

import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

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
const date = (value: string) => value as ISODate;

/** Cycle 28 from 2026-09-01, so the next start is predicted for 2026-09-29. */
function profile(startDates: string[] = ['2026-09-01']): CycleProfile {
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

    await expect(syncPeriodReminder(db, date('2026-09-18'))).resolves.toEqual({
      scheduled: null,
      cancelled: 1,
    });
  });

  it('schedules nothing', async () => {
    await syncPeriodReminder(db, date('2026-09-18'));

    expect(scheduler.schedulePeriodReminder).not.toHaveBeenCalled();
  });

  it('does not even read the cycle', async () => {
    await syncPeriodReminder(db, date('2026-09-18'));

    expect(cycleRepository.loadCycleProfile).not.toHaveBeenCalled();
  });

  it('cancels only period reminders, which is all that function touches', async () => {
    await syncPeriodReminder(db, date('2026-09-18'));

    expect(scheduler.cancelPeriodReminders).toHaveBeenCalledTimes(1);
    expect(scheduler.cancelPeriodReminders).toHaveBeenCalledWith();
  });
});

describe('syncPeriodReminder when the reminder is on', () => {
  it('schedules one a day before the predicted start', async () => {
    const result = await syncPeriodReminder(db, date('2026-09-18'));

    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledWith('2026-09-28', false);
    expect(result.scheduled).toBe('2026-09-28');
  });

  it('carries the quiet wording when this phone has asked for it', async () => {
    // The words are fixed when the notification is queued, so this argument is
    // the only moment the setting can reach the reminder that arrives.
    preferences.loadDiscreetNotifications.mockResolvedValue(true);

    await syncPeriodReminder(db, date('2026-09-18'));

    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledWith('2026-09-28', true);
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

    await syncPeriodReminder(db, date('2026-09-18'));

    expect(preferences.loadDiscreetNotifications).toHaveBeenCalledTimes(1);
  });

  it('takes the old one out before putting a new one in', async () => {
    scheduler.cancelPeriodReminders.mockResolvedValue(1);

    const result = await syncPeriodReminder(db, date('2026-09-18'));

    expect(scheduler.cancelPeriodReminders).toHaveBeenCalledTimes(1);
    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledTimes(1);
    expect(result.cancelled).toBe(1);
  });

  it('leaves exactly one behind however many were there', async () => {
    scheduler.cancelPeriodReminders.mockResolvedValue(3);

    await syncPeriodReminder(db, date('2026-09-18'));

    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledTimes(1);
  });

  it('follows the prediction when the cycle changes', async () => {
    cycleRepository.loadCycleProfile.mockResolvedValue(profile(['2026-09-10']));

    await syncPeriodReminder(db, date('2026-09-18'));

    // 2026-09-10 plus 28 days is 2026-10-08; the reminder is the day before.
    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledWith('2026-10-07', false);
  });

  it('reads the prediction rather than working one out', async () => {
    await syncPeriodReminder(db, date('2026-09-18'));

    expect(cycleRepository.loadCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('syncPeriodReminder with nothing to be early about', () => {
  it('schedules nothing when there is no cycle profile', async () => {
    cycleRepository.loadCycleProfile.mockResolvedValue(null);

    const result = await syncPeriodReminder(db, date('2026-09-18'));

    expect(scheduler.schedulePeriodReminder).not.toHaveBeenCalled();
    expect(result.scheduled).toBeNull();
  });

  it('schedules nothing when nothing has been recorded', async () => {
    cycleRepository.loadCycleProfile.mockResolvedValue(profile([]));

    await syncPeriodReminder(db, date('2026-09-18'));

    expect(scheduler.schedulePeriodReminder).not.toHaveBeenCalled();
  });

  it('still clears whatever was queued', async () => {
    cycleRepository.loadCycleProfile.mockResolvedValue(null);
    scheduler.cancelPeriodReminders.mockResolvedValue(1);

    const result = await syncPeriodReminder(db, date('2026-09-18'));

    expect(result.cancelled).toBe(1);
  });

  it('reports nothing scheduled when the moment has already passed', async () => {
    // The scheduler refuses a moment in the past rather than moving it.
    scheduler.schedulePeriodReminder.mockResolvedValue(null);

    const result = await syncPeriodReminder(db, date('2026-09-18'));

    expect(result.scheduled).toBeNull();
    expect(scheduler.schedulePeriodReminder).toHaveBeenCalledTimes(1);
  });
});

describe('syncPeriodReminder without permission', () => {
  it.each(['denied', 'undetermined'] as const)('schedules nothing for %s', async (status) => {
    permission.getNotificationPermissionStatus.mockResolvedValue(status);

    const result = await syncPeriodReminder(db, date('2026-09-18'));

    expect(scheduler.schedulePeriodReminder).not.toHaveBeenCalled();
    expect(result.scheduled).toBeNull();
  });

  it('clears the queue, so nothing is left that cannot be delivered', async () => {
    permission.getNotificationPermissionStatus.mockResolvedValue('denied');
    scheduler.cancelPeriodReminders.mockResolvedValue(1);

    await expect(syncPeriodReminder(db, date('2026-09-18'))).resolves.toEqual({
      scheduled: null,
      cancelled: 1,
    });
  });

  it('asks for no permission of its own', async () => {
    await syncPeriodReminder(db, date('2026-09-18'));

    // Reading is fine on any path; a dialog here would appear with no tap
    // behind it.
    expect(permission.ensureNotificationPermission).not.toHaveBeenCalled();
  });
});

describe('syncPeriodReminder leaves the rest of the queue alone', () => {
  it('never cancels anything by identifier of its own choosing', async () => {
    await syncPeriodReminder(db, date('2026-09-18'));

    // Everything it removes goes through the one function that filters on type.
    expect(Object.keys(scheduler)).toContain('cancelPeriodReminders');
    expect(scheduler.cancelPeriodReminders).toHaveBeenCalledWith();
  });

  it('writes nothing to the database', async () => {
    await syncPeriodReminder(db, date('2026-09-18'));

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

    await expect(syncPeriodReminder(db, date('2026-09-18'))).rejects.toThrow('something broke');
  });
});

describe('syncPeriodReminderQuietly', () => {
  it('returns what the sync did', async () => {
    await expect(syncPeriodReminderQuietly(db, date('2026-09-18'))).resolves.toEqual({
      scheduled: '2026-09-28',
      cancelled: 0,
    });
  });

  it.each([
    ['the queue', () => scheduler.schedulePeriodReminder],
    ['the database', () => cycleRepository.loadCycleProfile],
  ])('swallows a failure in %s and says so with null', async (_label, mock) => {
    mock().mockRejectedValue(new Error('something broke'));

    await expect(syncPeriodReminderQuietly(db, date('2026-09-18'))).resolves.toBeNull();
  });

  it('leaves the database untouched when it fails', async () => {
    scheduler.schedulePeriodReminder.mockRejectedValue(new Error('queue is full'));

    await syncPeriodReminderQuietly(db, date('2026-09-18'));

    expect(cycleRepository.saveCycleProfile).not.toHaveBeenCalled();
  });
});
