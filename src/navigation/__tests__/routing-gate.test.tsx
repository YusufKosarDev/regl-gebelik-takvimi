import { act, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import RootLayout from '@/app/_layout';
import { useAppStore } from '@/store/app-store';
import type { AppMode } from '@/types/app-state';

import { resolveRouteGroup } from '../routing-gate';

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

describe('resolveRouteGroup', () => {
  it('sends an unfinished onboarding to the onboarding group', () => {
    expect(resolveRouteGroup(false)).toBe('(onboarding)');
  });

  it('sends a finished onboarding to the app group', () => {
    expect(resolveRouteGroup(true)).toBe('(app)');
  });

  it('returns one of the two known groups only', () => {
    expect(['(onboarding)', '(app)']).toContain(resolveRouteGroup(true));
    expect(['(onboarding)', '(app)']).toContain(resolveRouteGroup(false));
  });
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

  it('shows a developer-visible error instead of spinning forever', async () => {
    primeStore({
      hydrated: false,
      onboardingCompleted: false,
      hydrate: jest.fn().mockRejectedValue(new Error('storage unavailable')),
    });

    const { findByText, queryByTestId } = await render(<RootLayout />);

    expect(await findByText('App state could not be loaded.')).toBeTruthy();
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
