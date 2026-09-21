import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';

import { restoreCloudBackup } from '@/features/backup/application/restore-cloud-backup';
import { buildCloudSyncPayloadV1 } from '@/features/privacy/application/build-cloud-sync-payload-v1';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';

import { loadRemoteSyncState, pushRemoteSyncState } from '../../data/cloud-sync-repository';
import { saveSyncState } from '../../data/sync-state-repository';
import { cloudSyncContentHash } from '../../domain/cloud-sync-hash';
import { clearUnresolvedConflict } from '../../infrastructure/unresolved-conflict';
import { LAST_SYNC_AT_STORAGE_KEY } from '../../infrastructure/last-sync-at';
import { keepLocalData, keepRemoteData } from '../resolve-sync-conflict';
import {
  onSyncOutcome,
  resetSyncOutcomeListenersForTests,
} from '../sync-outcome-notifier';

// `device-id` reaches AsyncStorage on import. The official mock keeps that
// from being a native call in a test runner.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

/**
 * The gate, standing in for itself.
 *
 * Same behaviour — a counted depth lifted in a `finally` — with the depth
 * exposed, so the tests below can watch it from inside a resolution.
 */
let suspensionDepth = 0;

jest.mock('../automatic-sync-suspension', () => ({
  withAutomaticSyncSuspended: async <T,>(run: () => Promise<T>): Promise<T> => {
    suspensionDepth += 1;

    try {
      return await run();
    } finally {
      suspensionDepth -= 1;
    }
  },
}));

jest.mock('../../data/cloud-sync-repository', () => ({
  loadRemoteSyncState: jest.fn(),
  pushRemoteSyncState: jest.fn(),
}));
jest.mock('../../data/sync-state-repository', () => ({ saveSyncState: jest.fn() }));
jest.mock('../../infrastructure/unresolved-conflict', () => ({
  clearUnresolvedConflict: jest.fn(),
}));
jest.mock('@/features/privacy/application/build-cloud-sync-payload-v1', () => ({
  buildCloudSyncPayloadV1: jest.fn(),
}));
jest.mock('@/features/backup/application/restore-cloud-backup', () => ({
  restoreCloudBackup: jest.fn(),
}));

const loadRemoteSyncStateMock = loadRemoteSyncState as jest.MockedFunction<
  typeof loadRemoteSyncState
>;
const pushRemoteSyncStateMock = pushRemoteSyncState as jest.MockedFunction<
  typeof pushRemoteSyncState
>;
const saveSyncStateMock = saveSyncState as jest.MockedFunction<typeof saveSyncState>;
const clearUnresolvedConflictMock = clearUnresolvedConflict as jest.MockedFunction<
  typeof clearUnresolvedConflict
>;
const buildCloudSyncPayloadV1Mock = buildCloudSyncPayloadV1 as jest.MockedFunction<
  typeof buildCloudSyncPayloadV1
>;
const restoreCloudBackupMock = restoreCloudBackup as jest.MockedFunction<
  typeof restoreCloudBackup
>;

const db = {} as SQLiteDatabase;

/**
 * A real payload, not a stand-in.
 *
 * `cloudSyncContentHash` is called on it for real below, and a shape that only
 * looks like a payload would make that assertion prove nothing.
 */
const payload = (startDate: string): CloudSyncPayloadV1 =>
  ({
    version: 1,
    cycleSettings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [
      {
        id: `period-${startDate}`,
        startDate,
        endDate: null,
        isOngoing: true,
      },
    ],
    pregnancyProfile: null,
    avatarConfig: null,
    notificationPreferences: {
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    },
  }) as unknown as CloudSyncPayloadV1;

const LOCAL = payload('2026-09-01');
const REMOTE = payload('2026-09-05');

const deviceId = async () => 'device-abc';
const now = () => '2026-09-21T10:00:00.000Z';

const input = {
  db,
  uid: 'uid-1',
  expectedRevision: 7,
  deviceId,
  now,
};

