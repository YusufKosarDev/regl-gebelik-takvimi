import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import LockScreen from '@/app/(lock)/index';
import {
  BIOMETRIC_FAILED_MESSAGE,
  LOCK_BIOMETRIC_RETRY_LABEL,
  LOCK_FORGOT_LABEL,
  LOCK_PROMPT,
  LOCK_WRONG_PIN_MESSAGE,
  remainingAttemptsMessage,
} from '@/features/app-lock/presentation/app-lock-messages';
import { waitMessage } from '@/features/app-lock/presentation/wait-message';
import { useAppLockStore } from '@/store/app-lock-store';

import { SafeAreaTestProvider } from '../../../../jest/safe-area-test-provider';

/**
 * The way in.
 *
 * ## Why this file exists
 *
 * This screen held **36% statement and 25% branch coverage**, and all of it came
 * from `every-screen-english.test.tsx`, which renders every screen once and
 * checks the words are English. Nothing exercised a wrong PIN, a wait, the
 * biometric sheet, the recovery link, or the two outcomes that open the app
 * without a PIN at all.
 *
 * It is the one screen standing between somebody and another person's health
 * records, and it was the least tested screen in the app. The settings-side
 * `app-lock.tsx` — which *configures* the lock — has two test files.
 *
 * The same argument `use-app-lock.test.tsx` makes for the hook under it: the
 * policy below this is pure and thoroughly tested, and nothing checked that the
 * screen asks it the right question or does the right thing with the answer.
 *
 * ## What is faked and what is not
 *
 * The three use cases and the two reads, because they reach SecureStore and the
 * biometric sensor. The store is real and reset per test, so `unlock()` being
 * called is observed as the state change it is rather than as a spy. The
 * messages are imported rather than typed out, so a reworded catalogue does not
 * read as a broken screen.
 */

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
const router = jest.requireMock('expo-router');

const unlockWithPin = pin.unlockWithPin as jest.Mock;
const unlockWithBiometrics = biometrics.unlockWithBiometrics as jest.Mock;
const isAppLockRecoverable = lockRecord.isAppLockRecoverable as jest.Mock;
const remainingLockWaitMs = lockRecord.remainingLockWaitMs as jest.Mock;
const useRouter = router.useRouter as jest.Mock;

let push: jest.Mock;

type View = Awaited<ReturnType<typeof render>>;

async function open(): Promise<View> {
  const view = await render(<LockScreen />, { wrapper: SafeAreaTestProvider });

  // The screen asks three things on arrival; let all of them land.
  await act(async () => {});

  return view;
}

async function type(view: View, digits: string): Promise<void> {
  for (const digit of digits) {
    await act(async () => {
      fireEvent.press(view.getByTestId(`pin-key-${digit}`));
    });
  }
}

const RIGHT_PIN = '123456';

beforeEach(() => {
  push = jest.fn();
  useRouter.mockReset();
  useRouter.mockReturnValue({ push, back: jest.fn(), replace: jest.fn() });

  unlockWithPin.mockReset();
  unlockWithPin.mockResolvedValue({ kind: 'unlocked' });

  unlockWithBiometrics.mockReset();
  // Dismissed by default, which is the state that leaves the pad in charge.
  unlockWithBiometrics.mockResolvedValue({ kind: 'cancelled' });

  isAppLockRecoverable.mockReset();
  isAppLockRecoverable.mockResolvedValue(false);

  remainingLockWaitMs.mockReset();
  remainingLockWaitMs.mockResolvedValue(0);

  useAppLockStore.setState({
    enabled: true,
    locked: true,
    hydrated: true,
    unreadable: false,
  });
});

describe('what the lock screen says before anything is typed', () => {
  it('asks for the PIN and shows nothing about the cycle', async () => {
    const view = await open();

    expect(view.getByText(LOCK_PROMPT)).toBeTruthy();
    expect(view.getByTestId('pin-pad')).toBeTruthy();
    expect(view.getByTestId('pin-dots')).toBeTruthy();
  });

  it('says nothing about a wrong PIN nobody has entered', async () => {
    const view = await open();

    expect(view.queryByText(LOCK_WRONG_PIN_MESSAGE)).toBeNull();
  });
});

