import type { SQLiteDatabase } from 'expo-sqlite';

import { AuthError } from '@/features/auth/domain/auth-error';
import type { AuthUser } from '@/features/auth/domain/auth-user';

import { deleteAccount } from '../delete-account';

jest.mock('@/features/auth/data/auth-repository', () => ({
  reauthenticateWithPassword: jest.fn(),
  deleteAuthUser: jest.fn(),
  checkAccountStillExists: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@/features/backup/data/cloud-backup-repository', () => ({
  deleteCloudBackup: jest.fn(),
}));

jest.mock('@/features/sync/data/sync-state-repository', () => ({
  clearAllSyncState: jest.fn(),
}));

jest.mock('@/features/sync/infrastructure/sync-preferences', () => ({
  clearSyncPreferences: jest.fn(),
}));

jest.mock('@/features/sync/infrastructure/last-sync-at', () => ({
  clearLastSyncAt: jest.fn(),
}));

jest.mock('@/features/sync/infrastructure/unresolved-conflict', () => ({
  clearUnresolvedConflict: jest.fn(),
}));

jest.mock('@/features/sync/infrastructure/device-id', () => ({
  clearDeviceId: jest.fn(),
}));

jest.mock('../../infrastructure/pending-account-deletion', () => ({
  markAccountDeletionPending: jest.fn(),
  clearPendingAccountDeletion: jest.fn(),
  isAccountDeletionPending: jest.fn(),
}));

jest.mock('../wipe-local-data', () => ({
  wipeLocalData: jest.fn(),
}));

jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: jest.fn(() => 'value'),
}));

const auth = jest.requireMock('@/features/auth/data/auth-repository') as {
  reauthenticateWithPassword: jest.Mock;
  deleteAuthUser: jest.Mock;
  checkAccountStillExists: jest.Mock;
  signOut: jest.Mock;
};
const { deleteCloudBackup } = jest.requireMock(
  '@/features/backup/data/cloud-backup-repository'
) as { deleteCloudBackup: jest.Mock };
const { clearAllSyncState } = jest.requireMock('@/features/sync/data/sync-state-repository') as {
  clearAllSyncState: jest.Mock;
};
const { clearSyncPreferences } = jest.requireMock(
  '@/features/sync/infrastructure/sync-preferences'
) as { clearSyncPreferences: jest.Mock };
const { clearDeviceId } = jest.requireMock('@/features/sync/infrastructure/device-id') as {
  clearDeviceId: jest.Mock;
};
const pending = jest.requireMock('../../infrastructure/pending-account-deletion') as {
  markAccountDeletionPending: jest.Mock;
  clearPendingAccountDeletion: jest.Mock;
  isAccountDeletionPending: jest.Mock;
};
const { wipeLocalData } = jest.requireMock('../wipe-local-data') as { wipeLocalData: jest.Mock };
const { logEvent } = jest.requireMock('@/shared/logging') as { logEvent: jest.Mock };

const db = {} as SQLiteDatabase;
const user: AuthUser = { uid: 'uid-1', email: 'someone@example.test' };

function baseInput(overrides: Partial<Parameters<typeof deleteAccount>[0]> = {}) {
  return {
    db,
    user,
    password: 'correct horse',
    wipeLocalDataToo: false,
    resetAppState: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  auth.reauthenticateWithPassword.mockResolvedValue(undefined);
  auth.deleteAuthUser.mockResolvedValue(undefined);
  deleteCloudBackup.mockResolvedValue(undefined);
  clearAllSyncState.mockResolvedValue(undefined);
  clearSyncPreferences.mockResolvedValue(undefined);
  clearDeviceId.mockResolvedValue(undefined);
  pending.markAccountDeletionPending.mockResolvedValue(undefined);
  pending.clearPendingAccountDeletion.mockResolvedValue(undefined);
  pending.isAccountDeletionPending.mockResolvedValue(false);
  auth.checkAccountStillExists.mockResolvedValue('present');
  auth.signOut.mockResolvedValue(undefined);
  wipeLocalData.mockResolvedValue({ kind: 'wiped' });
});

describe('the happy path', () => {
  it('reports the account deleted with the records kept', async () => {
    expect(await deleteAccount(baseInput())).toEqual({ kind: 'deleted' });
  });

  it('proves it is them, then deletes the backup, then the account', async () => {
    const order: string[] = [];

    auth.reauthenticateWithPassword.mockImplementation(async () => {
      order.push('reauth');
    });
    deleteCloudBackup.mockImplementation(async () => {
      order.push('cloud');
    });
    auth.deleteAuthUser.mockImplementation(async () => {
      order.push('account');
    });

    await deleteAccount(baseInput());

    expect(order).toEqual(['reauth', 'cloud', 'account']);
  });

  it('reauthenticates with the account address and the password given', async () => {
    await deleteAccount(baseInput({ password: 'hunter2' }));

    expect(auth.reauthenticateWithPassword).toHaveBeenCalledWith(
      'someone@example.test',
      'hunter2'
    );
  });

  it('deletes the backup belonging to that account', async () => {
    await deleteAccount(baseInput());

    expect(deleteCloudBackup).toHaveBeenCalledWith(user);
  });
});

