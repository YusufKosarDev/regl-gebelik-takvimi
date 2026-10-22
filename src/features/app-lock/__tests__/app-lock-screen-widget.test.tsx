import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import AppLockScreen from '@/app/(app)/app-lock';
import { appLockMessages } from '@/features/app-lock/presentation/app-lock-messages';
import { useAppLockStore } from '@/store/app-lock-store';

/**
 * Setting a lock empties the home screen widget, and removing it fills it again.
 *
 * ## Why this has a test of its own
 *
 * The setup screen promises it in both languages — `setupWidgetNote`: "Kilit
 * açıldığında ana ekran widget'ı boşalır" — and a widget is not locked. Anybody
 * who picks up the phone reads what it shows, which is exactly the person the
 * lock exists to stop, so a lock with a live widget beside it is decoration.
 *
 * `syncWidgetSnapshot` has always refused to write while the lock is on. What
 * was missing is anybody calling it at the moment the lock goes on: the home
 * screen syncs once per session and the setup screen did not sync at all, so
 * the card kept showing the cycle day until the next cold start happened to
 * clear it. The promise was made on this screen and kept somewhere else, later.
 *
 * It is also invisible from here — nothing on this screen shows it working —
 * which is the shape of a thing that quietly stops happening in a refactor.
 * Same reason `app-lock-screen-notifications.test.tsx` exists beside it.
 *
 * The file is deliberately narrow: the PIN pad, the account warning and the
 * notification coupling are not retested here.
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

jest.mock('@/features/app-lock/application/unlock-with-pin', () => ({
  unlockWithPin: jest.fn(async () => ({ kind: 'unlocked' })),
}));

jest.mock('@/features/notifications/application/set-discreet-notifications', () => ({
  setDiscreetNotifications: jest.fn(async () => true),
}));

jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshotQuietly: jest.fn(async () => null),
}));

// No fingerprint enrolled, so the biometric row settles as unavailable and the
// PIN is the only path.
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
const removal = jest.requireMock('@/features/app-lock/application/remove-app-lock');
const unlock = jest.requireMock('@/features/app-lock/application/unlock-with-pin');
const discreet = jest.requireMock(
  '@/features/notifications/application/set-discreet-notifications'
);
const widget = jest.requireMock('@/features/widget/application/sync-widget-snapshot');

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
  removal.removeAppLock.mockClear();
  removal.removeAppLock.mockResolvedValue(undefined);
  unlock.unlockWithPin.mockClear();
  unlock.unlockWithPin.mockResolvedValue({ kind: 'unlocked' });
  discreet.setDiscreetNotifications.mockClear();
  discreet.setDiscreetNotifications.mockResolvedValue(true);
  widget.syncWidgetSnapshotQuietly.mockClear();
  widget.syncWidgetSnapshotQuietly.mockResolvedValue(null);
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

/**
 * Takes an existing lock off: asks to remove it, then proves the current PIN.
 *
 * Two steps because the screen makes them two. The button only moves to the
 * pad; `unlockWithPin` is what decides, and `handleRemove` runs from there.
 */
async function removeLock(pin = PIN): Promise<View> {
  const view = await open();

  await act(async () => {
    fireEvent.press(view.getByLabelText(appLockMessages.tr.removeLockLabel));
  });

  await typePin(view, pin);

  return view;
}

describe('setting the lock', () => {
  /**
   * One call, not a `clearWidgetSnapshot` of its own.
   *
   * `syncWidgetSnapshot` is the one place that decides what a snapshot should
   * be, and it already reads the lock. Calling it here means the setup screen
   * states an intention — "the widget should match the world now" — rather
   * than carrying a second copy of the rule that the lock wins.
   */
  it('brings the widget in line, which empties it', async () => {
    await setUpLock();

    expect(widget.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
  });

  it('does it only after the lock itself is stored', async () => {
    // A widget emptied for a lock that failed to save would be a card gone
    // blank with nothing protecting anything.
    const order: string[] = [];

    lockStore.setAppLock.mockImplementation(async () => {
      order.push('lock');
    });
    widget.syncWidgetSnapshotQuietly.mockImplementation(async () => {
      order.push('widget');

      return null;
    });

    await setUpLock();

    expect(order).toEqual(['lock', 'widget']);
  });

  it('leaves the widget alone when the lock could not be saved', async () => {
    lockStore.setAppLock.mockRejectedValue(new Error('keystore is unavailable'));

    await setUpLock();

    expect(widget.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });

  /**
   * The widget is a copy. The lock is not.
   *
   * By this point the record is stored and the phone is locked. Failing the
   * setup because a home screen card could not be rewritten would throw away
   * the protection somebody pressed twelve keys to get.
   */
  it('still sets the lock when the widget could not be reached', async () => {
    widget.syncWidgetSnapshotQuietly.mockRejectedValue(new Error('no widget bridge'));

    await setUpLock();

    expect(lockStore.setAppLock).toHaveBeenCalledTimes(1);
  });

  /**
   * The reminders and the widget are two leaks, not one.
   *
   * They are independent: a reminder queue that could not be rebuilt must not
   * leave the widget showing the cycle day, and vice versa. Sharing one `try`
   * would make whichever ran second depend on the first.
   */
  it('empties the widget even when the rewording fails', async () => {
    discreet.setDiscreetNotifications.mockRejectedValue(new Error('disk is full'));

    await setUpLock();

    expect(widget.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
  });

  it('nothing touches the widget before both PINs match', async () => {
    const view = await open();

    await typePin(view, PIN);

    expect(widget.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });
});

describe('removing the lock', () => {
  beforeEach(() => {
    // A lock is already set, which is what opens this screen on the step that
    // asks for the current PIN before taking it off.
    useAppLockStore.setState({ enabled: true, locked: false, hydrated: true, unreadable: false });
  });

  /**
   * The other direction of the same gap.
   *
   * Without this the card stays blank after the lock comes off — until the next
   * cold start, or the next write, happens to fill it. Somebody who turned the
   * lock off to get their widget back would conclude the widget is broken.
   */
  it('fills the widget again', async () => {
    await removeLock();

    expect(removal.removeAppLock).toHaveBeenCalledTimes(1);
    expect(widget.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
  });

  it('does it only after the lock is actually off', async () => {
    const order: string[] = [];

    removal.removeAppLock.mockImplementation(async () => {
      order.push('removal');
    });
    widget.syncWidgetSnapshotQuietly.mockImplementation(async () => {
      order.push('widget');

      return null;
    });

    await removeLock();

    expect(order).toEqual(['removal', 'widget']);
  });

  it('leaves the widget alone when the lock could not be removed', async () => {
    removal.removeAppLock.mockRejectedValue(new Error('keystore is unavailable'));

    await removeLock();

    expect(widget.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });

  it('still removes the lock when the widget could not be reached', async () => {
    widget.syncWidgetSnapshotQuietly.mockRejectedValue(new Error('no widget bridge'));

    await removeLock();

    expect(removal.removeAppLock).toHaveBeenCalledTimes(1);
  });
});
