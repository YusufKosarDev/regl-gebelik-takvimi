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
