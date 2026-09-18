import { fireEvent, render, waitFor } from '@testing-library/react-native';
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

// The widget sync is faked so the screen's calls to it can be counted. It is
// quiet by contract, so the real one would do nothing under Jest anyway.
jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshotQuietly: jest.fn(),
  syncWidgetSnapshot: jest.fn(),
}));

const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const widgetSync = jest.requireMock('@/features/widget/application/sync-widget-snapshot');
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
  it('offers back, both steppers and save, and nothing else', async () => {
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
