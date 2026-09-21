import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';

import { AuthError } from '@/features/auth/domain/auth-error';
import type { CycleSettings } from '@/features/cycle/domain/types';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import type { ISODate } from '@/types/iso-date';

import type { CloudBackupEnvelopeV1 } from '../../domain/cloud-backup-envelope-v1';
import { cloudSyncContentHash } from '../../domain/cloud-sync-hash';
import type { SyncState } from '../../domain/sync-state';
import { LAST_SYNC_AT_STORAGE_KEY } from '../../infrastructure/last-sync-at';
import { UNRESOLVED_CONFLICT_STORAGE_KEY } from '../../infrastructure/unresolved-conflict';
import type { CloudSyncOutcome } from '../run-cloud-sync';
import { runCloudSync } from '../run-cloud-sync';
import {
  onSyncOutcome,
  resetSyncOutcomeListenersForTests,
} from '../sync-outcome-notifier';

/**
 * Everything that reads or writes is faked.
 *
 * What this file is about is the order of those calls and what happens when one
 * of them fails — not SQL, not Firestore and not the transaction, each of which
 * is pinned where it lives. `decideSync`, `mergeCloudSyncPayload` and the
 * content hash are the real ones: the point of the orchestrator is that it uses
 * them, and a fake decision engine would leave that untested.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@/features/privacy/application/build-cloud-sync-payload-v1', () => ({
  buildCloudSyncPayloadV1: jest.fn(),
}));

jest.mock('@/features/backup/application/restore-cloud-backup', () => ({
  restoreCloudBackup: jest.fn(),
}));

jest.mock('../../data/sync-state-repository', () => ({
  loadSyncState: jest.fn(),
  saveSyncState: jest.fn(),
  clearSyncState: jest.fn(),
}));

// The repository's own contract is tested against a transaction mock in its own
// file. Here it is a boundary: two functions, a typed conflict result and an
// error type that has to stay distinguishable from a network failure.
jest.mock('../../data/cloud-sync-repository', () => {
  class CloudSyncDocumentError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'CloudSyncDocumentError';
    }
  }

  return {
    NO_REMOTE_REVISION: 0,
    CloudSyncDocumentError,
    loadRemoteSyncState: jest.fn(),
    pushRemoteSyncState: jest.fn(),
  };
});

jest.mock('@/features/deletion/infrastructure/pending-account-deletion', () => ({
  isAccountDeletionPending: jest.fn(),
}));

jest.mock('../../infrastructure/device-id', () => ({
  deviceIdProvider: jest.fn(),
}));

jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: jest.requireActual('@/shared/logging').describeValue,
  describeError: jest.requireActual('@/shared/logging').describeError,
}));

const builder = jest.requireMock('@/features/privacy/application/build-cloud-sync-payload-v1');
const restore = jest.requireMock('@/features/backup/application/restore-cloud-backup');
const syncState = jest.requireMock('../../data/sync-state-repository');
const cloud = jest.requireMock('../../data/cloud-sync-repository');
const deviceId = jest.requireMock('../../infrastructure/device-id');
const logging = jest.requireMock('@/shared/logging');
const pendingDeletion = jest.requireMock(
  '@/features/deletion/infrastructure/pending-account-deletion'
);

const { CloudSyncDocumentError } = cloud;

const UID = 'firebase-uid-1';
const OTHER_UID = 'firebase-uid-2';
const DEVICE = 'device-aaaa-1111';
const NOW = '2026-09-20T10:00:00.000Z';
const STAMP = '2026-09-01T08:00:00.000Z';

const db = {} as unknown as SQLiteDatabase;
const date = (value: string) => value as ISODate;

/** Every call that reads or writes, in the order it happened. */
let calls: string[] = [];

function settings(cycle = 28, period = 5): CycleSettings {
  return { averageCycleLengthDays: cycle, averagePeriodLengthDays: period };
}

function payload(overrides: Partial<CloudSyncPayloadV1> = {}): CloudSyncPayloadV1 {
  return {
    version: 1,
    cycleSettings: settings(),
    periodRecords: [
      {
        id: 'period-2026-09-02',
        startDate: date('2026-09-02'),
        endDate: date('2026-09-07'),
        isOngoing: false,
      },
    ],
    pregnancyProfile: null,
    avatarConfig: null,
    notificationPreferences: {
      periodReminderEnabled: false,
      pregnancyWeeklyReminderEnabled: false,
    },
    ...overrides,
  };
}

/** What the two sides last agreed. */
const AGREED = payload();
/** A change only this phone made. */
const ON_THE_PHONE = payload({ cycleSettings: settings(30, 5) });
/** A change only the account has, which fits together with the one above. */
const IN_THE_ACCOUNT = payload({ cycleSettings: settings(28, 6) });
/** The two of them merged. */
const BOTH = payload({ cycleSettings: settings(30, 6) });
/** A change that cannot sit beside the phone's. */
const CONTESTED = payload({ cycleSettings: settings(32, 5) });