describe('the invariant: the account is never deleted while its cloud data exists', () => {
  it('does not delete the account when the backup delete is refused', async () => {
    deleteCloudBackup.mockRejectedValue(new Error('permission denied'));

    await deleteAccount(baseInput());

    expect(auth.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('does not delete the account when the backup delete times out', async () => {
    deleteCloudBackup.mockRejectedValue(new AuthError('network-failed'));

    await deleteAccount(baseInput());

    expect(auth.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('touches nothing at all when the password is wrong', async () => {
    auth.reauthenticateWithPassword.mockRejectedValue(new AuthError('invalid-credentials'));

    await deleteAccount(baseInput());

    expect(deleteCloudBackup).not.toHaveBeenCalled();
    expect(auth.deleteAuthUser).not.toHaveBeenCalled();
    expect(pending.markAccountDeletionPending).not.toHaveBeenCalled();
  });
});

describe('the gap between deleting the backup and deleting the account', () => {
  it('is marked before the backup is deleted, not after', async () => {
    const order: string[] = [];

    pending.markAccountDeletionPending.mockImplementation(async () => {
      order.push('mark');
    });
    deleteCloudBackup.mockImplementation(async () => {
      order.push('cloud');
    });

    await deleteAccount(baseInput());

    expect(order).toEqual(['mark', 'cloud']);
  });

  it('is marked with the account being deleted', async () => {
    await deleteAccount(baseInput());

    expect(pending.markAccountDeletionPending).toHaveBeenCalledWith('uid-1');
  });

  it('stays marked when the backup delete fails, so nothing can re-upload it', async () => {
    deleteCloudBackup.mockRejectedValue(new Error('permission denied'));

    await deleteAccount(baseInput());

    expect(pending.clearPendingAccountDeletion).not.toHaveBeenCalled();
  });

  it('stays marked when the account delete fails, which is the dangerous window', async () => {
    // The backup is gone and the session still works. Without the mark, one tap
    // on "Şimdi senkronize et" would push it straight back.
    auth.deleteAuthUser.mockRejectedValue(new Error('server error'));

    await deleteAccount(baseInput());

    expect(pending.clearPendingAccountDeletion).not.toHaveBeenCalled();
  });

  it('is cleared once the account is actually gone', async () => {
    await deleteAccount(baseInput());

    expect(pending.clearPendingAccountDeletion).toHaveBeenCalledTimes(1);
  });

  it('fails without deleting anything when the mark cannot be written', async () => {
    pending.markAccountDeletionPending.mockRejectedValue(new Error('storage full'));

    expect(await deleteAccount(baseInput())).toEqual({
      kind: 'failed',
      reason: 'local-failed',
    });
    expect(deleteCloudBackup).not.toHaveBeenCalled();
  });
});

describe('failures and what they mean for what is left', () => {
  it.each([
    ['a wrong password', 'invalid-credentials'],
    ['a session Firebase will not accept', 'requires-recent-login'],
    ['no connection', 'network-failed'],
    ['too many attempts', 'too-many-requests'],
    ['a build with no project', 'not-configured'],
  ])('reports %s as its own reason', async (_label, code) => {
    auth.reauthenticateWithPassword.mockRejectedValue(new AuthError(code as 'network-failed'));

    expect(await deleteAccount(baseInput())).toEqual({ kind: 'failed', reason: code });
  });

  it('reports a cloud delete that failed for no known reason as cloud-delete-failed', async () => {
    deleteCloudBackup.mockRejectedValue(new Error('something else'));

    expect(await deleteAccount(baseInput())).toEqual({
      kind: 'failed',
      reason: 'cloud-delete-failed',
    });
  });

  it('reports an account delete that failed for no known reason as account-delete-failed', async () => {
    // A different sentence from the one above, because a different thing is
    // still there: after this, the backup is already gone.
    auth.deleteAuthUser.mockRejectedValue(new Error('something else'));

    expect(await deleteAccount(baseInput())).toEqual({
      kind: 'failed',
      reason: 'account-delete-failed',
    });
  });

  it('keeps a known auth reason rather than flattening it', async () => {
    auth.deleteAuthUser.mockRejectedValue(new AuthError('requires-recent-login'));

    expect(await deleteAccount(baseInput())).toEqual({
      kind: 'failed',
      reason: 'requires-recent-login',
    });
  });

  it('refuses a user with no uid', async () => {
    const outcome = await deleteAccount(
      baseInput({ user: { uid: '', email: 'a@b.test' } as AuthUser })
    );

    expect(outcome).toEqual({ kind: 'failed', reason: 'signed-out' });
    expect(auth.reauthenticateWithPassword).not.toHaveBeenCalled();
  });

  it('logs only event names, never the account or the error text', async () => {
    auth.deleteAuthUser.mockRejectedValue(new Error('uid-1 someone@example.test'));

    await deleteAccount(baseInput());

    expect(logEvent).toHaveBeenCalledWith('account delete failed', expect.anything());
  });
});

describe('retrying', () => {
  it('is safe after a failed account delete, because deleting an absent backup succeeds', async () => {
    auth.deleteAuthUser.mockRejectedValueOnce(new Error('server error'));

    expect(await deleteAccount(baseInput())).toEqual({
      kind: 'failed',
      reason: 'account-delete-failed',
    });

    // Second attempt: the backup is already gone, and Firestore is happy to
    // delete a document that is not there.
    auth.deleteAuthUser.mockResolvedValue(undefined);

    expect(await deleteAccount(baseInput())).toEqual({ kind: 'deleted' });
    expect(deleteCloudBackup).toHaveBeenCalledTimes(2);
  });

  it('re-proves the password on every attempt', async () => {
    auth.deleteAuthUser.mockRejectedValueOnce(new Error('server error'));

    await deleteAccount(baseInput());
    await deleteAccount(baseInput());

    expect(auth.reauthenticateWithPassword).toHaveBeenCalledTimes(2);
  });
});

describe('what the deleted account leaves behind on this phone', () => {
  it('is forgotten even when the records are kept', async () => {
    // The sync base is not records. It is a copy of them filed under an account
    // that no longer exists.
    await deleteAccount(baseInput({ wipeLocalDataToo: false }));

    expect(clearAllSyncState).toHaveBeenCalledWith(db);
    expect(clearSyncPreferences).toHaveBeenCalledTimes(1);
    expect(clearDeviceId).toHaveBeenCalledTimes(1);
  });

  it('does not wipe the records when the box is unticked', async () => {
    await deleteAccount(baseInput({ wipeLocalDataToo: false }));

    expect(wipeLocalData).not.toHaveBeenCalled();
  });

  it('still reports success when the sync bookkeeping will not clear', async () => {
    clearAllSyncState.mockRejectedValue(new Error('database is locked'));

    expect(await deleteAccount(baseInput())).toEqual({ kind: 'deleted' });
  });

  it('logs a bookkeeping failure under its own event', async () => {
    clearDeviceId.mockRejectedValue(new Error('storage full'));

    await deleteAccount(baseInput());

    expect(logEvent).toHaveBeenCalledWith('sync state clear failed', expect.anything());
  });
});

describe('when the phone is being wiped too', () => {
  it('wipes exactly once, after the account is gone', async () => {
    const order: string[] = [];

    auth.deleteAuthUser.mockImplementation(async () => {
      order.push('account');
    });
    wipeLocalData.mockImplementation(async () => {
      order.push('wipe');

      return { kind: 'wiped' };
    });

    await deleteAccount(baseInput({ wipeLocalDataToo: true }));

    expect(order).toEqual(['account', 'wipe']);
    expect(wipeLocalData).toHaveBeenCalledTimes(1);
  });

  it('reports both things gone', async () => {
    expect(await deleteAccount(baseInput({ wipeLocalDataToo: true }))).toEqual({
      kind: 'deleted-and-wiped',
    });
  });

  it('treats a partial wipe as done, because the records are gone', async () => {
    wipeLocalData.mockResolvedValue({ kind: 'partial' });

    expect(await deleteAccount(baseInput({ wipeLocalDataToo: true }))).toEqual({
      kind: 'deleted-and-wiped',
    });
  });

  it('says the account went but the phone did not when the wipe fails', async () => {
    // Never reported as a failed deletion: the account really is gone, and
    // saying otherwise would send somebody looking for an account to delete.
    wipeLocalData.mockResolvedValue({ kind: 'failed', reason: 'local-failed' });

    expect(await deleteAccount(baseInput({ wipeLocalDataToo: true }))).toEqual({
      kind: 'deleted-wipe-failed',
    });
  });

  it('passes the caller its own resetAppState', async () => {
    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await deleteAccount(baseInput({ wipeLocalDataToo: true, resetAppState }));

    expect(wipeLocalData).toHaveBeenCalledWith({ db, resetAppState });
  });

  it('does not wipe when the account delete failed', async () => {
    auth.deleteAuthUser.mockRejectedValue(new Error('server error'));

    await deleteAccount(baseInput({ wipeLocalDataToo: true }));

    expect(wipeLocalData).not.toHaveBeenCalled();
  });
});

describe('a refused password while a deletion was already under way', () => {
  beforeEach(() => {
    auth.reauthenticateWithPassword.mockRejectedValue(new AuthError('invalid-credentials'));
    pending.isAccountDeletionPending.mockResolvedValue(true);
  });

  it('does not ask the server when no deletion is pending', async () => {
    // Outside that window a refused password is just a refused password.
    pending.isAccountDeletionPending.mockResolvedValue(false);

    expect(await deleteAccount(baseInput())).toEqual({
      kind: 'failed',
      reason: 'invalid-credentials',
    });
    expect(auth.checkAccountStillExists).not.toHaveBeenCalled();
  });

  describe('when the account turns out to be gone', () => {
    beforeEach(() => {
      auth.checkAccountStillExists.mockResolvedValue('gone');
    });

    it('says so rather than blaming the password', async () => {
      expect(await deleteAccount(baseInput())).toEqual({ kind: 'already-deleted' });
    });

    it('clears the sync traces the dead account left behind', async () => {
      await deleteAccount(baseInput());

      expect(clearAllSyncState).toHaveBeenCalledWith(db);
      expect(clearSyncPreferences).toHaveBeenCalledTimes(1);
      expect(clearDeviceId).toHaveBeenCalledTimes(1);
    });

    it('lifts the block on syncing, since there is nothing left to protect', async () => {
      await deleteAccount(baseInput());

      expect(pending.clearPendingAccountDeletion).toHaveBeenCalledTimes(1);
    });

    it('ends the session, which points at nothing', async () => {
      await deleteAccount(baseInput());

      expect(auth.signOut).toHaveBeenCalledTimes(1);
    });

    it('deletes nothing further, because there is nothing to delete', async () => {
      await deleteAccount(baseInput());

      expect(deleteCloudBackup).not.toHaveBeenCalled();
      expect(auth.deleteAuthUser).not.toHaveBeenCalled();
    });

    it('still reports it when signing out fails', async () => {
      auth.signOut.mockRejectedValue(new Error('offline'));

      expect(await deleteAccount(baseInput())).toEqual({ kind: 'already-deleted' });
    });
  });

  describe('when the account is still there', () => {
    beforeEach(() => {
      auth.checkAccountStillExists.mockResolvedValue('present');
    });

    it('keeps the wrong-password answer', async () => {
      // A person retrying an interrupted deletion can still mistype.
      expect(await deleteAccount(baseInput())).toEqual({
        kind: 'failed',
        reason: 'invalid-credentials',
      });
    });

    it('does not sign them out of an account that exists', async () => {
      await deleteAccount(baseInput());

      expect(auth.signOut).not.toHaveBeenCalled();
    });

    it('clears nothing', async () => {
      await deleteAccount(baseInput());

      expect(clearAllSyncState).not.toHaveBeenCalled();
      expect(pending.clearPendingAccountDeletion).not.toHaveBeenCalled();
    });
  });

  describe('when the server cannot be reached', () => {
    beforeEach(() => {
      auth.checkAccountStillExists.mockResolvedValue('unreachable');
    });

    it('reports the network rather than the password', async () => {
      expect(await deleteAccount(baseInput())).toEqual({
        kind: 'failed',
        reason: 'network-failed',
      });
    });

    it('concludes nothing: no clearing and no sign-out', async () => {
      await deleteAccount(baseInput());

      expect(auth.signOut).not.toHaveBeenCalled();
      expect(clearAllSyncState).not.toHaveBeenCalled();
      expect(pending.clearPendingAccountDeletion).not.toHaveBeenCalled();
    });
  });

  it('falls back to the wrong-password answer when the marker cannot be read', async () => {
    pending.isAccountDeletionPending.mockRejectedValue(new Error('storage unreadable'));

    expect(await deleteAccount(baseInput())).toEqual({
      kind: 'failed',
      reason: 'invalid-credentials',
    });
    expect(auth.checkAccountStillExists).not.toHaveBeenCalled();
  });

  it('is not consulted for any other refusal', async () => {
    auth.reauthenticateWithPassword.mockRejectedValue(new AuthError('too-many-requests'));

    expect(await deleteAccount(baseInput())).toEqual({
      kind: 'failed',
      reason: 'too-many-requests',
    });
    expect(auth.checkAccountStillExists).not.toHaveBeenCalled();
  });
});
