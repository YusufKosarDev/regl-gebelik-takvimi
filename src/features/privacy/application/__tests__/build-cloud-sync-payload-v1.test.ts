import type { SQLiteDatabase } from 'expo-sqlite';

import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

import { CLOUD_SYNC_PAYLOAD_V1_FIELDS } from '../../domain/cloud-sync-payload-v1';
import { buildCloudSyncPayloadV1 } from '../build-cloud-sync-payload-v1';

// The repositories are faked so this file is about which of them are read and
// what is done with the answers. Their own reading is covered where they live.
jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  loadPregnancyProfile: jest.fn(),
  savePregnancyProfile: jest.fn(),
  clearPregnancyProfile: jest.fn(),
}));

jest.mock('@/features/avatar/data/avatar-repository', () => ({
  loadAvatarConfig: jest.fn(),
  saveAvatarConfig: jest.fn(),
}));

jest.mock('@/features/notifications/data/notification-preferences-repository', () => ({
  loadNotificationPreferences: jest.fn(),
  saveNotificationPreferences: jest.fn(),
}));

// Not allowed to be read, and named here so the test can say so rather than
// hope. Each one is either derived from the four above or belongs to this
// device alone.
jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshot: jest.fn(),
  syncWidgetSnapshotQuietly: jest.fn(),
}));

jest.mock('@/features/widget/infrastructure/widget-snapshot-bridge', () => ({
  loadWidgetSnapshot: jest.fn(),
  saveWidgetSnapshot: jest.fn(),
  clearWidgetSnapshot: jest.fn(),
  isWidgetSnapshotBridgeAvailable: jest.fn(() => false),
}));

jest.mock('@/features/cycle/application/get-cycle-dashboard', () => ({
  getCycleDashboard: jest.fn(),
}));

jest.mock('@/features/cycle/application/get-cycle-home-data', () => ({
  getCycleHomeData: jest.fn(),
}));

jest.mock('@/features/pregnancy/application/get-pregnancy-dashboard', () => ({
  getPregnancyDashboard: jest.fn(),
}));

jest.mock('@/storage/app-state-storage', () => ({
  loadAppState: jest.fn(),
  saveAppState: jest.fn(),
  clearAppState: jest.fn(),
}));

jest.mock('@/utils/today', () => ({ getTodayLocalISODate: jest.fn() }));

const cycleRepository = jest.requireMock('@/features/cycle/data/cycle-repository');
const pregnancyRepository = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const avatarRepository = jest.requireMock('@/features/avatar/data/avatar-repository');
const preferencesRepository = jest.requireMock(
  '@/features/notifications/data/notification-preferences-repository'
);
const widgetSync = jest.requireMock('@/features/widget/application/sync-widget-snapshot');
const widgetBridge = jest.requireMock('@/features/widget/infrastructure/widget-snapshot-bridge');
const dashboard = jest.requireMock('@/features/cycle/application/get-cycle-dashboard');
const homeData = jest.requireMock('@/features/cycle/application/get-cycle-home-data');
const pregnancyDashboard = jest.requireMock(
  '@/features/pregnancy/application/get-pregnancy-dashboard'
);
const appState = jest.requireMock('@/storage/app-state-storage');
const today = jest.requireMock('@/utils/today');

const date = (value: string) => value as ISODate;

const db = {} as SQLiteDatabase;

function profile(): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [
      {
        id: 'period-2026-09-02',
        startDate: date('2026-09-02'),
        endDate: date('2026-09-07'),
        isOngoing: false,
      },
    ],
  };
}

function pregnancy() {
  return {
    lastMenstrualPeriodStartDate: date('2026-09-02'),
    estimatedDueDate: date('2027-06-09'),
    dueDateSource: 'lmp' as const,
  };
}

function avatar() {
  return {
    skinToneId: 'skin-tone-3',
    hairStyleId: 'wavy',
    hairColorId: 'dark-brown',
    outfitId: 'shirt',
  };
}

