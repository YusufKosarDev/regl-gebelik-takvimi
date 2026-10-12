import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import RecoverScreen from '@/app/(lock)/recover';
import { recoverWithAccountPassword } from '@/features/app-lock/application/recover-with-account-password';
import {
  RECOVERY_DESCRIPTION,
  RECOVERY_NO_ACCOUNT_MESSAGE,
  RECOVERY_SUBMIT_LABEL,
  RECOVERY_WRONG_ACCOUNT_MESSAGE,
} from '@/features/app-lock/presentation/app-lock-messages';
import { EMAIL_LABEL, PASSWORD_LABEL } from '@/features/auth/presentation/auth-messages';

/**
 * What the screen says when the PIN cannot be reset.
 *
 * ## The state this is about
 *
 * A lock bound to an account that was then deleted. Found on a device: the
 * lock screen offered "I forgot my PIN", this screen took an email and a
 * password, and the real credentials of the deleted account came back as
 * "that email or password is wrong". The route was offered and then refused,
 * which `(lock)/index.tsx` says in as many words is worse than not offering
 * one.
 *
 * Deleting an account now clears `boundUid`, so the outcome arrives as
 * `not-recoverable` before anything is sent anywhere. That outcome used to be
 * treated as unreachable and answered with `router.back()`.
 *
 * ## What is not claimed here
 *
 * A record still carrying a dead uid cannot be told apart from a wrong
 * password, and these tests do not pretend otherwise. `auth/invalid-credential`
 * covers both, deliberately, because email enumeration protection makes them
 * answer alike - `delete-account.ts` says so where it has the same problem.
 * The fix is that such a record is no longer produced, not that it is
 * detected.
 */

jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

jest.mock('@/features/app-lock/application/recover-with-account-password', () => ({
  recoverWithAccountPassword: jest.fn(),
}));

jest.mock('@/store/app-lock-store', () => ({
  useAppLockStore: (selector: (state: unknown) => unknown) =>
    selector({ markDisabled: jest.fn() }),
}));

const recover = jest.mocked(recoverWithAccountPassword);

beforeEach(() => {
  recover.mockReset();
});

/** Awaited throughout, like every other `fireEvent` in this project. */
async function submitCredentials() {
  const screen = await render(<RecoverScreen />);

  await fireEvent.changeText(screen.getByLabelText(EMAIL_LABEL), 'someone@example.test');
  await fireEvent.changeText(screen.getByLabelText(PASSWORD_LABEL), 'correct horse');
  await fireEvent.press(screen.getByLabelText(RECOVERY_SUBMIT_LABEL));

  return screen;
}

describe('a lock whose account no longer exists', () => {
  it('says the account is gone rather than blaming the password', async () => {
    recover.mockResolvedValue({ kind: 'not-recoverable' });

    const screen = await submitCredentials();

    await waitFor(() => {
      expect(screen.getByText(RECOVERY_NO_ACCOUNT_MESSAGE)).toBeTruthy();
    });
  });

  it('says the PIN still works, because it does', async () => {
    // The lock is on, not broken. Somebody who remembers six digits has lost
    // nothing, and a screen that only announced the bad half would send them
    // to reinstall over a PIN they could have typed.
    recover.mockResolvedValue({ kind: 'not-recoverable' });

    const screen = await submitCredentials();

    await waitFor(() => {
      expect(screen.getByText(RECOVERY_NO_ACCOUNT_MESSAGE)).toBeTruthy();
    });

    expect(RECOVERY_NO_ACCOUNT_MESSAGE).toMatch(/PIN’in hâlâ çalışıyor/);
  });

  it('takes the form away, because no password would work', async () => {
    recover.mockResolvedValue({ kind: 'not-recoverable' });

    const screen = await submitCredentials();

    await waitFor(() => {
      expect(screen.queryByLabelText(PASSWORD_LABEL)).toBeNull();
    });

    expect(screen.queryByLabelText(EMAIL_LABEL)).toBeNull();
    expect(screen.queryByLabelText(RECOVERY_SUBMIT_LABEL)).toBeNull();
    expect(screen.queryByText(RECOVERY_DESCRIPTION)).toBeNull();
  });

  it('does not leave the screen', async () => {
    // It used to call `router.back()`, which put somebody back at the keypad
    // with no explanation of why the thing they had just asked for did not
    // happen.
    recover.mockResolvedValue({ kind: 'not-recoverable' });

    const screen = await submitCredentials();

    await waitFor(() => {
      expect(screen.getByText(RECOVERY_NO_ACCOUNT_MESSAGE)).toBeTruthy();
    });
  });
});

describe('the failures this one has to stay distinct from', () => {
  it('a wrong password is still a wrong password', async () => {
    // The whole point of the new message is that it is not this one.
    recover.mockResolvedValue({ kind: 'failed', code: 'invalid-credentials' });

    const screen = await submitCredentials();

    await waitFor(() => {
      expect(screen.queryByText(RECOVERY_NO_ACCOUNT_MESSAGE)).toBeNull();
    });

    // The form stays, because here there is a password that would work.
    expect(screen.getByLabelText(PASSWORD_LABEL)).toBeTruthy();
  });

  it('somebody else’s account is still somebody else’s account', async () => {
    recover.mockResolvedValue({ kind: 'wrong-account' });

    const screen = await submitCredentials();

    await waitFor(() => {
      expect(screen.getByText(RECOVERY_WRONG_ACCOUNT_MESSAGE)).toBeTruthy();
    });

    expect(screen.queryByText(RECOVERY_NO_ACCOUNT_MESSAGE)).toBeNull();
    expect(screen.getByLabelText(PASSWORD_LABEL)).toBeTruthy();
  });
});
