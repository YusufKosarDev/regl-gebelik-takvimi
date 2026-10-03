import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { GRACE_WINDOW_MS } from '../../domain/lock-decision';
import { setAuthenticationInProgress, useAppLock } from '../use-app-lock';

import { useAppLockStore } from '@/store/app-lock-store';

/**
 * What happens when somebody leaves the app and comes back.
 *
 * ## Why this file exists
 *
 * This hook held 40% statement and 0% branch coverage. `lock-decision.ts` under
 * it is pure and thoroughly tested, but nothing checked that the hook asks it
 * the right question - and the hook is where every input to that question comes
 * from: which `AppState` transition counts as leaving, when the clock was read,
 * and whether the biometric sheet is up.
 *
 * It is also the whole of the feature from a person's point of view. The PIN
 * policy and the attempt counters only matter if the lock closes at all.
 *
 * ## How the time is controlled
 *
 * `Date.now` is mocked rather than timers advanced: the hook reads the clock
 * twice, once on leaving and once on returning, and what matters is the gap
 * between the two readings rather than any real waiting.
 */

type Listener = (state: string) => void;

let listener: Listener;
let removed: boolean;
let now: number;

beforeEach(() => {
  removed = false;
  now = 1_000_000;

  jest.spyOn(Date, 'now').mockImplementation(() => now);

  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, handler: Listener) => {
    listener = handler;

    return {
      remove: () => {
        removed = true;
      },
    };
  }) as never);

  setAuthenticationInProgress(false);

  useAppLockStore.setState({ enabled: true, locked: false, hydrated: true, unreadable: false });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Leaves the app, waits `awayMs`, and comes back. */
function leaveAndReturn(awayMs: number, leaveVia: string = 'background') {
  listener(leaveVia);
  now += awayMs;
  listener('active');
}

describe('coming back to a phone that was put down', () => {
  it('asks for the PIN after the grace window', async () => {
    await renderHook(() => useAppLock());

    leaveAndReturn(GRACE_WINDOW_MS + 1);

    expect(useAppLockStore.getState().locked).toBe(true);
  });

  it('does not ask after a glance at a notification', async () => {
    // The window exists so that pulling down the shade, answering a permission
    // dialog or reading a message does not cost a PIN.
    await renderHook(() => useAppLock());

    leaveAndReturn(GRACE_WINDOW_MS - 1);

    expect(useAppLockStore.getState().locked).toBe(false);
  });

  it('asks exactly at the window rather than a millisecond later', async () => {
    await renderHook(() => useAppLock());

    leaveAndReturn(GRACE_WINDOW_MS);

    expect(useAppLockStore.getState().locked).toBe(true);
  });

  it('treats iOS inactive as the moment they left, not the moment after', async () => {
    // iOS reports `inactive` on the way to `background`. Taking the second one
    // would start the window late and hand out free seconds.
    await renderHook(() => useAppLock());

    listener('inactive');
    now += 10_000;
    listener('background');
    now += GRACE_WINDOW_MS - 9_000;
    listener('active');

    // 19 seconds since `inactive`, 9 since `background`. Only the first reading
    // puts this past the window.
    expect(useAppLockStore.getState().locked).toBe(true);
  });

  it('starts the window again on the next trip out', async () => {
    await renderHook(() => useAppLock());

    leaveAndReturn(GRACE_WINDOW_MS - 1);
    expect(useAppLockStore.getState().locked).toBe(false);

    leaveAndReturn(GRACE_WINDOW_MS - 1);

    // Two short trips are two short trips, not one long one.
    expect(useAppLockStore.getState().locked).toBe(false);
  });
});

describe('what it refuses to do', () => {
  it('does nothing when no lock is set', async () => {
    useAppLockStore.setState({ enabled: false, locked: false });

    await renderHook(() => useAppLock());

    leaveAndReturn(GRACE_WINDOW_MS * 10);

    expect(useAppLockStore.getState().locked).toBe(false);
  });

  it('does not close a lock that is already closed', async () => {
    // Guarded on `locked` as well as on the decision, so returning to a locked
    // app is not a second lock event.
    useAppLockStore.setState({ enabled: true, locked: true });

    await renderHook(() => useAppLock());

    const lock = jest.spyOn(useAppLockStore.getState(), 'lock');

    leaveAndReturn(GRACE_WINDOW_MS * 2);

    expect(lock).not.toHaveBeenCalled();
  });

  it('does not lock while the biometric sheet is up', async () => {
    // The loop this hook is written around: on several Android devices the OS
    // biometric sheet drives the activity to `background`. Reading that as
    // "they left" locks the app behind the prompt that was going to open it,
    // and unlocking becomes impossible.
    await renderHook(() => useAppLock());

    setAuthenticationInProgress(true);
    leaveAndReturn(GRACE_WINDOW_MS * 2);

    expect(useAppLockStore.getState().locked).toBe(false);
  });

  it('locks again once the sheet is gone', async () => {
    // The other half: the flag must not disable locking for the rest of the
    // session. It is cleared in a `finally` by the biometric path.
    await renderHook(() => useAppLock());

    setAuthenticationInProgress(true);
    leaveAndReturn(GRACE_WINDOW_MS * 2);
    expect(useAppLockStore.getState().locked).toBe(false);

    setAuthenticationInProgress(false);
    leaveAndReturn(GRACE_WINDOW_MS * 2);

    expect(useAppLockStore.getState().locked).toBe(true);
  });
});

describe('a clock that moved while the app was away', () => {
  it('does not lock somebody out because their phone crossed a timezone', async () => {
    // Elapsed time reads negative. The window is a courtesy rather than a
    // defence - anybody who can move the clock is holding an unlocked phone -
    // so the kind reading wins.
    await renderHook(() => useAppLock());

    listener('background');
    now -= 60 * 60 * 1000;
    listener('active');

    expect(useAppLockStore.getState().locked).toBe(false);
  });
});

describe('the listener itself', () => {
  it('stops listening when the app tears down', async () => {
    const { unmount } = await renderHook(() => useAppLock());

    await act(async () => {
      unmount();
    });

    expect(removed).toBe(true);
  });

  it('registers once and keeps answering', async () => {
    // A ref rather than state holds the leaving time, because the listener is
    // registered once and a piece of state would be captured at its value then.
    // This is what that buys: the fifth trip out is read as freshly as the
    // first.
    // Counted as a delta: React Native subscribes to `AppState` for its own
    // reasons, so the absolute number is not this hook's to claim.
    const before = jest.mocked(AppState.addEventListener).mock.calls.length;

    await renderHook(() => useAppLock());

    expect(jest.mocked(AppState.addEventListener).mock.calls.length - before).toBe(1);

    for (let trip = 0; trip < 4; trip += 1) {
      leaveAndReturn(GRACE_WINDOW_MS - 1);
      expect([trip, useAppLockStore.getState().locked]).toEqual([trip, false]);
    }

    leaveAndReturn(GRACE_WINDOW_MS + 1);

    expect(useAppLockStore.getState().locked).toBe(true);
  });
});
