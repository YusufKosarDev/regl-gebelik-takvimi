import type { SQLiteDatabase } from 'expo-sqlite';

import {
  syncPregnancyWeeklyReminder,
  syncPregnancyWeeklyReminderQuietly,
} from '../sync-pregnancy-weekly-reminder';

import type { ISODate } from '@/types/iso-date';

// The database reads, the permission and the queue are faked. The enable/disable
// decision stays real, which is what this pins.
jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  loadPregnancyProfile: jest.fn(),
  savePregnancyProfile: jest.fn(),
  clearPregnancyProfile: jest.fn(),
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

jest.mock(
  '@/features/notifications/infrastructure/pregnancy-weekly-reminder-scheduler',
  () => ({
    cancelPregnancyWeeklyReminders: jest.fn(),
    schedulePregnancyWeeklyReminder: jest.fn(),
    ensurePregnancyWeeklyReminderChannel: jest.fn(),
  })
);

jest.mock('@/features/notifications/infrastructure/period-reminder-scheduler', () => ({
  cancelPeriodReminders: jest.fn(),
  schedulePeriodReminder: jest.fn(),
  ensurePeriodReminderChannel: jest.fn(),
  periodReminderMoment: jest.fn(),
}));

const pregnancyRepository = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const preferences = jest.requireMock(
  '@/features/notifications/data/notification-preferences-repository'
);
const permission = jest.requireMock(
  '@/features/notifications/infrastructure/notification-permission'
);
const scheduler = jest.requireMock(
  '@/features/notifications/infrastructure/pregnancy-weekly-reminder-scheduler'
);
const periodScheduler = jest.requireMock(
  '@/features/notifications/infrastructure/period-reminder-scheduler'
);

const db = {} as SQLiteDatabase;

function pregnancy() {
  return {
    lastMenstrualPeriodStartDate: '2026-07-11' as ISODate,
    estimatedDueDate: '2027-04-17' as ISODate,
    dueDateSource: 'lmp' as const,
  };
}

beforeEach(() => {
  pregnancyRepository.loadPregnancyProfile.mockReset();
  pregnancyRepository.loadPregnancyProfile.mockResolvedValue(pregnancy());
  pregnancyRepository.savePregnancyProfile.mockReset();
  pregnancyRepository.clearPregnancyProfile.mockReset();

  preferences.loadNotificationPreferences.mockReset();
  preferences.loadNotificationPreferences.mockResolvedValue({
    periodReminderEnabled: false,
    pregnancyWeeklyReminderEnabled: true,
  });
  preferences.saveNotificationPreferences.mockReset();

  // Off is the app's default wording, so it is the baseline these tests read
  // against; the cases about the quiet wording set it themselves.
  preferences.loadDiscreetNotifications.mockReset();
  preferences.loadDiscreetNotifications.mockResolvedValue(false);
  preferences.saveDiscreetNotifications.mockReset();

  permission.getNotificationPermissionStatus.mockReset();
  permission.getNotificationPermissionStatus.mockResolvedValue('granted');

  scheduler.cancelPregnancyWeeklyReminders.mockReset();
  scheduler.cancelPregnancyWeeklyReminders.mockResolvedValue(0);
  scheduler.schedulePregnancyWeeklyReminder.mockReset();
  scheduler.schedulePregnancyWeeklyReminder.mockResolvedValue('weekly-id');

  periodScheduler.cancelPeriodReminders.mockReset();
  periodScheduler.schedulePeriodReminder.mockReset();
});

describe('syncPregnancyWeeklyReminder when the reminder is off', () => {
  beforeEach(() => {
    preferences.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    });
  });

  it('takes the queued one back out', async () => {
    scheduler.cancelPregnancyWeeklyReminders.mockResolvedValue(1);

    await expect(syncPregnancyWeeklyReminder(db)).resolves.toEqual({
      scheduled: false,
      cancelled: 1,
    });
  });

  it('schedules nothing', async () => {
    await syncPregnancyWeeklyReminder(db);

    expect(scheduler.schedulePregnancyWeeklyReminder).not.toHaveBeenCalled();
  });

  it('does not even read the pregnancy', async () => {
    await syncPregnancyWeeklyReminder(db);

    expect(pregnancyRepository.loadPregnancyProfile).not.toHaveBeenCalled();
  });
});

describe('syncPregnancyWeeklyReminder when the reminder is on', () => {
  it('schedules exactly one', async () => {
    const result = await syncPregnancyWeeklyReminder(db);

    expect(scheduler.schedulePregnancyWeeklyReminder).toHaveBeenCalledTimes(1);
    expect(result.scheduled).toBe(true);
  });

  /**
   * The day and the time are still fixed; only the wording is passed.
   *
   * This used to assert no arguments at all, which was a true statement about a
   * function that took none. It now carries the one thing that cannot be worked
   * out at delivery time, because a repeating trigger holds one set of words for
   * every Monday it will ever fire.
   */
  it('passes only the wording, because the day and time are fixed', async () => {
    await syncPregnancyWeeklyReminder(db);

    expect(scheduler.schedulePregnancyWeeklyReminder).toHaveBeenCalledWith(false);
  });

  it('carries the quiet wording when this phone has asked for it', async () => {
    preferences.loadDiscreetNotifications.mockResolvedValue(true);

    await syncPregnancyWeeklyReminder(db);

    expect(scheduler.schedulePregnancyWeeklyReminder).toHaveBeenCalledWith(true);
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

    await syncPregnancyWeeklyReminder(db);

    expect(preferences.loadDiscreetNotifications).toHaveBeenCalledTimes(1);
  });

  it('takes the old one out before putting a new one in', async () => {
    scheduler.cancelPregnancyWeeklyReminders.mockResolvedValue(1);

    const result = await syncPregnancyWeeklyReminder(db);

    expect(scheduler.cancelPregnancyWeeklyReminders).toHaveBeenCalledTimes(1);
    expect(scheduler.schedulePregnancyWeeklyReminder).toHaveBeenCalledTimes(1);
    expect(result.cancelled).toBe(1);
  });

  it('leaves exactly one behind however many were there', async () => {
    scheduler.cancelPregnancyWeeklyReminders.mockResolvedValue(3);

    await syncPregnancyWeeklyReminder(db);

    expect(scheduler.schedulePregnancyWeeklyReminder).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate when run twice', async () => {
    await syncPregnancyWeeklyReminder(db);
    await syncPregnancyWeeklyReminder(db);

    expect(scheduler.cancelPregnancyWeeklyReminders).toHaveBeenCalledTimes(2);
    expect(scheduler.schedulePregnancyWeeklyReminder).toHaveBeenCalledTimes(2);
  });
});