/** Everything the builder is not allowed to reach for. */
const forbidden = () => [
  ['the widget sync', widgetSync.syncWidgetSnapshot],
  ['the widget sync, quietly', widgetSync.syncWidgetSnapshotQuietly],
  ['the widget bridge', widgetBridge.loadWidgetSnapshot],
  ['the cycle dashboard', dashboard.getCycleDashboard],
  ['the home data', homeData.getCycleHomeData],
  ['the pregnancy dashboard', pregnancyDashboard.getPregnancyDashboard],
  ['the app state', appState.loadAppState],
  ['the clock', today.getTodayLocalISODate],
] as const;

beforeEach(() => {
  cycleRepository.loadCycleProfile.mockReset();
  cycleRepository.loadCycleProfile.mockResolvedValue(profile());
  cycleRepository.saveCycleProfile.mockReset();

  pregnancyRepository.loadPregnancyProfile.mockReset();
  pregnancyRepository.loadPregnancyProfile.mockResolvedValue(pregnancy());
  pregnancyRepository.savePregnancyProfile.mockReset();
  pregnancyRepository.clearPregnancyProfile.mockReset();

  avatarRepository.loadAvatarConfig.mockReset();
  avatarRepository.loadAvatarConfig.mockResolvedValue(avatar());
  avatarRepository.saveAvatarConfig.mockReset();

  preferencesRepository.loadNotificationPreferences.mockReset();
  preferencesRepository.loadNotificationPreferences.mockResolvedValue({
    periodReminderEnabled: true,
    pregnancyWeeklyReminderEnabled: false,
  });
  preferencesRepository.saveNotificationPreferences.mockReset();

  for (const [, fake] of forbidden()) {
    (fake as jest.Mock).mockReset();
  }
});

describe('buildCloudSyncPayloadV1 with everything stored', () => {
  it('carries what the person entered', async () => {
    await expect(buildCloudSyncPayloadV1(db)).resolves.toEqual({
      version: 1,
      cycleSettings: profile().settings,
      periodRecords: profile().periodRecords,
      pregnancyProfile: pregnancy(),
      avatarConfig: avatar(),
      notificationPreferences: {
        periodReminderEnabled: true,
        pregnancyWeeklyReminderEnabled: false,
      },
    });
  });

  it('carries those fields and no others', async () => {
    const payload = await buildCloudSyncPayloadV1(db);

    expect(Object.keys(payload).sort()).toEqual([...CLOUD_SYNC_PAYLOAD_V1_FIELDS].sort());
  });

  it('reads each repository once', async () => {
    await buildCloudSyncPayloadV1(db);

    expect(cycleRepository.loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(pregnancyRepository.loadPregnancyProfile).toHaveBeenCalledTimes(1);
    expect(avatarRepository.loadAvatarConfig).toHaveBeenCalledTimes(1);
    expect(preferencesRepository.loadNotificationPreferences).toHaveBeenCalledTimes(1);
  });

  it('reads them on the database it was handed', async () => {
    await buildCloudSyncPayloadV1(db);

    expect(cycleRepository.loadCycleProfile).toHaveBeenCalledWith(db);
    expect(pregnancyRepository.loadPregnancyProfile).toHaveBeenCalledWith(db);
    expect(avatarRepository.loadAvatarConfig).toHaveBeenCalledWith(db);
    expect(preferencesRepository.loadNotificationPreferences).toHaveBeenCalledWith(db);
  });
});

describe('buildCloudSyncPayloadV1 with nothing stored', () => {
  beforeEach(() => {
    cycleRepository.loadCycleProfile.mockResolvedValue(null);
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);
    avatarRepository.loadAvatarConfig.mockResolvedValue(null);
    preferencesRepository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: false,
      pregnancyWeeklyReminderEnabled: false,
    });
  });

  it('says so with nulls rather than with missing fields', async () => {
    await expect(buildCloudSyncPayloadV1(db)).resolves.toEqual({
      version: 1,
      cycleSettings: null,
      periodRecords: [],
      pregnancyProfile: null,
      avatarConfig: null,
      notificationPreferences: {
        periodReminderEnabled: false,
        pregnancyWeeklyReminderEnabled: false,
      },
    });
  });

  it('gives an empty history rather than nothing at all', async () => {
    const payload = await buildCloudSyncPayloadV1(db);

    expect(payload.periodRecords).toEqual([]);
  });
});

