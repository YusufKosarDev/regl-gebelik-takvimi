import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';

import SettingsScreen from '@/app/(app)/(tabs)/settings';
import {
  LOCAL_WIPE_OPEN_LABEL,
  deletionMessages,
} from '@/features/deletion/presentation/deletion-messages';
import { Colors } from '@/constants/theme';
import { expectDestructiveConfirmation } from '../../../../jest/assert-destructive-confirmation';
import { ABOUT_OPEN_LABEL } from '@/features/disclaimer/presentation/disclaimer-messages';
import {
  DISCREET_NOTIFICATIONS_DESCRIPTION,
  DISCREET_NOTIFICATIONS_TOGGLE_LABEL,
  NOTIFICATIONS_BLOCKED_NOTICE,
  OPEN_SYSTEM_SETTINGS_FAILED_MESSAGE,
  OPEN_SYSTEM_SETTINGS_LABEL,
  PERMISSION_REFUSED_MESSAGE,
  reminderMessages,
} from '@/features/notifications/presentation/reminder-messages';
import {
  notifyLocalDataChanged,
  resetLocalDataChangeListenersForTests,
} from '@/shared/data-change/local-data-change';
import {
  MAX_CYCLE_LENGTH_DAYS,
  MAX_PERIOD_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
  MIN_PERIOD_LENGTH_DAYS,
} from '@/features/cycle/domain/limits';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { expectClearsTabBar } from '../../../../jest/assert-clears-tab-bar';

// The database is faked. The use cases, the repository contract and the domain
// rules stay real, so the stepper is bounded by the limits the app really has.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@/features/auth/data/auth-repository', () => ({
  // Returns its unsubscribe, which  calls on unmount.
  //
  // It reports signed-out straight away, which is what Firebase does on a
  // device with no session. Left silent, the hook sat on `loading` for the
  // whole test and the profile block could only ever be caught mid-question.
  observeAuthUser: jest.fn((listener) => {
    listener(null);

    return () => {};
  }),
  signOut: jest.fn(),
  getCurrentAuthUser: jest.fn(() => null),
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

// The profile tab shows the person at the top, so it reads the avatar too.
jest.mock('@/features/avatar/data/avatar-repository', () => ({
  loadAvatarConfig: jest.fn(async () => null),
  saveAvatarConfig: jest.fn(),
}));

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

// Screens re-read on focus now, so the mock has to behave like the real
// `useFocusEffect`. Shared, so four test files cannot drift apart.
jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

// The reminder rows read their own preferences and, when switched on, ask for a
// permission. Both are faked so this file stays about the cycle settings; the
// reminders have their own describe block below.
jest.mock('@/features/notifications/data/notification-preferences-repository', () => ({
  loadNotificationPreferences: jest.fn(),
  saveNotificationPreferences: jest.fn(),
  loadDiscreetNotifications: jest.fn(),
  saveDiscreetNotifications: jest.fn(),
}));

// The third switch decides what a reminder says rather than whether one
// happens, and turning it rebuilds both queues. Faked so this file stays about
// the cycle settings; it has its own describe block below.
jest.mock('@/features/notifications/application/set-discreet-notifications', () => ({
  setDiscreetNotifications: jest.fn(),
}));

// Read on every load, never prompting. Faked so each test can say what the
// system would answer.
jest.mock('@/features/notifications/infrastructure/notification-permission', () => ({
  getNotificationPermissionStatus: jest.fn(),
  ensureNotificationPermission: jest.fn(),
}));

jest.mock('@/features/notifications/application/set-reminder-enabled', () => ({
  setReminderEnabled: jest.fn(),
}));

// The widget sync is faked so the screen's calls to it can be counted. It is
// quiet by contract, so the real one would do nothing under Jest anyway.
jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshotQuietly: jest.fn(),
  syncWidgetSnapshot: jest.fn(),
}));

// The period reminder syncs alongside the widget. Faked so the calls can be
// counted; it is quiet by contract, so the real one would do nothing here.
jest.mock('@/features/notifications/application/sync-period-reminder', () => ({
  syncPeriodReminderQuietly: jest.fn(),
  syncPeriodReminder: jest.fn(),
}));

// The weekly pregnancy reminder syncs off its own toggle. Faked so the calls can
// be counted; it is quiet by contract, so the real one would do nothing here.
jest.mock('@/features/notifications/application/sync-pregnancy-weekly-reminder', () => ({
  syncPregnancyWeeklyReminderQuietly: jest.fn(),
  syncPregnancyWeeklyReminder: jest.fn(),
}));

const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const widgetSync = jest.requireMock('@/features/widget/application/sync-widget-snapshot');
const reminderSync = jest.requireMock('@/features/notifications/application/sync-period-reminder');
const pregnancyReminderSync = jest.requireMock(
  '@/features/notifications/application/sync-pregnancy-weekly-reminder'
);
const reminderRepository = jest.requireMock(
  '@/features/notifications/data/notification-preferences-repository'
);
const reminders = jest.requireMock('@/features/notifications/application/set-reminder-enabled');
const discreet = jest.requireMock(
  '@/features/notifications/application/set-discreet-notifications'
);
const permissionModule = jest.requireMock(
  '@/features/notifications/infrastructure/notification-permission'
);
// Spied rather than module-mocked: React Native's own Linking is already in
// place under jest-expo, and there is no system settings screen to open here.
const openSettingsMock = jest.spyOn(Linking, 'openSettings');

// Acting out leaving the screen and coming back, from the shared router mock.
const { focusAgain } = jest.requireMock('expo-router') as { focusAgain: () => void };
const useRouterMock = useRouter as unknown as jest.Mock;

let back: jest.Mock;
let push: jest.Mock;

function profile(cycle: number, period: number): CycleProfile {
  return {
    settings: { averageCycleLengthDays: cycle, averagePeriodLengthDays: period },
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
  db.openAppDatabase.mockReset();
  db.openAppDatabase.mockResolvedValue({});
  repository.loadCycleProfile.mockReset();
  repository.saveCycleProfile.mockReset();
  widgetSync.syncWidgetSnapshotQuietly.mockReset();
  widgetSync.syncWidgetSnapshotQuietly.mockResolvedValue(null);
  reminderSync.syncPeriodReminderQuietly.mockReset();
  reminderSync.syncPeriodReminderQuietly.mockResolvedValue(null);
  pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mockReset();
  pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mockResolvedValue(null);
  reminderRepository.loadNotificationPreferences.mockReset();
  reminderRepository.loadNotificationPreferences.mockResolvedValue({
    periodReminderEnabled: false,
    pregnancyWeeklyReminderEnabled: false,
  });
  reminderRepository.saveNotificationPreferences.mockReset();
  reminderRepository.loadDiscreetNotifications.mockReset();
  reminderRepository.loadDiscreetNotifications.mockResolvedValue(false);
  reminderRepository.saveDiscreetNotifications.mockReset();
  discreet.setDiscreetNotifications.mockReset();
  // The real one returns what is stored afterwards, which is what the screen
  // puts the switch back to.
  discreet.setDiscreetNotifications.mockImplementation(
    async (_db: unknown, enabled: boolean) => enabled
  );
  permissionModule.getNotificationPermissionStatus.mockReset();
  permissionModule.getNotificationPermissionStatus.mockResolvedValue('undetermined');
  permissionModule.ensureNotificationPermission.mockReset();
  openSettingsMock.mockReset();
  openSettingsMock.mockResolvedValue(undefined);
  reminders.setReminderEnabled.mockReset();
  reminders.setReminderEnabled.mockImplementation(
    async (_db: unknown, field: string, enabled: boolean) => ({
      preferences: {
        periodReminderEnabled: field === 'periodReminderEnabled' ? enabled : false,
        pregnancyWeeklyReminderEnabled:
          field === 'pregnancyWeeklyReminderEnabled' ? enabled : false,
      },
      permission: enabled ? 'granted' : null,
    })
  );
  repository.saveCycleProfile.mockResolvedValue(undefined);

  back = jest.fn();
  useRouterMock.mockReset();
  push = jest.fn();
  useRouterMock.mockReturnValue({ back, push, replace: jest.fn() });
});