function envelope(
  revision: number,
  content: CloudSyncPayloadV1,
  overrides: Partial<CloudBackupEnvelopeV1> = {}
): CloudBackupEnvelopeV1 {
  return {
    version: 1,
    revision,
    contentHash: cloudSyncContentHash(content),
    deviceId: 'device-bbbb-2222',
    updatedAt: STAMP,
    payload: content,
    ...overrides,
  };
}

function base(revision: number, content: CloudSyncPayloadV1, uid = UID): SyncState {
  return {
    uid,
    revision,
    contentHash: cloudSyncContentHash(content),
    basePayload: content,
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

/** Sets up one sync: what is on the phone, what was agreed, what is stored. */
function arrange(options: {
  readonly local: CloudSyncPayloadV1;
  readonly agreed: SyncState | null;
  readonly stored: CloudBackupEnvelopeV1 | null;
}): void {
  // Implementations rather than resolved values, so every read stays on the
  // record that the ordering assertions are made against.
  builder.buildCloudSyncPayloadV1.mockImplementation(async () => {
    calls.push('read local');

    return options.local;
  });

  syncState.loadSyncState.mockImplementation(async () => {
    calls.push('read base');

    return options.agreed;
  });

  cloud.loadRemoteSyncState.mockImplementation(async () => {
    calls.push('read remote');

    return options.stored;
  });
}

function sync(overrides: Partial<Parameters<typeof runCloudSync>[0]> = {}) {
  return runCloudSync({ db, uid: UID, deviceId: async () => DEVICE, now: () => NOW, ...overrides });
}

beforeEach(() => {
  calls = [];

  pendingDeletion.isAccountDeletionPending.mockReset();
  pendingDeletion.isAccountDeletionPending.mockResolvedValue(false);

  builder.buildCloudSyncPayloadV1.mockReset();
  builder.buildCloudSyncPayloadV1.mockImplementation(async () => {
    calls.push('read local');

    return AGREED;
  });

  restore.restoreCloudBackup.mockReset();
  restore.restoreCloudBackup.mockImplementation(async () => {
    calls.push('write local');
  });

  syncState.loadSyncState.mockReset();
  syncState.loadSyncState.mockImplementation(async () => {
    calls.push('read base');

    return null;
  });

  syncState.saveSyncState.mockReset();
  syncState.saveSyncState.mockImplementation(async () => {
    calls.push('write base');
  });

  cloud.loadRemoteSyncState.mockReset();
  cloud.loadRemoteSyncState.mockImplementation(async () => {
    calls.push('read remote');

    return null;
  });

  cloud.pushRemoteSyncState.mockReset();
  cloud.pushRemoteSyncState.mockImplementation(
    async (input: { expectedRevision: number; payload: CloudSyncPayloadV1; deviceId: string }) => {
      calls.push('write remote');

      return {
        kind: 'stored',
        envelope: envelope(input.expectedRevision + 1, input.payload, {
          deviceId: input.deviceId,
          // The server has not stamped it yet, which is the ordinary case for a
          // document this device has only just written.
          updatedAt: null,
        }),
      };
    }
  );

  deviceId.deviceIdProvider.mockReset();
  deviceId.deviceIdProvider.mockResolvedValue('device-from-storage');

  logging.logEvent.mockReset();
});

// ---------------------------------------------------------------------------
// Nobody signed in
// ---------------------------------------------------------------------------

describe('with nobody signed in', () => {
  it.each([
    ['no account at all', null],
    ['an account that is not there', undefined],
    ['a blank account id', '   '],
  ])('does not start a sync for %s', async (_label, uid) => {
    await expect(sync({ uid: uid as string })).resolves.toEqual({
      kind: 'error',
      failure: 'signed-out',
    });
  });

  it('reads nothing and writes nothing', async () => {
    await sync({ uid: null });

    expect(calls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 1, 6. Nothing to do
// ---------------------------------------------------------------------------

describe('when both sides already hold the same thing', () => {
  it('says so, and writes nothing anywhere', async () => {
    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await expect(sync()).resolves.toEqual({ kind: 'noop', revision: 4 });
    expect(calls).toEqual(['read local', 'read base', 'read remote']);
  });

  it('writes down the agreement when the base had not caught up', async () => {
    // What a device is left with when its last sync was interrupted between the
    // local write and the base row.
    arrange({ local: IN_THE_ACCOUNT, agreed: base(3, AGREED), stored: envelope(4, IN_THE_ACCOUNT) });

    await expect(sync()).resolves.toEqual({ kind: 'noop', revision: 4 });
    expect(syncState.saveSyncState).toHaveBeenCalledWith(db, {
      uid: UID,
      revision: 4,
      contentHash: cloudSyncContentHash(IN_THE_ACCOUNT),
      basePayload: IN_THE_ACCOUNT,
      updatedAt: STAMP,
    });
  });

  it('touches neither side while doing it', async () => {
    arrange({ local: IN_THE_ACCOUNT, agreed: base(3, AGREED), stored: envelope(4, IN_THE_ACCOUNT) });

    await sync();

    expect(restore.restoreCloudBackup).not.toHaveBeenCalled();
    expect(cloud.pushRemoteSyncState).not.toHaveBeenCalled();
  });

  it('records the agreement on a first sync that happens to match', async () => {
    arrange({ local: AGREED, agreed: null, stored: envelope(2, AGREED) });

    await expect(sync()).resolves.toEqual({ kind: 'noop', revision: 2 });
    expect(syncState.saveSyncState).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 2, 8, 11. Pushing
// ---------------------------------------------------------------------------

describe('when only this phone changed', () => {
  it('sends what is on the phone', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await expect(sync()).resolves.toEqual({ kind: 'pushed', revision: 5 });
    expect(cloud.pushRemoteSyncState).toHaveBeenCalledWith({
      uid: UID,
      expectedRevision: 4,
      payload: ON_THE_PHONE,
      deviceId: DEVICE,
    });
  });

  it('writes nothing to the phone', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await sync();

    expect(restore.restoreCloudBackup).not.toHaveBeenCalled();
  });

  it('moves the base to what was stored', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await sync();

    expect(syncState.saveSyncState).toHaveBeenCalledWith(db, {
      uid: UID,
      revision: 5,
      contentHash: cloudSyncContentHash(ON_THE_PHONE),
      basePayload: ON_THE_PHONE,
      updatedAt: NOW,
    });
  });

  it('writes the account before the base', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await sync();

    expect(calls).toEqual(['read local', 'read base', 'read remote', 'write remote', 'write base']);
  });
});

describe('the very first sync of an account', () => {
  it('expects nothing to be there and lands on revision one', async () => {
    arrange({ local: ON_THE_PHONE, agreed: null, stored: null });

    await expect(sync()).resolves.toEqual({ kind: 'pushed', revision: 1 });
    expect(cloud.pushRemoteSyncState).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 0 })
    );
  });

  it('starts the base off at that revision', async () => {
    arrange({ local: ON_THE_PHONE, agreed: null, stored: null });

    await sync();

    expect(syncState.saveSyncState).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ revision: 1, basePayload: ON_THE_PHONE })
    );
  });

  it('pushes rather than emptying the phone when the account holds nothing', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: null });

    await expect(sync()).resolves.toMatchObject({ kind: 'pushed' });
    expect(restore.restoreCloudBackup).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. A backup written before any of this existed
// ---------------------------------------------------------------------------

describe('an account whose backup predates the bookkeeping', () => {
  it('pushes against the revision the repository normalised it to', async () => {
    arrange({
      local: ON_THE_PHONE,
      agreed: base(0, AGREED),
      stored: envelope(0, AGREED, { deviceId: null }),
    });

    await expect(sync()).resolves.toEqual({ kind: 'pushed', revision: 1 });
    expect(cloud.pushRemoteSyncState).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 0 })
    );
  });

  it('can be pulled from like any other', async () => {
    arrange({
      local: AGREED,
      agreed: base(0, ON_THE_PHONE),
      stored: envelope(0, AGREED, { deviceId: null }),
    });

    // The phone holds what was agreed, the account holds something else: a pull.
    arrange({
      local: AGREED,
      agreed: base(0, AGREED),
      stored: envelope(0, IN_THE_ACCOUNT, { deviceId: null }),
    });

    await expect(sync()).resolves.toEqual({ kind: 'pulled', revision: 0 });
  });
});

