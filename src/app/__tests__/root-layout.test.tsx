import { act, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import RootLayout from '@/app/_layout';
import { useAppLockStore } from '@/store/app-lock-store';
import { useAppStore } from '@/store/app-store';
import type { AppMode } from '@/types/app-state';

/**
 * What the app opens on.
 *
 * This file used to sit in `src/navigation/` beside `routing-gate.ts` and
 * carried three assertions about that module's pure function. The function was
 * deleted - nothing but those assertions ever called it, and it still described
 * a two-way decision that had become a three-way one - so the file moved here,
 * next to the layout it has always actually been about.
 *
 * The decision lives in `_layout.tsx`'s three `Stack.Protected` guards and is
 * tested through them: rendering the layout and looking at which group mounted
 * is the only way to check the rule that is actually in force.
 */

// Stand-ins for the navigator: they record what the layout asked for without
// needing a real navigation tree.
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  const Screen = ({ name }: { name: string }) =>
    React.createElement(Text, null, `screen:${name}`);

  const Protected = ({ guard, children }: { guard: boolean; children?: ReactNode }) =>
    guard ? React.createElement(React.Fragment, null, children) : null;

  const Stack = Object.assign(
    ({ children }: { children?: ReactNode }) => React.createElement(View, null, children),
    { Screen, Protected }
  );

  return {
    Stack,
    ThemeProvider: ({ children }: { children?: ReactNode }) =>
      React.createElement(View, null, children),
    DarkTheme: {},
    DefaultTheme: {},
  };
});

jest.mock('@/storage/app-state-storage', () => ({
  loadAppState: jest.fn(),
  saveAppState: jest.fn(),
  clearAppState: jest.fn(),
}));

