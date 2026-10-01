import { render } from '@testing-library/react-native';
import React from 'react';

import SettingsScreen from '@/app/(app)/settings';
import { appMessages } from '@/shared/presentation/app-messages';
import { useAppStore } from '@/store/app-store';

import { settingsMessages } from '../presentation/settings-messages';

/**
 * The settings screen in English, chosen rather than inherited.
 *
 * ## Why this file is the end of the migration
 *
 * Every other English test in the repository mocks a phone reporting English.
 * This one leaves the phone Turkish - the suite's default - and sets the stored
 * preference instead, which is the path somebody actually takes: they open
 * settings on a Turkish phone and pick English.
 *
 * It is the only assertion that proves the whole chain, because it is the only
 * one where the device and the interface disagree. If the stored preference
 * were ignored, or the picker wrote somewhere nothing reads, this is the test
 * that fails and nothing else would.
 *
 * The mocks are the smallest set that lets the screen render: everything the
 * screen reads on mount, and the two reminder syncs it fires. They are
 * deliberately not the full set `settings-screen.test.tsx` carries, because
 * nothing here presses a button.
 */

jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

jest.mock('@/features/auth/data/auth-repository', () => ({
  observeAuthUser: jest.fn(() => () => {}),
  signOut: jest.fn(),
  getCurrentAuthUser: jest.fn(() => null),
}));

jest.mock('@/features/auth/infrastructure/firebase', () => ({
  isFirebaseConfigured: jest.fn(() => true),
  requireFirebaseAuth: jest.fn(),
  getFirebaseAuth: jest.fn(),
}));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(async () => ({}) as unknown),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(async () => null),
  saveCycleProfile: jest.fn(),
}));

jest.mock('@/features/notifications/data/notification-preferences-repository', () => ({
  loadNotificationPreferences: jest.fn(async () => ({
    periodReminderEnabled: false,
    pregnancyWeeklyReminderEnabled: false,
  })),
  saveNotificationPreferences: jest.fn(),
  loadDiscreetNotifications: jest.fn(async () => false),
  saveDiscreetNotifications: jest.fn(),
}));

jest.mock('@/features/notifications/infrastructure/notification-permission', () => ({
  getNotificationPermissionStatus: jest.fn(async () => 'undetermined'),
  ensureNotificationPermission: jest.fn(),
}));

jest.mock('@/features/notifications/application/set-reminder-enabled', () => ({
  setReminderEnabled: jest.fn(),
}));

jest.mock('@/features/notifications/application/set-discreet-notifications', () => ({
  setDiscreetNotifications: jest.fn(),
}));

jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshotQuietly: jest.fn(async () => null),
  syncWidgetSnapshot: jest.fn(),
}));

jest.mock('@/features/notifications/application/sync-period-reminder', () => ({
  syncPeriodReminderQuietly: jest.fn(async () => null),
  syncPeriodReminder: jest.fn(),
}));

jest.mock('@/features/notifications/application/sync-pregnancy-weekly-reminder', () => ({
  syncPregnancyWeeklyReminderQuietly: jest.fn(async () => null),
  syncPregnancyWeeklyReminder: jest.fn(),
}));

const router = jest.requireMock('expo-router');

beforeEach(() => {
  router.useRouter.mockReturnValue({ back: jest.fn(), push: jest.fn(), replace: jest.fn() });
});

afterEach(() => {
  useAppStore.setState({ languagePreference: 'system' });
});

describe('the settings screen, with a language chosen on a Turkish phone', () => {
  it('shows the screen in English when English was chosen', async () => {
    useAppStore.setState({ languagePreference: 'en' });

    const screen = await render(<SettingsScreen />);

    expect(screen.getByText(settingsMessages.en.settingsTitle)).toBeTruthy();
    expect(screen.queryByText(settingsMessages.tr.settingsTitle)).toBeNull();
  });

  it('shows the language section itself in English, with both languages named themselves', async () => {
    useAppStore.setState({ languagePreference: 'en' });

    const screen = await render(<SettingsScreen />);

    expect(screen.getByText(appMessages.en.languageSectionTitle)).toBeTruthy();
    expect(screen.getByLabelText('Türkçe')).toBeTruthy();
    expect(screen.getByLabelText('English')).toBeTruthy();
  });

  it('marks the chosen language as the one in force', async () => {
    useAppStore.setState({ languagePreference: 'en' });

    const screen = await render(<SettingsScreen />);

    expect(screen.getByLabelText('English').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Türkçe').props.accessibilityState.selected).toBe(false);
  });

  it('keeps Turkish when Turkish was chosen', async () => {
    // The other direction matters as much: a stored choice has to win whichever
    // way it points.
    useAppStore.setState({ languagePreference: 'tr' });

    const screen = await render(<SettingsScreen />);

    expect(screen.getByText(settingsMessages.tr.settingsTitle)).toBeTruthy();
  });

  it('follows the phone again when the preference is system', async () => {
    // The suite's device is Turkish, so 'system' resolves to Turkish here.
    useAppStore.setState({ languagePreference: 'system' });

    const screen = await render(<SettingsScreen />);

    expect(screen.getByText(settingsMessages.tr.settingsTitle)).toBeTruthy();
  });
});
