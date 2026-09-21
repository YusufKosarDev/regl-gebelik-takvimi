import type { SQLiteDatabase } from 'expo-sqlite';

import { isAccountDeletionPending } from '@/features/deletion/infrastructure/pending-account-deletion';
import { isFirebaseConfigured } from '@/features/auth/infrastructure/firebase';
import { syncPeriodReminderQuietly } from '@/features/notifications/application/sync-period-reminder';
import { syncPregnancyWeeklyReminderQuietly } from '@/features/notifications/application/sync-pregnancy-weekly-reminder';
import { syncWidgetSnapshotQuietly } from '@/features/widget/application/sync-widget-snapshot';
import {
  notifyLocalDataChanged,
  resetLocalDataChangeListenersForTests,
  withLocalDataChangeSuppressed,
} from '@/shared/data-change/local-data-change';

import { LOCAL_CHANGE_DEBOUNCE_MS, MINIMUM_INTERVAL_MS } from '../../domain/automatic-sync-policy';
import { isConflictUnresolved, markConflictUnresolved } from '../../infrastructure/unresolved-conflict';
import { saveLastSyncAt } from '../../infrastructure/last-sync-at';
import { loadSyncPreferences } from '../../infrastructure/sync-preferences';
import type { CloudSyncOutcome } from '../run-cloud-sync';
import { runCloudSync } from '../run-cloud-sync';
import {
  flushPendingAutomaticSync,
  hasPendingLocalChange,
  onAutomaticSyncOutcome,
  requestAutomaticSync,
  resetAutomaticSyncForTests,
  setAutomaticSyncContext,
} from '../automatic-sync-scheduler';
import { withAutomaticSyncSuspended } from '../automatic-sync-suspension';

jest.mock('../run-cloud-sync', () => ({ runCloudSync: jest.fn() }));
jest.mock('../../infrastructure/sync-preferences', () => ({ loadSyncPreferences: jest.fn() }));
jest.mock('../../infrastructure/last-sync-at', () => ({ saveLastSyncAt: jest.fn() }));
jest.mock('../../infrastructure/unresolved-conflict', () => ({
  isConflictUnresolved: jest.fn(),
  markConflictUnresolved: jest.fn(),
}));
jest.mock('@/features/deletion/infrastructure/pending-account-deletion', () => ({
  isAccountDeletionPending: jest.fn(),
}));
jest.mock('@/features/auth/infrastructure/firebase', () => ({ isFirebaseConfigured: jest.fn() }));
jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshotQuietly: jest.fn(),
}));
jest.mock('@/features/notifications/application/sync-period-reminder', () => ({
  syncPeriodReminderQuietly: jest.fn(),
}));
jest.mock('@/features/notifications/application/sync-pregnancy-weekly-reminder', () => ({
  syncPregnancyWeeklyReminderQuietly: jest.fn(),
}));

const runCloudSyncMock = runCloudSync as jest.MockedFunction<typeof runCloudSync>;
const loadSyncPreferencesMock = loadSyncPreferences as jest.MockedFunction<
  typeof loadSyncPreferences
>;
const saveLastSyncAtMock = saveLastSyncAt as jest.MockedFunction<typeof saveLastSyncAt>;
const isConflictUnresolvedMock = isConflictUnresolved as jest.MockedFunction<
  typeof isConflictUnresolved
>;
const markConflictUnresolvedMock = markConflictUnresolved as jest.MockedFunction<
  typeof markConflictUnresolved
>;
const isAccountDeletionPendingMock = isAccountDeletionPending as jest.MockedFunction<
  typeof isAccountDeletionPending
>;
const isFirebaseConfiguredMock = isFirebaseConfigured as jest.MockedFunction<
  typeof isFirebaseConfigured
>;
const syncWidgetSnapshotQuietlyMock = syncWidgetSnapshotQuietly as jest.MockedFunction<
  typeof syncWidgetSnapshotQuietly
>;
const syncPeriodReminderQuietlyMock = syncPeriodReminderQuietly as jest.MockedFunction<
  typeof syncPeriodReminderQuietly