async function renderScreen() {
  const screen = await render(<SettingsScreen />);

  await waitFor(() => {
    expect(screen.queryByTestId('cycle-settings-loading')).toBeNull();
  });

  return screen;
}

async function renderLoaded(cycle = 28, period = 5) {
  repository.loadCycleProfile.mockResolvedValue(profile(cycle, period));

  return renderScreen();
}

function savedProfile(): CycleProfile {
  return repository.saveCycleProfile.mock.calls[0][1] as CycleProfile;
}

describe('SettingsScreen while loading', () => {
  it('shows a spinner and a message', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { getByTestId, getByText } = await render(<SettingsScreen />);

    expect(getByTestId('cycle-settings-loading')).toBeTruthy();
    expect(getByText('Veriler yükleniyor')).toBeTruthy();
  });

  it('offers no controls yet', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByLabelText } = await render(<SettingsScreen />);

    expect(queryByLabelText('Döngü ayarlarını kaydet')).toBeNull();
    expect(queryByLabelText('Ortalama döngü süresini artır')).toBeNull();
  });
});

describe('SettingsScreen header', () => {
  it('names the screen and says what it is for', async () => {
    const { getByText } = await renderLoaded();

    expect(getByText('Döngü ayarları')).toBeTruthy();
    expect(
      getByText('Hesabın, döngü ayarların, hatırlatıcıların ve verilerin.')
    ).toBeTruthy();
  });
});

describe('SettingsScreen with nothing saved', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(null);
  });

  it('says so', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Döngü bilgisi bulunamadı.')).toBeTruthy();
  });

  it('offers nothing to edit or save', async () => {
    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Ortalama döngü süresini artır')).toBeNull();
    expect(queryByLabelText('Döngü ayarlarını kaydet')).toBeNull();
  });

  it('does not claim the settings failed to load', async () => {
    const { queryByText } = await renderScreen();

    expect(queryByText('Ayarlar yüklenemedi.')).toBeNull();
  });
});

describe('SettingsScreen when loading fails', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockRejectedValue(new Error('database is locked'));
  });

  it('says so', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Ayarlar yüklenemedi.')).toBeTruthy();
  });

  it('announces it to assistive technology', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Ayarlar yüklenemedi.').props.accessibilityRole).toBe('alert');
  });

  it('offers nothing to save', async () => {
    const { queryByLabelText, queryByText } = await renderScreen();

    expect(queryByLabelText('Döngü ayarlarını kaydet')).toBeNull();
    expect(queryByText('Döngü bilgisi bulunamadı.')).toBeNull();
  });
});