describe('syncPregnancyWeeklyReminder with no pregnancy', () => {
  beforeEach(() => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);
  });

  it('schedules nothing', async () => {
    const result = await syncPregnancyWeeklyReminder(db);

    expect(scheduler.schedulePregnancyWeeklyReminder).not.toHaveBeenCalled();
    expect(result.scheduled).toBe(false);
  });

  it('takes the old one out, so a stopped pregnancy stops being mentioned', async () => {
    scheduler.cancelPregnancyWeeklyReminders.mockResolvedValue(1);

    await expect(syncPregnancyWeeklyReminder(db)).resolves.toEqual({
      scheduled: false,
      cancelled: 1,
    });
  });
});

describe('syncPregnancyWeeklyReminder without permission', () => {
  it.each(['denied', 'undetermined'] as const)('schedules nothing for %s', async (status) => {
    permission.getNotificationPermissionStatus.mockResolvedValue(status);

    const result = await syncPregnancyWeeklyReminder(db);

    expect(scheduler.schedulePregnancyWeeklyReminder).not.toHaveBeenCalled();
    expect(result.scheduled).toBe(false);
  });

  it('clears the queue, so nothing is left that cannot be delivered', async () => {
    permission.getNotificationPermissionStatus.mockResolvedValue('denied');
    scheduler.cancelPregnancyWeeklyReminders.mockResolvedValue(1);

    await expect(syncPregnancyWeeklyReminder(db)).resolves.toEqual({
      scheduled: false,
      cancelled: 1,
    });
  });

  it('asks for no permission of its own', async () => {
    await syncPregnancyWeeklyReminder(db);

    expect(permission.ensureNotificationPermission).not.toHaveBeenCalled();
  });
});

describe('syncPregnancyWeeklyReminder leaves the period reminder alone', () => {
  it.each([
    ['on, with a pregnancy', { enabled: true, profile: true, permission: 'granted' }],
    ['on, with none', { enabled: true, profile: false, permission: 'granted' }],
    ['off', { enabled: false, profile: true, permission: 'granted' }],
    ['without permission', { enabled: true, profile: true, permission: 'denied' }],
  ] as const)('touches no period reminder when %s', async (_label, setup) => {
    preferences.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: setup.enabled,
    });
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(setup.profile ? pregnancy() : null);
    permission.getNotificationPermissionStatus.mockResolvedValue(setup.permission);

    await syncPregnancyWeeklyReminder(db);

    expect(periodScheduler.cancelPeriodReminders).not.toHaveBeenCalled();
    expect(periodScheduler.schedulePeriodReminder).not.toHaveBeenCalled();
  });

  it('writes nothing to the database', async () => {
    await syncPregnancyWeeklyReminder(db);

    expect(pregnancyRepository.savePregnancyProfile).not.toHaveBeenCalled();
    expect(pregnancyRepository.clearPregnancyProfile).not.toHaveBeenCalled();
    expect(preferences.saveNotificationPreferences).not.toHaveBeenCalled();
  });
});

describe('syncPregnancyWeeklyReminder when something fails', () => {
  it.each([
    ['the preferences read', () => preferences.loadNotificationPreferences],
    ['the pregnancy read', () => pregnancyRepository.loadPregnancyProfile],
    ['the permission read', () => permission.getNotificationPermissionStatus],
    ['the cancel', () => scheduler.cancelPregnancyWeeklyReminders],
    ['the schedule', () => scheduler.schedulePregnancyWeeklyReminder],
  ])('passes a failure in %s on', async (_label, mock) => {
    mock().mockRejectedValue(new Error('something broke'));

    await expect(syncPregnancyWeeklyReminder(db)).rejects.toThrow('something broke');
  });
});

describe('syncPregnancyWeeklyReminderQuietly', () => {
  it('returns what the sync did', async () => {
    await expect(syncPregnancyWeeklyReminderQuietly(db)).resolves.toEqual({
      scheduled: true,
      cancelled: 0,
    });
  });

  it.each([
    ['the queue', () => scheduler.schedulePregnancyWeeklyReminder],
    ['the database', () => pregnancyRepository.loadPregnancyProfile],
  ])('swallows a failure in %s and says so with null', async (_label, mock) => {
    mock().mockRejectedValue(new Error('something broke'));

    await expect(syncPregnancyWeeklyReminderQuietly(db)).resolves.toBeNull();
  });

  it('leaves the database untouched when it fails', async () => {
    scheduler.schedulePregnancyWeeklyReminder.mockRejectedValue(new Error('queue is full'));

    await syncPregnancyWeeklyReminderQuietly(db);

    expect(pregnancyRepository.savePregnancyProfile).not.toHaveBeenCalled();
  });
});