>;
const syncPregnancyWeeklyReminderQuietlyMock =
  syncPregnancyWeeklyReminderQuietly as jest.MockedFunction<
    typeof syncPregnancyWeeklyReminderQuietly
  >;

const db = {} as SQLiteDatabase;

/** The clock the scheduler is given, moved by hand. */
let clock = 1_700_000_000_000;

function setUp(): void {
  clock = 1_700_000_000_000;

  resetLocalDataChangeListenersForTests();
  resetAutomaticSyncForTests({ now: () => clock });

  jest.clearAllMocks();

  loadSyncPreferencesMock.mockResolvedValue({ automaticSyncEnabled: true });
  isAccountDeletionPendingMock.mockResolvedValue(false);
  isConflictUnresolvedMock.mockResolvedValue(false);
  isFirebaseConfiguredMock.mockReturnValue(true);
  saveLastSyncAtMock.mockResolvedValue(undefined);
  markConflictUnresolvedMock.mockResolvedValue(undefined);
  syncWidgetSnapshotQuietlyMock.mockResolvedValue(null);
  syncPeriodReminderQuietlyMock.mockResolvedValue(null);
  syncPregnancyWeeklyReminderQuietlyMock.mockResolvedValue(null);
  runCloudSyncMock.mockResolvedValue({ kind: 'pushed' } as CloudSyncOutcome);
}

beforeEach(() => {
  jest.useFakeTimers();
  setUp();
});

afterEach(() => {
  resetAutomaticSyncForTests();
  resetLocalDataChangeListenersForTests();
  jest.useRealTimers();
});

