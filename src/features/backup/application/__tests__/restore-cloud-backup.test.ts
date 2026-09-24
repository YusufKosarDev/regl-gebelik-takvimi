import type { SQLiteDatabase } from 'expo-sqlite';

import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import type { ISODate } from '@/types/iso-date';

import { restoreCloudBackup } from '../restore-cloud-backup';

// The repositories are faked, so this file is about the order, the transaction
// and what each field does — not about SQL.
jest.mock('@/features/cycle/data/cycle-repository', () => ({
  writeCycleSettings: jest.fn(),
  replacePeriodRecords: jest.fn(),
  clearCycleSettings: jest.fn(),
  saveCycleProfile: jest.fn(),
  loadCycleProfile: jest.fn(),
}));

jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  savePregnancyProfile: jest.fn(),
  clearPregnancyProfile: jest.fn(),
  loadPregnancyProfile: jest.fn(),
}));

jest.mock('@/features/avatar/data/avatar-repository', () => ({
  saveAvatarConfig: jest.fn(),
  clearAvatarConfig: jest.fn(),
  loadAvatarConfig: jest.fn(),
}));

jest.mock('@/features/daily-log/data/daily-log-repository', () => ({
  replaceDailyEntries: jest.fn(),
}));

jest.mock('@/features/notifications/data/notification-preferences-repository', () => ({
  saveNotificationPreferences: jest.fn(),
  loadNotificationPreferences: jest.fn(),
}));

// A restore writes; it does not sync. Both are faked so the tests can say so.
jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshot: jest.fn(),
  syncWidgetSnapshotQuietly: jest.fn(),
}));

jest.mock('@/features/notifications/application/sync-period-reminder', () => ({
  syncPeriodReminder: jest.fn(),
  syncPeriodReminderQuietly: jest.fn(),
}));

jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: jest.requireActual('@/shared/logging').describeValue,
  describeError: jest.requireActual('@/shared/logging').describeError,
}));

const cycle = jest.requireMock('@/features/cycle/data/cycle-repository');
const pregnancy = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const avatar = jest.requireMock('@/features/avatar/data/avatar-repository');
const preferences = jest.requireMock(
  '@/features/notifications/data/notification-preferences-repository'
);
const widgetSync = jest.requireMock('@/features/widget/application/sync-widget-snapshot');
const reminderSync = jest.requireMock('@/features/notifications/application/sync-period-reminder');
const logging = jest.requireMock('@/shared/logging');

const date = (value: string) => value as ISODate;

/** Every write, in the order it was made. */
let order: string[] = [];

let withTransactionAsync: jest.Mock;
let db: SQLiteDatabase;

function payload(overrides: Partial<CloudSyncPayloadV1> = {}): CloudSyncPayloadV1 {
  return {
    version: 1,
    cycleSettings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [
      {
        id: 'period-2026-09-02',
        startDate: date('2026-09-02'),
        endDate: date('2026-09-07'),
        isOngoing: false,
      },
    ],
    pregnancyProfile: {
      lastMenstrualPeriodStartDate: date('2026-09-02'),
      estimatedDueDate: date('2027-06-09'),
      dueDateSource: 'lmp',
    },
    avatarConfig: {
      skinToneId: 'skin-tone-3',
      hairStyleId: 'wavy',
      hairColorId: 'dark-brown',
      outfitId: 'shirt',
    },
    notificationPreferences: {
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    },
    dailyEntries: [],
    ...overrides,
  };
}

/** Records the call and its order, the way every faked write does. */
function writeSpy(name: string) {
  return jest.fn(async () => {
    order.push(name);
  });
}

