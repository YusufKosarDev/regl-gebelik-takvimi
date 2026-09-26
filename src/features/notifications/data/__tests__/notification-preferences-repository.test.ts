import type { SQLiteDatabase } from 'expo-sqlite';

import type { NotificationPreferences } from '../../domain/notification-preferences';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../../domain/notification-preferences';
import {
  loadDiscreetNotifications,
  loadNotificationPreferences,
  saveDiscreetNotifications,
  saveNotificationPreferences,
} from '../notification-preferences-repository';

// The one signal this module raises. Faked so a test can say which writes do
// and do not tell the sync machinery there is something new here.
jest.mock('@/shared/data-change/local-data-change', () => ({
  notifyLocalDataChanged: jest.fn(),
}));

const { notifyLocalDataChanged } = jest.requireMock('@/shared/data-change/local-data-change');

beforeEach(() => {
  // Counts accumulate across a file otherwise, which turns "this write raises
  // nothing" into "some earlier write did".
  notifyLocalDataChanged.mockClear();
});

type DatabaseSpy = {
  readonly db: SQLiteDatabase;
  readonly runAsync: jest.Mock;
  readonly getFirstAsync: jest.Mock;
  readonly execAsync: jest.Mock;
};

function createDatabaseSpy(row: unknown = null, runError?: Error): DatabaseSpy {
  const runAsync = runError
    ? jest.fn().mockRejectedValue(runError)
    : jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
  const getFirstAsync = jest.fn().mockResolvedValue(row);
  const execAsync = jest.fn().mockResolvedValue(undefined);

  const db = {
    runAsync,
    getFirstAsync,
    execAsync,
    getAllAsync: jest.fn().mockResolvedValue([]),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
  } as unknown as SQLiteDatabase;

  return { db, runAsync, getFirstAsync, execAsync };
}

/** Collapses whitespace so assertions do not depend on SQL formatting. */
function normalize(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').trim();
}

function row(period: unknown = 0, pregnancy: unknown = 0) {
  return {
    period_reminder_enabled: period,
    pregnancy_weekly_reminder_enabled: pregnancy,
  };
}

function preferences(
  overrides: Partial<NotificationPreferences> = {}
): NotificationPreferences {
  return { periodReminderEnabled: false, pregnancyWeeklyReminderEnabled: false, ...overrides };
}