// ---------------------------------------------------------------------------
// 3, 12. Pulling
// ---------------------------------------------------------------------------

describe('when only the account changed', () => {
  it('writes what is stored over what is on the phone', async () => {
    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });

    await expect(sync()).resolves.toEqual({ kind: 'pulled', revision: 5 });
    expect(restore.restoreCloudBackup).toHaveBeenCalledWith(db, IN_THE_ACCOUNT);
  });

  it('sends nothing back', async () => {
    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });

    await sync();

    expect(cloud.pushRemoteSyncState).not.toHaveBeenCalled();
  });

  it('moves the base to what it took', async () => {
    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });

    await sync();

    expect(syncState.saveSyncState).toHaveBeenCalledWith(db, {
      uid: UID,
      revision: 5,
      contentHash: cloudSyncContentHash(IN_THE_ACCOUNT),
      basePayload: IN_THE_ACCOUNT,
      updatedAt: STAMP,
    });
  });

  it('writes the phone before the base', async () => {
    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });

    await sync();

    expect(calls).toEqual(['read local', 'read base', 'read remote', 'write local', 'write base']);
  });
});

// ---------------------------------------------------------------------------
// 4, 13. Both changed, and it fits
// ---------------------------------------------------------------------------

describe('when both sides changed and the changes fit together', () => {
  function bothChanged() {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });
  }

  it('keeps both changes', async () => {
    bothChanged();

    await expect(sync()).resolves.toEqual({ kind: 'merged', revision: 6 });
    expect(cloud.pushRemoteSyncState).toHaveBeenCalledWith({
      uid: UID,
      expectedRevision: 5,
      payload: BOTH,
      deviceId: DEVICE,
    });
  });

  it('puts the merged history on the phone as well', async () => {
    bothChanged();

    await sync();

    expect(restore.restoreCloudBackup).toHaveBeenCalledWith(db, BOTH);
  });

  it('writes the account first, then the phone, then the base', async () => {
    bothChanged();

    await sync();

    expect(calls).toEqual([
      'read local',
      'read base',
      'read remote',
      'write remote',
      'write local',
      'write base',
    ]);
  });

  it('moves the base to the merged result', async () => {
    bothChanged();

    await sync();

    expect(syncState.saveSyncState).toHaveBeenCalledWith(db, {
      uid: UID,
      revision: 6,
      contentHash: cloudSyncContentHash(BOTH),
      basePayload: BOTH,
      updatedAt: NOW,
    });
  });

  it('merges against the base payload rather than against either side', async () => {
    bothChanged();

    const result = await sync();

    // Neither side's own payload would have both changes in it.
    expect(result).toMatchObject({ kind: 'merged' });
    expect(cloud.pushRemoteSyncState.mock.calls[0][0].payload).not.toEqual(ON_THE_PHONE);
    expect(cloud.pushRemoteSyncState.mock.calls[0][0].payload).not.toEqual(IN_THE_ACCOUNT);
  });
});