describe('SettingsScreen loaded values', () => {
  it('shows the stored averages', async () => {
    const { getByLabelText } = await renderLoaded(28, 5);

    expect(getByLabelText('Ortalama döngü süresi: 28 gün')).toBeTruthy();
    expect(getByLabelText('Ortalama regl süresi: 5 gün')).toBeTruthy();
  });

  it('shows whatever was stored, not a default', async () => {
    const { getByLabelText } = await renderLoaded(34, 7);

    expect(getByLabelText('Ortalama döngü süresi: 34 gün')).toBeTruthy();
    expect(getByLabelText('Ortalama regl süresi: 7 gün')).toBeTruthy();
  });

  it('reads the database once', async () => {
    await renderLoaded();

    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('writes nothing on arrival', async () => {
    await renderLoaded();

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('SettingsScreen cycle length control', () => {
  it('steps up', async () => {
    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));

    expect(screen.getByLabelText('Ortalama döngü süresi: 29 gün')).toBeTruthy();
  });

  it('steps down', async () => {
    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini azalt'));

    expect(screen.getByLabelText('Ortalama döngü süresi: 27 gün')).toBeTruthy();
  });

  it('stops at the domain minimum', async () => {
    const screen = await renderLoaded(MIN_CYCLE_LENGTH_DAYS, MIN_PERIOD_LENGTH_DAYS);

    const decrease = screen.getByLabelText('Ortalama döngü süresini azalt');

    expect(decrease.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(decrease);

    expect(
      screen.getByLabelText(`Ortalama döngü süresi: ${MIN_CYCLE_LENGTH_DAYS} gün`)
    ).toBeTruthy();
  });

  it('stops at the domain maximum', async () => {
    const screen = await renderLoaded(MAX_CYCLE_LENGTH_DAYS, 5);

    const increase = screen.getByLabelText('Ortalama döngü süresini artır');

    expect(increase.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(increase);

    expect(
      screen.getByLabelText(`Ortalama döngü süresi: ${MAX_CYCLE_LENGTH_DAYS} gün`)
    ).toBeTruthy();
  });

  it('leaves both controls open in the middle of the range', async () => {
    const screen = await renderLoaded(28, 5);

    expect(
      screen.getByLabelText('Ortalama döngü süresini azalt').props.accessibilityState.disabled
    ).toBe(false);
    expect(
      screen.getByLabelText('Ortalama döngü süresini artır').props.accessibilityState.disabled
    ).toBe(false);
  });
});

describe('SettingsScreen period length control', () => {
  it('steps up', async () => {
    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama regl süresini artır'));

    expect(screen.getByLabelText('Ortalama regl süresi: 6 gün')).toBeTruthy();
  });

  it('steps down', async () => {
    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama regl süresini azalt'));

    expect(screen.getByLabelText('Ortalama regl süresi: 4 gün')).toBeTruthy();
  });

  it('stops at the domain minimum', async () => {
    const screen = await renderLoaded(28, MIN_PERIOD_LENGTH_DAYS);

    const decrease = screen.getByLabelText('Ortalama regl süresini azalt');

    expect(decrease.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(decrease);

    expect(
      screen.getByLabelText(`Ortalama regl süresi: ${MIN_PERIOD_LENGTH_DAYS} gün`)
    ).toBeTruthy();
  });

  it('stops at the domain maximum when the cycle is longer than it', async () => {
    const screen = await renderLoaded(28, MAX_PERIOD_LENGTH_DAYS);

    const increase = screen.getByLabelText('Ortalama regl süresini artır');

    expect(increase.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(increase);

    expect(
      screen.getByLabelText(`Ortalama regl süresi: ${MAX_PERIOD_LENGTH_DAYS} gün`)
    ).toBeTruthy();
  });

  it('stops at the cycle length when that is the shorter bound', async () => {
    // A 16-day cycle caps the period at 16, well below the domain's own maximum.
    const screen = await renderLoaded(16, 16);

    const increase = screen.getByLabelText('Ortalama regl süresini artır');

    expect(increase.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(increase);

    expect(screen.getByLabelText('Ortalama regl süresi: 16 gün')).toBeTruthy();
  });
});

describe('SettingsScreen when the cycle is shortened past the period', () => {
  it('brings the period down with it', async () => {
    const screen = await renderLoaded(16, 16);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini azalt'));

    expect(screen.getByLabelText('Ortalama döngü süresi: 15 gün')).toBeTruthy();
    expect(screen.getByLabelText('Ortalama regl süresi: 15 gün')).toBeTruthy();
  });

  it('leaves a period that already fits alone', async () => {
    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini azalt'));

    expect(screen.getByLabelText('Ortalama regl süresi: 5 gün')).toBeTruthy();
  });

  it('never lets the pair the domain would refuse be saved', async () => {
    const screen = await renderLoaded(16, 16);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini azalt'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    expect(savedProfile().settings).toEqual({
      averageCycleLengthDays: 15,
      averagePeriodLengthDays: 15,
    });
  });

  it('does not raise the period again when the cycle grows back', async () => {
    const screen = await renderLoaded(16, 16);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini azalt'));
    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));

    // Clamping is a correction, not a link between the two values.
    expect(screen.getByLabelText('Ortalama döngü süresi: 16 gün')).toBeTruthy();
    expect(screen.getByLabelText('Ortalama regl süresi: 15 gün')).toBeTruthy();
  });
});

describe('SettingsScreen save', () => {
  it('stores the values that are on screen', async () => {
    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));
    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));
    await fireEvent.press(screen.getByLabelText('Ortalama regl süresini azalt'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    expect(savedProfile().settings).toEqual({
      averageCycleLengthDays: 30,
      averagePeriodLengthDays: 4,
    });
  });

  it('leaves the recorded periods untouched', async () => {
    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    expect(savedProfile().periodRecords).toEqual([
      {
        id: 'onboarding-initial-period',
        startDate: '2026-09-02',
        endDate: '2026-09-07',
        isOngoing: false,
      },
    ]);
  });

  it('goes back once the write lands', async () => {
    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('goes back without writing when nothing was changed', async () => {
    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('locks the screen while the write is in flight', async () => {
    let finishWrite: () => void = () => {};
    repository.saveCycleProfile.mockReturnValue(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      })
    );

    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));

    const press = fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Kaydediliyor...')).toBeTruthy();
    });

    // Every control is refused, so there is no second press to guard against in
    // the first place; the ref behind them is what catches a tap that lands
    // before this render does.
    expect(
      screen.getByLabelText('Döngü ayarlarını kaydet').props.accessibilityState.disabled
    ).toBe(true);
    expect(
      screen.getByLabelText('Ortalama döngü süresini artır').props.accessibilityState.disabled
    ).toBe(true);
    expect(
      screen.getByLabelText('Ortalama regl süresini azalt').props.accessibilityState.disabled
    ).toBe(true);

    // Inside `act`: resolving the write runs the screen's own `finally`,
    // and the `setState` that clears the busy flag would otherwise land
    // outside it - after this test has already moved on.
    await act(async () => {
      finishWrite();
      await press;
    });

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('opens the database through the shared connection', async () => {
    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    // Once on mount and once to save; both go through openAppDatabase, which
    // hands out the one connection rather than opening another.
    expect(db.openAppDatabase).toHaveBeenCalledTimes(2);
  });
});

describe('SettingsScreen when saving fails', () => {
  async function failToSave() {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk full'));

    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    return screen;
  }

  it('says so', async () => {
    const screen = await failToSave();

    expect(screen.getByText('Ayarlar kaydedilemedi.')).toBeTruthy();
  });

  it('announces it', async () => {
    const screen = await failToSave();

    expect(screen.getByText('Ayarlar kaydedilemedi.').props.accessibilityRole).toBe('alert');
  });

  it('stays on the screen', async () => {
    const screen = await failToSave();

    expect(back).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Döngü ayarlarını kaydet')).toBeTruthy();
  });

  it('keeps the values that were picked', async () => {
    const screen = await failToSave();

    expect(screen.getByLabelText('Ortalama döngü süresi: 29 gün')).toBeTruthy();
  });

  it('can be tried again', async () => {
    const screen = await failToSave();

    repository.saveCycleProfile.mockResolvedValue(undefined);

    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(2);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('clears the error when a value is changed', async () => {
    const screen = await failToSave();

    await fireEvent.press(screen.getByLabelText('Ortalama regl süresini artır'));

    expect(screen.queryByText('Ayarlar kaydedilemedi.')).toBeNull();
  });
});

describe('SettingsScreen leaving without saving', () => {
  it('writes nothing until the save button is pressed', async () => {
    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));
    await fireEvent.press(screen.getByLabelText('Ortalama regl süresini artır'));
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('SettingsScreen scope', () => {
  it('opens with the person, then the settings, and nothing else', async () => {
    const { queryAllByRole } = await renderLoaded(28, 5);

    expect(
      queryAllByRole('button').map((node) => node.props.accessibilityLabel as string)
    ).toEqual([
      // Who this is, before any setting. The tab answers that question and
      // it used to open with the cycle-length steppers instead.
      'Avatar oluştur',
      'Hesabı aç',
      'Ortalama döngü süresini azalt',
      'Ortalama döngü süresini artır',
      'Ortalama regl süresini azalt',
      'Ortalama regl süresini artır',
      'Döngü ayarlarını kaydet',
      // After the account, because whether there is one decides whether a
      // forgotten PIN can be recovered at all. Opens a screen; sets nothing.
      'Uygulama kilidini kur',
      // Directly above the section that empties the phone: somebody about to
      // delete everything should pass the way to take it with them first.
      'Verilerini dışa aktar',
      'Hakkında',
      // Opens the confirmation panel; it deletes nothing on its own.
      'Tüm verilerimi sil',
    ]);
  });

  it('offers no way to change the recorded periods or the last period start', async () => {
    const { queryByText } = await renderLoaded(28, 5);

    for (const forbidden of [
      'Son regl başlangıcı',
      'Geçmiş kayıtlar',
      'Sil',
      'Başlangıcı düzenle',
      'Bitişi düzenle',
    ]) {
      expect(queryByText(forbidden)).toBeNull();
    }
  });
});

describe('SettingsScreen widget snapshot sync', () => {
  it('syncs after the settings are saved', async () => {
    const screen = await renderLoaded();

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini azalt'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs with the database the screen opened', async () => {
    const screen = await renderLoaded();

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini azalt'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    expect(widgetSync.syncWidgetSnapshotQuietly.mock.calls[0][0]).toBe(
      await db.openAppDatabase.mock.results[0].value
    );
  });

  it('does not sync when the save failed', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderLoaded();

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini azalt'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Ayarlar kaydedilemedi.')).toBeTruthy();
    });

    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });

  it('keeps the save successful when the sync writes nothing', async () => {
    widgetSync.syncWidgetSnapshotQuietly.mockResolvedValue(null);

    const screen = await renderLoaded();

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini azalt'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ayarlar kaydedilemedi.')).toBeNull();
  });
});

// The copy now lives in the notifications feature's presentation file, so the
// test reads the same string the screen does rather than a second copy of it.
const DENIED_MESSAGE = PERMISSION_REFUSED_MESSAGE;

/** Reads a switch's state off its accessibility state. */
function isOn(
  screen: { getByLabelText: (label: string) => { props: Record<string, unknown> } },
  label: string
) {
  const state = screen.getByLabelText(label).props.accessibilityState as { checked?: boolean };

  return state.checked === true;
}

