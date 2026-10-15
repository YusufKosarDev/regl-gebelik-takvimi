import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import SettingsScreen from '@/app/(app)/(tabs)/settings';
import type { AuthUser } from '@/features/auth/domain/auth-user';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { useAppLockStore } from '@/store/app-lock-store';
import { armAppState } from '../../../../jest/app-state-driver';

/**
 * The wipe proves who is asking, when there is anything to prove it with.
 *
 * "Tüm verilerimi sil" is irreversible and removes its own evidence — it
 * deletes the lock record and signs the session out on its way. Until this
 * step existed, anyone holding the unlocked phone could destroy every record
 * with two taps. Now the panel asks for the PIN when a lock is set, for the
 * account password when there is a session and no lock, and keeps the plain
 * two-step confirm when there is neither — a credential nobody holds cannot
 * be demanded.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

let mockAuthUser: AuthUser | null = null;

jest.mock('@/features/auth/data/auth-repository', () => ({
  observeAuthUser: jest.fn((listener) => {
    listener(mockAuthUser);

    return () => {};
  }),
  signOut: jest.fn(),
  getCurrentAuthUser: jest.fn(() => mockAuthUser),
  reauthenticateWithPassword: jest.fn(),
}));

jest.mock('@/features/auth/infrastructure/firebase', () => ({
  isFirebaseConfigured: jest.fn(() => true),
  requireFirebaseAuth: jest.fn(),
  getFirebaseAuth: jest.fn(),
}));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/avatar/data/avatar-repository', () => ({
  loadAvatarConfig: jest.fn(async () => null),
  saveAvatarConfig: jest.fn(),
}));

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

jest.mock('@/features/notifications/data/notification-preferences-repository', () => ({
  loadNotificationPreferences: jest.fn(),
  saveNotificationPreferences: jest.fn(),
  loadDiscreetNotifications: jest.fn(),
  saveDiscreetNotifications: jest.fn(),
}));

jest.mock('@/features/notifications/application/set-discreet-notifications', () => ({
  setDiscreetNotifications: jest.fn(),
}));

jest.mock('@/features/notifications/infrastructure/notification-permission', () => ({
  getNotificationPermissionStatus: jest.fn(),
  ensureNotificationPermission: jest.fn(),
}));

jest.mock('@/features/notifications/infrastructure/open-notification-settings', () => ({
  openNotificationSettings: jest.fn(),
}));

jest.mock('@/features/notifications/infrastructure/blocked-reminder-channels', () => ({
  loadBlockedReminderChannels: jest.fn(),
  NO_BLOCKED_REMINDER_CHANNELS: {
    periodReminder: false,
    pregnancyWeeklyReminder: false,
  },
}));

jest.mock('@/features/notifications/application/set-reminder-enabled', () => ({
  setReminderEnabled: jest.fn(),
}));

jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshotQuietly: jest.fn(),
  syncWidgetSnapshot: jest.fn(),
}));

jest.mock('@/features/notifications/application/sync-period-reminder', () => ({
  syncPeriodReminderQuietly: jest.fn(),
  syncPeriodReminder: jest.fn(),
}));

jest.mock('@/features/notifications/application/sync-pregnancy-weekly-reminder', () => ({
  syncPregnancyWeeklyReminderQuietly: jest.fn(),
  syncPregnancyWeeklyReminder: jest.fn(),
}));

// What this file is about.
jest.mock('@/features/deletion/application/wipe-local-data', () => ({
  wipeLocalData: jest.fn(),
}));

jest.mock('@/features/app-lock/application/unlock-with-pin', () => ({
  unlockWithPin: jest.fn(),
}));

const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const reminderRepository = jest.requireMock(
  '@/features/notifications/data/notification-preferences-repository'
);
const permissionModule = jest.requireMock(
  '@/features/notifications/infrastructure/notification-permission'
);
const channelsModule = jest.requireMock(
  '@/features/notifications/infrastructure/blocked-reminder-channels'
);
const wipe = jest.requireMock('@/features/deletion/application/wipe-local-data');
const unlock = jest.requireMock('@/features/app-lock/application/unlock-with-pin');
const auth = jest.requireMock('@/features/auth/data/auth-repository');

type View = Awaited<ReturnType<typeof render>>;

const PIN = '135790';
const USER: AuthUser = { uid: 'uid-1', email: 'someone@example.test' };

function profile(): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [
      {
        id: 'onboarding-initial-period',
        startDate: '2026-09-02' as ISODate,
        endDate: '2026-09-07' as ISODate,
        isOngoing: false,
      },
    ],
  };
}

beforeEach(() => {
  mockAuthUser = null;
  useAppLockStore.setState({ enabled: false, locked: false, hydrated: true, unreadable: false });

  db.openAppDatabase.mockReset();
  db.openAppDatabase.mockResolvedValue({});
  repository.loadCycleProfile.mockReset();
  repository.loadCycleProfile.mockResolvedValue(profile());
  repository.saveCycleProfile.mockReset();
  reminderRepository.loadNotificationPreferences.mockReset();
  reminderRepository.loadNotificationPreferences.mockResolvedValue({
    periodReminderEnabled: false,
    pregnancyWeeklyReminderEnabled: false,
  });
  reminderRepository.loadDiscreetNotifications.mockReset();
  reminderRepository.loadDiscreetNotifications.mockResolvedValue(false);
  permissionModule.getNotificationPermissionStatus.mockReset();
  permissionModule.getNotificationPermissionStatus.mockResolvedValue('undetermined');
  channelsModule.loadBlockedReminderChannels.mockReset();
  channelsModule.loadBlockedReminderChannels.mockResolvedValue({
    periodReminder: false,
    pregnancyWeeklyReminder: false,
  });

  wipe.wipeLocalData.mockReset();
  wipe.wipeLocalData.mockResolvedValue({ kind: 'wiped' });
  unlock.unlockWithPin.mockReset();
  unlock.unlockWithPin.mockResolvedValue({ kind: 'unlocked' });
  auth.reauthenticateWithPassword.mockReset();
  auth.reauthenticateWithPassword.mockResolvedValue(undefined);

  armAppState();
});

async function openWipePanel(): Promise<View> {
  const screen = await render(<SettingsScreen />);

  await waitFor(() => {
    expect(screen.queryByTestId('cycle-settings-loading')).toBeNull();
  });

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Tüm verilerimi sil'));
  });

  return screen;
}

async function typePin(view: View, pin: string): Promise<void> {
  for (const digit of pin) {
    await act(async () => {
      fireEvent.press(view.getByTestId(`pin-key-${digit}`));
    });
  }
}

describe('with the app lock on', () => {
  beforeEach(() => {
    useAppLockStore.setState({ enabled: true });
  });

  it('asks for the PIN instead of offering a bare confirm button', async () => {
    const view = await openWipePanel();

    expect(view.getByText("Silmek için önce PIN'ini gir")).toBeTruthy();
    expect(view.queryByText('Her şeyi sil')).toBeNull();
    expect(wipe.wipeLocalData).not.toHaveBeenCalled();
  });

  it('wipes once the right PIN is given', async () => {
    const view = await openWipePanel();

    await typePin(view, PIN);

    expect(unlock.unlockWithPin).toHaveBeenCalledWith(PIN);
    expect(wipe.wipeLocalData).toHaveBeenCalledTimes(1);
  });

  it('deletes nothing on a wrong PIN, and says so', async () => {
    unlock.unlockWithPin.mockResolvedValue({
      kind: 'wrong',
      attempts: { consecutiveFailures: 1, lockedUntil: null },
    });

    const view = await openWipePanel();

    await typePin(view, PIN);

    expect(wipe.wipeLocalData).not.toHaveBeenCalled();
    expect(view.getByText('PIN yanlış.')).toBeTruthy();
  });

  it('honours a lockout wait here too', async () => {
    unlock.unlockWithPin.mockResolvedValue({ kind: 'waiting', remainingMs: 30_000 });

    const view = await openWipePanel();

    await typePin(view, PIN);

    expect(wipe.wipeLocalData).not.toHaveBeenCalled();
    expect(view.getByText(/30 saniye/)).toBeTruthy();
  });
});

describe('signed in, with no lock', () => {
  beforeEach(() => {
    mockAuthUser = USER;
  });

  it('asks for the account password', async () => {
    const view = await openWipePanel();

    // "Şifre" rather than "parola": the word every other screen of this app
    // uses, the field placeholder right below it included.
    expect(view.getByText('Silmek için hesap şifreni gir')).toBeTruthy();
    expect(view.getByPlaceholderText('Şifre')).toBeTruthy();
  });

  it('wipes once the password checks out', async () => {
    const view = await openWipePanel();

    await act(async () => {
      fireEvent.changeText(view.getByPlaceholderText('Şifre'), 'correct-horse');
    });
    await act(async () => {
      fireEvent.press(view.getByLabelText('Her şeyi sil'));
    });

    expect(auth.reauthenticateWithPassword).toHaveBeenCalledWith(USER.email, 'correct-horse');
    expect(wipe.wipeLocalData).toHaveBeenCalledTimes(1);
  });

  it('deletes nothing on a wrong password', async () => {
    const { AuthError } = jest.requireActual<
      typeof import('@/features/auth/domain/auth-error')
    >('@/features/auth/domain/auth-error');

    auth.reauthenticateWithPassword.mockRejectedValue(new AuthError('invalid-credentials'));

    const view = await openWipePanel();

    await act(async () => {
      fireEvent.changeText(view.getByPlaceholderText('Şifre'), 'nope');
    });
    await act(async () => {
      fireEvent.press(view.getByLabelText('Her şeyi sil'));
    });

    expect(wipe.wipeLocalData).not.toHaveBeenCalled();
  });
});

describe('with neither a lock nor a session', () => {
  it('keeps the plain two-step confirm: there is nothing to prove a person with', async () => {
    const view = await openWipePanel();

    expect(view.queryByText("Silmek için önce PIN'ini gir")).toBeNull();
    expect(view.queryByText('Silmek için hesap şifreni gir')).toBeNull();

    await act(async () => {
      fireEvent.press(view.getByLabelText('Her şeyi sil'));
    });

    expect(wipe.wipeLocalData).toHaveBeenCalledTimes(1);
  });
});