// ---------------------------------------------------------------------------
// 5, 14. Both changed, and it does not fit
// ---------------------------------------------------------------------------

describe('when both sides changed the same thing', () => {
  function contested() {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(5, CONTESTED) });
  }

  it('reports the conflict rather than throwing', async () => {
    contested();

    const result = await sync();

    expect(result).toMatchObject({ kind: 'conflict', reason: 'unresolved' });
  });

  it('says which part is in question', async () => {
    contested();

    const result = await sync();

    expect(result.kind === 'conflict' && result.conflicts.map((one) => one.path)).toEqual([
      'cycleSettings.averageCycleLengthDays',
    ]);
  });

  it('writes nothing, on either side', async () => {
    contested();

    await sync();

    expect(calls).toEqual(['read local', 'read base', 'read remote']);
    expect(restore.restoreCloudBackup).not.toHaveBeenCalled();
    expect(cloud.pushRemoteSyncState).not.toHaveBeenCalled();
    expect(syncState.saveSyncState).not.toHaveBeenCalled();
  });

  it('leaves the base exactly where it was', async () => {
    contested();

    await sync();

    expect(syncState.saveSyncState).not.toHaveBeenCalled();
  });
});

describe('an account this phone has never synced', () => {
  it('will not choose between two histories it cannot measure', async () => {
    arrange({ local: ON_THE_PHONE, agreed: null, stored: envelope(3, IN_THE_ACCOUNT) });

    await expect(sync()).resolves.toEqual({
      kind: 'conflict',
      reason: 'no-base',
      conflicts: [],
    });
  });

  it('writes nothing while it cannot', async () => {
    arrange({ local: ON_THE_PHONE, agreed: null, stored: envelope(3, IN_THE_ACCOUNT) });

    await sync();

    expect(restore.restoreCloudBackup).not.toHaveBeenCalled();
    expect(cloud.pushRemoteSyncState).not.toHaveBeenCalled();
    expect(syncState.saveSyncState).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 9, 10. Somebody else wrote first
// ---------------------------------------------------------------------------

describe('when the account moves underneath a push', () => {
  function raced() {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });
  }

  it('looks again rather than insisting', async () => {
    raced();
    cloud.pushRemoteSyncState.mockResolvedValueOnce({ kind: 'conflict', actualRevision: 9 });

    await sync();

    expect(cloud.loadRemoteSyncState).toHaveBeenCalledTimes(2);
  });

  it('reads the phone and the base again too, rather than deciding from a stale read', async () => {
    raced();
    cloud.pushRemoteSyncState.mockResolvedValueOnce({ kind: 'conflict', actualRevision: 9 });

    await sync();

    expect(builder.buildCloudSyncPayloadV1).toHaveBeenCalledTimes(2);
    expect(syncState.loadSyncState).toHaveBeenCalledTimes(2);
  });

  it('gets there on the second look when the account has settled', async () => {
    raced();
    cloud.pushRemoteSyncState.mockResolvedValueOnce({ kind: 'conflict', actualRevision: 5 });
    cloud.loadRemoteSyncState
      .mockImplementationOnce(async () => {
        calls.push('read remote');

        return envelope(4, AGREED);
      })
      .mockImplementationOnce(async () => {
        calls.push('read remote');

        return envelope(5, AGREED);
      });
    syncState.loadSyncState.mockImplementation(async () => {
      calls.push('read base');

      return base(5, AGREED);
    });

    await expect(sync()).resolves.toEqual({ kind: 'pushed', revision: 6 });
  });

  it('gives up after the second try and says what the revision actually is', async () => {
    raced();
    cloud.pushRemoteSyncState.mockResolvedValue({ kind: 'conflict', actualRevision: 11 });

    await expect(sync()).resolves.toEqual({ kind: 'retry-required', actualRevision: 11 });
  });

  it('stops at two, rather than competing with the other device', async () => {
    raced();
    cloud.pushRemoteSyncState.mockResolvedValue({ kind: 'conflict', actualRevision: 11 });

    await sync();

    expect(cloud.pushRemoteSyncState).toHaveBeenCalledTimes(2);
  });

  it('never writes the phone because a push was refused', async () => {
    raced();
    cloud.pushRemoteSyncState.mockResolvedValue({ kind: 'conflict', actualRevision: 11 });

    await sync();

    expect(restore.restoreCloudBackup).not.toHaveBeenCalled();
  });

  it('never moves the base because a push was refused', async () => {
    raced();
    cloud.pushRemoteSyncState.mockResolvedValue({ kind: 'conflict', actualRevision: 11 });

    await sync();

    expect(syncState.saveSyncState).not.toHaveBeenCalled();
  });

  it('refuses a merged push the same way, and leaves the phone alone', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });
    cloud.pushRemoteSyncState.mockResolvedValue({ kind: 'conflict', actualRevision: 7 });

    await expect(sync()).resolves.toEqual({ kind: 'retry-required', actualRevision: 7 });
    expect(restore.restoreCloudBackup).not.toHaveBeenCalled();
    expect(syncState.saveSyncState).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 15, 16. When a write does not land
// ---------------------------------------------------------------------------

describe('when the phone cannot be written', () => {
  it('says so, and does not move the base', async () => {
    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });
    restore.restoreCloudBackup.mockRejectedValue(new Error('database is locked'));

    await expect(sync()).resolves.toEqual({ kind: 'error', failure: 'local-failed' });
    expect(syncState.saveSyncState).not.toHaveBeenCalled();
  });

  it('leaves the base behind rather than ahead after a merged push landed', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });
    restore.restoreCloudBackup.mockRejectedValue(new Error('database is locked'));

    await expect(sync()).resolves.toEqual({ kind: 'error', failure: 'local-failed' });
    // The account is at 6 and the base is still at 4: the next sync will find
    // them apart and work it out again, which is the recoverable way round.
    expect(cloud.pushRemoteSyncState).toHaveBeenCalledTimes(1);
    expect(syncState.saveSyncState).not.toHaveBeenCalled();
  });

  it('says so when the phone cannot even be read', async () => {
    builder.buildCloudSyncPayloadV1.mockRejectedValue(new Error('no such table'));

    await expect(sync()).resolves.toEqual({ kind: 'error', failure: 'local-failed' });
    expect(cloud.loadRemoteSyncState).not.toHaveBeenCalled();
  });

  it('says so when the base row cannot be read', async () => {
    arrange({ local: AGREED, agreed: null, stored: null });
    syncState.loadSyncState.mockRejectedValue(new Error('no such table'));

    await expect(sync()).resolves.toEqual({ kind: 'error', failure: 'local-failed' });
  });

  it('says so when the base row cannot be written', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });
    syncState.saveSyncState.mockRejectedValue(new Error('disk is full'));

    await expect(sync()).resolves.toEqual({ kind: 'error', failure: 'local-failed' });
  });

  it('carries no message out of the database with it', async () => {
    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });
    restore.restoreCloudBackup.mockRejectedValue(
      new Error('UNIQUE constraint failed: period_records.start_date 2026-09-02')
    );

    const result = await sync();

    expect(JSON.stringify(result)).not.toMatch(/2026-09-02|period_records|UNIQUE/);
  });
});

