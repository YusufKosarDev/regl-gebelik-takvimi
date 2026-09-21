import type { SQLiteDatabase } from 'expo-sqlite';

import type { AuthUser } from '@/features/auth/domain/auth-user';

import { createCloudBackup } from '../create-cloud-backup';

jest.mock('@/features/deletion/infrastructure/pending-account-deletion', () => ({
  isAccountDeletionPending: jest.fn(),
}));

jest.mock('@/features/privacy/application/build-cloud-sync-payload-v1', () => ({
  buildCloudSyncPayloadV1: jest.fn(),
}));

jest.mock('../../data/cloud-backup-repository', () => ({
  saveCloudBackup: jest.fn(),
}));

const { isAccountDeletionPending } = jest.requireMock(
  '@/features/deletion/infrastructure/pending-account-deletion'
) as { isAccountDeletionPending: jest.Mock };
const { buildCloudSyncPayloadV1 } = jest.requireMock(
  '@/features/privacy/application/build-cloud-sync-payload-v1'
) as { buildCloudSyncPayloadV1: jest.Mock };
const { saveCloudBackup } = jest.requireMock('../../data/cloud-backup-repository') as {
  saveCloudBackup: jest.Mock;
};

const db = {} as SQLiteDatabase;
const user: AuthUser = { uid: 'uid-1', email: 'someone@example.test' };
const payload = { version: 1 } as never;

beforeEach(() => {
  jest.clearAllMocks();
  isAccountDeletionPending.mockResolvedValue(false);
  buildCloudSyncPayloadV1.mockResolvedValue(payload);
  saveCloudBackup.mockResolvedValue(undefined);
});

describe('creating a backup normally', () => {
  it('writes it and says so', async () => {
    expect(await createCloudBackup({ db, user })).toEqual({ kind: 'saved' });
    expect(saveCloudBackup).toHaveBeenCalledWith(user, payload);
  });

  it('builds the payload from the privacy boundary', async () => {
    await createCloudBackup({ db, user });

    expect(buildCloudSyncPayloadV1).toHaveBeenCalledWith(db);
  });

  it('asks whether a deletion is pending before it builds anything', async () => {
    const order: string[] = [];

    isAccountDeletionPending.mockImplementation(async () => {
      order.push('check');

      return false;
    });
    buildCloudSyncPayloadV1.mockImplementation(async () => {
      order.push('build');

      return payload;
    });

    await createCloudBackup({ db, user });

    expect(order).toEqual(['check', 'build']);
  });
});

describe('while an account deletion is part-way through', () => {
  it('refuses rather than writing', async () => {
    isAccountDeletionPending.mockResolvedValue(true);

    expect(await createCloudBackup({ db, user })).toEqual({
      kind: 'refused-deletion-pending',
    });
  });

  it('writes nothing to the account', async () => {
    // This is the whole point: the backup was deleted a moment ago as part of
    // deleting the account, and writing one now would put it back.
    isAccountDeletionPending.mockResolvedValue(true);

    await createCloudBackup({ db, user });

    expect(saveCloudBackup).not.toHaveBeenCalled();
  });

  it('does not even read the health tables', async () => {
    isAccountDeletionPending.mockResolvedValue(true);

    await createCloudBackup({ db, user });

    expect(buildCloudSyncPayloadV1).not.toHaveBeenCalled();
  });

  it('asks about this account rather than about any deletion', async () => {
    await createCloudBackup({ db, user });

    expect(isAccountDeletionPending).toHaveBeenCalledWith('uid-1');
  });

  it('still writes when the pending deletion belongs to a different account', async () => {
    isAccountDeletionPending.mockResolvedValue(false);

    expect(await createCloudBackup({ db, user })).toEqual({ kind: 'saved' });
  });
});