// The splash screen, which the layout holds up at module scope and lets go
// once there is something on screen.
//
// The factory builds its own spies and the handle comes back through
// `jest.requireMock`, because `jest.mock` is hoisted above the imports and the
// layout calls `preventAutoHideAsync` as it loads — a factory closing over a
// `const` declared below would run while that `const` is still in its temporal
// dead zone, and the first version of this failed with
// "preventAutoHideAsync is not a function" for exactly that reason.
//
// `jest-expo` has no mock of its own for this module, and the real one no-ops
// quietly enough that a test built on it would assert nothing — which is how
// this behaviour came to be untested in the first place.
jest.mock('expo-splash-screen', () => ({
  // Resolved by default, because the layout calls this as it loads and the
  // real one answers a promise. A bare `jest.fn()` returns undefined and the
  // `.catch` on it throws before any test runs.
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

const mockSplash = jest.requireMock('expo-splash-screen') as {
  preventAutoHideAsync: jest.Mock;
  hideAsync: jest.Mock;
};

// The root layout mounts automatic sync, which reaches Firebase. This file is
// about which screen the app lands on, and a session it never opens has no
// bearing on that.
jest.mock('@/features/sync/application/use-automatic-sync', () => ({
  useAutomaticSync: jest.fn(),
}));

let hydrateMock: jest.Mock;

function primeStore(options: {
  hydrated: boolean;
  onboardingCompleted: boolean;
  mode?: AppMode;
  hydrate?: jest.Mock;
}) {
  hydrateMock = options.hydrate ?? jest.fn().mockResolvedValue(undefined);

  useAppStore.setState({
    mode: options.mode ?? 'cycle',
    onboardingCompleted: options.onboardingCompleted,
    hydrated: options.hydrated,
    hydrate: hydrateMock as unknown as () => Promise<void>,
  });
}

/**
 * The lock half of the same decision.
 *
 * Its `hydrate` is replaced for the same reason the app store's is: the real
 * one reads the device and would overwrite whatever this test just said about
 * whether the app is locked.
 *
 * Called by every test rather than only the lock ones. A zustand store outlives
 * the test that set it, so a file where some tests prime it and others do not
 * is a file whose results depend on the order they ran in.
 */
function primeLock(options: { enabled: boolean; locked: boolean }) {
  useAppLockStore.setState({
    enabled: options.enabled,
    locked: options.locked,
    hydrated: true,
    hydrate: jest.fn().mockResolvedValue(undefined) as unknown as () => Promise<void>,
  });
}

beforeEach(() => {
  primeLock({ enabled: false, locked: false });

  // `preventAutoHideAsync` is deliberately not reset: it is called once, at
  // module scope, before any test runs, and resetting would erase the only
  // record that it happened.
  mockSplash.hideAsync.mockClear();
});

describe('RootLayout hydration', () => {
  it('starts hydration on mount', async () => {
    primeStore({ hydrated: false, onboardingCompleted: false });

    await render(<RootLayout />);

    expect(hydrateMock).toHaveBeenCalledTimes(1);
  });

  it('does not hydrate again when the state changes', async () => {
    primeStore({ hydrated: false, onboardingCompleted: false });

    const { rerender } = await render(<RootLayout />);
    await act(async () => {
      useAppStore.setState({ hydrated: true, onboardingCompleted: true });
    });
    await rerender(<RootLayout />);
    await rerender(<RootLayout />);

    expect(hydrateMock).toHaveBeenCalledTimes(1);
  });

  it('shows a loading placeholder while unhydrated', async () => {
    primeStore({ hydrated: false, onboardingCompleted: false });

    const { queryByText, queryByTestId } = await render(<RootLayout />);

    expect(queryByTestId('app-hydration-loading')).not.toBeNull();
    expect(queryByText('screen:(onboarding)')).toBeNull();
    expect(queryByText('screen:(app)')).toBeNull();
  });

  it('routes nowhere until hydration finishes', async () => {
    primeStore({ hydrated: false, onboardingCompleted: true });

    const { queryByText } = await render(<RootLayout />);

    expect(queryByText('screen:(app)')).toBeNull();
    expect(queryByText('screen:(onboarding)')).toBeNull();
  });

  it('says what happened, in the language of the phone, rather than spinning forever', async () => {
    primeStore({
      hydrated: false,
      onboardingCompleted: false,
      hydrate: jest.fn().mockRejectedValue(new Error('storage unavailable')),
    });

    const { findByText, queryByTestId } = await render(<RootLayout />);

    // This read 'App state could not be loaded.' - hardcoded English on a
    // Turkish-first app, on the one screen somebody cannot navigate away from,
    // and this assertion is what held it there. The name above called it
    // developer-visible, which is how it survived: it was never a developer who
    // would see it.
    expect(
      await findByText('Uygulama açılamadı. Kayıtların telefonunda duruyor, silinmedi.')
    ).toBeTruthy();
    expect(queryByTestId('app-hydration-loading')).toBeNull();
  });
});

describe('RootLayout routing', () => {
  it('mounts the onboarding group when onboarding is incomplete', async () => {
    primeStore({ hydrated: true, onboardingCompleted: false });

    const { getByText, queryByText } = await render(<RootLayout />);

    expect(getByText('screen:(onboarding)')).toBeTruthy();
    expect(queryByText('screen:(app)')).toBeNull();
  });

  it('mounts the app group when onboarding is complete', async () => {
    primeStore({ hydrated: true, onboardingCompleted: true });

    const { getByText, queryByText } = await render(<RootLayout />);

    expect(getByText('screen:(app)')).toBeTruthy();
    expect(queryByText('screen:(onboarding)')).toBeNull();
  });

  it('mounts exactly one group at a time', async () => {
    for (const onboardingCompleted of [false, true]) {
      primeStore({ hydrated: true, onboardingCompleted });

      const { queryAllByText, unmount } = await render(<RootLayout />);
      const mounted = [
        ...queryAllByText('screen:(onboarding)'),
        ...queryAllByText('screen:(app)'),
      ];

      expect(mounted).toHaveLength(1);
      await unmount();
    }
  });

  it.each<AppMode>(['cycle', 'pregnancy'])(
    'ignores mode "%s" when choosing the group',
    async (mode) => {
      primeStore({ hydrated: true, onboardingCompleted: true, mode });
      const first = await render(<RootLayout />);
      expect(first.getByText('screen:(app)')).toBeTruthy();
      await first.unmount();

      primeStore({ hydrated: true, onboardingCompleted: false, mode });
      const second = await render(<RootLayout />);
      expect(second.getByText('screen:(onboarding)')).toBeTruthy();
      await second.unmount();
    }
  );
});

/**
 * The third guard, which the deleted `resolveRouteGroup` never knew about.
 *
 * It is first in `_layout.tsx` on purpose: a locked app mounts nothing else, so
 * there is no screen behind the lock to draw, to leak into the task switcher,
 * or to be reached by a deep link that arrived while the app was closed. These
 * assertions are what hold that ordering in place.
 */
describe('RootLayout locking', () => {
  it('mounts the lock group ahead of the app group', async () => {
    primeStore({ hydrated: true, onboardingCompleted: true });
    primeLock({ enabled: true, locked: true });

    const { getByText, queryByText } = await render(<RootLayout />);

    expect(getByText('screen:(lock)')).toBeTruthy();
    expect(queryByText('screen:(app)')).toBeNull();
  });

  it('mounts the app group once the lock is opened', async () => {
    primeStore({ hydrated: true, onboardingCompleted: true });
    primeLock({ enabled: true, locked: false });

    const { getByText, queryByText } = await render(<RootLayout />);

    expect(getByText('screen:(app)')).toBeTruthy();
    expect(queryByText('screen:(lock)')).toBeNull();
  });

  it('does not lock somebody who has not finished onboarding', async () => {
    // A lock cannot be set up before onboarding finishes, so this is a state
    // the app should never reach. If it ever does, the answer is the setup
    // flow rather than a PIN prompt with nothing behind it.
    primeStore({ hydrated: true, onboardingCompleted: false });
    primeLock({ enabled: true, locked: true });

    const { getByText, queryByText } = await render(<RootLayout />);

    expect(getByText('screen:(onboarding)')).toBeTruthy();
    expect(queryByText('screen:(lock)')).toBeNull();
  });

  it('waits for the lock to be read before mounting anything', async () => {
    primeStore({ hydrated: true, onboardingCompleted: true });
    useAppLockStore.setState({
      enabled: false,
      locked: false,
      hydrated: false,
      hydrate: jest.fn().mockResolvedValue(undefined) as unknown as () => Promise<void>,
    });

    const { queryByText, queryByTestId } = await render(<RootLayout />);

    expect(queryByTestId('app-hydration-loading')).not.toBeNull();
    expect(queryByText('screen:(app)')).toBeNull();
    expect(queryByText('screen:(lock)')).toBeNull();
  });

  it('mounts exactly one group whatever the two flags say', async () => {
    for (const onboardingCompleted of [false, true]) {
      for (const locked of [false, true]) {
        primeStore({ hydrated: true, onboardingCompleted });
        primeLock({ enabled: locked, locked });

        const { queryAllByText, unmount } = await render(<RootLayout />);
        const mounted = [
          ...queryAllByText('screen:(onboarding)'),
          ...queryAllByText('screen:(app)'),
          ...queryAllByText('screen:(lock)'),
        ];

        expect(mounted).toHaveLength(1);
        await unmount();
      }
    }
  });
});

/**
 * The splash, and the flicker it used to leave.
 *
 * `expo-splash-screen` was configured in `app.json` and never asked to wait, so
 * it hid itself on the first frame — and the first frame is the loading
 * placeholder, because the fonts and two AsyncStorage reads have not landed
 * yet. Every cold start went splash, flash of spinner, app.
 *
 * `preventAutoHideAsync` runs at module scope rather than in an effect, because
 * an effect runs after the first render and the splash is already gone by then.
 */
describe('RootLayout and the splash screen', () => {
  it('asks for the splash to be held', () => {
    // At module scope, so it has already happened by the time any test runs.
    expect(mockSplash.preventAutoHideAsync).toHaveBeenCalled();
  });

  it('keeps the splash up while the app is still reading its state', async () => {
    primeStore({ hydrated: false, onboardingCompleted: false });

    await render(<RootLayout />);

    expect(mockSplash.hideAsync).not.toHaveBeenCalled();
  });

  it('lets the splash go once there is something to show', async () => {
    primeStore({ hydrated: true, onboardingCompleted: true });

    await render(<RootLayout />);

    expect(mockSplash.hideAsync).toHaveBeenCalled();
  });

  it('lets it go when the state could not be read at all', async () => {
    // A hydration error puts a message on screen. Leaving the splash over it
    // would be an app that looks like it hung rather than one explaining
    // itself.
    primeStore({
      hydrated: false,
      onboardingCompleted: false,
      hydrate: jest.fn().mockRejectedValue(new Error('storage said no')),
    });

    await render(<RootLayout />);

    expect(mockSplash.hideAsync).toHaveBeenCalled();
  });
});
