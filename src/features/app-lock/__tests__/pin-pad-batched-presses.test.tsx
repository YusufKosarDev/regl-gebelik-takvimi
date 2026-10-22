import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import AppLockScreen from '@/app/(app)/app-lock';
import LockScreen from '@/app/(lock)/index';
import { appLockMessages } from '@/features/app-lock/presentation/app-lock-messages';
import { useAppLockStore } from '@/store/app-lock-store';

import { SafeAreaTestProvider } from '../../../../jest/safe-area-test-provider';

/**
 * Two key presses that land in one render.
 *
 * ## The gap this holds
 *
 * Both pads work the next value out in the handler body and hand `setEntered` a
 * plain value. That is deliberate and documented: the branch used to live inside
 * a `setEntered` updater, React may replay an updater, and a replay meant two
 * `unlockWithPin` calls for one wrong PIN — a second failed attempt out of the
 * five free ones. The side effects belong in the body.
 *
 * What the plain value cannot survive is two handlers running before the next
 * render. React batches updates made in the same tick, so both read the same
 * `entered` from the same closure: the second press overwrites the first
 * instead of extending it. A sixth digit is swallowed and the PIN is never
 * submitted; a delete followed by a digit is silently undone and the PIN
 * submitted is not the one on screen.
 *
 * The dependency array does not reach this. It gives each **render** a fresh
 * closure, and this is two calls inside one.
 *
 * So the value is mirrored in a ref, read in the body and written beside the
 * state. Purity is kept — no updater, no side effect in one — and a batch sees
 * the latest value.
 *
 * ## Why a test and not a comment
 *
 * The failure is silent in exactly the way the lock cannot afford: nothing
 * throws, nothing logs, the dots simply stop at five, or the wrong six digits
 * are sent. On the lock screen that costs a failed attempt out of five.
 */

jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(async () => ({}) as unknown),
}));

jest.mock('@/features/app-lock/application/unlock-with-pin', () => ({
  unlockWithPin: jest.fn(async () => ({ kind: 'unlocked' })),
}));

jest.mock('@/features/app-lock/application/unlock-with-biometrics', () => ({
  unlockWithBiometrics: jest.fn(async () => ({ kind: 'cancelled' })),
}));

jest.mock('@/features/app-lock/application/remove-app-lock', () => ({
  removeAppLock: jest.fn(async () => undefined),
  isAppLockRecoverable: jest.fn(async () => false),
  remainingLockWaitMs: jest.fn(async () => 0),
}));

jest.mock('@/features/app-lock/application/set-app-lock', () => ({
  setAppLock: jest.fn(async () => undefined),
}));

jest.mock('@/features/notifications/application/set-discreet-notifications', () => ({
  setDiscreetNotifications: jest.fn(async () => true),
}));

jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshotQuietly: jest.fn(async () => null),
}));

jest.mock('@/features/app-lock/infrastructure/biometrics', () => ({
  canUseBiometrics: jest.fn(async () => false),
}));

jest.mock('@/features/app-lock/infrastructure/screen-privacy', () => ({
  blocksScreenshots: jest.fn(() => false),
  applyScreenPrivacy: jest.fn(async () => undefined),
  isScreenPrivacyAvailable: jest.fn(() => false),
}));

jest.mock('@/features/sync/application/use-automatic-sync', () => ({
  currentUidOrNull: jest.fn(() => 'uid-1'),
  useAutomaticSync: jest.fn(),
}));

const pin = jest.requireMock('@/features/app-lock/application/unlock-with-pin');
const unlockWithPin = pin.unlockWithPin as jest.Mock;

type View = Awaited<ReturnType<typeof render>>;

/** One press per tick, which is what a person's thumb does. */
async function press(view: View, keys: string): Promise<void> {
  for (const key of keys) {
    await act(async () => {
      fireEvent.press(view.getByTestId(`pin-key-${key}`));
    });
  }
}

/**
 * Several presses inside one tick, which is what two thumbs do.
 *
 * React batches updates made in the same synchronous block, so these handlers
 * all run against the render that was current when the block started — the
 * situation the ref exists for.
 */
async function pressTogether(view: View, keys: readonly string[]): Promise<void> {
  await act(async () => {
    for (const key of keys) {
      fireEvent.press(view.getByTestId(`pin-key-${key}`));
    }
  });
}

beforeEach(() => {
  unlockWithPin.mockClear();
  unlockWithPin.mockResolvedValue({ kind: 'unlocked' });

  useAppLockStore.setState({ enabled: true, locked: true, hydrated: true, unreadable: false });
});

describe('the lock screen pad', () => {
  async function open(): Promise<View> {
    const view = await render(<LockScreen />, { wrapper: SafeAreaTestProvider });

    await act(async () => {});

    return view;
  }

  it('submits all six digits when the last two arrive together', async () => {
    const view = await open();

    await press(view, '1234');
    await pressTogether(view, ['5', '6']);

    expect(unlockWithPin).toHaveBeenCalledWith('123456');
  });

  it('keeps a delete that arrives with the next digit', async () => {
    const view = await open();

    await press(view, '12345');

    // Corrected the fifth digit and typed the replacement in the same moment:
    // the PIN is 1234 then 9, and the sixth key completes it.
    await pressTogether(view, ['delete', '9']);
    await press(view, '0');

    expect(unlockWithPin).toHaveBeenCalledWith('123490');
  });
});

describe('the setup pad', () => {
  beforeEach(() => {
    // No lock yet, so the screen opens on choosing a PIN rather than on removal.
    useAppLockStore.setState({ enabled: false, locked: false, hydrated: true, unreadable: false });
  });

  async function open(): Promise<View> {
    const view = await render(<AppLockScreen />);

    await act(async () => {});

    return view;
  }

  it('reaches the confirm step when the last two digits arrive together', async () => {
    const view = await open();

    await press(view, '1357');
    await pressTogether(view, ['9', '0']);

    expect(view.getByText(appLockMessages.tr.setupConfirmPin)).toBeTruthy();
  });
});
