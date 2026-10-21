import { act, renderHook } from '@testing-library/react-native';

import type { AuthUser } from '@/features/auth/domain/auth-user';

import { currentUidOrNull, useAutomaticSync } from '../use-automatic-sync';

import {
  appStateListenerCount,
  armAppState,
  sendAppState,
} from '../../../../../jest/app-state-driver';

/**
 * The wiring between the scheduler and the two things only a running app knows:
 * who is signed in, and whether it is on screen.
 *
 * ## Why this file exists
 *
 * This hook held **0% coverage**. Every test that mounts the root layout fakes
 * it — `root-layout.test.tsx`, `every-screen-english.test.tsx` and the two
 * app-lock screen tests all do — so the whole of automatic sync's lifecycle
 * wiring had no test anywhere, while reading as covered because the thing above
 * it was.
 *
 * The same case `use-app-lock.test.tsx` makes: `decideAutomaticSync` under this
 * is pure and thoroughly tested, and nothing checked that the hook feeds it the
 * right facts or cleans up after itself. A sync that never fires and a sync that
 * fires for a signed-out account are both this file's business.
 *
 * ## What is faked
 *
 * The scheduler, the auth watcher and the database open, because those are the
 * boundaries. `AppState` goes through the shared driver, whose registry really
 * removes listeners — which is what lets the last test ask whether the hook
 * left anything behind.
 */

jest.mock('../automatic-sync-scheduler', () => ({
  setAutomaticSyncContext: jest.fn(),
  requestAutomaticSync: jest.fn(),
  flushPendingAutomaticSync: jest.fn(),
}));

jest.mock('@/features/auth/data/auth-repository', () => ({
  observeAuthUser: jest.fn(),
  getCurrentAuthUser: jest.fn(),
}));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
}));

jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
}));

const scheduler = jest.requireMock('../automatic-sync-scheduler');
const auth = jest.requireMock('@/features/auth/data/auth-repository');
const storage = jest.requireMock('@/storage/db');
const logging = jest.requireMock('@/shared/logging');

const setAutomaticSyncContext = scheduler.setAutomaticSyncContext as jest.Mock;
const requestAutomaticSync = scheduler.requestAutomaticSync as jest.Mock;
const flushPendingAutomaticSync = scheduler.flushPendingAutomaticSync as jest.Mock;
const observeAuthUser = auth.observeAuthUser as jest.Mock;
const getCurrentAuthUser = auth.getCurrentAuthUser as jest.Mock;
const openAppDatabase = storage.openAppDatabase as jest.Mock;
const logEvent = logging.logEvent as jest.Mock;

const USER: AuthUser = { uid: 'firebase-uid-1', email: 'someone@example.test' };

const DB = { marker: 'the-one-database' };

/** Pushes a signed-in user, or a sign-out, the way the SDK would. */
let notify: (user: AuthUser | null) => void;
let unsubscribe: jest.Mock;

