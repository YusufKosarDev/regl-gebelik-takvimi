import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import LockScreen from '@/app/(lock)/index';
import { appLockMessages } from '@/features/app-lock/presentation/app-lock-messages';
import { waitMessageIn } from '@/features/app-lock/presentation/wait-message';
import { useAppLockStore } from '@/store/app-lock-store';

import { expectNoTurkishCatalogueText } from '../../../../jest/assert-english-render';
import { SafeAreaTestProvider } from '../../../../jest/safe-area-test-provider';

/**
 * The lock screen on an English phone, with a wait running.
 *
 * ## Why this file exists, and what it caught
 *
 * `lock-screen.test.tsx` beside it asserts Turkish, as most of this repository
 * does. This one says the device is English and then puts the screen into the
 * one state the English sweep cannot reach: a wait.
 *
 * `every-screen-english.test.tsx` renders this screen, but only as it arrives —
 * no PIN entered, no wait running — so it never saw the wait sentence. And the
 * wait sentence was the one piece of text on the screen built with
 * `waitMessage(…)`, the Turkish-only wrapper kept for assertions, instead of
 * `waitMessageIn(lock, …)`. All five places a wait can begin used it. So every
 * wait on the lock screen read in Turkish however the app was set, on a screen
 * whose whole job is to be understood by whoever is holding the phone.
 *
 * The setup screen next door has always gone through the catalogue. This is the
 * test that would have noticed the difference.
 */

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }],
  getCalendars: () => [{ calendar: 'gregory', uses24hourClock: true, firstWeekday: 2 }],
}));

jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

jest.mock('@/features/app-lock/application/unlock-with-pin', () => ({
  unlockWithPin: jest.fn(),
}));

jest.mock('@/features/app-lock/application/unlock-with-biometrics', () => ({
  unlockWithBiometrics: jest.fn(),
}));

jest.mock('@/features/app-lock/application/remove-app-lock', () => ({
  isAppLockRecoverable: jest.fn(),
  remainingLockWaitMs: jest.fn(),
}));

const pin = jest.requireMock('@/features/app-lock/application/unlock-with-pin');
const biometrics = jest.requireMock('@/features/app-lock/application/unlock-with-biometrics');
const lockRecord = jest.requireMock('@/features/app-lock/application/remove-app-lock');
const routerModule = jest.requireMock('expo-router');

const unlockWithPin = pin.unlockWithPin as jest.Mock;
const unlockWithBiometrics = biometrics.unlockWithBiometrics as jest.Mock;
const isAppLockRecoverable = lockRecord.isAppLockRecoverable as jest.Mock;
const remainingLockWaitMs = lockRecord.remainingLockWaitMs as jest.Mock;
const useRouter = routerModule.useRouter as jest.Mock;

const english = appLockMessages.en;

type View = Awaited<ReturnType<typeof render>>;

async function open(): Promise<View> {
  const view = await render(<LockScreen />, { wrapper: SafeAreaTestProvider });

  await act(async () => {});

  return view;
}

beforeEach(() => {
  useRouter.mockReset();
  useRouter.mockReturnValue({ push: jest.fn(), back: jest.fn(), replace: jest.fn() });

  unlockWithPin.mockReset();
  unlockWithPin.mockResolvedValue({ kind: 'unlocked' });

  unlockWithBiometrics.mockReset();
  unlockWithBiometrics.mockResolvedValue({ kind: 'cancelled' });

  isAppLockRecoverable.mockReset();
  isAppLockRecoverable.mockResolvedValue(true);

  remainingLockWaitMs.mockReset();
  remainingLockWaitMs.mockResolvedValue(0);

  useAppLockStore.setState({
    enabled: true,
    locked: true,
    hydrated: true,
    unreadable: false,
  });
});

describe('the lock screen in English', () => {
  it('asks for the PIN in English', async () => {
    const view = await open();

    expect(view.getByText(english.lockPrompt)).toBeTruthy();
    expectNoTurkishCatalogueText(view);
  });

  it('says a wait that outlived a restart in English', async () => {
    remainingLockWaitMs.mockResolvedValue(90_000);

    const view = await open();

    expect(view.getByText(waitMessageIn(english, 90_000))).toBeTruthy();
    expectNoTurkishCatalogueText(view);
  });

  it('says a wait a wrong PIN began in English', async () => {
    unlockWithPin.mockResolvedValue({ kind: 'waiting', remainingMs: 30_000 });

    const view = await open();

    for (const digit of '123456') {
      await act(async () => {
        fireEvent.press(view.getByTestId(`pin-key-${digit}`));
      });
    }

    expect(view.getByText(waitMessageIn(english, 30_000))).toBeTruthy();
    expectNoTurkishCatalogueText(view);
  });

  it('says a wait the fingerprint ran into in English', async () => {
    unlockWithBiometrics.mockResolvedValue({ kind: 'waiting', remainingMs: 300_000 });

    const view = await open();

    expect(view.getByText(waitMessageIn(english, 300_000))).toBeTruthy();
    expectNoTurkishCatalogueText(view);
  });

  it('says a wrong PIN and what is left of the tries in English', async () => {
    unlockWithPin.mockResolvedValue({
      kind: 'wrong',
      attempts: { failedAttempts: 4, lockedUntil: null },
    });

    const view = await open();

    for (const digit of '123456') {
      await act(async () => {
        fireEvent.press(view.getByTestId(`pin-key-${digit}`));
      });
    }

    expect(view.getByText(new RegExp(english.remainingAttemptsMessage(1)))).toBeTruthy();
    expectNoTurkishCatalogueText(view);
  });
});
