import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import AppLockScreen from '@/app/(app)/app-lock';
import { useAppLockStore } from '@/store/app-lock-store';

/**
 * Removing or changing the lock proves the current PIN first.
 *
 * The lock's whole point is that holding the phone is not enough. Until this
 * step existed, the management screen removed the lock on one tap and wrote a
 * new PIN without asking for the old one — so anybody holding the unlocked
 * phone for a moment could lock the owner out, or quietly take the lock off.
 *
 * The check goes through `unlockWithPin`, deliberately: the same counters,
 * the same waits. A wrong guess here costs what it costs on the lock screen.
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
  unlockWithPin: jest.fn(),
}));

jest.mock('@/features/notifications/application/set-discreet-notifications', () => ({
  setDiscreetNotifications: jest.fn(async () => true),
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

const setLock = jest.requireMock('@/features/app-lock/application/set-app-lock');
const removal = jest.requireMock('@/features/app-lock/application/remove-app-lock');
const unlock = jest.requireMock('@/features/app-lock/application/unlock-with-pin');

type View = Awaited<ReturnType<typeof render>>;

const PIN = '135790';
const VERIFY_TITLE = "Önce mevcut PIN'ini gir";

beforeEach(() => {
  // Enabled, so the screen opens on the management step.
  useAppLockStore.setState({ enabled: true, locked: false, hydrated: true, unreadable: false });

  setLock.setAppLock.mockClear();
  setLock.setAppLock.mockResolvedValue(undefined);
  removal.removeAppLock.mockClear();
  removal.removeAppLock.mockResolvedValue(undefined);
  unlock.unlockWithPin.mockReset();
  unlock.unlockWithPin.mockResolvedValue({ kind: 'unlocked' });
});

async function typePin(view: View, pin: string): Promise<void> {
  for (const digit of pin) {
    await act(async () => {
      fireEvent.press(view.getByTestId(`pin-key-${digit}`));
    });
  }
}

async function open(): Promise<View> {
  const view = await render(<AppLockScreen />);

  await act(async () => {});

  return view;
}

describe('removing the lock', () => {
  it('asks for the current PIN instead of removing on one tap', async () => {
    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText('Kilidi kaldır'));
    });

    expect(removal.removeAppLock).not.toHaveBeenCalled();
    expect(view.getByText(VERIFY_TITLE)).toBeTruthy();
  });

  it('removes it once the right PIN is given', async () => {
    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText('Kilidi kaldır'));
    });
    await typePin(view, PIN);

    expect(unlock.unlockWithPin).toHaveBeenCalledWith(PIN);
    expect(removal.removeAppLock).toHaveBeenCalledTimes(1);
  });

  it('keeps the lock and says so on a wrong PIN', async () => {
    unlock.unlockWithPin.mockResolvedValue({
      kind: 'wrong',
      attempts: { consecutiveFailures: 1, lockedUntil: null },
    });

    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText('Kilidi kaldır'));
    });
    await typePin(view, PIN);

    expect(removal.removeAppLock).not.toHaveBeenCalled();
    expect(view.getByText('PIN yanlış.')).toBeTruthy();
  });

  it('honours a lockout wait, exactly as the lock screen does', async () => {
    unlock.unlockWithPin.mockResolvedValue({ kind: 'waiting', remainingMs: 30_000 });

    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText('Kilidi kaldır'));
    });
    await typePin(view, PIN);

    expect(removal.removeAppLock).not.toHaveBeenCalled();
    expect(view.getByText(/30 saniye/)).toBeTruthy();
  });
});

describe('changing the PIN', () => {
  it('asks for the current PIN before offering to choose a new one', async () => {
    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText("PIN'i değiştir"));
    });

    expect(view.getByText(VERIFY_TITLE)).toBeTruthy();
    expect(view.queryByText('Bir PIN seç')).toBeNull();
  });

  it('opens the choose step once the right PIN is given', async () => {
    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText("PIN'i değiştir"));
    });
    await typePin(view, PIN);

    expect(view.getByText('Bir PIN seç')).toBeTruthy();

    // And the new PIN saves exactly as before.
    await typePin(view, '246801');
    await typePin(view, '246801');

    expect(setLock.setAppLock).toHaveBeenCalledTimes(1);
    expect(setLock.setAppLock.mock.calls[0][0].pin).toBe('246801');
  });

  it('opens no path to a new PIN on a wrong one', async () => {
    unlock.unlockWithPin.mockResolvedValue({
      kind: 'wrong',
      attempts: { consecutiveFailures: 1, lockedUntil: null },
    });

    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText("PIN'i değiştir"));
    });
    await typePin(view, PIN);

    expect(view.queryByText('Bir PIN seç')).toBeNull();
    expect(setLock.setAppLock).not.toHaveBeenCalled();
  });
});

describe('choosing an easily guessed PIN', () => {
  const WEAK_WARNING =
    'Bu PIN kolay tahmin ediliyor (tekrarlayan ya da ardışık rakamlar). ' +
    'İstersen yine de kullanabilirsin.';

  beforeEach(() => {
    // No lock yet, so the screen opens on the choose step.
    useAppLockStore.setState({ enabled: false, locked: false, hydrated: true, unreadable: false });
  });

  it('warns about a repeated digit, without refusing it', async () => {
    const view = await open();

    await typePin(view, '111111');

    expect(view.getByText(WEAK_WARNING)).toBeTruthy();

    // Non-blocking by design: confirming it still sets the lock.
    await typePin(view, '111111');

    expect(setLock.setAppLock).toHaveBeenCalledTimes(1);
  });

  it('keeps the warning up while the confirmation is typed', async () => {
    // The warning is not the message line, which every digit clears - it is
    // tied to the chosen PIN and stays until the choice does.
    const view = await open();

    await typePin(view, '123456');
    await typePin(view, '123');

    expect(view.getByText(WEAK_WARNING)).toBeTruthy();
  });

  it('says nothing about an ordinary PIN', async () => {
    const view = await open();

    await typePin(view, '135790');

    expect(view.queryByText(WEAK_WARNING)).toBeNull();
  });

  it('drops the warning when a mismatch sends the choice back', async () => {
    const view = await open();

    await typePin(view, '111111');
    await typePin(view, '222222');

    // Back on the choose step with no chosen PIN, there is nothing to warn
    // about yet; the mismatch message is doing the talking.
    expect(view.queryByText(WEAK_WARNING)).toBeNull();
  });
});

/**
 * Two presses in one turn, and why the guard is not belt-and-braces.
 *
 * `handleDigit` used to branch inside a `setEntered` updater, and React
 * processes queued updaters in sequence — so a second press read the first's
 * result, saw six digits already and did nothing. The clamp did the work.
 *
 * Moving the side effects out of the updater (which React requires, since an
 * updater must be pure and may be replayed) reads `entered` from the closure
 * instead. Two presses in the same turn now read the *same* value, both build
 * the same sixth digit, and both would call through. The pad is drawn disabled
 * while `isSaving`, but that only lands on the next render.
 *
 * So the `inFlight` ref is what closes the window the refactor opened. Its
 * cost if it were missing is not a cosmetic double render: `unlockWithPin`
 * writes `afterWrongPin` to the record before it answers, so one wrong PIN
 * would be counted twice and five free attempts would become two and a half.
 */
describe('two presses of the sixth key in one turn', () => {
  it('verifies the current PIN once', async () => {
    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText('Kilidi kaldır'));
    });

    await typePin(view, PIN.slice(0, 5));

    const sixth = view.getByTestId(`pin-key-${PIN[5]}`);

    await act(async () => {
      fireEvent.press(sixth);
      fireEvent.press(sixth);
    });

    expect(unlock.unlockWithPin).toHaveBeenCalledTimes(1);
  });

  it('writes a new lock once', async () => {
    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText("PIN'i değiştir"));
    });

    await typePin(view, PIN);
    // Past the verify step; now choosing and confirming a new one.
    await typePin(view, '135790');
    await typePin(view, '13579');

    const sixth = view.getByTestId('pin-key-0');

    await act(async () => {
      fireEvent.press(sixth);
      fireEvent.press(sixth);
    });

    expect(setLock.setAppLock).toHaveBeenCalledTimes(1);
  });
});