/** Lets every pending microtask settle without moving the fake clock. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('without a context', () => {
  it('does not sync when nobody has said which account this is', () => {
    // The module owns no database and no session. Until it is handed one,
    // there is nothing it could sync and nobody it could sync for.
    return requestAutomaticSync('foreground').then((outcome) => {
      expect(outcome).toBeNull();
      expect(runCloudSyncMock).not.toHaveBeenCalled();
    });
  });
});

describe('the rules that say no', () => {
  beforeEach(() => {
    setAutomaticSyncContext({ db, uid: 'uid-1' });
  });

  it('does not sync with the switch off', async () => {
    loadSyncPreferencesMock.mockResolvedValue({ automaticSyncEnabled: false });

    await expect(requestAutomaticSync('sign-in')).resolves.toBeNull();
    expect(runCloudSyncMock).not.toHaveBeenCalled();
  });

  it('does not sync in a build with no Firebase project', async () => {
    isFirebaseConfiguredMock.mockReturnValue(false);

    await expect(requestAutomaticSync('sign-in')).resolves.toBeNull();
    expect(runCloudSyncMock).not.toHaveBeenCalled();
  });

  it('does not sync while an account deletion is part-way through', async () => {
    isAccountDeletionPendingMock.mockResolvedValue(true);

    await expect(requestAutomaticSync('sign-in')).resolves.toBeNull();
    expect(runCloudSyncMock).not.toHaveBeenCalled();
  });

  it('does not sync while a conflict is waiting for a person', async () => {
    isConflictUnresolvedMock.mockResolvedValue(true);

    await expect(requestAutomaticSync('sign-in')).resolves.toBeNull();
    expect(runCloudSyncMock).not.toHaveBeenCalled();
  });

  it('treats a preference it cannot read as permission refused', async () => {
    // Storage failing is not consent. The safe reading of "unknown" is "off".
    loadSyncPreferencesMock.mockRejectedValue(new Error('storage gone'));

    await expect(requestAutomaticSync('sign-in')).resolves.toBeNull();
    expect(runCloudSyncMock).not.toHaveBeenCalled();
  });

  it('does not sync while something else owns the data', async () => {
    const outcome = await withAutomaticSyncSuspended(async () =>
      requestAutomaticSync('sign-in')
    );

    expect(outcome).toBeNull();
    expect(runCloudSyncMock).not.toHaveBeenCalled();
  });

  it('syncs again once the suspension lifts', async () => {
    await withAutomaticSyncSuspended(async () => undefined);
    await requestAutomaticSync('sign-in');

    expect(runCloudSyncMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the gate shut until the outermost suspension closes', async () => {
    await withAutomaticSyncSuspended(async () => {
      await withAutomaticSyncSuspended(async () => undefined);

      await expect(requestAutomaticSync('sign-in')).resolves.toBeNull();
    });

    expect(runCloudSyncMock).not.toHaveBeenCalled();
  });

  it('lifts a suspension even when what it was holding for threw', async () => {
    await expect(
      withAutomaticSyncSuspended(async () => {
        throw new Error('resolution failed');
      })
    ).rejects.toThrow('resolution failed');

    await requestAutomaticSync('sign-in');

    expect(runCloudSyncMock).toHaveBeenCalledTimes(1);
  });

  it('holds the foreground trigger to its five minutes', async () => {
    await requestAutomaticSync('foreground');

    clock += MINIMUM_INTERVAL_MS.foreground - 1;

    await expect(requestAutomaticSync('foreground')).resolves.toBeNull();
    expect(runCloudSyncMock).toHaveBeenCalledTimes(1);

    clock += 1;

    await requestAutomaticSync('foreground');
    expect(runCloudSyncMock).toHaveBeenCalledTimes(2);
  });
});

describe('one at a time', () => {
  beforeEach(() => {
    setAutomaticSyncContext({ db, uid: 'uid-1' });
  });

  it('gives a second caller the first run rather than a second sync', async () => {
    // Two `pushRemoteSyncState` calls with the same expected revision would
    // lose the compare and report a conflict that never existed.
    let release: (outcome: CloudSyncOutcome) => void = () => undefined;

    runCloudSyncMock.mockReturnValue(
      new Promise<CloudSyncOutcome>((resolve) => {
        release = resolve;
      })
    );

    const first = requestAutomaticSync('sign-in');

    await settle();

    const second = requestAutomaticSync('foreground');

    release({ kind: 'pushed' } as CloudSyncOutcome);

    await expect(first).resolves.toEqual({ kind: 'pushed' });
    await expect(second).resolves.toEqual({ kind: 'pushed' });
    expect(runCloudSyncMock).toHaveBeenCalledTimes(1);
  });

  it('is free again once the run finishes', async () => {
    await requestAutomaticSync('sign-in');
    await requestAutomaticSync('enabled');

    expect(runCloudSyncMock).toHaveBeenCalledTimes(2);
  });

  it('is free again even when the run threw', async () => {
    runCloudSyncMock.mockRejectedValueOnce(new Error('network'));

    await expect(requestAutomaticSync('sign-in')).resolves.toBeNull();

    runCloudSyncMock.mockResolvedValue({ kind: 'pushed' } as CloudSyncOutcome);

    await expect(requestAutomaticSync('enabled')).resolves.toEqual({ kind: 'pushed' });
  });
});

describe('an edit on this phone', () => {
  beforeEach(() => {
    setAutomaticSyncContext({ db, uid: 'uid-1' });
  });

  it('waits out the debounce before syncing', async () => {
    notifyLocalDataChanged();

    expect(hasPendingLocalChange()).toBe(true);
    expect(runCloudSyncMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(LOCAL_CHANGE_DEBOUNCE_MS - 1);
    await settle();

    expect(runCloudSyncMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await settle();

    expect(runCloudSyncMock).toHaveBeenCalledTimes(1);
  });

  it('restarts the wait when a second edit lands, and sends once', async () => {
    notifyLocalDataChanged();

    jest.advanceTimersByTime(LOCAL_CHANGE_DEBOUNCE_MS - 1);

    notifyLocalDataChanged();

    jest.advanceTimersByTime(LOCAL_CHANGE_DEBOUNCE_MS - 1);
    await settle();

    expect(runCloudSyncMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await settle();

    expect(runCloudSyncMock).toHaveBeenCalledTimes(1);
  });

  it('hears nothing from a restore or a wipe', async () => {
    // Those are the result of a sync, or the deliberate end of one. Either
    // announcing would schedule a sync of what was just received.
    await withLocalDataChangeSuppressed(async () => {
      notifyLocalDataChanged();
    });

    expect(hasPendingLocalChange()).toBe(false);

    jest.advanceTimersByTime(LOCAL_CHANGE_DEBOUNCE_MS);
    await settle();

    expect(runCloudSyncMock).not.toHaveBeenCalled();
  });

  it('stops listening once the session ends', async () => {
    setAutomaticSyncContext(null);

    notifyLocalDataChanged();

    jest.advanceTimersByTime(LOCAL_CHANGE_DEBOUNCE_MS);
    await settle();

    expect(runCloudSyncMock).not.toHaveBeenCalled();
  });
});

describe('the flush on the way out', () => {
  beforeEach(() => {
    setAutomaticSyncContext({ db, uid: 'uid-1' });
  });

  it('sends an edit that is still inside its debounce', async () => {
    // Otherwise something written a second before the app was closed sits on
    // the phone until the next launch.
    notifyLocalDataChanged();

    await flushPendingAutomaticSync();

    expect(runCloudSyncMock).toHaveBeenCalledTimes(1);
    expect(hasPendingLocalChange()).toBe(false);
  });

  it('does not fire the debounce a second time afterwards', async () => {
    notifyLocalDataChanged();

    await flushPendingAutomaticSync();

    jest.advanceTimersByTime(LOCAL_CHANGE_DEBOUNCE_MS * 2);
    await settle();

    expect(runCloudSyncMock).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no edit waiting', async () => {
    await expect(flushPendingAutomaticSync()).resolves.toBeNull();
    expect(runCloudSyncMock).not.toHaveBeenCalled();
  });

  it('still obeys the rules — a conflict stops the flush too', async () => {
    isConflictUnresolvedMock.mockResolvedValue(true);

    notifyLocalDataChanged();

    await expect(flushPendingAutomaticSync()).resolves.toBeNull();
    expect(runCloudSyncMock).not.toHaveBeenCalled();
  });
});

describe('what a finished run is used for', () => {
  beforeEach(() => {
    setAutomaticSyncContext({ db, uid: 'uid-1' });
  });

  it('hands a conflict back without resolving it', async () => {
    runCloudSyncMock.mockResolvedValue({
      kind: 'conflict',
      conflict: { paths: ['periodRecords'] },
    } as unknown as CloudSyncOutcome);

    const outcome = await requestAutomaticSync('sign-in');

    expect(outcome).toEqual(expect.objectContaining({ kind: 'conflict' }));
  });

  it('leaves the bookkeeping to the sync itself', async () => {
    // Writing the conflict down and recording a settled sync both live inside
    // runCloudSync, so the button and the scheduler leave the same trail.
    // Repeating either here would be a second, divergent copy of the rule.
    await requestAutomaticSync('sign-in');

    expect(runCloudSyncMock).toHaveBeenCalledWith({ db, uid: 'uid-1' });
  });

  it('stops every later automatic run once a conflict is written down', async () => {
    runCloudSyncMock.mockResolvedValue({
      kind: 'conflict',
      conflict: { paths: ['periodRecords'] },
    } as unknown as CloudSyncOutcome);

    await requestAutomaticSync('sign-in');

    isConflictUnresolvedMock.mockResolvedValue(true);

    await expect(requestAutomaticSync('enabled')).resolves.toBeNull();
    expect(runCloudSyncMock).toHaveBeenCalledTimes(1);
  });

  it.each([['pulled'], ['merged']])('refreshes the copies after a %s', async (kind) => {
    runCloudSyncMock.mockResolvedValue({ kind } as unknown as CloudSyncOutcome);

    await requestAutomaticSync('sign-in');

    expect(syncWidgetSnapshotQuietlyMock).toHaveBeenCalledTimes(1);
    expect(syncPeriodReminderQuietlyMock).toHaveBeenCalledTimes(1);
    expect(syncPregnancyWeeklyReminderQuietlyMock).toHaveBeenCalledTimes(1);
  });

  it('leaves the copies alone when this phone did not change', async () => {
    await requestAutomaticSync('sign-in');

    expect(syncWidgetSnapshotQuietlyMock).not.toHaveBeenCalled();
    expect(syncPeriodReminderQuietlyMock).not.toHaveBeenCalled();
  });

  it('keeps the sync when a copy could not be refreshed', async () => {
    // A widget that would not redraw is not a reason to undo a pull that
    // already landed.
    runCloudSyncMock.mockResolvedValue({ kind: 'pulled' } as unknown as CloudSyncOutcome);
    syncWidgetSnapshotQuietlyMock.mockRejectedValue(new Error('no bridge'));

    await expect(requestAutomaticSync('sign-in')).resolves.toEqual({ kind: 'pulled' });
  });

  it('tells its listeners what the run came to', async () => {
    const heard: CloudSyncOutcome[] = [];
    const stop = onAutomaticSyncOutcome((outcome) => {
      heard.push(outcome);
    });

    await requestAutomaticSync('sign-in');

    stop();

    await requestAutomaticSync('enabled');

    expect(heard).toEqual([{ kind: 'pushed' }]);
  });

  it('keeps going when a listener throws', async () => {
    const calm = jest.fn();

    onAutomaticSyncOutcome(() => {
      throw new Error('screen went away');
    });
    onAutomaticSyncOutcome(calm);

    await expect(requestAutomaticSync('sign-in')).resolves.toEqual({ kind: 'pushed' });
    expect(calm).toHaveBeenCalledTimes(1);
  });
});

describe('when the account changes underneath a run', () => {
  it('drops a debounce started for the account that has gone', async () => {
    setAutomaticSyncContext({ db, uid: 'uid-1' });

    notifyLocalDataChanged();

    setAutomaticSyncContext({ db, uid: 'uid-2' });

    expect(hasPendingLocalChange()).toBe(false);

    jest.advanceTimersByTime(LOCAL_CHANGE_DEBOUNCE_MS);
    await settle();

    expect(runCloudSyncMock).not.toHaveBeenCalled();
  });

  it('does not apply a late result to whoever signed in next', async () => {
    let release: (outcome: CloudSyncOutcome) => void = () => undefined;

    runCloudSyncMock.mockReturnValue(
      new Promise<CloudSyncOutcome>((resolve) => {
        release = resolve;
      })
    );

    setAutomaticSyncContext({ db, uid: 'uid-1' });

    const attempt = requestAutomaticSync('sign-in');

    await settle();

    setAutomaticSyncContext({ db, uid: 'uid-2' });

    release({ kind: 'conflict', conflict: { paths: [] } } as unknown as CloudSyncOutcome);

    await expect(attempt).resolves.toBeNull();

    // The conflict belonged to a session that has gone. Writing it down would
    // stop syncing for an account that never had one.
    expect(markConflictUnresolvedMock).not.toHaveBeenCalled();
    expect(saveLastSyncAtMock).not.toHaveBeenCalled();
  });

  it('lets the new account sync straight away rather than inheriting a wait', async () => {
    setAutomaticSyncContext({ db, uid: 'uid-1' });

    await requestAutomaticSync('foreground');

    setAutomaticSyncContext({ db, uid: 'uid-2' });

    await requestAutomaticSync('foreground');

    expect(runCloudSyncMock).toHaveBeenCalledTimes(2);
    expect(runCloudSyncMock).toHaveBeenLastCalledWith({ db, uid: 'uid-2' });
  });

  it('keeps the spacing when the same account is set again', async () => {
    setAutomaticSyncContext({ db, uid: 'uid-1' });

    await requestAutomaticSync('foreground');

    setAutomaticSyncContext({ db, uid: 'uid-1' });

    await expect(requestAutomaticSync('foreground')).resolves.toBeNull();
    expect(runCloudSyncMock).toHaveBeenCalledTimes(1);
  });
});