describe('a correct PIN', () => {
  it('opens the app', async () => {
    const view = await open();

    await type(view, RIGHT_PIN);

    expect(unlockWithPin).toHaveBeenCalledWith(RIGHT_PIN);
    expect(useAppLockStore.getState().locked).toBe(false);
  });

  it('refuses the pad while a check is in flight, so no second one starts', async () => {
    const view = await open();

    // Held open, so the whole test happens during the one check.
    let answer!: (outcome: { kind: string }) => void;
    unlockWithPin.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      })
    );

    await type(view, RIGHT_PIN);

    expect(view.getByTestId('pin-key-1').props.accessibilityState.disabled).toBe(true);

    // More keys while it is refused. The guarantee asserted here is the pad's
    // state, not a reentrancy flag: with the keys disabled, `onPress` never
    // runs, so a second check cannot be started from the pad at all.
    await type(view, '1');

    expect(unlockWithPin).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer({ kind: 'unlocked' });
    });
  });
});

describe('a wrong PIN', () => {
  it('says so, and stays locked', async () => {
    unlockWithPin.mockResolvedValue({
      kind: 'wrong',
      attempts: { failedAttempts: 1, lockedUntil: null },
    });

    const view = await open();

    await type(view, RIGHT_PIN);

    expect(view.getByText(LOCK_WRONG_PIN_MESSAGE)).toBeTruthy();
    expect(useAppLockStore.getState().locked).toBe(true);
  });

  it('keeps the count to itself while there are plenty of tries left', async () => {
    unlockWithPin.mockResolvedValue({
      kind: 'wrong',
      attempts: { failedAttempts: 1, lockedUntil: null },
    });

    const view = await open();

    await type(view, RIGHT_PIN);

    // Four left. Telling somebody that is noise, not help.
    expect(view.queryByText(new RegExp(remainingAttemptsMessage(4)))).toBeNull();
  });

  it('says how many are left once they are nearly gone', async () => {
    unlockWithPin.mockResolvedValue({
      kind: 'wrong',
      attempts: { failedAttempts: 4, lockedUntil: null },
    });

    const view = await open();

    await type(view, RIGHT_PIN);

    expect(view.getByText(new RegExp(remainingAttemptsMessage(1)))).toBeTruthy();
  });

  it('clears what was typed, so the next try starts empty', async () => {
    unlockWithPin.mockResolvedValue({
      kind: 'wrong',
      attempts: { failedAttempts: 1, lockedUntil: null },
    });

    const view = await open();

    await type(view, RIGHT_PIN);

    await type(view, '1');

    // One digit in, not seven: the pad counts from empty again.
    expect(unlockWithPin).toHaveBeenCalledTimes(1);
  });
});

describe('a wait', () => {
  it('shows the wait and refuses the pad', async () => {
    unlockWithPin.mockResolvedValue({ kind: 'waiting', remainingMs: 30_000 });

    const view = await open();

    await type(view, RIGHT_PIN);

    expect(view.getByText(waitMessage(30_000))).toBeTruthy();
    expect(view.getByTestId('pin-key-1').props.accessibilityState.disabled).toBe(true);
  });

  it('shows a wait that outlived a restart, without spending six digits to find out', async () => {
    remainingLockWaitMs.mockResolvedValue(90_000);

    const view = await open();

    expect(view.getByText(waitMessage(90_000))).toBeTruthy();
    expect(unlockWithPin).not.toHaveBeenCalled();
  });

  it('starts the wait from the stored deadline when a wrong PIN began one', async () => {
    const lockedUntil = Date.now() + 60_000;

    unlockWithPin.mockResolvedValue({
      kind: 'wrong',
      attempts: { failedAttempts: 6, lockedUntil },
    });

    const view = await open();

    await type(view, RIGHT_PIN);

    // Rounded up by `waitMessageIn`, so a shade under a minute still reads as
    // one minute rather than as fifty-nine seconds of arithmetic.
    expect(view.getByText(waitMessage(60_000))).toBeTruthy();
  });
});