describe('when the account cannot be reached', () => {
  it.each([
    ['network-failed', 'network-failed'],
    ['invalid-credentials', 'invalid-credentials'],
    ['not-configured', 'not-configured'],
    ['too-many-requests', 'unknown'],
  ])('turns a %s from the read into %s', async (code, failure) => {
    cloud.loadRemoteSyncState.mockRejectedValue(new AuthError(code as 'network-failed'));

    await expect(sync()).resolves.toEqual({ kind: 'error', failure });
  });

  it('does not move the base when the write failed', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });
    cloud.pushRemoteSyncState.mockRejectedValue(new AuthError('network-failed'));

    await expect(sync()).resolves.toEqual({ kind: 'error', failure: 'network-failed' });
    expect(syncState.saveSyncState).not.toHaveBeenCalled();
  });

  it('does not write the phone when the write failed', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });
    cloud.pushRemoteSyncState.mockRejectedValue(new AuthError('network-failed'));

    await sync();

    expect(restore.restoreCloudBackup).not.toHaveBeenCalled();
  });

  it('keeps a stored backup it cannot read apart from a failed request', async () => {
    cloud.loadRemoteSyncState.mockRejectedValue(
      new CloudSyncDocumentError('The stored backup could not be read.')
    );

    await expect(sync()).resolves.toEqual({ kind: 'error', failure: 'unreadable-backup' });
  });

  it('will not overwrite a backup it cannot read', async () => {
    cloud.loadRemoteSyncState.mockRejectedValue(
      new CloudSyncDocumentError('The stored backup could not be read.')
    );

    await sync();

    expect(cloud.pushRemoteSyncState).not.toHaveBeenCalled();
    expect(restore.restoreCloudBackup).not.toHaveBeenCalled();
  });

  it('turns anything unrecognised into unknown rather than passing it on', async () => {
    cloud.loadRemoteSyncState.mockRejectedValue(new Error('something the SDK made up'));

    await expect(sync()).resolves.toEqual({ kind: 'error', failure: 'unknown' });
  });
});