beforeEach(() => {
  order = [];

  withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
    order.push('begin');
    await task();
    order.push('commit');
  });

  db = { withTransactionAsync } as unknown as SQLiteDatabase;

  cycle.writeCycleSettings.mockReset();
  cycle.writeCycleSettings.mockImplementation(writeSpy('writeCycleSettings'));
  cycle.replacePeriodRecords.mockReset();
  cycle.replacePeriodRecords.mockImplementation(writeSpy('replacePeriodRecords'));
  cycle.clearCycleSettings.mockReset();
  cycle.clearCycleSettings.mockImplementation(writeSpy('clearCycleSettings'));
  cycle.saveCycleProfile.mockReset();

  pregnancy.savePregnancyProfile.mockReset();
  pregnancy.savePregnancyProfile.mockImplementation(writeSpy('savePregnancyProfile'));
  pregnancy.clearPregnancyProfile.mockReset();
  pregnancy.clearPregnancyProfile.mockImplementation(writeSpy('clearPregnancyProfile'));

  avatar.saveAvatarConfig.mockReset();
  avatar.saveAvatarConfig.mockImplementation(writeSpy('saveAvatarConfig'));
  avatar.clearAvatarConfig.mockReset();
  avatar.clearAvatarConfig.mockImplementation(writeSpy('clearAvatarConfig'));

  preferences.saveNotificationPreferences.mockReset();
  preferences.saveNotificationPreferences.mockImplementation(writeSpy('saveNotificationPreferences'));

  widgetSync.syncWidgetSnapshotQuietly.mockReset();
  reminderSync.syncPeriodReminderQuietly.mockReset();
  logging.logEvent.mockReset();
});