describe('saveNotificationPreferences', () => {
  it('writes one statement on the pinned row', async () => {
    const spy = createDatabaseSpy();

    await saveNotificationPreferences(spy.db, preferences());
    const [sql, ...params] = spy.runAsync.mock.calls[0];

    expect(spy.runAsync).toHaveBeenCalledTimes(1);
    expect(normalize(sql)).toMatch(/^INSERT INTO notification_preferences/i);
    expect(normalize(sql)).toMatch(/ON CONFLICT\(id\) DO UPDATE SET/i);
    expect(params[0]).toBe(1);
  });

  it.each([
    [false, false, 0, 0],
    [true, false, 1, 0],
    [false, true, 0, 1],
    [true, true, 1, 1],
  ])('binds %p and %p as %p and %p', async (period, pregnancy, boundPeriod, boundPregnancy) => {
    const spy = createDatabaseSpy();

    await saveNotificationPreferences(
      spy.db,
      preferences({ periodReminderEnabled: period, pregnancyWeeklyReminderEnabled: pregnancy })
    );

    expect(spy.runAsync.mock.calls[0].slice(1)).toEqual([1, boundPeriod, boundPregnancy]);
  });

  it('binds rather than interpolating', async () => {
    const spy = createDatabaseSpy();

    await saveNotificationPreferences(spy.db, preferences({ periodReminderEnabled: true }));

    expect(normalize(spy.runAsync.mock.calls[0][0])).toContain('VALUES (?, ?, ?)');
  });

  it('touches nothing else', async () => {
    const spy = createDatabaseSpy();

    await saveNotificationPreferences(spy.db, preferences());

    expect(normalize(spy.runAsync.mock.calls[0][0])).not.toMatch(
      /cycle_settings|period_records|pregnancy_profile|avatar_config/i
    );
    expect(spy.execAsync).not.toHaveBeenCalled();
  });

  it('refuses preferences the domain would, and writes nothing', async () => {
    const spy = createDatabaseSpy();

    await expect(
      saveNotificationPreferences(
        spy.db,
        preferences({ periodReminderEnabled: 1 as unknown as boolean })
      )
    ).rejects.toThrow(/non-boolean/);

    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('passes a failure on', async () => {
    const spy = createDatabaseSpy(null, new Error('disk is full'));

    await expect(saveNotificationPreferences(spy.db, preferences())).rejects.toThrow(
      'disk is full'
    );
  });

  it('does not mutate what it was given', async () => {
    const spy = createDatabaseSpy();
    const current = preferences({ periodReminderEnabled: true });
    const before = JSON.stringify(current);

    await saveNotificationPreferences(spy.db, current);

    expect(JSON.stringify(current)).toBe(before);
  });
});

describe('loadNotificationPreferences', () => {
  it('returns the defaults when nothing is stored', async () => {
    const spy = createDatabaseSpy(null);

    await expect(loadNotificationPreferences(spy.db)).resolves.toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
  });

  it('returns the defaults for an undefined row too', async () => {
    const spy = createDatabaseSpy(undefined);

    await expect(loadNotificationPreferences(spy.db)).resolves.toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
  });

  it('reads the pinned row', async () => {
    const spy = createDatabaseSpy(row());

    await loadNotificationPreferences(spy.db);
    const [sql, ...params] = spy.getFirstAsync.mock.calls[0];

    expect(normalize(sql)).toMatch(/^SELECT .* FROM notification_preferences WHERE id = \?$/i);
    expect(params).toEqual([1]);
  });

  it.each([
    [0, 0, false, false],
    [1, 0, true, false],
    [0, 1, false, true],
    [1, 1, true, true],
  ])('reads %p and %p as %p and %p', async (period, pregnancy, expectedPeriod, expectedPregnancy) => {
    const spy = createDatabaseSpy(row(period, pregnancy));

    await expect(loadNotificationPreferences(spy.db)).resolves.toEqual({
      periodReminderEnabled: expectedPeriod,
      pregnancyWeeklyReminderEnabled: expectedPregnancy,
    });
  });

  it('hands back booleans, not the integers it read', async () => {
    const spy = createDatabaseSpy(row(1, 1));
    const loaded = await loadNotificationPreferences(spy.db);

    expect(typeof loaded.periodReminderEnabled).toBe('boolean');
    expect(typeof loaded.pregnancyWeeklyReminderEnabled).toBe('boolean');
  });

  it('writes nothing while reading', async () => {
    const spy = createDatabaseSpy(row());

    await loadNotificationPreferences(spy.db);

    expect(spy.runAsync).not.toHaveBeenCalled();
    expect(spy.execAsync).not.toHaveBeenCalled();
  });

  it('round-trips through the fake store', async () => {
    const writer = createDatabaseSpy();
    const value = preferences({ periodReminderEnabled: true });

    await saveNotificationPreferences(writer.db, value);
    const [, , period, pregnancy] = writer.runAsync.mock.calls[0];
    const reader = createDatabaseSpy(row(period, pregnancy));

    await expect(loadNotificationPreferences(reader.db)).resolves.toEqual(value);
  });
});

describe('loadNotificationPreferences with a corrupt row', () => {
  it.each(['period_reminder_enabled', 'pregnancy_weekly_reminder_enabled'])(
    'refuses a 2 in %s',
    async (column) => {
      const spy = createDatabaseSpy({ ...row(), [column]: 2 });

      await expect(loadNotificationPreferences(spy.db)).rejects.toThrow(
        new RegExp(`invalid ${column}`)
      );
    }
  );

  it.each(['period_reminder_enabled', 'pregnancy_weekly_reminder_enabled'])(
    'refuses a NULL in %s',
    async (column) => {
      const spy = createDatabaseSpy({ ...row(), [column]: null });

      await expect(loadNotificationPreferences(spy.db)).rejects.toThrow(
        new RegExp(`invalid ${column}`)
      );
    }
  );

  it('refuses text where a flag should be', async () => {
    const spy = createDatabaseSpy(row('1', 0));

    await expect(loadNotificationPreferences(spy.db)).rejects.toThrow(/invalid/);
  });

  it('refuses a boolean where the integer should be', async () => {
    // SQLite has no boolean, so this is a row nothing in this app wrote.
    const spy = createDatabaseSpy(row(true, 0));

    await expect(loadNotificationPreferences(spy.db)).rejects.toThrow(/invalid/);
  });

  it('does not repair or overwrite it', async () => {
    const spy = createDatabaseSpy(row(2, 0));

    await expect(loadNotificationPreferences(spy.db)).rejects.toThrow();

    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('does not quietly fall back to the defaults', async () => {
    // Turning a reminder off silently would look exactly like the person doing
    // it, and turning one on silently is worse.
    const spy = createDatabaseSpy(row(2, 2));

    await expect(loadNotificationPreferences(spy.db)).rejects.toThrow();
  });
});

describe('what a preferences repository error gives away', () => {
  it('says what kind of thing the column held, not the value', async () => {
    const spy = createDatabaseSpy(row(2, 0));

    await expect(loadNotificationPreferences(spy.db)).rejects.toThrow(
      'Stored notification preferences have an invalid period_reminder_enabled: ' +
        'a number. Expected 0 or 1.'
    );
  });

  it.each([
    ['text in the column', row('yes', 0)],
    ['an object in the column', row({ on: true }, 0)],
  ])('quotes nothing for %s', async (_label, stored) => {
    const spy = createDatabaseSpy(stored);
    const error = await loadNotificationPreferences(spy.db).then(
      () => {
        throw new Error('expected a rejection');
      },
      (thrown: unknown) => thrown as Error
    );

    expect(error.message).not.toMatch(/yes|true|\{/);
  });
});

describe('loadDiscreetNotifications', () => {
  it('reads the pinned row', async () => {
    const spy = createDatabaseSpy({ discreet_notifications: 1 });

    await loadDiscreetNotifications(spy.db);
    const [sql, ...params] = spy.getFirstAsync.mock.calls[0];

    expect(normalize(sql)).toContain('FROM notification_preferences');
    expect(normalize(sql)).toContain('WHERE id = ?');
    expect(params).toEqual([1]);
  });

  it('turns a stored one into true and a stored zero into false', async () => {
    // SQLite has no boolean, so the 1 must not escape upwards as a 1.
    await expect(
      loadDiscreetNotifications(createDatabaseSpy({ discreet_notifications: 1 }).db)
    ).resolves.toBe(true);
    await expect(
      loadDiscreetNotifications(createDatabaseSpy({ discreet_notifications: 0 }).db)
    ).resolves.toBe(false);
  });

  it('is off when no row has been written', async () => {
    await expect(loadDiscreetNotifications(createDatabaseSpy(null).db)).resolves.toBe(false);
  });

  /**
   * Raises rather than reading a broken value as "off".
   *
   * Falling back here would put the full sentence back on the lock screen of
   * somebody who had asked for the opposite, and it would look exactly like
   * them having turned it off themselves.
   */
  it.each([
    ['a two', 2],
    ['a string', '1'],
    ['null in the column', null],
    ['undefined in the column', undefined],
  ])('refuses %s', async (_name, value) => {
    await expect(
      loadDiscreetNotifications(createDatabaseSpy({ discreet_notifications: value }).db)
    ).rejects.toThrow(/discreet_notifications/);
  });

  it('writes nothing while reading', async () => {
    const spy = createDatabaseSpy({ discreet_notifications: 1 });

    await loadDiscreetNotifications(spy.db);

    expect(spy.runAsync).not.toHaveBeenCalled();
    expect(spy.execAsync).not.toHaveBeenCalled();
  });

  /**
   * It reads its own column and neither reminder switch.
   *
   * The two live in the same row and go to different places — the switches to
   * the account, this one nowhere — and naming columns explicitly is the whole
   * of what keeps them apart.
   */
  it('names no column that cloud sync carries', async () => {
    const spy = createDatabaseSpy({ discreet_notifications: 0 });

    await loadDiscreetNotifications(spy.db);
    const sql = normalize(spy.getFirstAsync.mock.calls[0][0]);

    expect(sql).toContain('discreet_notifications');
    expect(sql).not.toContain('period_reminder_enabled');
    expect(sql).not.toContain('pregnancy_weekly_reminder_enabled');
  });
});

describe('saveDiscreetNotifications', () => {
  it('writes one statement on the pinned row', async () => {
    const spy = createDatabaseSpy();

    await saveDiscreetNotifications(spy.db, true);
    const [sql, ...params] = spy.runAsync.mock.calls[0];

    expect(spy.runAsync).toHaveBeenCalledTimes(1);
    expect(normalize(sql)).toContain('INSERT INTO notification_preferences');
    expect(params).toEqual([1, 1]);
  });

  it('binds every value rather than building a statement out of it', async () => {
    const spy = createDatabaseSpy();

    await saveDiscreetNotifications(spy.db, false);
    const [sql, ...params] = spy.runAsync.mock.calls[0];

    expect(params).toEqual([1, 0]);
    expect(normalize(sql)).not.toMatch(/VALUES \(1, [01]\)/);
  });

  it('refuses anything that is not a boolean', async () => {
    const spy = createDatabaseSpy();

    await expect(
      saveDiscreetNotifications(spy.db, 1 as unknown as boolean)
    ).rejects.toThrow(/must be a boolean/);
    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  /**
   * Touches neither reminder switch.
   *
   * A restore from an account writes the two synced columns through
   * `saveNotificationPreferences`; this writes the one that stays here. Each
   * has to leave the other's answer alone, or one of them silently undoes the
   * other on the same row.
   */
  it('names no column that cloud sync carries', async () => {
    const spy = createDatabaseSpy();

    await saveDiscreetNotifications(spy.db, true);
    const sql = normalize(spy.runAsync.mock.calls[0][0]);

    expect(sql).toContain('discreet_notifications');
    expect(sql).not.toContain('period_reminder_enabled');
    expect(sql).not.toContain('pregnancy_weekly_reminder_enabled');
  });

  /**
   * Raises no local-data-change signal.
   *
   * That signal is how the sync machinery is told this phone holds something
   * the account has not seen. This column never leaves the phone, so raising it
   * would schedule an upload of a payload byte for byte identical to the one
   * already stored.
   */
  it('does not mark the device as having something to sync', async () => {
    const spy = createDatabaseSpy();

    await saveDiscreetNotifications(spy.db, true);

    expect(notifyLocalDataChanged).not.toHaveBeenCalled();
  });

  it('unlike the synced preferences, which do', async () => {
    // The contrast is the point: the signal is not missing by oversight.
    const spy = createDatabaseSpy();

    await saveNotificationPreferences(spy.db, preferences());

    expect(notifyLocalDataChanged).toHaveBeenCalledTimes(1);
  });
});

describe('the two halves of the row', () => {
  it('saving the synced preferences leaves the device column alone', async () => {
    // A person restoring on a new phone has said nothing about that phone's
    // lock screen, so an incoming sync must not answer for them.
    const spy = createDatabaseSpy();

    await saveNotificationPreferences(spy.db, preferences({ periodReminderEnabled: true }));
    const sql = normalize(spy.runAsync.mock.calls[0][0]);

    expect(sql).not.toContain('discreet_notifications');
  });

  it('reading the synced preferences does not read it either', async () => {
    const spy = createDatabaseSpy(row());

    await loadNotificationPreferences(spy.db);

    expect(normalize(spy.getFirstAsync.mock.calls[0][0])).not.toContain('discreet_notifications');
  });
});
