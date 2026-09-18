import type { SQLiteDatabase } from 'expo-sqlite';

import type { NotificationPreferences } from '../../domain/notification-preferences';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../../domain/notification-preferences';
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '../notification-preferences-repository';

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