beforeEach(() => {
  jest.clearAllMocks();

  buildCloudSyncPayloadV1Mock.mockResolvedValue(LOCAL);
  saveSyncStateMock.mockResolvedValue(undefined);
  clearUnresolvedConflictMock.mockResolvedValue(undefined);
  restoreCloudBackupMock.mockResolvedValue(undefined);
});

/** What the account holds, as the repository reports it. */
function remoteAt(revision: number) {
  return {
    revision,
    payload: REMOTE,
    contentHash: 'hash-remote',
    updatedAt: '2026-09-20T08:00:00.000Z',
    deviceId: 'device-other',
  };
}

describe('keeping what is on this phone', () => {
  it('rebuilds the payload rather than sending what the screen was holding', async () => {
    // A conflict screen can sit open for minutes. Sending the version the
    // phone held when it opened would quietly drop anything written since.
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);
    pushRemoteSyncStateMock.mockResolvedValue({
      kind: 'stored',
      envelope: { revision: 8, updatedAt: '2026-09-21T10:00:00.000Z' },
    } as never);

    await keepLocalData(input);

    expect(buildCloudSyncPayloadV1Mock).toHaveBeenCalledWith(db);
    expect(pushRemoteSyncStateMock).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'uid-1', expectedRevision: 7, payload: LOCAL })
    );
  });

  it('reports the new revision and clears the note', async () => {
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);
    pushRemoteSyncStateMock.mockResolvedValue({
      kind: 'stored',
      envelope: { revision: 8, updatedAt: '2026-09-21T10:00:00.000Z' },
    } as never);

    await expect(keepLocalData(input)).resolves.toEqual({ kind: 'local-kept', revision: 8 });
    expect(clearUnresolvedConflictMock).toHaveBeenCalledTimes(1);
  });

  it('writes the new base, so the next sync measures from what is true', async () => {
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);
    pushRemoteSyncStateMock.mockResolvedValue({
      kind: 'stored',
      envelope: { revision: 8, updatedAt: '2026-09-21T10:00:00.000Z' },
    } as never);

    await keepLocalData(input);

    expect(saveSyncStateMock).toHaveBeenCalledWith(db, {
      uid: 'uid-1',
      revision: 8,
      contentHash: cloudSyncContentHash(LOCAL),
      basePayload: LOCAL,
      updatedAt: '2026-09-21T10:00:00.000Z',
    });
  });

  it('writes nothing when the account moved while the screen was open', async () => {
    // Somebody else got there first. The choice was about an older version.
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(9) as never);

    await expect(keepLocalData(input)).resolves.toEqual({
      kind: 'failed',
      reason: 'revision-moved',
    });

    expect(pushRemoteSyncStateMock).not.toHaveBeenCalled();
    expect(clearUnresolvedConflictMock).not.toHaveBeenCalled();
  });

  it('reports a lost compare-and-set as something to look at again', async () => {
    // The gap between reading and writing is small, not zero.
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);
    pushRemoteSyncStateMock.mockResolvedValue({ kind: 'conflict' } as never);

    await expect(keepLocalData(input)).resolves.toEqual({
      kind: 'failed',
      reason: 'revision-moved',
    });

    expect(clearUnresolvedConflictMock).not.toHaveBeenCalled();
  });

  it('treats an empty account as revision zero', async () => {
    loadRemoteSyncStateMock.mockResolvedValue(null as never);
    pushRemoteSyncStateMock.mockResolvedValue({
      kind: 'stored',
      envelope: { revision: 1, updatedAt: '2026-09-21T10:00:00.000Z' },
    } as never);

    await expect(
      keepLocalData({ ...input, expectedRevision: 0 })
    ).resolves.toEqual({ kind: 'local-kept', revision: 1 });
  });

  it('names a network failure as one', async () => {
    loadRemoteSyncStateMock.mockRejectedValue(
      Object.assign(new Error('offline'), { code: 'unavailable' })
    );

    await expect(keepLocalData(input)).resolves.toEqual({
      kind: 'failed',
      reason: 'network-failed',
    });
  });

  it('does not let a thrown message out under any other name', async () => {
    loadRemoteSyncStateMock.mockRejectedValue(new Error('permission denied for users/uid-1'));

    await expect(keepLocalData(input)).resolves.toEqual({ kind: 'failed', reason: 'unknown' });
  });

  it('keeps the resolution when only the base could not be written', async () => {
    // The account holds the data. A base that is behind is re-derived next
    // time; reporting a failure here would send somebody back to choose again
    // about a conflict that no longer exists.
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);
    pushRemoteSyncStateMock.mockResolvedValue({
      kind: 'stored',
      envelope: { revision: 8, updatedAt: '2026-09-21T10:00:00.000Z' },
    } as never);
    saveSyncStateMock.mockRejectedValue(new Error('db locked'));

    await expect(keepLocalData(input)).resolves.toEqual({ kind: 'local-kept', revision: 8 });
    expect(clearUnresolvedConflictMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the resolution when only the note could not be cleared', async () => {
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);
    pushRemoteSyncStateMock.mockResolvedValue({
      kind: 'stored',
      envelope: { revision: 8, updatedAt: '2026-09-21T10:00:00.000Z' },
    } as never);
    clearUnresolvedConflictMock.mockRejectedValue(new Error('storage gone'));

    await expect(keepLocalData(input)).resolves.toEqual({ kind: 'local-kept', revision: 8 });
  });
});

