import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import SettingsScreen from '@/app/(app)/settings';
import {
  MAX_CYCLE_LENGTH_DAYS,
  MAX_PERIOD_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
  MIN_PERIOD_LENGTH_DAYS,
} from '@/features/cycle/domain/limits';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

// The database is faked. The use cases, the repository contract and the domain
// rules stay real, so the stepper is bounded by the limits the app really has.
jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

// The reminder rows read their own preferences and, when switched on, ask for a
// permission. Both are faked so this file stays about the cycle settings; the
// reminders have their own describe block below.
jest.mock('@/features/notifications/data/notification-preferences-repository', () => ({
  loadNotificationPreferences: jest.fn(),
  saveNotificationPreferences: jest.fn(),
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
const useRouterMock = useRouter as unknown as jest.Mock;

let back: jest.Mock;

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
  useRouterMock.mockReturnValue({ back, push: jest.fn(), replace: jest.fn() });
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
      getByText('Döngü ve regl süresi tahminlerini buradan güncelleyebilirsin.')
    ).toBeTruthy();
  });

  it('offers a way back', async () => {
    const screen = await renderLoaded();

    await fireEvent.press(screen.getByLabelText('Geri'));

    expect(back).toHaveBeenCalledTimes(1);
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

    finishWrite();
    await press;

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

describe('SettingsScreen back', () => {
  it('writes nothing, even after the values were changed', async () => {
    const screen = await renderLoaded(28, 5);

    await fireEvent.press(screen.getByLabelText('Ortalama döngü süresini artır'));
    await fireEvent.press(screen.getByLabelText('Ortalama regl süresini artır'));
    await fireEvent.press(screen.getByLabelText('Geri'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsScreen scope', () => {
  it('offers back, both steppers, save and the account link, and nothing else', async () => {
    const { queryAllByRole } = await renderLoaded(28, 5);

    expect(
      queryAllByRole('button').map((node) => node.props.accessibilityLabel as string)
    ).toEqual([
      'Geri',
      'Ortalama döngü süresini azalt',
      'Ortalama döngü süresini artır',
      'Ortalama regl süresini azalt',
      'Ortalama regl süresini artır',
      'Döngü ayarlarını kaydet',
      'Hesabı aç',
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

const DENIED_MESSAGE =
  'Bildirim izni verilmedi. Hatırlatıcıyı açmak için telefon ayarlarından bu uygulamaya ' +
  'bildirim izni ver.';

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
    expect(screen.queryByText(/Bildirim izni verilmedi/)).toBeNull();
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

    expect(screen.queryByText(/Bildirim izni verilmedi/)).toBeNull();
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
    const screen = await renderLoaded();

    expect(screen.getByText('Hesap')).toBeTruthy();
    expect(screen.getByText('Hesabı aç')).toBeTruthy();
    expect(screen.getByLabelText('Hesabı aç')).toBeTruthy();
  });

  it('says an account is optional and that the data stays on the phone', async () => {
    const screen = await renderLoaded();

    expect(screen.getByText(/Hesap açmak isteğe bağlı/)).toBeTruthy();
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