describe('buildCloudSyncPayloadV1 with a pregnancy and nothing else', () => {
  it('carries the pregnancy on its own', async () => {
    cycleRepository.loadCycleProfile.mockResolvedValue(null);
    avatarRepository.loadAvatarConfig.mockResolvedValue(null);

    const payload = await buildCloudSyncPayloadV1(db);

    expect(payload.pregnancyProfile).toEqual(pregnancy());
    expect(payload.cycleSettings).toBeNull();
  });
});

describe('what buildCloudSyncPayloadV1 does not read', () => {
  it.each(forbidden())('never reaches for %s', async (_label, fake) => {
    await buildCloudSyncPayloadV1(db);

    expect(fake).not.toHaveBeenCalled();
  });

  it('works out nothing about today', async () => {
    const payload = await buildCloudSyncPayloadV1(db);

    expect(JSON.stringify(payload)).not.toMatch(/cycleDay|phase|fertil|today|snapshot/i);
  });
});

describe('buildCloudSyncPayloadV1 writes nothing', () => {
  it('saves nothing back to any repository', async () => {
    await buildCloudSyncPayloadV1(db);

    expect(cycleRepository.saveCycleProfile).not.toHaveBeenCalled();
    expect(pregnancyRepository.savePregnancyProfile).not.toHaveBeenCalled();
    expect(pregnancyRepository.clearPregnancyProfile).not.toHaveBeenCalled();
    expect(avatarRepository.saveAvatarConfig).not.toHaveBeenCalled();
    expect(preferencesRepository.saveNotificationPreferences).not.toHaveBeenCalled();
  });

  it('leaves what it read exactly as it found it', async () => {
    const stored = profile();
    cycleRepository.loadCycleProfile.mockResolvedValue(stored);

    await buildCloudSyncPayloadV1(db);

    expect(stored).toEqual(profile());
  });

  it('sends nothing anywhere, because there is nowhere to send it', async () => {
    // A guard against the day someone adds an upload here rather than in a
    // feature of its own: the builder collects, and that is all it does.
    const payload = await buildCloudSyncPayloadV1(db);

    expect(payload).toBeDefined();
    expect(widgetBridge.saveWidgetSnapshot).not.toHaveBeenCalled();
  });
});

describe('buildCloudSyncPayloadV1 when a row is corrupt', () => {
  it('refuses rather than handing out something unreadable', async () => {
    cycleRepository.loadCycleProfile.mockResolvedValue({
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [
        { id: 'a', startDate: date('2026-02-30'), isOngoing: false },
      ],
    });

    await expect(buildCloudSyncPayloadV1(db)).rejects.toThrow(/invalid startDate/);
  });

  it('names no value when it refuses', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      ...pregnancy(),
      estimatedDueDate: date('2027-06-10'),
    });

    const error = await buildCloudSyncPayloadV1(db).then(
      () => {
        throw new Error('expected a rejection');
      },
      (thrown: unknown) => thrown as Error
    );

    expect(error.message).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it.each([
    ['the cycle read', () => cycleRepository.loadCycleProfile],
    ['the pregnancy read', () => pregnancyRepository.loadPregnancyProfile],
    ['the avatar read', () => avatarRepository.loadAvatarConfig],
    ['the preferences read', () => preferencesRepository.loadNotificationPreferences],
  ])('passes a failure in %s on', async (_label, mock) => {
    mock().mockRejectedValue(new Error('database is locked'));

    await expect(buildCloudSyncPayloadV1(db)).rejects.toThrow('database is locked');
  });
});