// ---------------------------------------------------------------------------
// 17. What it does to what it was given
// ---------------------------------------------------------------------------

describe('what it does to the data it handles', () => {
  it('changes nothing about the payload it read from the phone', async () => {
    const local = Object.freeze(payload({ cycleSettings: settings(30, 5) }));
    arrange({ local, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await expect(sync()).resolves.toMatchObject({ kind: 'pushed' });
    expect(local).toEqual(payload({ cycleSettings: settings(30, 5) }));
  });

  it('changes nothing about the stored payload it pulled', async () => {
    const stored = envelope(5, IN_THE_ACCOUNT);
    Object.freeze(stored);
    arrange({ local: AGREED, agreed: base(4, AGREED), stored });

    await expect(sync()).resolves.toMatchObject({ kind: 'pulled' });
    expect(stored.payload).toBe(IN_THE_ACCOUNT);
  });

  it('sends the phone’s payload untouched rather than a copy of something else', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await sync();

    expect(cloud.pushRemoteSyncState.mock.calls[0][0].payload).toBe(ON_THE_PHONE);
  });

  it('writes the stored payload to the phone untouched', async () => {
    const stored = envelope(5, IN_THE_ACCOUNT);
    arrange({ local: AGREED, agreed: base(4, AGREED), stored });

    await sync();

    expect(restore.restoreCloudBackup.mock.calls[0][1]).toBe(stored.payload);
  });
});

// ---------------------------------------------------------------------------
// 18. One account never reaches another
// ---------------------------------------------------------------------------

describe('one account never reaches another', () => {
  it('asks for the base of the account it was given', async () => {
    arrange({ local: AGREED, agreed: null, stored: null });

    await sync({ uid: OTHER_UID });

    expect(syncState.loadSyncState).toHaveBeenCalledWith(db, OTHER_UID);
  });

  it('reads and writes the account it was given', async () => {
    arrange({ local: ON_THE_PHONE, agreed: null, stored: null });

    await sync({ uid: OTHER_UID });

    expect(cloud.loadRemoteSyncState).toHaveBeenCalledWith(OTHER_UID);
    expect(cloud.pushRemoteSyncState).toHaveBeenCalledWith(
      expect.objectContaining({ uid: OTHER_UID })
    );
  });

  it('writes the base under that account', async () => {
    arrange({ local: ON_THE_PHONE, agreed: null, stored: null });

    await sync({ uid: OTHER_UID });

    expect(syncState.saveSyncState).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ uid: OTHER_UID })
    );
  });

  it('never uses one account’s base for another', async () => {
    // A base row belonging to somebody else would be the wrong thing to measure
    // from; the repository is asked for this account's, and that is all it gets.
    arrange({ local: AGREED, agreed: null, stored: null });

    await sync({ uid: OTHER_UID });

    expect(syncState.loadSyncState).toHaveBeenCalledTimes(1);
    expect(syncState.loadSyncState).not.toHaveBeenCalledWith(db, UID);
  });
});

// ---------------------------------------------------------------------------
// The device it calls itself
// ---------------------------------------------------------------------------