describe('SettingsScreen reminders', () => {
  it('shows both reminders', async () => {
    const screen = await renderLoaded();

    expect(screen.getByText('Bildirimler')).toBeTruthy();
    expect(screen.getByLabelText('Regl hatırlatıcısı')).toBeTruthy();
    expect(screen.getByLabelText('Haftalık gebelik hatırlatıcısı')).toBeTruthy();
  });

  it('shows both off by default', async () => {
    const screen = await renderLoaded();

    expect(isOn(screen, 'Regl hatırlatıcısı')).toBe(false);
    expect(isOn(screen, 'Haftalık gebelik hatırlatıcısı')).toBe(false);
  });

  it('shows what was stored', async () => {
    reminderRepository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    });

    const screen = await renderLoaded();

    expect(isOn(screen, 'Regl hatırlatıcısı')).toBe(true);
    expect(isOn(screen, 'Haftalık gebelik hatırlatıcısı')).toBe(false);
  });

  it('asks for no permission while the screen is opening', async () => {
    await renderLoaded();

    // A dialog before anyone has asked for anything is a question with no
    // answer, and the only safe answer to an unexplained one is no.
    expect(reminders.setReminderEnabled).not.toHaveBeenCalled();
  });

  it('reads the preferences on the same database the screen opened', async () => {
    await renderLoaded();

    expect(reminderRepository.loadNotificationPreferences).toHaveBeenCalledTimes(1);
    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsScreen switching a reminder on', () => {
  it.each([
    ['Regl hatırlatıcısı', 'periodReminderEnabled'],
    ['Haftalık gebelik hatırlatıcısı', 'pregnancyWeeklyReminderEnabled'],
  ] as const)('sends %s to the use case', async (label, field) => {
    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText(label), 'valueChange', true);
    });

    expect(reminders.setReminderEnabled).toHaveBeenCalledTimes(1);
    expect(reminders.setReminderEnabled.mock.calls[0].slice(1)).toEqual([field, true]);
  });

  it('turns the switch on when permission is granted', async () => {
    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', true);
    });

    expect(isOn(screen, 'Regl hatırlatıcısı')).toBe(true);
    expect(screen.queryByText(PERMISSION_REFUSED_MESSAGE)).toBeNull();
  });

  it('leaves it off and says why when permission is refused', async () => {
    reminders.setReminderEnabled.mockResolvedValue({
      preferences: { periodReminderEnabled: false, pregnancyWeeklyReminderEnabled: false },
      permission: 'denied',
    });

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', true);
    });

    expect(isOn(screen, 'Regl hatırlatıcısı')).toBe(false);
    expect(screen.getByText(DENIED_MESSAGE)).toBeTruthy();
  });

  it('says the same when the dialog was dismissed rather than answered', async () => {
    reminders.setReminderEnabled.mockResolvedValue({
      preferences: { periodReminderEnabled: false, pregnancyWeeklyReminderEnabled: false },
      permission: 'undetermined',
    });

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', true);
    });

    expect(isOn(screen, 'Regl hatırlatıcısı')).toBe(false);
    expect(screen.getByText(DENIED_MESSAGE)).toBeTruthy();
  });

  it('says so when the change could not be saved', async () => {
    reminders.setReminderEnabled.mockRejectedValue(new Error('disk is full'));

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', true);
    });

    expect(screen.getByText('Hatırlatıcı ayarı kaydedilemedi.')).toBeTruthy();
    expect(isOn(screen, 'Regl hatırlatıcısı')).toBe(false);
  });

  it('clears an earlier refusal on the next attempt', async () => {
    reminders.setReminderEnabled.mockResolvedValue({
      preferences: { periodReminderEnabled: false, pregnancyWeeklyReminderEnabled: false },
      permission: 'denied',
    });

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', true);
    });
    expect(screen.getByText(DENIED_MESSAGE)).toBeTruthy();

    reminders.setReminderEnabled.mockResolvedValue({
      preferences: { periodReminderEnabled: true, pregnancyWeeklyReminderEnabled: false },
      permission: 'granted',
    });

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', true);
    });

    expect(screen.queryByText(DENIED_MESSAGE)).toBeNull();
    expect(isOn(screen, 'Regl hatırlatıcısı')).toBe(true);
  });

  it('leaves the cycle settings untouched', async () => {
    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', true);
    });

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });
});

describe('SettingsScreen switching a reminder off', () => {
  beforeEach(() => {
    reminderRepository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: true,
    });
  });

  it('sends the change to the use case', async () => {
    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', false);
    });

    expect(reminders.setReminderEnabled.mock.calls[0].slice(1)).toEqual([
      'periodReminderEnabled',
      false,
    ]);
  });

  it('turns the switch off', async () => {
    reminders.setReminderEnabled.mockResolvedValue({
      preferences: { periodReminderEnabled: false, pregnancyWeeklyReminderEnabled: true },
      permission: null,
    });

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', false);
    });

    expect(isOn(screen, 'Regl hatırlatıcısı')).toBe(false);
    expect(isOn(screen, 'Haftalık gebelik hatırlatıcısı')).toBe(true);
  });

  it('says nothing about permission', async () => {
    reminders.setReminderEnabled.mockResolvedValue({
      preferences: { periodReminderEnabled: false, pregnancyWeeklyReminderEnabled: true },
      permission: null,
    });

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', false);
    });

    expect(screen.queryByText(PERMISSION_REFUSED_MESSAGE)).toBeNull();
  });
});

describe('SettingsScreen period reminder sync', () => {
  it('syncs after the cycle settings are saved', async () => {
    const screen = await renderLoaded();

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini azalt'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs after the period reminder is switched on', async () => {
    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', true);
    });

    expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs after it is switched off, so the queued one goes', async () => {
    reminderRepository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    });

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', false);
    });

    expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('does not sync for the pregnancy reminder, which is a different type', async () => {
    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Haftalık gebelik hatırlatıcısı'), 'valueChange', true);
    });

    expect(reminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
  });

  it('does not sync when the cycle settings save failed', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderLoaded();

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini azalt'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Ayarlar kaydedilemedi.')).toBeTruthy();
    });

    expect(reminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
  });

  it('keeps the toggle successful when the reminder could not be scheduled', async () => {
    reminderSync.syncPeriodReminderQuietly.mockResolvedValue(null);

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', true);
    });

    expect(isOn(screen, 'Regl hatırlatıcısı')).toBe(true);
    expect(screen.queryByText('Hatırlatıcı ayarı kaydedilemedi.')).toBeNull();
  });
});

describe('SettingsScreen pregnancy weekly reminder sync', () => {
  it('syncs after the pregnancy reminder is switched on', async () => {
    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Haftalık gebelik hatırlatıcısı'), 'valueChange', true);
    });

    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs after it is switched off, so the queued one goes', async () => {
    reminderRepository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: false,
      pregnancyWeeklyReminderEnabled: true,
    });

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Haftalık gebelik hatırlatıcısı'), 'valueChange', false);
    });

    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('does not sync for the period reminder, which is a different type', async () => {
    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Regl hatırlatıcısı'), 'valueChange', true);
    });

    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).not.toHaveBeenCalled();
  });

  it('does not sync when the cycle settings are saved, which change no week', async () => {
    const screen = await renderLoaded();

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini azalt'));
    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).not.toHaveBeenCalled();
  });

  it('does not sync when the preference could not be written', async () => {
    reminders.setReminderEnabled.mockRejectedValue(new Error('disk is full'));

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Haftalık gebelik hatırlatıcısı'), 'valueChange', true);
    });

    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).not.toHaveBeenCalled();
  });

  it('keeps the toggle successful when the reminder could not be scheduled', async () => {
    pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mockResolvedValue(null);

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText('Haftalık gebelik hatırlatıcısı'), 'valueChange', true);
    });

    expect(isOn(screen, 'Haftalık gebelik hatırlatıcısı')).toBe(true);
    expect(screen.queryByText('Hatırlatıcı ayarı kaydedilemedi.')).toBeNull();
  });

  it('does not sync when the screen is only opened', async () => {
    await renderLoaded();

    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).not.toHaveBeenCalled();
  });
});

describe('SettingsScreen account link', () => {
  it('offers a way to the account screen', async () => {
    // The section heading went with the section. The way to the account is in
    // the block at the top of the tab now, beside the line that already says
    // what the account would change.
    const screen = await renderLoaded();

    expect(screen.getByText('Hesabı aç')).toBeTruthy();
    expect(screen.getByLabelText('Hesabı aç')).toBeTruthy();
  });

  it('says where the records are, which is what the account would change', async () => {
    // This used to be a paragraph under a heading saying an account was
    // optional and the data stayed on the phone. It is the state line now:
    // the same fact, about this person rather than about accounts in general,
    // and true of whichever state they are actually in.
    const screen = await renderLoaded();

    expect(screen.getByText('Kayıtların yalnızca bu telefonda.')).toBeTruthy();
  });

  it('opens the account route', async () => {
    const push = jest.fn();
    useRouterMock.mockReturnValue({ back, push, replace: jest.fn() });

    const screen = await renderLoaded();

    await fireEvent.press(screen.getByLabelText('Hesabı aç'));

    expect(push).toHaveBeenCalledWith('/(app)/account');
  });

  it('is offered even when the cycle settings could not be read', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('database is locked'));

    const screen = await renderScreen();

    expect(screen.getByLabelText('Hesabı aç')).toBeTruthy();
  });

  it('signs nobody in by itself', async () => {
    await renderLoaded();

    // The settings screen knows nothing about sessions: the link is a link.
    expect(reminders.setReminderEnabled).not.toHaveBeenCalled();
  });
});

