import { readLockRecord } from '@/features/app-lock/infrastructure/lock-record-store';
import { useAppLockStore } from '@/store/app-lock-store';

/**
 * The two facts the app needs about the lock: whether there is one, and whether
 * it is currently closed.
 *
 * ## Why this file exists
 *
 * This store held 33% statement coverage while being the thing that decides
 * whether a period tracker opens on somebody's screen. Everything around it was
 * tested - the PIN policy, the attempt counters, the lock decision - and the
 * state they all feed was not.
 *
 * What is tested here is specifically what the store does with a *read*, since
 * that is where the failing-open choice lives: an unreadable record has to come
 * back as "no lock, and say so once", and getting that wrong in either
 * direction is serious. Locking somebody out of their own records because a key
 * store misbehaved is as bad as leaving the lock off when they set one.
 */

jest.mock('@/features/app-lock/infrastructure/lock-record-store', () => ({
  readLockRecord: jest.fn(),
}));

const read = jest.mocked(readLockRecord);

/** A stored record, with only the fields this store looks at. */
const RECORD = {
  kind: 'record' as const,
  record: {
    hash: 'hash',
    salt: 'salt',
    attempts: { failedCount: 0, lockedUntil: null },
    biometricsEnabled: false,
    boundUid: null,
  },
};

beforeEach(() => {
  read.mockReset();

  useAppLockStore.setState({
    enabled: false,
    locked: false,
    hydrated: false,
    unreadable: false,
  });
});

describe('reading the lock at startup', () => {
  it('opens on the lock when there is one', async () => {
    // A cold start is locked whenever a lock is set. The grace window is about
    // coming back, and a launch has nothing to come back from.
    read.mockResolvedValue(RECORD as never);

    await useAppLockStore.getState().hydrate();

    expect(useAppLockStore.getState()).toMatchObject({
      enabled: true,
      locked: true,
      hydrated: true,
      unreadable: false,
    });
  });

  it('opens the app when no lock was ever set', async () => {
    read.mockResolvedValue({ kind: 'absent' } as never);

    await useAppLockStore.getState().hydrate();

    expect(useAppLockStore.getState()).toMatchObject({
      enabled: false,
      locked: false,
      hydrated: true,
      unreadable: false,
    });
  });

  it('fails open when the record cannot be read, and says so once', async () => {
    // The sharp end of the whole file. A key store that misbehaves must not
    // lock somebody out of their own records, so this reads as "no lock" - and
    // the person is told, because a lock they set has silently stopped working.
    read.mockResolvedValue({ kind: 'unreadable' } as never);

    await useAppLockStore.getState().hydrate();

    expect(useAppLockStore.getState()).toMatchObject({
      enabled: false,
      locked: false,
      hydrated: true,
      unreadable: true,
    });
  });

  it('stops saying it once it has been said', async () => {
    read.mockResolvedValue({ kind: 'unreadable' } as never);
    await useAppLockStore.getState().hydrate();

    useAppLockStore.getState().acknowledgeUnreadable();

    expect(useAppLockStore.getState().unreadable).toBe(false);
  });

  it('marks itself hydrated whatever the read said', async () => {
    // Without this the app holds its loading screen forever, which is the one
    // outcome worse than either answer.
    for (const outcome of [RECORD, { kind: 'absent' }, { kind: 'unreadable' }]) {
      useAppLockStore.setState({ hydrated: false });
      read.mockResolvedValue(outcome as never);

      await useAppLockStore.getState().hydrate();

      expect([outcome.kind, useAppLockStore.getState().hydrated]).toEqual([outcome.kind, true]);
    }
  });
});

describe('closing and opening it while the app runs', () => {
  it('closes without claiming a lock was set up', async () => {
    // `lock()` is called by the foreground listener, which has already checked
    // that a lock exists. It must not be the thing that decides there is one.
    useAppLockStore.setState({ enabled: true, locked: false });

    useAppLockStore.getState().lock();

    expect(useAppLockStore.getState()).toMatchObject({ enabled: true, locked: true });
  });

  it('opens without taking the lock off', async () => {
    // Unlocking is getting past the lock, not removing it. If these two ever
    // merged, opening the app once would disable it for good.
    useAppLockStore.setState({ enabled: true, locked: true });

    useAppLockStore.getState().unlock();

    expect(useAppLockStore.getState()).toMatchObject({ enabled: true, locked: false });
  });
});

describe('setting and removing a lock', () => {
  it('leaves somebody past the lock they just set', async () => {
    // Setting a PIN and then being asked for it immediately would read as the
    // app not having registered it.
    useAppLockStore.setState({ enabled: false, locked: false });

    useAppLockStore.getState().markEnabled();

    expect(useAppLockStore.getState()).toMatchObject({ enabled: true, locked: false });
  });

  it('does not leave the screen locked behind a lock that is gone', async () => {
    // The state that would strand somebody: no lock set, but the lock screen
    // still up and no PIN that opens it.
    useAppLockStore.setState({ enabled: true, locked: true });

    useAppLockStore.getState().markDisabled();

    expect(useAppLockStore.getState()).toMatchObject({ enabled: false, locked: false });
  });
});
