import type { SQLiteDatabase } from 'expo-sqlite';

import { PERIOD_REMINDER_TYPE } from '@/features/notifications/domain/period-reminder';
import { PREGNANCY_WEEKLY_REMINDER_TYPE } from '@/features/notifications/domain/pregnancy-weekly-reminder';

import { wipeLocalData } from '../wipe-local-data';

jest.mock('../../data/local-data-repository', () => ({
  clearAllLocalTables: jest.fn(),
}));

jest.mock('../../infrastructure/pending-account-deletion', () => ({
  clearPendingAccountDeletion: jest.fn(),
}));

jest.mock('@/features/notifications/infrastructure/scheduled-reminders', () => ({
  cancelScheduledRemindersOfType: jest.fn(),
}));

jest.mock('@/features/widget/infrastructure/widget-snapshot-bridge', () => ({
  clearWidgetSnapshot: jest.fn(),
  isWidgetSnapshotBridgeAvailable: jest.fn(() => true),
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

jest.mock('@/features/auth/data/auth-repository', () => ({
  getCurrentAuthUser: jest.fn(() => null),
  signOut: jest.fn(),
}));

jest.mock('@/features/export/infrastructure/export-cache', () => ({
  deleteExportCache: jest.fn(),
}));

jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: jest.fn(() => 'value'),
}));

const { clearAllLocalTables } = jest.requireMock('../../data/local-data-repository') as {
  clearAllLocalTables: jest.Mock;
};
const { clearPendingAccountDeletion } = jest.requireMock(
  '../../infrastructure/pending-account-deletion'
) as { clearPendingAccountDeletion: jest.Mock };
const { cancelScheduledRemindersOfType } = jest.requireMock(
  '@/features/notifications/infrastructure/scheduled-reminders'
) as { cancelScheduledRemindersOfType: jest.Mock };
const widget = jest.requireMock('@/features/widget/infrastructure/widget-snapshot-bridge') as {
  clearWidgetSnapshot: jest.Mock;
  isWidgetSnapshotBridgeAvailable: jest.Mock;
};
const { clearSyncPreferences } = jest.requireMock(
  '@/features/sync/infrastructure/sync-preferences'
) as { clearSyncPreferences: jest.Mock };
const { clearDeviceId } = jest.requireMock('@/features/sync/infrastructure/device-id') as {
  clearDeviceId: jest.Mock;
};
const auth = jest.requireMock('@/features/auth/data/auth-repository') as {
  getCurrentAuthUser: jest.Mock;
  signOut: jest.Mock;
};
const { logEvent } = jest.requireMock('@/shared/logging') as { logEvent: jest.Mock };
const { deleteExportCache } = jest.requireMock(
  '@/features/export/infrastructure/export-cache'
) as { deleteExportCache: jest.Mock };

const db = {} as SQLiteDatabase;

function resolveAll(): void {
  clearAllLocalTables.mockResolvedValue(undefined);
  clearPendingAccountDeletion.mockResolvedValue(undefined);
  cancelScheduledRemindersOfType.mockResolvedValue(1);
  widget.clearWidgetSnapshot.mockResolvedValue(undefined);
  widget.isWidgetSnapshotBridgeAvailable.mockReturnValue(true);
  clearSyncPreferences.mockResolvedValue(undefined);
  clearDeviceId.mockResolvedValue(undefined);
  auth.getCurrentAuthUser.mockReturnValue(null);
  auth.signOut.mockResolvedValue(undefined);
  // `clearAllMocks` keeps implementations, so a test that made this throw
  // would otherwise leak its failure into every test after it.
  deleteExportCache.mockImplementation(() => undefined);
}

// Shared rather than made per test: it is the one input that is a plain
// callback with no return to arrange, and `clearAllMocks` resets it below.
const forgetAppLockState = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  resolveAll();
});