describe('when a sync replaces the data underneath', () => {
  beforeEach(() => {
    resetLocalDataChangeListenersForTests();
  });

  it('shows the pulled value without the screen being left and reopened', async () => {
    const screen = await renderLoaded(28, 5);

    expect(screen.getByLabelText('Ortalama döngü süresi: 28 gün')).toBeTruthy();

    // What a pull does: the database now holds another phone's value.
    repository.loadCycleProfile.mockResolvedValue(profile(32, 6));

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Ortalama döngü süresi: 32 gün')).toBeTruthy();
    });
  });

  it('never writes the value that was on screen before the pull', async () => {
    // This is the whole point. The form held 28, a pull made it 32, and the
    // next "Kaydet" must not put 28 back over somebody else's 32.
    const screen = await renderLoaded(28, 5);

    repository.loadCycleProfile.mockResolvedValue(profile(32, 6));

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Ortalama döngü süresi: 32 gün')).toBeTruthy();
    });

    // Edit again on top of the pulled value and save. What lands says which
    // number the form was counting from.
    fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));

    await waitFor(() => {
      expect(screen.getByLabelText('Ortalama döngü süresi: 33 gün')).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    await waitFor(() => {
      expect(repository.saveCycleProfile).toHaveBeenCalled();
    });

    expect(repository.saveCycleProfile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        settings: { averageCycleLengthDays: 33, averagePeriodLengthDays: 6 },
      })
    );
  });

  it('replaces an unsaved edit and says so', async () => {
    const screen = await renderLoaded(28, 5);

    // An unsaved edit: they have tapped "+" but not saved.
    fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));

    await waitFor(() => {
      expect(screen.getByLabelText('Ortalama döngü süresi: 29 gün')).toBeTruthy();
    });

    repository.loadCycleProfile.mockResolvedValue(profile(32, 6));

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(screen.getByText(/Veriler başka bir cihazdan güncellendi/)).toBeTruthy();
    });

    expect(screen.getByLabelText('Ortalama döngü süresi: 32 gün')).toBeTruthy();
  });

  it('says nothing when the form had no unsaved edit', async () => {
    // The value on screen moves, and that is not an interruption: nothing they
    // had typed was thrown away, because they had typed nothing.
    const screen = await renderLoaded(28, 5);

    repository.loadCycleProfile.mockResolvedValue(profile(32, 6));

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Ortalama döngü süresi: 32 gün')).toBeTruthy();
    });

    expect(screen.queryByText(/Veriler başka bir cihazdan güncellendi/)).toBeNull();
  });

  it('says nothing when the screen is simply opened', async () => {
    // Arriving and seeing current data is not an event. A notice for it would
    // be noise on every navigation.
    const screen = await renderLoaded(28, 5);

    expect(screen.queryByText(/Veriler başka bir cihazdan güncellendi/)).toBeNull();
  });

  it('says nothing when the change came from this phone', async () => {
    // Another screen saving something is not an interruption worth a notice.
    const screen = await renderLoaded(28, 5);

    repository.loadCycleProfile.mockResolvedValue(profile(32, 6));

    await act(async () => {
      notifyLocalDataChanged('local');
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Ortalama döngü süresi: 32 gün')).toBeTruthy();
    });

    expect(screen.queryByText(/Veriler başka bir cihazdan güncellendi/)).toBeNull();
  });

  it('drops the notice once they have saved', async () => {
    const screen = await renderLoaded(28, 5);

    fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));

    await waitFor(() => {
      expect(screen.getByLabelText('Ortalama döngü süresi: 29 gün')).toBeTruthy();
    });

    repository.loadCycleProfile.mockResolvedValue(profile(32, 6));

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(screen.getByText(/Veriler başka bir cihazdan güncellendi/)).toBeTruthy();
    });

    // Something to save, so the button is not sitting there disabled.
    fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));

    await waitFor(() => {
      expect(screen.getByLabelText('Ortalama döngü süresi: 33 gün')).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText('Döngü ayarlarını kaydet'));

    await waitFor(() => {
      expect(repository.saveCycleProfile).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByText(/Veriler başka bir cihazdan güncellendi/)).toBeNull();
    });
  });
});

