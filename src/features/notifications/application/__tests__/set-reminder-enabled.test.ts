import type { SQLiteDatabase } from 'expo-sqlite';

import { setReminderEnabled } from '../set-reminder-enabled';

// Only the database and the system permission are faked. The domain rules and
// the enable/disable decision stay real.
jest.mock('@/features/notifications/data/notification-preferences-repository', () => ({
  loadNotificationPreferences: jest.fn(),
  saveNotificationPreferences: jest.fn(),
}));

jest.mock('@/features/notifications/infrastructure/notification-permission', () => ({
  ensureNotificationPermission: jest.fn(),
  getNotificationPermissionStatus: jest.fn(),
}));

const repository = jest.requireMock(
  '@/features/notifications/data/notification-preferences-repository'
);
const permission = jest.requireMock(
  '@/features/notifications/infrastructure/notification-permission'
);

const db = {} as SQLiteDatabase;

const OFF = { periodReminderEnabled: false, pregnancyWeeklyReminderEnabled: false };
const FIELDS = ['periodReminderEnabled', 'pregnancyWeeklyReminderEnabled'] as const;

beforeEach(() => {
  repository.loadNotificationPreferences.mockReset();
  repository.loadNotificationPreferences.mockResolvedValue(OFF);
  repository.saveNotificationPreferences.mockReset();
  repository.saveNotificationPreferences.mockResolvedValue(undefined);
  permission.ensureNotificationPermission.mockReset();
  permission.ensureNotificationPermission.mockResolvedValue('granted');
});

/** What was handed to the repository on the first write. */
function saved() {
  return repository.saveNotificationPreferences.mock.calls[0][1];
}

describe('setReminderEnabled turning one on with permission', () => {
  it.each(FIELDS)('saves %s as on', async (field) => {
    const result = await setReminderEnabled(db, field, true);

    expect(saved()[field]).toBe(true);
    expect(result.preferences[field]).toBe(true);
    expect(result.permission).toBe('granted');
  });

  it('asks for permission exactly once', async () => {
    await setReminderEnabled(db, 'periodReminderEnabled', true);

    expect(permission.ensureNotificationPermission).toHaveBeenCalledTimes(1);
  });

  it('leaves the other reminder where it was', async () => {
    repository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: false,
      pregnancyWeeklyReminderEnabled: true,
    });

    await setReminderEnabled(db, 'periodReminderEnabled', true);

    expect(saved()).toEqual({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: true,
    });
  });

  it('reads the stored preferences rather than trusting a copy', async () => {
    await setReminderEnabled(db, 'periodReminderEnabled', true);

    expect(repository.loadNotificationPreferences).toHaveBeenCalledWith(db);
  });

  it('writes once', async () => {
    await setReminderEnabled(db, 'periodReminderEnabled', true);

    expect(repository.saveNotificationPreferences).toHaveBeenCalledTimes(1);
  });
});

describe('setReminderEnabled when permission is refused', () => {
  it.each(['denied', 'undetermined'] as const)('writes nothing for %s', async (status) => {
    permission.ensureNotificationPermission.mockResolvedValue(status);

    const result = await setReminderEnabled(db, 'periodReminderEnabled', true);

    expect(repository.saveNotificationPreferences).not.toHaveBeenCalled();
    expect(result.preferences).toEqual(OFF);
    expect(result.permission).toBe(status);
  });

  it('leaves the reminder off rather than promising one it cannot send', async () => {
    permission.ensureNotificationPermission.mockResolvedValue('denied');

    const result = await setReminderEnabled(db, 'pregnancyWeeklyReminderEnabled', true);

    expect(result.preferences.pregnancyWeeklyReminderEnabled).toBe(false);
  });

  it('does not turn off a reminder that was already on', async () => {
    repository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    });
    permission.ensureNotificationPermission.mockResolvedValue('denied');

    const result = await setReminderEnabled(db, 'pregnancyWeeklyReminderEnabled', true);

    expect(result.preferences.periodReminderEnabled).toBe(true);
  });
});

describe('setReminderEnabled turning one off', () => {
  it.each(FIELDS)('saves %s as off', async (field) => {
    repository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: true,
    });

    const result = await setReminderEnabled(db, field, false);

    expect(saved()[field]).toBe(false);
    expect(result.preferences[field]).toBe(false);
  });

  it('asks for no permission', async () => {
    await setReminderEnabled(db, 'periodReminderEnabled', false);

    expect(permission.ensureNotificationPermission).not.toHaveBeenCalled();
  });

  it('asks for none even when permission was never granted', async () => {
    permission.ensureNotificationPermission.mockResolvedValue('denied');

    await setReminderEnabled(db, 'periodReminderEnabled', false);

    expect(permission.ensureNotificationPermission).not.toHaveBeenCalled();
    expect(repository.saveNotificationPreferences).toHaveBeenCalledTimes(1);
  });

  it('reports no permission answer, because it asked no question', async () => {
    const result = await setReminderEnabled(db, 'periodReminderEnabled', false);

    expect(result.permission).toBeNull();
  });

  it('leaves the other reminder on', async () => {
    repository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: true,
    });

    await setReminderEnabled(db, 'periodReminderEnabled', false);

    expect(saved().pregnancyWeeklyReminderEnabled).toBe(true);
  });
});

describe('setReminderEnabled when something fails', () => {
  it('passes a read failure on', async () => {
    repository.loadNotificationPreferences.mockRejectedValue(new Error('disk is gone'));

    await expect(setReminderEnabled(db, 'periodReminderEnabled', true)).rejects.toThrow(
      'disk is gone'
    );
  });

  it('passes a write failure on', async () => {
    repository.saveNotificationPreferences.mockRejectedValue(new Error('disk is full'));

    await expect(setReminderEnabled(db, 'periodReminderEnabled', true)).rejects.toThrow(
      'disk is full'
    );
  });

  it('passes a permission failure on', async () => {
    permission.ensureNotificationPermission.mockRejectedValue(new Error('no notification module'));

    await expect(setReminderEnabled(db, 'periodReminderEnabled', true)).rejects.toThrow(
      'no notification module'
    );
    expect(repository.saveNotificationPreferences).not.toHaveBeenCalled();
  });

  it('refuses stored preferences the domain would', async () => {
    repository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: 1 as unknown as boolean,
      pregnancyWeeklyReminderEnabled: false,
    });

    await expect(setReminderEnabled(db, 'periodReminderEnabled', false)).rejects.toThrow(
      /non-boolean/
    );
  });
});

describe('setReminderEnabled scope', () => {
  it('schedules nothing', async () => {
    // Nothing is sent yet: this records what someone wants, and acting on it
    // comes later.
    const notifications = jest.requireActual('expo-notifications') as Record<string, unknown>;

    await setReminderEnabled(db, 'periodReminderEnabled', true);

    expect(typeof notifications.scheduleNotificationAsync).toBe('function');
    expect(repository.saveNotificationPreferences).toHaveBeenCalledTimes(1);
  });
});
