import type { SQLiteDatabase } from 'expo-sqlite';

import { setReminderEnabled } from '../set-reminder-enabled';

import {
  resetLocalDbWriteLockForTests,
  withLocalDbWriteLock,
} from '@/storage/local-db-write-lock';

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
  resetLocalDbWriteLockForTests();
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

/**
 * The write queue, and the one place this function is deliberately outside it.
 *
 * The read and the write used to sit on either side of a system permission
 * dialog, so the copy written back was as old as however long somebody left
 * that dialog open — and the other switch changed in the meantime was
 * overwritten. That is the lost update `storage/local-db-write-lock.ts` exists
 * for, and the function's own doc claimed it could not happen.
 *
 * It cannot be fixed by locking the whole function: a dialog nobody answers
 * would hold every write in the app behind it. So the dialog is outside, and
 * the read and the write are one turn.
 */
describe('setReminderEnabled and the write queue', () => {
  /** Several turns, so "not yet" means the queue rather than a race. */
  const settle = async () => {
    for (let turn = 0; turn < 8; turn += 1) {
      await Promise.resolve();
    }
  };

  it('asks for permission without holding the queue', async () => {
    let answerDialog!: (status: 'granted') => void;

    permission.ensureNotificationPermission.mockReturnValue(
      new Promise((resolve) => {
        answerDialog = resolve;
      })
    );

    const switching = setReminderEnabled(db, 'periodReminderEnabled', true);

    await settle();

    // The dialog is open. Another write must still be able to run — this is
    // what locking the whole function would have broken.
    await expect(
      withLocalDbWriteLock(async () => 'somebody else got through')
    ).resolves.toBe('somebody else got through');

    answerDialog('granted');
    await switching;

    expect(repository.saveNotificationPreferences).toHaveBeenCalledTimes(1);
  });

  it('reads and writes in one turn, so a stale copy cannot be written back', async () => {
    let release!: () => void;
    const held = withLocalDbWriteLock(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );

    const switching = setReminderEnabled(db, 'periodReminderEnabled', true);

    await settle();

    // Permission is resolved by now; the read has not happened, because the
    // read is inside the turn rather than before it.
    expect(repository.loadNotificationPreferences).not.toHaveBeenCalled();

    release();
    await held;
    await switching;

    expect(repository.loadNotificationPreferences).toHaveBeenCalledTimes(1);
    expect(repository.saveNotificationPreferences).toHaveBeenCalledTimes(1);
  });

  it('reports the preferences as they are after the dialog, not before it', async () => {
    // The behaviour change this restructure carries. On a refusal the read now
    // happens after the dialog, so what the screen is told is what is stored
    // when it is told — not what was stored before somebody spent a minute on
    // a system prompt. Nothing is written either way.
    permission.ensureNotificationPermission.mockImplementation(async () => {
      repository.loadNotificationPreferences.mockResolvedValue({
        periodReminderEnabled: true,
        pregnancyWeeklyReminderEnabled: false,
      });

      return 'denied';
    });

    const result = await setReminderEnabled(db, 'pregnancyWeeklyReminderEnabled', true);

    expect(result.preferences.periodReminderEnabled).toBe(true);
    expect(repository.saveNotificationPreferences).not.toHaveBeenCalled();
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
