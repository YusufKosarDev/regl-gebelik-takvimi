import type { SQLiteDatabase } from 'expo-sqlite';

import { buildCloudSyncPayloadV1 } from '@/features/privacy/application/build-cloud-sync-payload-v1';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';

import { loadRemoteSyncState } from '../../data/cloud-sync-repository';
import { buildConflictPreview } from '../build-conflict-preview';

jest.mock('../../data/cloud-sync-repository', () => ({ loadRemoteSyncState: jest.fn() }));
jest.mock('@/features/privacy/application/build-cloud-sync-payload-v1', () => ({
  buildCloudSyncPayloadV1: jest.fn(),
}));

const loadRemoteSyncStateMock = loadRemoteSyncState as jest.MockedFunction<
  typeof loadRemoteSyncState
>;
const buildCloudSyncPayloadV1Mock = buildCloudSyncPayloadV1 as jest.MockedFunction<
  typeof buildCloudSyncPayloadV1
>;

const db = {} as SQLiteDatabase;

/** A record in the real shape, since the preview counts and reads them. */
function record(startDate: string) {
  return {
    id: `period-${startDate}`,
    startDate,
    endDate: null,
    isOngoing: true,
  } as unknown as CloudSyncPayloadV1['periodRecords'][number];
}

function payload(overrides: Partial<CloudSyncPayloadV1> = {}): CloudSyncPayloadV1 {
  return {
    version: 1,
    cycleSettings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [record('2026-09-02')],
    pregnancyProfile: null,
    avatarConfig: null,
    notificationPreferences: {
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    },
    ...overrides,
  } as unknown as CloudSyncPayloadV1;
}

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    revision: 7,
    payload: payload(),
    contentHash: 'hash-remote',
    updatedAt: '2026-09-20T08:00:00.000Z',
    deviceId: 'device-other',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('describing both sides of a conflict', () => {
  it('counts what each side holds', async () => {
    buildCloudSyncPayloadV1Mock.mockResolvedValue(
      payload({
        periodRecords: [record('2026-09-02'), record('2026-08-01')],
        avatarConfig: { skinToneId: 's', hairStyleId: 'h', hairColorId: 'c', outfitId: 'o' },
      } as unknown as Partial<CloudSyncPayloadV1>)
    );
    loadRemoteSyncStateMock.mockResolvedValue(envelope() as never);

    const result = await buildConflictPreview({ db, uid: 'uid-1', deviceId: 'device-abc' });

    expect(result.kind).toBe('ready');

    if (result.kind !== 'ready') return;

    expect(result.preview.local).toEqual({
      periodRecordCount: 2,
      hasPregnancy: false,
      hasAvatar: true,
      hasCycleSettings: true,
    });
    expect(result.preview.remote).toEqual({
      periodRecordCount: 1,
      hasPregnancy: false,
      hasAvatar: false,
      hasCycleSettings: true,
    });
  });

  it('says how many and whether, and never which', async () => {
    // This is a screen somebody may be holding in front of another person.
    buildCloudSyncPayloadV1Mock.mockResolvedValue(payload());
    loadRemoteSyncStateMock.mockResolvedValue(envelope() as never);

    const result = await buildConflictPreview({ db, uid: 'uid-1', deviceId: 'device-abc' });

    if (result.kind !== 'ready') throw new Error('expected a preview');

    for (const side of [result.preview.local, result.preview.remote]) {
      expect(Object.keys(side).sort()).toEqual([
        'hasAvatar',
        'hasCycleSettings',
        'hasPregnancy',
        'periodRecordCount',
      ]);
    }
  });

  it('carries the revision the choice will be made against', async () => {
    buildCloudSyncPayloadV1Mock.mockResolvedValue(payload());
    loadRemoteSyncStateMock.mockResolvedValue(envelope({ revision: 12 }) as never);

    const result = await buildConflictPreview({ db, uid: 'uid-1', deviceId: 'device-abc' });

    if (result.kind !== 'ready') throw new Error('expected a preview');

    expect(result.preview.revision).toBe(12);
    expect(result.preview.remoteUpdatedAt).toBe('2026-09-20T08:00:00.000Z');
  });

  it('recognises the account being written by this phone itself', async () => {
    // The distinction somebody needs is whether the other version is their own
    // older write or a different phone's.
    buildCloudSyncPayloadV1Mock.mockResolvedValue(payload());
    loadRemoteSyncStateMock.mockResolvedValue(envelope({ deviceId: 'device-abc' }) as never);

    const result = await buildConflictPreview({ db, uid: 'uid-1', deviceId: 'device-abc' });

    if (result.kind !== 'ready') throw new Error('expected a preview');

    expect(result.preview.remoteWrittenByThisDevice).toBe(true);
  });

  it('does not call an unnamed writer this phone', async () => {
    buildCloudSyncPayloadV1Mock.mockResolvedValue(payload());
    loadRemoteSyncStateMock.mockResolvedValue(envelope({ deviceId: null }) as never);

    const result = await buildConflictPreview({ db, uid: 'uid-1', deviceId: 'device-abc' });

    if (result.kind !== 'ready') throw new Error('expected a preview');

    expect(result.preview.remoteWrittenByThisDevice).toBe(false);
  });

  it('keeps the account payload so a resolution need not read it twice', async () => {
    const remote = payload({ periodRecords: [record('2026-07-07')] });

    buildCloudSyncPayloadV1Mock.mockResolvedValue(payload());
    loadRemoteSyncStateMock.mockResolvedValue(envelope({ payload: remote }) as never);

    const result = await buildConflictPreview({ db, uid: 'uid-1', deviceId: 'device-abc' });

    if (result.kind !== 'ready') throw new Error('expected a preview');

    expect(result.preview.remotePayload).toBe(remote);
  });

  it('answers the ordinary restore question too', async () => {
    buildCloudSyncPayloadV1Mock.mockResolvedValue(payload());
    loadRemoteSyncStateMock.mockResolvedValue(envelope() as never);

    const result = await buildConflictPreview({ db, uid: 'uid-1', deviceId: 'device-abc' });

    if (result.kind !== 'ready') throw new Error('expected a preview');

    expect(result.preview.ifCloudWins).toBeDefined();
  });
});

describe('when there is nothing to choose between', () => {
  it('says so when the account holds nothing', async () => {
    buildCloudSyncPayloadV1Mock.mockResolvedValue(payload());
    loadRemoteSyncStateMock.mockResolvedValue(null as never);

    await expect(
      buildConflictPreview({ db, uid: 'uid-1', deviceId: 'device-abc' })
    ).resolves.toEqual({ kind: 'no-remote' });
  });

  it('says it failed rather than showing half a comparison', async () => {
    // Half a comparison is worse than none: somebody would choose a side
    // against numbers that are not the other side's.
    loadRemoteSyncStateMock.mockRejectedValue(new Error('offline'));
    buildCloudSyncPayloadV1Mock.mockResolvedValue(payload());

    await expect(
      buildConflictPreview({ db, uid: 'uid-1', deviceId: 'device-abc' })
    ).resolves.toEqual({ kind: 'failed' });
  });

  it('says it failed when this phone cannot be read either', async () => {
    buildCloudSyncPayloadV1Mock.mockRejectedValue(new Error('db locked'));

    await expect(
      buildConflictPreview({ db, uid: 'uid-1', deviceId: 'device-abc' })
    ).resolves.toEqual({ kind: 'failed' });

    expect(loadRemoteSyncStateMock).not.toHaveBeenCalled();
  });
});