describe('when notifications are blocked for this app', () => {
  it('says nothing while the permission has never been asked for', async () => {
    // "undetermined" is the ordinary starting point. A warning about it would
    // be a warning about nothing.
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('undetermined');

    const screen = await renderLoaded();

    expect(screen.queryByText(NOTIFICATIONS_BLOCKED_NOTICE)).toBeNull();
    expect(screen.queryByLabelText(OPEN_SYSTEM_SETTINGS_LABEL)).toBeNull();
  });

  it('says nothing while notifications are allowed', async () => {
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('granted');

    const screen = await renderLoaded();

    expect(screen.queryByText(NOTIFICATIONS_BLOCKED_NOTICE)).toBeNull();
  });

  it('explains that reminders cannot arrive when the answer is a refusal', async () => {
    // Standing, not tied to a press: while this is true every switch in the
    // section is a promise the phone will not keep.
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('denied');

    const screen = await renderLoaded();

    await waitFor(() => {
      expect(screen.getByText(NOTIFICATIONS_BLOCKED_NOTICE)).toBeTruthy();
    });
  });

  it('offers the way out, which is the only one Android leaves', async () => {
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('denied');

    const screen = await renderLoaded();

    await waitFor(() => {
      expect(screen.getByLabelText(OPEN_SYSTEM_SETTINGS_LABEL)).toBeTruthy();
    });
  });

  it('opens the system settings when that is pressed', async () => {
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('denied');

    const screen = await renderLoaded();

    await waitFor(() => {
      expect(screen.getByLabelText(OPEN_SYSTEM_SETTINGS_LABEL)).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText(OPEN_SYSTEM_SETTINGS_LABEL));

    await waitFor(() => {
      expect(openSettingsMock).toHaveBeenCalledTimes(1);
    });
  });

  it('says so when the settings screen refuses to open', async () => {
    // Somebody who pressed a button and saw nothing happen would press again.
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('denied');
    openSettingsMock.mockRejectedValue(new Error('no activity'));

    const screen = await renderLoaded();

    await waitFor(() => {
      expect(screen.getByLabelText(OPEN_SYSTEM_SETTINGS_LABEL)).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText(OPEN_SYSTEM_SETTINGS_LABEL));

    await waitFor(() => {
      expect(screen.getByText(OPEN_SYSTEM_SETTINGS_FAILED_MESSAGE)).toBeTruthy();
    });
  });

  it('never prompts just because the screen opened', async () => {
    // A permission dialog nobody asked for is a question with no safe answer.
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('denied');

    await renderLoaded();

    expect(permissionModule.ensureNotificationPermission).not.toHaveBeenCalled();
  });

  it('picks up a permission granted while the app was in the background', async () => {
    // Coming back from system settings should show the new answer without
    // anybody having to press a switch to find out.
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('denied');

    const screen = await renderLoaded();

    await waitFor(() => {
      expect(screen.getByText(NOTIFICATIONS_BLOCKED_NOTICE)).toBeTruthy();
    });

    permissionModule.getNotificationPermissionStatus.mockResolvedValue('granted');

    await act(async () => {
      focusAgain();
    });

    await waitFor(() => {
      expect(screen.queryByText(NOTIFICATIONS_BLOCKED_NOTICE)).toBeNull();
    });
  });

  it('keeps the screen usable when the permission cannot be read', async () => {
    permissionModule.getNotificationPermissionStatus.mockRejectedValue(new Error('no module'));

    const screen = await renderLoaded();

    expect(screen.queryByText(NOTIFICATIONS_BLOCKED_NOTICE)).toBeNull();
    expect(screen.getByLabelText('Regl hatırlatıcısı')).toBeTruthy();
  });
});

/**
 * A reminder switched on that the system will not deliver.
 *
 * ## Why these are screen tests and not permission tests
 *
 * There are three ways into this state and the permission layer cannot see any
 * of them. Two of the three - a grant revoked in system settings, and
 * notifications switched off for the whole app - arrive as a response field for
 * field identical to the one an app that has never asked receives, because
 * Android does not distinguish them at query time. The third never asks at all.
 *
 * What the app does know is whether somebody switched a reminder on. So the
 * notice is keyed off the stored preference, which looks like the wrong signal
 * until you know that the right-looking one cannot answer the question. These
 * assertions are what say so.
 *
 * Before this, all three were silent: the switch read on, the queue held
 * nothing, and the screen explained nothing. The failure is invisible by
 * construction - the person is waiting for a notification, so the thing that
 * would tell them something is wrong is the thing that never comes.
 */
describe('a reminder that cannot reach anybody', () => {
  const PERMISSION_MISSING_NOTICE = reminderMessages.tr.reminderPermissionMissingNotice;
  const UNREACHABLE_NOTICE = reminderMessages.tr.reminderUnreachableNotice;
  const GRANT_PERMISSION_LABEL = reminderMessages.tr.grantNotificationPermissionLabel;

  function storedReminderOn() {
    reminderRepository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    });
  }

  it('says so, and offers the dialog, after a grant was revoked in settings', async () => {
    // Route one. The person switched the reminder on, Android said yes, and
    // they later turned notifications off again - so the persisted flag is
    // still the false the grant wrote, and the status reads 'undetermined'.
    storedReminderOn();
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('undetermined');

    const screen = await renderLoaded();

    await waitFor(() => {
      expect(screen.getByText(PERMISSION_MISSING_NOTICE)).toBeTruthy();
    });

    expect(screen.getByLabelText(GRANT_PERMISSION_LABEL)).toBeTruthy();
    // The dialog is available, so nobody is sent on a trip through settings.
    expect(screen.queryByLabelText(OPEN_SYSTEM_SETTINGS_LABEL)).toBeNull();
  });

  it('says so, and offers settings, when notifications are off for the app', async () => {
    // Route two. The permission bit may well still be held; what is off is the
    // app's notifications, which no dialog can turn back on - so the permission
    // layer reports 'denied' and system settings is the only honest route.
    storedReminderOn();
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('denied');

    const screen = await renderLoaded();

    await waitFor(() => {
      expect(screen.getByText(UNREACHABLE_NOTICE)).toBeTruthy();
    });

    expect(screen.getByLabelText(OPEN_SYSTEM_SETTINGS_LABEL)).toBeTruthy();
    expect(screen.queryByLabelText(GRANT_PERMISSION_LABEL)).toBeNull();
  });

  /**
   * Route three, and its own case because it is the one no test would have
   * caught and the one that reaches somebody who did nothing wrong.
   *
   * The preference is on because it came back with their account -
   * `periodReminderEnabled` is carried by cloud sync - and this phone has never
   * been asked for anything. Nothing they did is visible to them as a cause,
   * and the only clue the old build gave was a reminder that never arrived.
   *
   * It also pins what must not happen on the way: a restore must not produce a
   * permission dialog on a screen somebody merely opened.
   */
  it('says so after an account restore onto a phone that was never asked', async () => {
    storedReminderOn();
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('undetermined');

    const screen = await renderLoaded();

    await waitFor(() => {
      expect(screen.getByText(PERMISSION_MISSING_NOTICE)).toBeTruthy();
    });

    expect(screen.getByLabelText(GRANT_PERMISSION_LABEL)).toBeTruthy();
    expect(permissionModule.ensureNotificationPermission).not.toHaveBeenCalled();
  });

  it('shows the switch on while saying it cannot reach anybody', async () => {
    // The contradiction is the point. The switch reports what is stored, which
    // is what the person asked for; the notice reports what the phone will do
    // about it. Hiding either would be the app choosing which half to admit.
    storedReminderOn();
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('undetermined');

    const screen = await renderLoaded();

    await waitFor(() => {
      expect(screen.getByText(PERMISSION_MISSING_NOTICE)).toBeTruthy();
    });

    expect(isOn(screen, 'Regl hatırlatıcısı')).toBe(true);
  });

  it('says nothing while no reminder is switched on', async () => {
    // Unchanged, and the reason the preference is the signal: somebody who has
    // asked for nothing is not waiting for anything, however little permission
    // the app has.
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('undetermined');

    const screen = await renderLoaded();

    expect(screen.queryByText(PERMISSION_MISSING_NOTICE)).toBeNull();
    expect(screen.queryByText(UNREACHABLE_NOTICE)).toBeNull();
    expect(screen.queryByText(NOTIFICATIONS_BLOCKED_NOTICE)).toBeNull();
    expect(screen.queryByLabelText(GRANT_PERMISSION_LABEL)).toBeNull();
  });

  it('says nothing when the reminder will actually arrive', async () => {
    storedReminderOn();
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('granted');

    const screen = await renderLoaded();

    expect(screen.queryByText(PERMISSION_MISSING_NOTICE)).toBeNull();
    expect(screen.queryByText(UNREACHABLE_NOTICE)).toBeNull();
    expect(screen.queryByLabelText(GRANT_PERMISSION_LABEL)).toBeNull();
  });

  it('keeps the blocked notice for the case it was written for', async () => {
    // Nothing switched on and notifications blocked outright. That notice
    // argues about a hypothetical - "açsan bile" - which is right for somebody
    // whose switches are off and wrong for somebody whose switch is on.
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('denied');

    const screen = await renderLoaded();

    await waitFor(() => {
      expect(screen.getByText(NOTIFICATIONS_BLOCKED_NOTICE)).toBeTruthy();
    });

    expect(screen.queryByText(UNREACHABLE_NOTICE)).toBeNull();
  });

  it('shows one notice and never two', async () => {
    // A reminder switched on while notifications are blocked is both states at
    // once, and it only wants telling once.
    storedReminderOn();
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('denied');

    const screen = await renderLoaded();

    await waitFor(() => {
      expect(screen.getByText(UNREACHABLE_NOTICE)).toBeTruthy();
    });

    expect(screen.queryByText(NOTIFICATIONS_BLOCKED_NOTICE)).toBeNull();
  });
});

