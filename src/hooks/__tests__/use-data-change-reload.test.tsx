import { act } from '@testing-library/react-native';
import { useCallback } from 'react';
import { AppState, Text } from 'react-native';

import type { LocalDataChangeOrigin } from '@/shared/data-change/local-data-change';
import {
  notifyLocalDataChanged,
  resetLocalDataChangeListenersForTests,
} from '@/shared/data-change/local-data-change';

import { useDataChangeReload } from '../use-data-change-reload';

import { renderSettled } from '../../../jest/render-settled';

jest.mock('expo-router', () => require('../../../jest/expo-router-mock'));

/**
 * The hook that decides when a screen stops believing what it read earlier.
 *
 * ## Why this file exists at all
 *
 * It did not, for as long as the hook had two triggers, and the gap that
 * opened up is the reason it does now. `useFocusEffect` is React Navigation's
 * focus: it fires when somebody arrives at a screen and when they come back to
 * it from elsewhere **inside the app**. It does not fire when Android takes the
 * app away and gives it back, because navigation never moved - the same screen
 * was focused the whole time.
 *
 * The settings screen is where that cost something. It sends people to system
 * settings with a button of its own, and it was the screen least able to
 * notice what they did there. Turning notifications back on and pressing Back
 * returned to a screen still saying they were off, with nothing queued; the
 * device said so in both directions before a line of this was written.
 *
 * Every test here drives `AppState` directly rather than through a screen,
 * because the rule belongs to the hook and seven screens inherit it.
 *
 * ## The reloads are recorded, not counted through a render
 *
 * What a reload *does* is the screen's business. What this hook owes is a call
 * at the right moments with the right `origin`, so each test reads the list of
 * origins it was called with.
 */

const addAppStateListener = AppState.addEventListener as unknown as jest.Mock;
const { focusAgain } = jest.requireMock('expo-router') as { focusAgain: () => void };

let origins: (LocalDataChangeOrigin | null)[];
let cancels: jest.Mock[];

/**
 * The listeners currently registered, as the real `AppState` would hold them.
 *
 * A registry rather than a replay of `mock.calls`, because the question "does
 * an unfocused screen still read" is only asked honestly by a stand-in that
 * honours `remove()`. Driving every call ever recorded answers it `yes` for a
 * hook that unsubscribed correctly, which is a test that cannot fail for the
 * right reason - and this one did exactly that before the registry existed.
 */
let listeners: ((state: string) => void)[];

function Probe() {
  const reload = useCallback((origin: LocalDataChangeOrigin | null) => {
    origins.push(origin);

    const cancel = jest.fn();

    cancels.push(cancel);

    return cancel;
  }, []);

  useDataChangeReload(reload);

  return <Text>probe</Text>;
}

/**
 * Hands the registered listeners a state change, inside `act`.
 *
 * Every listener rather than the first: a test that rendered two probes is
 * acting out two focused screens, and the real `AppState` would tell both.
 */
async function appState(next: string): Promise<void> {
  await act(async () => {
    for (const listener of [...listeners]) {
      listener(next);
    }
  });
}

/** Away and back, which is what a trip to system settings looks like. */
async function returnToForeground(): Promise<void> {
  await appState('background');
  await appState('active');
}

function setCurrentState(state: string): void {
  (AppState as unknown as { currentState: string }).currentState = state;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetLocalDataChangeListenersForTests();

  origins = [];
  cancels = [];
  listeners = [];

  addAppStateListener.mockImplementation((event: string, listener: (state: string) => void) => {
    if (event === 'change') {
      listeners.push(listener);
    }

    return {
      remove: () => {
        listeners = listeners.filter((registered) => registered !== listener);
      },
    };
  });

  setCurrentState('active');
});

describe('arriving at a screen', () => {
  it('reads once, with no origin', async () => {
    // `null` is the screen having been opened. A notice about interrupted work
    // belongs only to an arrival that interrupted something.
    await renderSettled(<Probe />);

    expect(origins).toEqual([null]);
  });
});

describe('coming back from another app', () => {
  it('reads again', async () => {
    // The whole reason this hook listens to anything but navigation. Somebody
    // who followed the app's own button into system settings, changed what it
    // asked them to change and came back was shown the answer from before they
    // left - and, on the settings screen, an empty reminder queue with it.
    await renderSettled(<Probe />);

    await returnToForeground();

    expect(origins).toEqual([null, null]);
  });

  it('calls it an arrival rather than an interruption', async () => {
    // Same origin as opening the screen: nobody's work was interrupted by
    // their own trip out of the app.
    await renderSettled(<Probe />);

    await returnToForeground();

    expect(origins[1]).toBeNull();
  });

  it('reads again on every return, not only the first', async () => {
    await renderSettled(<Probe />);

    await returnToForeground();
    await returnToForeground();

    expect(origins).toHaveLength(3);
  });

  it('counts a screen focused while the app was already away as away', async () => {
    // A screen can gain focus without anybody looking at it - a notification
    // tap routes while the app is still coming up. It never saw the trip out,
    // so the state it starts from is what has to say it was away.
    setCurrentState('background');

    await renderSettled(<Probe />);

    await appState('active');

    expect(origins).toEqual([null, null]);
  });
});

describe('what is not a return', () => {
  it('does not read on the way out', async () => {
    // Nothing has changed yet, and the screen is not being looked at.
    await renderSettled(<Probe />);

    await appState('background');

    expect(origins).toEqual([null]);
  });

  it('does not read when the app reports active without having been away', async () => {
    // `change` carries states that are not a trip out of the app. A read per
    // blip would be work nobody asked for, so the listener arms on the way out
    // and only then fires on the way in.
    await renderSettled(<Probe />);

    await appState('active');

    expect(origins).toEqual([null]);
  });

  it('does not read twice for one return reported twice', async () => {
    await renderSettled(<Probe />);

    await appState('background');
    await appState('active');
    await appState('active');

    expect(origins).toHaveLength(2);
  });
});

describe('a screen nobody is looking at', () => {
  it('does not read when the app comes back after it has gone', async () => {
    // The subscriptions live and die with focus. A screen sitting in the
    // navigation stack does no work and cannot set state.
    const view = await renderSettled(<Probe />);

    await act(async () => {
      view.unmount();
    });

    const before = origins.length;

    await returnToForeground();

    expect(origins).toHaveLength(before);
  });

  it('leaves nothing registered behind it', async () => {
    // The outcome above is the one that matters; this says why it holds, and
    // catches a listener kept alive by a screen that has gone before it can
    // become a leak nobody can see.
    const view = await renderSettled(<Probe />);

    expect(listeners).toHaveLength(1);

    await act(async () => {
      view.unmount();
    });

    expect(listeners).toHaveLength(0);
  });
});

describe('the other two triggers still work', () => {
  it('reads again when the screen is focused anew', async () => {
    await renderSettled(<Probe />);

    await act(async () => {
      focusAgain();
    });

    expect(origins).toEqual([null, null]);
  });

  it('reads when the change notifier announces one, carrying its origin', async () => {
    await renderSettled(<Probe />);

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    expect(origins).toEqual([null, 'remote']);
  });
});

describe('reads already in flight', () => {
  it('cancels every one of them when focus is lost', async () => {
    // Including the ones a resume started. A read that lands on a screen which
    // has gone is the bug the cancel flags exist for.
    const view = await renderSettled(<Probe />);

    await returnToForeground();

    expect(cancels).toHaveLength(2);

    await act(async () => {
      view.unmount();
    });

    for (const cancel of cancels) {
      expect(cancel).toHaveBeenCalled();
    }
  });
});