/** Lets the database open and the adopt that follows it land. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  armAppState();

  notify = () => undefined;
  unsubscribe = jest.fn();

  setAutomaticSyncContext.mockReset();
  requestAutomaticSync.mockReset();
  requestAutomaticSync.mockResolvedValue(null);
  flushPendingAutomaticSync.mockReset();
  flushPendingAutomaticSync.mockResolvedValue(null);

  observeAuthUser.mockReset();
  observeAuthUser.mockImplementation((callback: (user: AuthUser | null) => void) => {
    notify = callback;

    return unsubscribe;
  });

  getCurrentAuthUser.mockReset();
  getCurrentAuthUser.mockReturnValue(null);

  openAppDatabase.mockReset();
  openAppDatabase.mockResolvedValue(DB);

  logEvent.mockReset();
});

describe('adopting the account that is signed in', () => {
  it('points the scheduler at it and asks for a sync', async () => {
    await renderHook(() => useAutomaticSync());

    await act(async () => {
      notify(USER);
    });
    await settle();

    expect(setAutomaticSyncContext).toHaveBeenCalledWith({ db: DB, uid: USER.uid });
    // Signing in is the largest gap there is: this phone may have been out of
    // date for as long as the session was gone.
    expect(requestAutomaticSync).toHaveBeenCalledWith('sign-in');
  });

  it('clears the context on a sign-out, and asks for nothing', async () => {
    await renderHook(() => useAutomaticSync());

    await act(async () => {
      notify(null);
    });
    await settle();

    expect(setAutomaticSyncContext).toHaveBeenCalledWith(null);
    expect(requestAutomaticSync).not.toHaveBeenCalled();
    // Nothing to open a database for either.
    expect(openAppDatabase).not.toHaveBeenCalled();
  });
});

describe('what the app being on screen does', () => {
  it('asks for a sync on coming to the front', async () => {
    await renderHook(() => useAutomaticSync());

    await sendAppState('active');

    expect(requestAutomaticSync).toHaveBeenCalledWith('foreground');
  });

  it('flushes a pending edit on the way out rather than starting something new', async () => {
    await renderHook(() => useAutomaticSync());

    await sendAppState('background');

    expect(flushPendingAutomaticSync).toHaveBeenCalledTimes(1);
    // Going away is a chance to send what is already waiting, not to begin.
    expect(requestAutomaticSync).not.toHaveBeenCalled();
  });

  it.each(['inactive', 'background'] as const)('flushes for %s', async (state) => {
    await renderHook(() => useAutomaticSync());

    await sendAppState(state);

    expect(flushPendingAutomaticSync).toHaveBeenCalledTimes(1);
  });
});

describe('a build with no Firebase project', () => {
  it('reads as signed out rather than crashing the app', async () => {
    observeAuthUser.mockImplementation(() => {
      throw new Error('Firebase is not configured.');
    });

    await renderHook(() => useAutomaticSync());

    expect(setAutomaticSyncContext).toHaveBeenCalledWith(null);
  });

  it('still watches the app coming and going', async () => {
    observeAuthUser.mockImplementation(() => {
      throw new Error('Firebase is not configured.');
    });

    await renderHook(() => useAutomaticSync());

    await sendAppState('active');

    // The foreground trigger is harmless with no account — the policy refuses
    // it — and losing the listener would be a hook that half-mounted.
    expect(requestAutomaticSync).toHaveBeenCalledWith('foreground');
  });
});

describe('a database that will not open', () => {
  it('says so and leaves the scheduler without a context', async () => {
    openAppDatabase.mockRejectedValue(new Error('the disk said no'));

    await renderHook(() => useAutomaticSync());

    await act(async () => {
      notify(USER);
    });
    await settle();

    expect(logEvent).toHaveBeenCalledWith('automatic sync failed', expect.any(Error));
    expect(setAutomaticSyncContext).not.toHaveBeenCalledWith(
      expect.objectContaining({ uid: USER.uid })
    );
    expect(requestAutomaticSync).not.toHaveBeenCalled();
  });
});

describe('going away', () => {
  it('stops watching and clears the context', async () => {
    const view = await renderHook(() => useAutomaticSync());

    expect(appStateListenerCount()).toBe(1);

    await act(async () => {
      view.unmount();
    });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(appStateListenerCount()).toBe(0);
    expect(setAutomaticSyncContext).toHaveBeenLastCalledWith(null);
  });

  it('sets nothing from a database that resolves after it has gone', async () => {
    let openDatabase!: (db: unknown) => void;
    openAppDatabase.mockReturnValue(
      new Promise((resolve) => {
        openDatabase = resolve;
      })
    );

    const view = await renderHook(() => useAutomaticSync());

    await act(async () => {
      notify(USER);
    });

    await act(async () => {
      view.unmount();
    });

    setAutomaticSyncContext.mockClear();

    await act(async () => {
      openDatabase(DB);
      await Promise.resolve();
      await Promise.resolve();
    });

    // The screen has gone. Pointing the scheduler at a database now would be a
    // sync nobody is on screen for, scheduled by a hook that is not mounted.
    expect(setAutomaticSyncContext).not.toHaveBeenCalled();
    expect(requestAutomaticSync).not.toHaveBeenCalled();
  });
});

describe('currentUidOrNull', () => {
  it('reports the signed-in uid', () => {
    getCurrentAuthUser.mockReturnValue(USER);

    expect(currentUidOrNull()).toBe(USER.uid);
  });

  it('reports nothing when nobody is signed in', () => {
    expect(currentUidOrNull()).toBeNull();
  });

  it('reports nothing rather than throwing with no Firebase project', () => {
    getCurrentAuthUser.mockImplementation(() => {
      throw new Error('Firebase is not configured.');
    });

    expect(currentUidOrNull()).toBeNull();
  });
});