describe('keeping what is in the account', () => {
  it('writes nothing to the account at all', async () => {
    // It already holds what is wanted. There is no compare to lose.
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);

    await keepRemoteData(input);

    expect(pushRemoteSyncStateMock).not.toHaveBeenCalled();
  });

  it('replaces the phone with the account and clears the note', async () => {
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);

    await expect(keepRemoteData(input)).resolves.toEqual({ kind: 'remote-kept', revision: 7 });

    expect(restoreCloudBackupMock).toHaveBeenCalledWith(db, REMOTE);
    expect(clearUnresolvedConflictMock).toHaveBeenCalledTimes(1);
  });

  it('records the account version as the new base', async () => {
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);

    await keepRemoteData(input);

    expect(saveSyncStateMock).toHaveBeenCalledWith(db, {
      uid: 'uid-1',
      revision: 7,
      contentHash: 'hash-remote',
      basePayload: REMOTE,
      updatedAt: '2026-09-20T08:00:00.000Z',
    });
  });

  it('refuses when the account moved while the screen was open', async () => {
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(9) as never);

    await expect(keepRemoteData(input)).resolves.toEqual({
      kind: 'failed',
      reason: 'revision-moved',
    });

    expect(restoreCloudBackupMock).not.toHaveBeenCalled();
  });

  it('refuses when the account turns out to hold nothing', async () => {
    loadRemoteSyncStateMock.mockResolvedValue(null as never);

    await expect(keepRemoteData(input)).resolves.toEqual({
      kind: 'failed',
      reason: 'revision-moved',
    });

    expect(restoreCloudBackupMock).not.toHaveBeenCalled();
  });

  it('says so when the phone refused the write, and leaves the note alone', async () => {
    // The restore is one transaction, so the phone is wholly untouched. The
    // conflict is still there, and still needs settling.
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);
    restoreCloudBackupMock.mockRejectedValue(new Error('db locked'));

    await expect(keepRemoteData(input)).resolves.toEqual({
      kind: 'failed',
      reason: 'local-failed',
    });

    expect(clearUnresolvedConflictMock).not.toHaveBeenCalled();
  });

  it('names a network failure while reading as one', async () => {
    loadRemoteSyncStateMock.mockRejectedValue(
      Object.assign(new Error('offline'), { code: 'deadline-exceeded' })
    );

    await expect(keepRemoteData(input)).resolves.toEqual({
      kind: 'failed',
      reason: 'network-failed',
    });

    expect(restoreCloudBackupMock).not.toHaveBeenCalled();
  });

  it('keeps the resolution when only the base could not be written', async () => {
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);
    saveSyncStateMock.mockRejectedValue(new Error('db locked'));

    await expect(keepRemoteData(input)).resolves.toEqual({ kind: 'remote-kept', revision: 7 });
  });
});