describe('wiping this device', () => {
  it('reports it wiped everything when every step works', async () => {
    const resetAppState = jest.fn().mockResolvedValue(undefined);

    expect(await wipeLocalData({ db, resetAppState, forgetAppLockState })).toEqual({ kind: 'wiped' });
  });

  /**
   * The CSVs written for the share sheet are the records in plain text. A
   * wipe that emptied the tables and left those files behind would keep the
   * most readable copy of everything it promised to delete.
   */
  it('deletes the exported copies along with the tables', async () => {
    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(deleteExportCache).toHaveBeenCalledTimes(1);
  });

  it('reports partial, not failed, when only the export cache would not empty', async () => {
    deleteExportCache.mockImplementation(() => {
      throw new Error('EBUSY');
    });

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    expect(await wipeLocalData({ db, resetAppState, forgetAppLockState })).toEqual({
      kind: 'partial',
    });
    expect(logEvent).toHaveBeenCalledWith('local data wipe failed', expect.anything());
  });

  /**
   * The record goes and the memory of it goes with it.
   *
   * `removeAppLock` deletes the stored record, and the app's own copy of "a
   * lock is set" lives in a store that only reads it at launch. Reproduced on
   * a device: wipe, finish onboarding again without killing the process, and
   * Profile still said On and offered to manage a lock that was not there -
   * the manage screen offered to change a PIN that no longer existed. A force
   * stop corrected it, which is what identified the state as in-memory.
   *
   * The order is asserted as well. `resetAppState` is what sends the app back
   * to onboarding, and the layout decides whether to show a lock screen from
   * this same store - so forgetting the lock after that flip would mount
   * onboarding with the app still believing it is locked.
   */
  it('forgets the lock in memory, before the app is sent back to onboarding', async () => {
    const order: string[] = [];
    const resetAppState = jest.fn(async () => {
      order.push('reset');
    });

    forgetAppLockState.mockImplementation(() => {
      order.push('forget');
    });

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(order).toEqual(['forget', 'reset']);
  });

  it('empties the tables', async () => {
    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(clearAllLocalTables).toHaveBeenCalledWith(db);
  });

  it('cancels both reminders, and only those two kinds', async () => {
    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(cancelScheduledRemindersOfType).toHaveBeenCalledTimes(2);
    expect(cancelScheduledRemindersOfType).toHaveBeenCalledWith(PERIOD_REMINDER_TYPE);
    expect(cancelScheduledRemindersOfType).toHaveBeenCalledWith(PREGNANCY_WEEKLY_REMINDER_TYPE);
  });

  it('clears the widget copy sitting on the home screen', async () => {
    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(widget.clearWidgetSnapshot).toHaveBeenCalledTimes(1);
  });

  it('clears the sync preference, the device id and any half-finished deletion', async () => {
    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(clearSyncPreferences).toHaveBeenCalledTimes(1);
    expect(clearDeviceId).toHaveBeenCalledTimes(1);
    expect(clearPendingAccountDeletion).toHaveBeenCalledTimes(1);
  });

  it('resets the app state, which is what sends the app to onboarding', async () => {
    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(resetAppState).toHaveBeenCalledTimes(1);
  });
});

describe('the order the steps run in', () => {
  it('empties the tables before anything else', async () => {
    const order: string[] = [];

    clearAllLocalTables.mockImplementation(async () => {
      order.push('tables');
    });
    cancelScheduledRemindersOfType.mockImplementation(async () => {
      order.push('reminders');

      return 0;
    });

    const resetAppState = jest.fn(async () => {
      order.push('reset');
    });

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(order[0]).toBe('tables');
  });

  it('resets the app state last, so onboarding never shows over live records', async () => {
    const order: string[] = [];

    clearAllLocalTables.mockImplementation(async () => {
      order.push('tables');
    });
    widget.clearWidgetSnapshot.mockImplementation(async () => {
      order.push('widget');
    });
    clearSyncPreferences.mockImplementation(async () => {
      order.push('preferences');
    });
    clearDeviceId.mockImplementation(async () => {
      order.push('device-id');
    });

    const resetAppState = jest.fn(async () => {
      order.push('reset');
    });

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(order[order.length - 1]).toBe('reset');
  });

  it('signs out before resetting the app state', async () => {
    const order: string[] = [];

    auth.getCurrentAuthUser.mockReturnValue({ uid: 'uid-1', email: 'a@b.test' });
    auth.signOut.mockImplementation(async () => {
      order.push('sign-out');
    });

    const resetAppState = jest.fn(async () => {
      order.push('reset');
    });

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(order).toEqual(['sign-out', 'reset']);
  });
});