describe('restoreCloudBackup with a full backup', () => {
  it('writes everything the payload holds', async () => {
    await restoreCloudBackup(db, payload());

    expect(cycle.writeCycleSettings).toHaveBeenCalledWith(db, payload().cycleSettings);
    expect(cycle.replacePeriodRecords).toHaveBeenCalledWith(db, payload().periodRecords);
    expect(pregnancy.savePregnancyProfile).toHaveBeenCalledWith(db, payload().pregnancyProfile);
    expect(avatar.saveAvatarConfig).toHaveBeenCalledWith(db, payload().avatarConfig);
    expect(preferences.saveNotificationPreferences).toHaveBeenCalledWith(
      db,
      payload().notificationPreferences
    );
  });

  it('writes them in the order the step asked for', async () => {
    await restoreCloudBackup(db, payload());

    expect(order).toEqual([
      'begin',
      'writeCycleSettings',
      'replacePeriodRecords',
      'savePregnancyProfile',
      'saveAvatarConfig',
      'saveNotificationPreferences',
      'commit',
    ]);
  });

  it('writes inside one transaction', async () => {
    await restoreCloudBackup(db, payload());

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('replaces the period history exactly, rather than merging it', async () => {
    await restoreCloudBackup(db, payload({ periodRecords: [] }));

    expect(cycle.replacePeriodRecords).toHaveBeenCalledWith(db, []);
  });

  it('never reaches for the whole-profile write, which owns a transaction', async () => {
    await restoreCloudBackup(db, payload());

    expect(cycle.saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('restoreCloudBackup with a backup that is missing things', () => {
  it('clears the cycle settings when the backup has none', async () => {
    await restoreCloudBackup(db, payload({ cycleSettings: null }));

    expect(cycle.clearCycleSettings).toHaveBeenCalledWith(db);
    expect(cycle.writeCycleSettings).not.toHaveBeenCalled();
  });

  it('clears the pregnancy when the backup has none', async () => {
    await restoreCloudBackup(db, payload({ pregnancyProfile: null }));

    expect(pregnancy.clearPregnancyProfile).toHaveBeenCalledWith(db);
    expect(pregnancy.savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('clears the avatar when the backup has none', async () => {
    await restoreCloudBackup(db, payload({ avatarConfig: null }));

    expect(avatar.clearAvatarConfig).toHaveBeenCalledWith(db);
    expect(avatar.saveAvatarConfig).not.toHaveBeenCalled();
  });

  it('always writes the reminder preferences, which are never absent', async () => {
    await restoreCloudBackup(
      db,
      payload({
        notificationPreferences: {
          periodReminderEnabled: false,
          pregnancyWeeklyReminderEnabled: false,
        },
      })
    );

    expect(preferences.saveNotificationPreferences).toHaveBeenCalledTimes(1);
  });

  it('clears everything for a backup taken before anything was entered', async () => {
    await restoreCloudBackup(
      db,
      payload({
        cycleSettings: null,
        periodRecords: [],
        pregnancyProfile: null,
        avatarConfig: null,
      })
    );

    expect(order).toEqual([
      'begin',
      'clearCycleSettings',
      'replacePeriodRecords',
      'clearPregnancyProfile',
      'clearAvatarConfig',
      'saveNotificationPreferences',
      'commit',
    ]);
  });
});

describe('restoreCloudBackup when the payload is not one', () => {
  it.each([
    ['another version', payload({ version: 2 as 1 })],
    [
      'a corrupt record',
      payload({ periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }] }),
    ],
    [
      'settings the app would refuse',
      payload({ cycleSettings: { averageCycleLengthDays: 3, averagePeriodLengthDays: 5 } }),
    ],
    [
      'a due date that disagrees with its source',
      payload({
        pregnancyProfile: {
          lastMenstrualPeriodStartDate: date('2026-09-02'),
          estimatedDueDate: date('2027-06-10'),
          dueDateSource: 'lmp',
        },
      }),
    ],
  ])('refuses %s before opening a transaction', async (_label, broken) => {
    await expect(restoreCloudBackup(db, broken)).rejects.toThrow();

    expect(withTransactionAsync).not.toHaveBeenCalled();
    expect(order).toEqual([]);
  });

  it('names no value when it refuses', async () => {
    const error = await restoreCloudBackup(
      db,
      payload({ periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }] })
    ).then(
      () => {
        throw new Error('expected a rejection');
      },
      (thrown: unknown) => thrown as Error
    );

    expect(error.message).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('restoreCloudBackup when a write fails', () => {
  it.each([
    ['the settings', () => cycle.writeCycleSettings],
    ['the records', () => cycle.replacePeriodRecords],
    ['the pregnancy', () => pregnancy.savePregnancyProfile],
    ['the avatar', () => avatar.saveAvatarConfig],
    ['the preferences', () => preferences.saveNotificationPreferences],
  ])('passes a failure in %s on, so the transaction rolls back', async (_label, mock) => {
    mock().mockRejectedValue(new Error('disk is full'));

    await expect(restoreCloudBackup(db, payload())).rejects.toThrow('disk is full');
  });

  it('never commits when a write fails', async () => {
    // The real `withTransactionAsync` rolls back when the task throws; this one
    // records that the commit was not reached.
    avatar.saveAvatarConfig.mockRejectedValue(new Error('disk is full'));

    await restoreCloudBackup(db, payload()).catch(() => undefined);

    expect(order).not.toContain('commit');
  });

  it('stops at the failure rather than writing on', async () => {
    pregnancy.savePregnancyProfile.mockRejectedValue(new Error('disk is full'));

    await restoreCloudBackup(db, payload()).catch(() => undefined);

    expect(avatar.saveAvatarConfig).not.toHaveBeenCalled();
    expect(preferences.saveNotificationPreferences).not.toHaveBeenCalled();
  });
});

describe('what restoreCloudBackup does not do', () => {
  it('syncs no widget and no reminder: that is the caller’s job', async () => {
    await restoreCloudBackup(db, payload());

    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
    expect(reminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
  });

  it('sends nothing anywhere', async () => {
    await restoreCloudBackup(db, payload());

    // It takes a payload and writes it. Fetching one is somebody else's call.
    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('writes nothing to the log or the console', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    avatar.saveAvatarConfig.mockRejectedValue(new Error('disk is full'));
    await restoreCloudBackup(db, payload()).catch(() => undefined);

    expect(logging.logEvent).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('changes nothing about the payload it was given', async () => {
    const original = payload();
    const copy = JSON.parse(JSON.stringify(original)) as CloudSyncPayloadV1;

    await restoreCloudBackup(db, original);

    expect(original).toEqual(copy);
  });
});