describe('the button that asks for the permission', () => {
  const GRANT_PERMISSION_LABEL = reminderMessages.tr.grantNotificationPermissionLabel;
  const PERMISSION_MISSING_NOTICE = reminderMessages.tr.reminderPermissionMissingNotice;

  beforeEach(() => {
    reminderRepository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    });
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('undetermined');
  });

  async function pressAsk() {
    const screen = await renderLoaded();

    await waitFor(() => {
      expect(screen.getByLabelText(GRANT_PERMISSION_LABEL)).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText(GRANT_PERMISSION_LABEL));

    return screen;
  }

  it('asks', async () => {
    permissionModule.ensureNotificationPermission.mockResolvedValue('granted');

    await pressAsk();

    await waitFor(() => {
      expect(permissionModule.ensureNotificationPermission).toHaveBeenCalledTimes(1);
    });
  });

  it('builds the queue the preference was already asking for', async () => {
    // The whole repair for the restored account: the preference said yes all
    // along and nothing was queued because the system would not deliver it.
    // This is the moment it can be, and leaving it to the home screen would
    // make the notice's promise come true somewhere else.
    permissionModule.ensureNotificationPermission.mockResolvedValue('granted');

    await pressAsk();

    await waitFor(() => {
      expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalled();
    });

    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalled();
  });

  it('writes no preference, because the preference already says yes', async () => {
    permissionModule.ensureNotificationPermission.mockResolvedValue('granted');

    await pressAsk();

    await waitFor(() => {
      expect(permissionModule.ensureNotificationPermission).toHaveBeenCalledTimes(1);
    });

    expect(reminders.setReminderEnabled).not.toHaveBeenCalled();
    expect(reminderRepository.saveNotificationPreferences).not.toHaveBeenCalled();
  });

  it('stops saying anything once the permission is in hand', async () => {
    permissionModule.ensureNotificationPermission.mockResolvedValue('granted');

    const screen = await pressAsk();

    await waitFor(() => {
      expect(screen.queryByText(PERMISSION_MISSING_NOTICE)).toBeNull();
    });
  });

  it('says so when the answer is no', async () => {
    // Pressed, Android asked, the person said no. Without a line here the
    // press would look like the app losing it: the refusal Android is still
    // willing to reconsider leaves the panel exactly as it was.
    permissionModule.ensureNotificationPermission.mockResolvedValue('undetermined');

    const screen = await pressAsk();

    await waitFor(() => {
      expect(
        screen.getByText(reminderMessages.tr.reminderPermissionDeclinedMessage)
      ).toBeTruthy();
    });
  });

  it('does not tell somebody they need permission to switch on a reminder that is on', async () => {
    // `permissionRefusedMessage` belongs to a switch that failed to move. Here
    // the switch moved weeks ago and the phone is the part that is missing, so
    // borrowing that sentence would be the app talking past the person in the
    // same way the panel around it exists to stop.
    permissionModule.ensureNotificationPermission.mockResolvedValue('undetermined');

    const screen = await pressAsk();

    await waitFor(() => {
      expect(
        screen.getByText(reminderMessages.tr.reminderPermissionDeclinedMessage)
      ).toBeTruthy();
    });

    expect(screen.queryByText(PERMISSION_REFUSED_MESSAGE)).toBeNull();
  });

  it('queues nothing when the answer is no', async () => {
    permissionModule.ensureNotificationPermission.mockResolvedValue('undetermined');

    await pressAsk();

    await waitFor(() => {
      expect(permissionModule.ensureNotificationPermission).toHaveBeenCalledTimes(1);
    });

    expect(reminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).not.toHaveBeenCalled();
  });

  it('hands over to system settings once Android stops offering the dialog', async () => {
    permissionModule.ensureNotificationPermission.mockResolvedValue('denied');

    const screen = await pressAsk();

    await waitFor(() => {
      expect(screen.getByLabelText(OPEN_SYSTEM_SETTINGS_LABEL)).toBeTruthy();
    });

    expect(screen.queryByLabelText(GRANT_PERMISSION_LABEL)).toBeNull();
  });

  it('keeps the screen standing when the request itself fails', async () => {
    permissionModule.ensureNotificationPermission.mockRejectedValue(new Error('no module'));

    const screen = await pressAsk();

    // The notice still says the permission is missing, which is still true.
    await waitFor(() => {
      expect(screen.getByText(PERMISSION_MISSING_NOTICE)).toBeTruthy();
    });

    expect(screen.getByLabelText('Regl hatırlatıcısı')).toBeTruthy();
  });
});

describe('the queue after permission arrives from outside the app', () => {
  beforeEach(() => {
    reminderRepository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    });
  });

  it('builds it on the way back from system settings', async () => {
    // What makes "izin verdiğinde hatırlatıcı çalışmaya başlar" true. Nothing
    // was queued while the system would not deliver, so without this the
    // sentence would come true only when the home screen was next opened -
    // the same defect of naming a remedy that does not happen, one screen on.
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('denied');

    await renderLoaded();

    reminderSync.syncPeriodReminderQuietly.mockClear();
    pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mockClear();

    permissionModule.getNotificationPermissionStatus.mockResolvedValue('granted');

    await act(async () => {
      focusAgain();
    });

    await waitFor(() => {
      expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalled();
    });

    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalled();
  });

  it('does not rebuild it on every focus once the permission is settled', async () => {
    // A rebuild is idempotent, so doing it every time would be harmless and
    // wasteful. It is the arrival that matters, not the state.
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('granted');

    await renderLoaded();

    reminderSync.syncPeriodReminderQuietly.mockClear();
    pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mockClear();

    await act(async () => {
      focusAgain();
    });

    expect(reminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).not.toHaveBeenCalled();
  });

  it('leaves the queue alone when no reminder is switched on', async () => {
    reminderRepository.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: false,
      pregnancyWeeklyReminderEnabled: false,
    });
    permissionModule.getNotificationPermissionStatus.mockResolvedValue('denied');

    await renderLoaded();

    reminderSync.syncPeriodReminderQuietly.mockClear();
    pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mockClear();

    permissionModule.getNotificationPermissionStatus.mockResolvedValue('granted');

    await act(async () => {
      focusAgain();
    });

    expect(reminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).not.toHaveBeenCalled();
  });
});

describe('the about row', () => {
  it('offers a way to what the app says about itself', async () => {
    const screen = await renderLoaded();

    expect(screen.getByLabelText(ABOUT_OPEN_LABEL)).toBeTruthy();
  });

  it('opens the about screen when pressed', async () => {
    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText(ABOUT_OPEN_LABEL));

    expect(push).toHaveBeenCalledWith('/(app)/about');
  });

  it('sits above the section that empties the phone', async () => {
    // Somebody looking for what this app claims about itself should find it
    // before they find the button that deletes everything.
    const screen = await renderLoaded();

    const labels = screen
      .queryAllByRole('button')
      .map((node) => String(node.props.accessibilityLabel ?? ''));

    const aboutIndex = labels.indexOf(ABOUT_OPEN_LABEL);
    const wipeIndex = labels.indexOf(LOCAL_WIPE_OPEN_LABEL);

    expect(aboutIndex).toBeGreaterThanOrEqual(0);
    expect(wipeIndex).toBeGreaterThanOrEqual(0);
    expect(aboutIndex).toBeLessThan(wipeIndex);
  });
});

