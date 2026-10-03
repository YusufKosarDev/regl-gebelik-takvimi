import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import RootLayout from '@/app/_layout';
import { useAppLockStore } from '@/store/app-lock-store';
import { useAppStore } from '@/store/app-store';

import { expectNoTurkishCatalogueText } from '../../../jest/assert-english-render';

/**
 * The startup gate on an English phone.
 *
 * ## Why this file exists
 *
 * The hydration error read `App state could not be loaded.` - a hardcoded
 * English sentence on a Turkish-first app, with no catalogue entry behind it.
 * The lint rule could not see it, because that rule looks for Turkish outside
 * the catalogues and this was the opposite mistake. The test beside this one
 * asserted the English string outright, so the bug had a test holding it in
 * place rather than catching it.
 *
 * It is also the one screen in the app somebody cannot navigate away from: by
 * the time it shows, nothing has started.
 *
 * The sweep at the end is the part that generalises. `expectNoTurkishCatalogueText`
 * knows every Turkish string in the app, so this catches the next leak on this
 * screen whether or not anybody thinks to assert it.
 *
 * The device is overridden here rather than globally, the escape hatch
 * `jest/expo-localization-mock.js` documents. The mocks are copied from
 * `root-layout.test.tsx` beside it, which stays Turkish by design.
 */

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }],
  getCalendars: () => [{ calendar: 'gregory', uses24hourClock: true, firstWeekday: 2 }],
}));

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

jest.mock('@/features/sync/application/use-automatic-sync', () => ({
  useAutomaticSync: jest.fn(),
}));

beforeEach(() => {
  useAppLockStore.setState({
    enabled: false,
    locked: false,
    hydrated: true,
    hydrate: jest.fn().mockResolvedValue(undefined) as unknown as () => Promise<void>,
  });
});

describe('the startup gate in English', () => {
  it('explains a failed start in English', async () => {
    useAppStore.setState({
      mode: 'cycle',
      onboardingCompleted: false,
      hydrated: false,
      hydrate: jest
        .fn()
        .mockRejectedValue(new Error('storage unavailable')) as unknown as () => Promise<void>,
    });

    const screen = await render(<RootLayout />);

    // The sentence a person actually needs here is that nothing was lost, and
    // it has to arrive in a language they read.
    expect(
      await screen.findByText(
        'The app could not start. Your records are still on this phone. Nothing was deleted.'
      )
    ).toBeTruthy();

    expectNoTurkishCatalogueText(screen);
  });

  it('shows nothing to read while it is still starting', async () => {
    // The other side of the same screen: the loading state is a spinner with no
    // words, so there is nothing here that could be in the wrong language. This
    // says so, rather than leaving the gap for somebody to fill with a
    // hardcoded sentence later.
    useAppStore.setState({
      mode: 'cycle',
      onboardingCompleted: false,
      hydrated: false,
      hydrate: jest.fn().mockReturnValue(new Promise(() => {})) as unknown as () => Promise<void>,
    });

    const screen = await render(<RootLayout />);

    expect(screen.getByTestId('app-hydration-loading')).toBeTruthy();

    expectNoTurkishCatalogueText(screen);
  });
});