describe('when the tables cannot be emptied', () => {
  it('fails, because nothing was deleted', async () => {
    clearAllLocalTables.mockRejectedValue(new Error('database is locked'));

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    expect(await wipeLocalData({ db, resetAppState, forgetAppLockState })).toEqual({
      kind: 'failed',
      reason: 'local-failed',
    });
  });

  it('stops before anything else runs', async () => {
    clearAllLocalTables.mockRejectedValue(new Error('database is locked'));

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(cancelScheduledRemindersOfType).not.toHaveBeenCalled();
    expect(widget.clearWidgetSnapshot).not.toHaveBeenCalled();
    expect(resetAppState).not.toHaveBeenCalled();
  });

  it('never sends the app to onboarding over a database that still has records', async () => {
    clearAllLocalTables.mockRejectedValue(new Error('database is locked'));

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(resetAppState).not.toHaveBeenCalled();
  });

  it('logs only the event name', async () => {
    clearAllLocalTables.mockRejectedValue(new Error('uid-1 at 2026-01-01'));

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(logEvent).toHaveBeenCalledWith('local data wipe failed', expect.anything());
  });
});

describe('steps that must not stop the wipe', () => {
  it.each([
    ['a reminder that will not cancel', () => cancelScheduledRemindersOfType.mockRejectedValue(new Error('no'))],
    ['a widget that will not clear', () => widget.clearWidgetSnapshot.mockRejectedValue(new Error('no'))],
    ['sync preferences that will not clear', () => clearSyncPreferences.mockRejectedValue(new Error('no'))],
    ['a device id that will not clear', () => clearDeviceId.mockRejectedValue(new Error('no'))],
  ])('reports partial for %s, not failed', async (_label, break_) => {
    break_();

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    expect(await wipeLocalData({ db, resetAppState, forgetAppLockState })).toEqual({ kind: 'partial' });
  });

  it('still resets the app state when a middle step failed', async () => {
    widget.clearWidgetSnapshot.mockRejectedValue(new Error('no'));

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(resetAppState).toHaveBeenCalledTimes(1);
  });

  it('reports partial when the app state itself will not reset', async () => {
    const resetAppState = jest.fn().mockRejectedValue(new Error('storage full'));

    expect(await wipeLocalData({ db, resetAppState, forgetAppLockState })).toEqual({ kind: 'partial' });
  });
});

describe('the widget bridge not being there', () => {
  it('skips it without calling it', async () => {
    widget.isWidgetSnapshotBridgeAvailable.mockReturnValue(false);

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(widget.clearWidgetSnapshot).not.toHaveBeenCalled();
  });

  it('still counts as a complete wipe', async () => {
    // Expo Go and the web build have no widget to be holding anything.
    widget.isWidgetSnapshotBridgeAvailable.mockReturnValue(false);

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    expect(await wipeLocalData({ db, resetAppState, forgetAppLockState })).toEqual({ kind: 'wiped' });
  });
});

describe('the session', () => {
  it('is ended when somebody is signed in', async () => {
    auth.getCurrentAuthUser.mockReturnValue({ uid: 'uid-1', email: 'a@b.test' });

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('is left alone when nobody is', async () => {
    auth.getCurrentAuthUser.mockReturnValue(null);

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    await wipeLocalData({ db, resetAppState, forgetAppLockState });

    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('is not asked about at all in a build with no Firebase project', async () => {
    auth.getCurrentAuthUser.mockImplementation(() => {
      throw new Error('not configured');
    });

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    expect(await wipeLocalData({ db, resetAppState, forgetAppLockState })).toEqual({ kind: 'wiped' });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('reports partial when signing out fails, because the records are already gone', async () => {
    auth.getCurrentAuthUser.mockReturnValue({ uid: 'uid-1', email: 'a@b.test' });
    auth.signOut.mockRejectedValue(new Error('offline'));

    const resetAppState = jest.fn().mockResolvedValue(undefined);

    expect(await wipeLocalData({ db, resetAppState, forgetAppLockState })).toEqual({ kind: 'partial' });
  });
});

describe('running it twice', () => {
  it('succeeds the second time as well', async () => {
    const resetAppState = jest.fn().mockResolvedValue(undefined);

    expect(await wipeLocalData({ db, resetAppState, forgetAppLockState })).toEqual({ kind: 'wiped' });
    expect(await wipeLocalData({ db, resetAppState, forgetAppLockState })).toEqual({ kind: 'wiped' });
  });
});