describe('the device id a write carries', () => {
  it('is the one it was given', async () => {
    arrange({ local: ON_THE_PHONE, agreed: null, stored: null });

    await sync({ deviceId: async () => 'device-for-a-test' });

    expect(cloud.pushRemoteSyncState).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'device-for-a-test' })
    );
  });

  it('is this installation’s when nothing was given', async () => {
    arrange({ local: ON_THE_PHONE, agreed: null, stored: null });

    await runCloudSync({ db, uid: UID, now: () => NOW });

    expect(cloud.pushRemoteSyncState).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'device-from-storage' })
    );
  });

  it('is not asked for when nothing is being written', async () => {
    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await runCloudSync({ db, uid: UID, now: () => NOW });

    expect(deviceId.deviceIdProvider).not.toHaveBeenCalled();
  });

  it('stops the sync rather than inventing one when storage will not answer', async () => {
    arrange({ local: ON_THE_PHONE, agreed: null, stored: null });
    deviceId.deviceIdProvider.mockRejectedValue(new Error('storage unavailable'));

    await expect(runCloudSync({ db, uid: UID, now: () => NOW })).resolves.toEqual({
      kind: 'error',
      failure: 'local-failed',
    });
    expect(cloud.pushRemoteSyncState).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Everything else
// ---------------------------------------------------------------------------

describe('what a sync leaves behind', () => {
  it('writes nothing to the log or the console, whatever happens', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(5, CONTESTED) });
    await sync();

    cloud.loadRemoteSyncState.mockRejectedValue(new AuthError('network-failed'));
    await sync();

    expect(logging.logEvent).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('runs nothing by being imported', () => {
    expect(builder.buildCloudSyncPayloadV1).not.toHaveBeenCalled();
    expect(cloud.loadRemoteSyncState).not.toHaveBeenCalled();
  });

  it('reads the phone once per pass and no more', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await sync();

    expect(builder.buildCloudSyncPayloadV1).toHaveBeenCalledTimes(1);
    expect(builder.buildCloudSyncPayloadV1).toHaveBeenCalledWith(db);
  });

  it('dates a base row by the clock it was given when the server has not stamped it', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await sync({ now: () => '2030-01-01T00:00:00.000Z' });

    expect(syncState.saveSyncState).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ updatedAt: '2030-01-01T00:00:00.000Z' })
    );
  });

  it('prefers the server’s stamp when there is one', async () => {
    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });

    await sync({ now: () => '2030-01-01T00:00:00.000Z' });

    expect(syncState.saveSyncState).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ updatedAt: STAMP })
    );
  });
});

describe('an account whose deletion is part-way through', () => {
  it('refuses to sync at all', async () => {
    pendingDeletion.isAccountDeletionPending.mockResolvedValue(true);

    expect(await sync()).toEqual({ kind: 'error', failure: 'deletion-pending' });
  });

  it('reads nothing and writes nothing', async () => {
    // The backup was deleted a moment ago on purpose. Every decision below the
    // guard would read that absence as "this phone has the only copy".
    pendingDeletion.isAccountDeletionPending.mockResolvedValue(true);

    await sync();

    expect(calls).toEqual([]);
  });

  it('never pushes, which is what would re-create the deleted backup', async () => {
    pendingDeletion.isAccountDeletionPending.mockResolvedValue(true);

    await sync();

    expect(cloud.pushRemoteSyncState).not.toHaveBeenCalled();
  });

  it('asks about the account being synced, not about any deletion', async () => {
    await sync();

    expect(pendingDeletion.isAccountDeletionPending).toHaveBeenCalledWith(UID);
  });

  it('syncs normally once the deletion is finished or abandoned', async () => {
    pendingDeletion.isAccountDeletionPending.mockResolvedValue(false);
    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });

    expect((await sync()).kind).not.toBe('error');
  });

  it('is not even asked when there is no account to sync', async () => {
    const outcome = await sync({ uid: '   ' });

    expect(outcome).toEqual({ kind: 'error', failure: 'signed-out' });
    expect(pendingDeletion.isAccountDeletionPending).not.toHaveBeenCalled();
  });
});

describe('what a finished sync writes down, whoever started it', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('records when a push happened', async () => {
    // The status line under the switch used to move only for syncs the
    // scheduler ran, so pressing the button left it showing an older time.
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await expect(sync()).resolves.toEqual({ kind: 'pushed', revision: 5 });
    await expect(AsyncStorage.getItem(LAST_SYNC_AT_STORAGE_KEY)).resolves.toBe(NOW);
  });

  it('records when a pull happened', async () => {
    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(5, IN_THE_ACCOUNT) });

    await expect(sync()).resolves.toEqual({ kind: 'pulled', revision: 5 });
    await expect(AsyncStorage.getItem(LAST_SYNC_AT_STORAGE_KEY)).resolves.toBe(NOW);
  });

  it('records when there was nothing to do', async () => {
    // "Nothing to send" is a successful sync, and the line saying so is the
    // difference between up to date and not working.
    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await expect(sync()).resolves.toEqual({ kind: 'noop', revision: 4 });
    await expect(AsyncStorage.getItem(LAST_SYNC_AT_STORAGE_KEY)).resolves.toBe(NOW);
  });

  it('records nothing when the sync found a conflict', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(5, CONTESTED) });

    await expect(sync()).resolves.toMatchObject({ kind: 'conflict' });
    await expect(AsyncStorage.getItem(LAST_SYNC_AT_STORAGE_KEY)).resolves.toBeNull();
  });

  it('records nothing when the sync failed', async () => {
    cloud.loadRemoteSyncState.mockRejectedValue(new AuthError('network-failed'));

    await expect(sync()).resolves.toMatchObject({ kind: 'error' });
    await expect(AsyncStorage.getItem(LAST_SYNC_AT_STORAGE_KEY)).resolves.toBeNull();
  });
});