describe('SettingsScreen discreet notifications', () => {
  it('offers the switch under the two reminders', async () => {
    const screen = await renderLoaded();

    expect(screen.getByLabelText(DISCREET_NOTIFICATIONS_TOGGLE_LABEL)).toBeTruthy();
  });

  it('says why it exists, including that Android will not hide the text', async () => {
    // Somebody deciding this needs the constraint before the feature: the lock
    // screen shows the words whatever the app would prefer.
    const screen = await renderLoaded();

    expect(screen.getByText(DISCREET_NOTIFICATIONS_DESCRIPTION)).toBeTruthy();
    expect(DISCREET_NOTIFICATIONS_DESCRIPTION).toContain('kilit ekranında');
    expect(DISCREET_NOTIFICATIONS_DESCRIPTION).toContain('gizleyemez');
  });

  it('comes up off when nothing has been chosen', async () => {
    const screen = await renderLoaded();

    expect(isOn(screen, DISCREET_NOTIFICATIONS_TOGGLE_LABEL)).toBe(false);
  });

  it('comes up on when this phone has asked for it', async () => {
    reminderRepository.loadDiscreetNotifications.mockResolvedValue(true);

    const screen = await renderLoaded();

    expect(isOn(screen, DISCREET_NOTIFICATIONS_TOGGLE_LABEL)).toBe(true);
  });

  it('reads it from the device rather than from the synced preferences', async () => {
    await renderLoaded();

    expect(reminderRepository.loadDiscreetNotifications).toHaveBeenCalledTimes(1);
  });

  it('sends the change to its own use case, not to the reminder one', async () => {
    // The reminder use case asks Android for a notification permission before
    // it writes. Nothing here needs one.
    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText(DISCREET_NOTIFICATIONS_TOGGLE_LABEL), 'valueChange', true);
    });

    expect(discreet.setDiscreetNotifications).toHaveBeenCalledTimes(1);
    expect(discreet.setDiscreetNotifications.mock.calls[0][1]).toBe(true);
    expect(reminders.setReminderEnabled).not.toHaveBeenCalled();
  });

  it('turns the switch on', async () => {
    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText(DISCREET_NOTIFICATIONS_TOGGLE_LABEL), 'valueChange', true);
    });

    expect(isOn(screen, DISCREET_NOTIFICATIONS_TOGGLE_LABEL)).toBe(true);
  });

  it('turns it back off again', async () => {
    reminderRepository.loadDiscreetNotifications.mockResolvedValue(true);

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText(DISCREET_NOTIFICATIONS_TOGGLE_LABEL), 'valueChange', false);
    });

    expect(discreet.setDiscreetNotifications.mock.calls[0][1]).toBe(false);
    expect(isOn(screen, DISCREET_NOTIFICATIONS_TOGGLE_LABEL)).toBe(false);
  });

  /**
   * The one switch where an optimistic answer would be worse than none.
   *
   * Somebody who believes their lock screen is quiet behaves differently from
   * somebody who knows it is not, so a failed write has to leave the switch
   * showing what is actually stored.
   */
  it('does not show itself on when the change failed', async () => {
    discreet.setDiscreetNotifications.mockRejectedValue(new Error('disk is full'));

    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText(DISCREET_NOTIFICATIONS_TOGGLE_LABEL), 'valueChange', true);
    });

    expect(isOn(screen, DISCREET_NOTIFICATIONS_TOGGLE_LABEL)).toBe(false);
    expect(screen.getByText('Hatırlatıcı ayarı kaydedilemedi.')).toBeTruthy();
  });

  it('asks for no notification permission', async () => {
    const screen = await renderLoaded();

    await act(async () => {
      fireEvent(screen.getByLabelText(DISCREET_NOTIFICATIONS_TOGGLE_LABEL), 'valueChange', true);
    });

    expect(permissionModule.ensureNotificationPermission).not.toHaveBeenCalled();
  });
});

describe('SettingsScreen under the floating tab bar', () => {
  it('leaves room for the bar so its last row is not hidden under it', async () => {
    const screen = await renderLoaded();

    expectClearsTabBar(screen.toJSON());
  });
});

/**
 * The profile tab, which is ours.
 *
 * The app this follows structurally has a tab for the person; its store
 * screenshots show four words along the bottom and nothing of what any of them
 * opens. So the architecture is taken and the screen is not - there was
 * nothing here to copy.
 *
 * What was wrong: the tab opened with the cycle-length steppers, which are a
 * setting, and the account - the one identifying thing on it - was a button
 * somebody had to press to find out their own state.
 */
describe('SettingsScreen as the profile tab', () => {
  it('says where the records are without being asked', async () => {
    const screen = await renderLoaded(28, 5);

    expect(screen.getByText('Kayıtların yalnızca bu telefonda.')).toBeTruthy();
  });

  it('names the whole screen rather than one of its sections', async () => {
    const screen = await renderLoaded(28, 5);

    expect(screen.getByText('Profil')).toBeTruthy();
  });

  it('keeps the cycle settings, as a section with its own heading', async () => {
    const screen = await renderLoaded(28, 5);

    expect(screen.getByText('Döngü ayarları')).toBeTruthy();
    expect(screen.getByLabelText('Döngü ayarlarını kaydet')).toBeTruthy();
  });

  it('offers one way to the account, not two', async () => {
    const screen = await renderLoaded(28, 5);

    expect(screen.queryAllByLabelText('Hesabı aç')).toHaveLength(1);
  });
});

/**
 * The app-lock status sits with its section, not after its button.
 *
 * It rendered last in the block, so "Açık" appeared alone beneath the control
 * with the next section's heading right after it. On a device it read as a
 * stray word, or as a heading of its own. The order a person reads is what
 * this is, what it does, what state it is in, and then how to change it.
 *
 * Asserted as order rather than as pixels: the status has to come before the
 * button in the tree, which is the whole of the change.
 */
describe('the app lock section order', () => {
  it('puts the status before the button that changes it', async () => {
    const screen = await renderScreen();

    await screen.findByText('Kapalı');

    // One snapshot, walked once. `toJSON` builds a new tree per call, so
    // nodes from a query are never the same objects as nodes in it.
    const flat: any[] = [];
    const walk = (current: any) => {
      if (Array.isArray(current)) return current.forEach(walk);
      if (current === null || typeof current !== 'object') return;
      flat.push(current);
      walk(current.children);
    };

    walk(screen.toJSON());

    const statusAt = flat.findIndex((node) => node.children?.[0] === 'Kapalı');
    const buttonAt = flat.findIndex(
      (node) => node.props?.accessibilityLabel === 'Uygulama kilidini kur'
    );

    expect(statusAt).toBeGreaterThanOrEqual(0);
    expect(buttonAt).toBeGreaterThanOrEqual(0);
    expect(statusAt).toBeLessThan(buttonAt);
  });
});

/**
 * The account row says what pressing it does, for the state the person is in.
 *
 * One constant was used for both, so somebody signed in read "Hesabı aç" on
 * the line directly below their own address - the screen offering to open a
 * thing it had just told them they had.
 *
 * Asserted on the screen rather than on the catalogue. The catalogue test next
 * door checks the two strings differ, and it stayed green when the screen was
 * reverted to using one of them for both - which is the whole defect.
 */
describe('the account row label', () => {
  const auth = jest.requireMock('@/features/auth/data/auth-repository') as {
    observeAuthUser: jest.Mock;
    getCurrentAuthUser: jest.Mock;
  };

  afterEach(() => {
    auth.observeAuthUser.mockImplementation((listener: (user: unknown) => void) => {
      listener(null);

      return () => {};
    });
    auth.getCurrentAuthUser.mockReturnValue(null);
  });

  it('offers to open an account when there is not one', async () => {
    const screen = await renderScreen();

    expect(await screen.findByLabelText('Hesabı aç')).toBeTruthy();
    expect(screen.queryByLabelText('Hesabı yönet')).toBeNull();
  });

  it('offers to manage the account when there is one', async () => {
    const user = { uid: 'uid-1', email: 'biri@ornek.com' };

    auth.observeAuthUser.mockImplementation((listener: (value: unknown) => void) => {
      listener(user);

      return () => {};
    });
    auth.getCurrentAuthUser.mockReturnValue(user);

    const screen = await renderScreen();

    expect(await screen.findByLabelText('Hesabı yönet')).toBeTruthy();
    expect(screen.queryByLabelText('Hesabı aç')).toBeNull();
  });
});

/**
 * Which of the two buttons is the loud one.
 *
 * The rule and the reason are in `jest/assert-destructive-confirmation.ts`.
 */
describe('SettingsScreen wipe confirmation weights', () => {
  it('fills Cancel and outlines the wipe, with Cancel first', async () => {
    const screen = await renderLoaded();

    await fireEvent.press(screen.getByLabelText(LOCAL_WIPE_OPEN_LABEL));

    const buttons = screen.queryAllByRole('button').map((node) => ({
      label: String(node.props.accessibilityLabel ?? ''),
      style: node.props.style,
    }));

    expectDestructiveConfirmation(
      buttons,
      {
        cancel: deletionMessages.tr.localWipeCancelLabel,
        destructive: deletionMessages.tr.localWipeConfirmLabel,
      },
      Colors.light.primary
    );
  });
});
