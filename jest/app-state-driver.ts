import { act } from '@testing-library/react-native';
import { AppState } from 'react-native';

/**
 * A stand-in for Android taking the app away and giving it back.
 *
 * `useDataChangeReload` listens to `AppState` as well as to navigation focus,
 * because the two are different events: going to the system settings and
 * pressing Back moves no navigation at all. Four test files need to act out
 * that second one, which is four chances for them to drift apart — the same
 * reason `expo-router-mock.js` exists for the first.
 *
 * ## The registry is the point
 *
 * `AppState.addEventListener` is a mock, so the obvious driver is to replay
 * `mock.calls` and call everything that was ever registered. That cannot
 * answer the question a test most wants to ask — *does a screen that has gone
 * still read?* — because it keeps calling listeners the screen removed on its
 * way out, and so reports a correctly unsubscribed hook as leaking. The first
 * version written here did exactly that.
 *
 * So the listeners are kept in a list that `remove()` really removes from, and
 * the driver walks the list. `appStateListenerCount()` reads it, for a test
 * that wants to say nothing was left behind.
 */
let listeners: ((state: string) => void)[] = [];

const addEventListener = AppState.addEventListener as unknown as jest.Mock;

/**
 * Call in `beforeEach`, after any `clearAllMocks`.
 *
 * Replaces the mock's implementation rather than its return value, because a
 * shared `{ remove }` object cannot know which listener it was handed out for.
 */
export function armAppState(): void {
  listeners = [];

  addEventListener.mockReset();
  addEventListener.mockImplementation((event: string, listener: (state: string) => void) => {
    if (event === 'change') {
      listeners.push(listener);
    }

    return {
      remove: () => {
        listeners = listeners.filter((registered) => registered !== listener);
      },
    };
  });

  setCurrentAppState('active');
}

/**
 * One state change, to every listener, inside `act`.
 *
 * Every listener rather than the first: two mounted screens are two focused
 * screens as far as this is concerned, and the real `AppState` would tell
 * both.
 */
export async function sendAppState(next: string): Promise<void> {
  await act(async () => {
    for (const listener of [...listeners]) {
      listener(next);
    }
  });
}

/** Away and back, which is what a trip to Android's own settings looks like. */
export async function returnToForeground(): Promise<void> {
  await sendAppState('background');
  await sendAppState('active');
}

/** What `AppState.currentState` reads, for a hook that asks on the way in. */
export function setCurrentAppState(state: string): void {
  (AppState as unknown as { currentState: string }).currentState = state;
}

/** How many listeners are registered right now. */
export function appStateListenerCount(): number {
  return listeners.length;
}