describe('the note about an unresolved conflict', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('is written when a conflict is found', async () => {
    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(5, CONTESTED) });

    await expect(sync()).resolves.toMatchObject({ kind: 'conflict' });
    await expect(AsyncStorage.getItem(UNRESOLVED_CONFLICT_STORAGE_KEY)).resolves.toBe(UID);
  });

  it('is dropped by a sync that agreed, even though one was set', async () => {
    // A conflict can resolve itself — the other phone's change pulled in, or
    // the same edit made on both sides. Leaving the note up would keep the
    // notice on screen and automatic sync stopped for a disagreement that is
    // over, with the only way out a screen showing two identical columns.
    await AsyncStorage.setItem(UNRESOLVED_CONFLICT_STORAGE_KEY, UID);

    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await expect(sync()).resolves.toEqual({ kind: 'pushed', revision: 5 });
    await expect(AsyncStorage.getItem(UNRESOLVED_CONFLICT_STORAGE_KEY)).resolves.toBeNull();
  });

  it('runs at all while the note is set, which is what the button relies on', async () => {
    // Automatic sync refuses while this is set — that rule lives in the
    // scheduler. `runCloudSync` itself must not, or pressing the button would
    // be refused too and nothing could ever clear the note.
    await AsyncStorage.setItem(UNRESOLVED_CONFLICT_STORAGE_KEY, UID);

    arrange({ local: AGREED, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await expect(sync()).resolves.toEqual({ kind: 'noop', revision: 4 });
  });

  it('survives a sync that failed', async () => {
    await AsyncStorage.setItem(UNRESOLVED_CONFLICT_STORAGE_KEY, UID);

    cloud.loadRemoteSyncState.mockRejectedValue(new AuthError('network-failed'));

    await expect(sync()).resolves.toMatchObject({ kind: 'error' });
    await expect(AsyncStorage.getItem(UNRESOLVED_CONFLICT_STORAGE_KEY)).resolves.toBe(UID);
  });
});

describe('telling the screens a sync finished', () => {
  beforeEach(() => {
    resetSyncOutcomeListenersForTests();
  });

  it('announces a push, so the status line moves for the button too', async () => {
    // Recording the time in storage is not enough: the account screen reads it
    // back, and used to be told only about syncs the scheduler ran.
    const heard: CloudSyncOutcome[] = [];

    onSyncOutcome((outcome) => heard.push(outcome));

    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await sync();

    expect(heard).toEqual([{ kind: 'pushed', revision: 5 }]);
  });

  it('announces a conflict, so the notice appears without a remount', async () => {
    const heard: CloudSyncOutcome[] = [];

    onSyncOutcome((outcome) => heard.push(outcome));

    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(5, CONTESTED) });

    await sync();

    expect(heard).toHaveLength(1);
    expect(heard[0]).toMatchObject({ kind: 'conflict' });
  });

  it('announces after the bookkeeping, not before', async () => {
    // A listener re-reads storage on hearing this, so storage has to have
    // finished changing.
    let storedWhenHeard: string | null = 'not read';

    await AsyncStorage.clear();

    onSyncOutcome(() => {
      void AsyncStorage.getItem(LAST_SYNC_AT_STORAGE_KEY).then((value) => {
        storedWhenHeard = value;
      });
    });

    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });

    await sync();
    await Promise.resolve();

    expect(storedWhenHeard).toBe(NOW);
  });

  it('says nothing while it is still retrying', async () => {
    // A retry is not a finished sync. Announcing one would have screens read
    // back a state that is about to change again.
    const heard: CloudSyncOutcome[] = [];

    onSyncOutcome((outcome) => heard.push(outcome));

    arrange({ local: ON_THE_PHONE, agreed: base(4, AGREED), stored: envelope(4, AGREED) });
    cloud.pushRemoteSyncState.mockResolvedValue({ kind: 'conflict', actualRevision: 9 });

    await sync();

    expect(heard).toHaveLength(0);
  });
});