describe('what neither path ever does', () => {
  it('never stores the conflict payload, whichever side wins', async () => {
    // The merge hands back the *base* value at every disputed place — the one
    // value neither side wrote. Storing it would undo whichever edit lost.
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);
    pushRemoteSyncStateMock.mockResolvedValue({
      kind: 'stored',
      envelope: { revision: 8, updatedAt: '2026-09-21T10:00:00.000Z' },
    } as never);

    await keepLocalData(input);
    await keepRemoteData(input);

    for (const call of saveSyncStateMock.mock.calls) {
      expect([LOCAL, REMOTE]).toContain(call[1].basePayload);
    }

    for (const call of pushRemoteSyncStateMock.mock.calls) {
      expect(call[0].payload).toBe(LOCAL);
    }
  });
});

describe('while a resolution is running', () => {
  it('holds automatic sync off for the whole of keeping the local side', async () => {
    // A foreground trigger landing mid-push would read a database that is
    // being rewritten and send it.
    let sawSuspension = false;

    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);
    pushRemoteSyncStateMock.mockImplementation(async () => {
      sawSuspension = suspensionDepth > 0;

      return { kind: 'stored', envelope: { revision: 8, updatedAt: null } } as never;
    });

    await keepLocalData(input);

    expect(sawSuspension).toBe(true);
    expect(suspensionDepth).toBe(0);
  });

  it('holds automatic sync off for the whole of keeping the remote side', async () => {
    let sawSuspension = false;

    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);
    restoreCloudBackupMock.mockImplementation(async () => {
      sawSuspension = suspensionDepth > 0;
    });

    await keepRemoteData(input);

    expect(sawSuspension).toBe(true);
    expect(suspensionDepth).toBe(0);
  });

  it('lifts the suspension after a failure too', async () => {
    // Otherwise one failed resolution would leave the app unable to sync at
    // all for as long as it stayed open.
    loadRemoteSyncStateMock.mockRejectedValue(new Error('offline'));

    await keepLocalData(input);
    await keepRemoteData(input);

    expect(suspensionDepth).toBe(0);
  });
});

describe('telling the rest of the app it is over', () => {
  beforeEach(() => {
    resetSyncOutcomeListenersForTests();
  });

  it('announces keeping the phone as the push it was', async () => {
    // The account screen listens to this. Without it the conflict notice stayed
    // on screen for a conflict that had just been settled, until the screen was
    // rebuilt from scratch.
    const heard: unknown[] = [];

    onSyncOutcome((outcome) => heard.push(outcome));

    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);
    pushRemoteSyncStateMock.mockResolvedValue({
      kind: 'stored',
      envelope: { revision: 8, updatedAt: '2026-09-21T10:00:00.000Z' },
    } as never);

    await keepLocalData(input);

    expect(heard).toEqual([{ kind: 'pushed', revision: 8 }]);
  });

  it('announces keeping the account as the pull it was', async () => {
    const heard: unknown[] = [];

    onSyncOutcome((outcome) => heard.push(outcome));

    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);

    await keepRemoteData(input);

    expect(heard).toEqual([{ kind: 'pulled', revision: 7 }]);
  });

  it('says nothing when the resolution failed', async () => {
    // Nothing moved, so nothing anybody is showing has gone out of date.
    const heard: unknown[] = [];

    onSyncOutcome((outcome) => heard.push(outcome));

    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(9) as never);

    await keepLocalData(input);
    await keepRemoteData(input);

    expect(heard).toEqual([]);
  });

  it('records the sync time, the same as any other sync that agreed', async () => {
    loadRemoteSyncStateMock.mockResolvedValue(remoteAt(7) as never);

    await keepRemoteData(input);

    await expect(AsyncStorage.getItem(LAST_SYNC_AT_STORAGE_KEY)).resolves.toBe(
      '2026-09-21T10:00:00.000Z'
    );
  });
});
