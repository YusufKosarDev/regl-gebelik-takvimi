import type { SQLiteDatabase } from 'expo-sqlite';

import { setDiscreetNotifications } from '../set-discreet-notifications';

import type { ISODate } from '@/types/iso-date';

jest.mock('@/features/notifications/data/notification-preferences-repository', () => ({
  loadDiscreetNotifications: jest.fn(),
  saveDiscreetNotifications: jest.fn(),
  loadNotificationPreferences: jest.fn(),
  saveNotificationPreferences: jest.fn(),
}));

// Both are faked so the rebuild can be counted. They are quiet by contract, so
// the real ones would swallow everything here anyway and prove nothing.
jest.mock('@/features/notifications/application/sync-period-reminder', () => ({
  syncPeriodReminderQuietly: jest.fn(),
  syncPeriodReminder: jest.fn(),
}));

jest.mock('@/features/notifications/application/sync-pregnancy-weekly-reminder', () => ({
  syncPregnancyWeeklyReminderQuietly: jest.fn(),
  syncPregnancyWeeklyReminder: jest.fn(),
}));

// The permission module is not mocked and not imported: nothing here may ask
// for one. A test that faked it would hide the day somebody wires one in.
const repository = jest.requireMock(
  '@/features/notifications/data/notification-preferences-repository'
);
const periodSync = jest.requireMock('@/features/notifications/application/sync-period-reminder');
const pregnancySync = jest.requireMock(
  '@/features/notifications/application/sync-pregnancy-weekly-reminder'
);

const db = {} as SQLiteDatabase;
const today = '2026-09-26' as ISODate;

beforeEach(() => {
  repository.saveDiscreetNotifications.mockReset();
  repository.saveDiscreetNotifications.mockResolvedValue(undefined);
  repository.loadDiscreetNotifications.mockReset();
  repository.loadDiscreetNotifications.mockResolvedValue(true);
  repository.loadNotificationPreferences.mockReset();
  repository.saveNotificationPreferences.mockReset();

  periodSync.syncPeriodReminderQuietly.mockReset();
  periodSync.syncPeriodReminderQuietly.mockResolvedValue(null);
  pregnancySync.syncPregnancyWeeklyReminderQuietly.mockReset();
  pregnancySync.syncPregnancyWeeklyReminderQuietly.mockResolvedValue(null);
});

describe('setDiscreetNotifications', () => {
  it('writes what was asked for', async () => {
    await setDiscreetNotifications(db, true, today);

    expect(repository.saveDiscreetNotifications).toHaveBeenCalledTimes(1);
    expect(repository.saveDiscreetNotifications.mock.calls[0][1]).toBe(true);
  });

  it('writes an off just as readily', async () => {
    repository.loadDiscreetNotifications.mockResolvedValue(false);

    await expect(setDiscreetNotifications(db, false, today)).resolves.toBe(false);
    expect(repository.saveDiscreetNotifications.mock.calls[0][1]).toBe(false);
  });

  it('returns what is stored afterwards rather than what it was handed', async () => {
    // What the screen shows has to be the stored answer, not the optimistic
    // one: somebody who believes their lock screen is quiet behaves
    // differently from somebody who knows it is not.
    repository.loadDiscreetNotifications.mockResolvedValue(false);

    await expect(setDiscreetNotifications(db, true, today)).resolves.toBe(false);
  });

  /**
   * The rebuild is the protection, not the stored answer.
   *
   * A queued notification carries the words it was scheduled with. Without
   * this, somebody who turns the setting on and closes the app still has the
   * old sentence sitting in the system queue, waiting to print itself.
   */
  it('rebuilds the period reminder', async () => {
    await setDiscreetNotifications(db, true, today);

    expect(periodSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
    expect(periodSync.syncPeriodReminderQuietly.mock.calls[0][1]).toBe(today);
  });

  it('rebuilds the weekly pregnancy reminder too', async () => {
    // One switch governs both. A version that only reached one of them would
    // be true on the screen and false on the phone.
    await setDiscreetNotifications(db, true, today);

    expect(pregnancySync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('rebuilds on the way back down as well', async () => {
    repository.loadDiscreetNotifications.mockResolvedValue(false);

    await setDiscreetNotifications(db, false, today);

    expect(periodSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
    expect(pregnancySync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('writes before it rebuilds, so the rebuild reads the new answer', async () => {
    const order: string[] = [];

    repository.saveDiscreetNotifications.mockImplementation(async () => {
      order.push('save');
    });
    periodSync.syncPeriodReminderQuietly.mockImplementation(async () => {
      order.push('period');

      return null;
    });
    pregnancySync.syncPregnancyWeeklyReminderQuietly.mockImplementation(async () => {
      order.push('pregnancy');

      return null;
    });

    await setDiscreetNotifications(db, true, today);

    expect(order).toEqual(['save', 'period', 'pregnancy']);
  });

  it('uses the database it was given for all of it', async () => {
    await setDiscreetNotifications(db, true, today);

    expect(repository.saveDiscreetNotifications.mock.calls[0][0]).toBe(db);
    expect(periodSync.syncPeriodReminderQuietly.mock.calls[0][0]).toBe(db);
    expect(pregnancySync.syncPregnancyWeeklyReminderQuietly.mock.calls[0][0]).toBe(db);
  });

  /**
   * Nothing here decides whether a reminder is sent, so nothing here touches
   * the switches that do — including on the account's side of the row.
   */
  it('changes neither reminder switch', async () => {
    await setDiscreetNotifications(db, true, today);

    expect(repository.saveNotificationPreferences).not.toHaveBeenCalled();
  });

  it('passes a failed write on rather than pretending it worked', async () => {
    repository.saveDiscreetNotifications.mockRejectedValue(new Error('disk is full'));

    await expect(setDiscreetNotifications(db, true, today)).rejects.toThrow('disk is full');
    expect(periodSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
  });
});