describe('a lock record that has gone', () => {
  it.each(['no-lock', 'unreadable'] as const)('opens the app for %s', async (kind) => {
    unlockWithPin.mockResolvedValue({ kind });

    const view = await open();

    await type(view, RIGHT_PIN);

    // There is nothing left to ask for. Staying shut would be a lock with no
    // key, over records that are still here.
    expect(useAppLockStore.getState().locked).toBe(false);
  });
});

describe('the fingerprint', () => {
  it('opens the app when the sensor is satisfied on arrival', async () => {
    unlockWithBiometrics.mockResolvedValue({ kind: 'unlocked' });

    await open();

    expect(useAppLockStore.getState().locked).toBe(false);
  });

  it('offers the sheet again after it was dismissed, and says nothing', async () => {
    const view = await open();

    expect(view.getByLabelText(LOCK_BIOMETRIC_RETRY_LABEL)).toBeTruthy();
    // Dismissing is a decision. "Not recognised" would report an event that
    // did not happen.
    expect(view.queryByText(BIOMETRIC_FAILED_MESSAGE)).toBeNull();
  });

  it('explains a rejection, and keeps the button', async () => {
    unlockWithBiometrics.mockResolvedValue({ kind: 'failed' });

    const view = await open();

    expect(view.getByText(BIOMETRIC_FAILED_MESSAGE)).toBeTruthy();
    expect(view.getByLabelText(LOCK_BIOMETRIC_RETRY_LABEL)).toBeTruthy();
  });

  it('tries again when the button is pressed', async () => {
    const view = await open();

    expect(unlockWithBiometrics).toHaveBeenCalledTimes(1);

    unlockWithBiometrics.mockResolvedValue({ kind: 'unlocked' });

    await act(async () => {
      fireEvent.press(view.getByLabelText(LOCK_BIOMETRIC_RETRY_LABEL));
    });

    expect(unlockWithBiometrics).toHaveBeenCalledTimes(2);
    expect(useAppLockStore.getState().locked).toBe(false);
  });

  it('shows a wait the sensor ran into', async () => {
    unlockWithBiometrics.mockResolvedValue({ kind: 'waiting', remainingMs: 30_000 });

    const view = await open();

    expect(view.getByText(waitMessage(30_000))).toBeTruthy();
    expect(view.queryByLabelText(LOCK_BIOMETRIC_RETRY_LABEL)).toBeNull();
  });

  it('is not offered where the device cannot do it', async () => {
    unlockWithBiometrics.mockResolvedValue({ kind: 'unavailable' });

    const view = await open();

    expect(view.queryByLabelText(LOCK_BIOMETRIC_RETRY_LABEL)).toBeNull();
    expect(view.queryByText(BIOMETRIC_FAILED_MESSAGE)).toBeNull();
  });
});

describe('the way out for somebody who has forgotten the PIN', () => {
  it('is offered when an account can reset the lock', async () => {
    isAppLockRecoverable.mockResolvedValue(true);

    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText(LOCK_FORGOT_LABEL));
    });

    expect(push).toHaveBeenCalledWith('/(lock)/recover');
  });

  it('is not offered for a lock no account can reset', async () => {
    const view = await open();

    // Offering a route and then refusing it is worse than not offering one.
    expect(view.queryByLabelText(LOCK_FORGOT_LABEL)).toBeNull();
  });

  it('stays available part-way through a wait', async () => {
    isAppLockRecoverable.mockResolvedValue(true);
    remainingLockWaitMs.mockResolvedValue(30_000);

    const view = await open();

    // A delay must never trap somebody out of their own records.
    await waitFor(() => {
      expect(view.getByLabelText(LOCK_FORGOT_LABEL)).toBeTruthy();
    });
  });
});
