import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import AppLockScreen from '@/app/(app)/app-lock';
import {
  SETUP_DISCREET_NOTIFICATIONS_NOTE,
  SETUP_WIDGET_NOTE,
} from '@/features/app-lock/presentation/app-lock-messages';
import { useAppLockStore } from '@/store/app-lock-store';

/**
 * Setting a lock also switches the reminders to their quiet wording.
 *
 * ## Why this has a test of its own
 *
 * It is the one thing this screen does outside itself. Somebody enabling the
 * lock has said their phone can end up in another pair of hands, and a reminder
 * that then prints "Tahminine göre regl dönemin yaklaşıyor" on the lock screen
 * walks straight past the lock they just set. Android does not let an app hide
 * that text — only reword it — so this coupling is the whole protection.
 *
 * It is also invisible. Nothing on this screen shows it working, which is
 * exactly the shape of a thing that quietly stops happening during a refactor.
 *
 * The file is deliberately narrow: the PIN pad, the account warning and the
 * removal flow are not retested here.
 */

jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(async () => ({}) as unknown),
}));

jest.mock('@/features/app-lock/application/set-app-lock', () => ({
  setAppLock: jest.fn(async () => undefined),
}));

jest.mock('@/features/app-lock/application/remove-app-lock', () => ({
  removeAppLock: jest.fn(async () => undefined),
}));

jest.mock('@/features/notifications/application/set-discreet-notifications', () => ({
  setDiscreetNotifications: jest.fn(async () => true),
}));

// No fingerprint enrolled, so the biometric row settles as unavailable and the
// PIN is the only path. Keeps this file about the notification coupling.
jest.mock('@/features/app-lock/infrastructure/biometrics', () => ({
  canUseBiometrics: jest.fn(async () => false),
}));

jest.mock('@/features/app-lock/infrastructure/screen-privacy', () => ({
  blocksScreenshots: jest.fn(() => false),
  applyScreenPrivacy: jest.fn(async () => undefined),
  isScreenPrivacyAvailable: jest.fn(() => false),
}));

// Signed in, so the screen opens straight on the PIN step rather than on the
// account-less warning.
jest.mock('@/features/sync/application/use-automatic-sync', () => ({
  currentUidOrNull: jest.fn(() => 'uid-1'),
  useAutomaticSync: jest.fn(),
}));

const lockStore = jest.requireMock('@/features/app-lock/application/set-app-lock');
const discreet = jest.requireMock(
  '@/features/notifications/application/set-discreet-notifications'
);

/**
 * What `render` hands back here.
 *
 * Taken from the function rather than imported by name: under this setup it is
 * awaited, and the exported type has changed name between versions.
 */
type View = Awaited<ReturnType<typeof render>>;

const PIN = '135790';

beforeEach(() => {
  // The store is real and module-level, so a test that sets the lock leaves the
  // next one opening on the removal step instead of the pad.
  useAppLockStore.setState({ enabled: false, locked: false, hydrated: true, unreadable: false });

  lockStore.setAppLock.mockClear();
  lockStore.setAppLock.mockResolvedValue(undefined);
  discreet.setDiscreetNotifications.mockClear();
  discreet.setDiscreetNotifications.mockResolvedValue(true);
});

/** Types a six-digit PIN on the pad. */
async function typePin(view: View, pin: string): Promise<void> {
  for (const digit of pin) {
    await act(async () => {
      fireEvent.press(view.getByTestId(`pin-key-${digit}`));
    });
  }
}

/** Opens the screen and lets the biometric availability check settle. */
async function open(): Promise<View> {
  const view = await render(<AppLockScreen />);

  await act(async () => {});

  return view;
}

/** Chooses a PIN and confirms it, which is what saves the lock. */
async function setUpLock(pin = PIN): Promise<View> {
  const view = await open();

  await typePin(view, pin);
  await typePin(view, pin);

  return view;
}

describe('setting the lock', () => {
  it('turns the discreet wording on', async () => {
    await setUpLock();

    expect(discreet.setDiscreetNotifications).toHaveBeenCalledTimes(1);
    expect(discreet.setDiscreetNotifications.mock.calls[0][1]).toBe(true);
  });

  it('does it only after the lock itself is stored', async () => {
    // The lock is what the person asked for. Rewording reminders for a lock
    // that failed to save would leave the phone quieter about a protection it
    // does not have.
    const order: string[] = [];

    lockStore.setAppLock.mockImplementation(async () => {
      order.push('lock');
    });
    discreet.setDiscreetNotifications.mockImplementation(async () => {
      order.push('discreet');

      return true;
    });

    await setUpLock();

    expect(order).toEqual(['lock', 'discreet']);
  });

  it('does not reword anything when the lock could not be saved', async () => {
    lockStore.setAppLock.mockRejectedValue(new Error('keystore is unavailable'));

    await setUpLock();

    expect(discreet.setDiscreetNotifications).not.toHaveBeenCalled();
  });

  /**
   * A reminder queue that could not be rebuilt must not undo the lock.
   *
   * The lock is stored and durable by this point, and it is the thing somebody
   * pressed six keys twice to get. Failing the setup over the notification
   * wording would throw away what worked because of what did not.
   */
  it('still sets the lock when the rewording fails', async () => {
    discreet.setDiscreetNotifications.mockRejectedValue(new Error('disk is full'));

    await setUpLock();

    expect(lockStore.setAppLock).toHaveBeenCalledTimes(1);
  });

  it('nothing is reworded before both PINs match', async () => {
    const view = await open();

    await typePin(view, PIN);

    expect(discreet.setDiscreetNotifications).not.toHaveBeenCalled();
  });

  it('nor when the second PIN is a different one', async () => {
    const view = await open();

    await typePin(view, PIN);
    await typePin(view, '246801');

    expect(lockStore.setAppLock).not.toHaveBeenCalled();
    expect(discreet.setDiscreetNotifications).not.toHaveBeenCalled();
  });
});

describe('what the setup screen says about it', () => {
  it('says the notifications change, before the PIN is chosen', async () => {
    const view = await open();

    expect(view.getByText(SETUP_DISCREET_NOTIFICATIONS_NOTE)).toBeTruthy();
  });

  it('says it beside the widget note, which is the same kind of thing', async () => {
    const view = await open();

    expect(view.getByText(SETUP_WIDGET_NOTE)).toBeTruthy();
    expect(view.getByText(SETUP_DISCREET_NOTIFICATIONS_NOTE)).toBeTruthy();
  });
});
