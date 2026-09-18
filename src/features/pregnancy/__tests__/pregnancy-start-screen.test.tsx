import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import PregnancyStartScreen from '@/app/(app)/pregnancy-start';
import type { PregnancyProfile } from '@/features/pregnancy/domain/types';
import type { ISODate } from '@/types/iso-date';
import { getTodayLocalISODate } from '@/utils/today';

// The database is faked. The use case, the repository contract and the due-date
// formula stay real, so what the screen saves is what the app would store.
jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  savePregnancyProfile: jest.fn(),
  loadPregnancyProfile: jest.fn(),
}));

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

// The weekly pregnancy reminder syncs after a start or a stop. Faked so the
// calls can be counted; it is quiet by contract, so the real one would do
// nothing here.
jest.mock('@/features/notifications/application/sync-pregnancy-weekly-reminder', () => ({
  syncPregnancyWeeklyReminderQuietly: jest.fn(),
  syncPregnancyWeeklyReminder: jest.fn(),
}));

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const reminderSync = jest.requireMock('@/features/notifications/application/sync-pregnancy-weekly-reminder');
const useRouterMock = useRouter as unknown as jest.Mock;
const getTodayMock = getTodayLocalISODate as unknown as jest.Mock;

let back: jest.Mock;

function savedProfile(): PregnancyProfile {
  return repository.savePregnancyProfile.mock.calls[0][1] as PregnancyProfile;
}

beforeEach(() => {
  db.openAppDatabase.mockReset();
  db.openAppDatabase.mockResolvedValue({});
  reminderSync.syncPregnancyWeeklyReminderQuietly.mockReset();
  reminderSync.syncPregnancyWeeklyReminderQuietly.mockResolvedValue(null);
  repository.savePregnancyProfile.mockReset();
  repository.savePregnancyProfile.mockResolvedValue(undefined);
  repository.loadPregnancyProfile.mockReset();
  repository.loadPregnancyProfile.mockResolvedValue(null);

  back = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ back, push: jest.fn(), replace: jest.fn() });

  getTodayMock.mockReset();
  getTodayMock.mockReturnValue('2026-09-18' as ISODate);
});

describe('PregnancyStartScreen header', () => {
  it('names the screen and says what the date is for', async () => {
    const { getByText } = await render(<PregnancyStartScreen />);

    expect(getByText('Gebelik takibini başlat')).toBeTruthy();
    expect(
      getByText(
        'Son regl döneminin başladığı günü seç. Gebelik haftaları ve tahmini doğum tarihi bu güne göre hesaplanır.'
      )
    ).toBeTruthy();
  });

  it('offers a way back', async () => {
    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Geri'));

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('writes nothing on arrival', async () => {
    await render(<PregnancyStartScreen />);

    expect(repository.savePregnancyProfile).not.toHaveBeenCalled();
  });
});

describe('PregnancyStartScreen date stepper', () => {
  it('starts on today', async () => {
    const { getByLabelText } = await render(<PregnancyStartScreen />);

    expect(getByLabelText('Seçilen son regl başlangıcı: 18 Eylül 2026')).toBeTruthy();
  });

  it('steps back a day', async () => {
    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.getByLabelText('Seçilen son regl başlangıcı: 17 Eylül 2026')).toBeTruthy();
  });

  it('keeps stepping back', async () => {
    const screen = await render(<PregnancyStartScreen />);

    for (let step = 0; step < 16; step += 1) {
      await fireEvent.press(screen.getByLabelText('Önceki gün'));
    }

    expect(screen.getByLabelText('Seçilen son regl başlangıcı: 2 Eylül 2026')).toBeTruthy();
  });

  it('rolls over into the previous month', async () => {
    getTodayMock.mockReturnValue('2026-09-01' as ISODate);

    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.getByLabelText('Seçilen son regl başlangıcı: 31 Ağustos 2026')).toBeTruthy();
  });

  it('rolls over into the previous year', async () => {
    getTodayMock.mockReturnValue('2027-01-01' as ISODate);

    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.getByLabelText('Seçilen son regl başlangıcı: 31 Aralık 2026')).toBeTruthy();
  });

  it('steps forward again', async () => {
    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(screen.getByLabelText('Seçilen son regl başlangıcı: 17 Eylül 2026')).toBeTruthy();
  });

  it('refuses to reach a day that has not happened yet', async () => {
    const screen = await render(<PregnancyStartScreen />);

    const forward = screen.getByLabelText('Sonraki gün');

    expect(forward.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(forward);

    expect(screen.getByLabelText('Seçilen son regl başlangıcı: 18 Eylül 2026')).toBeTruthy();
  });

  it('opens the way forward again once the date is in the past', async () => {
    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.getByLabelText('Sonraki gün').props.accessibilityState.disabled).toBe(false);
  });

  it('leaves the way back open with no lower bound', async () => {
    const screen = await render(<PregnancyStartScreen />);

    expect(screen.getByLabelText('Önceki gün').props.accessibilityState.disabled).toBe(false);
  });
});

describe('PregnancyStartScreen save', () => {
  it('stores a profile dated from the day on screen', async () => {
    const screen = await render(<PregnancyStartScreen />);

    for (let step = 0; step < 16; step += 1) {
      await fireEvent.press(screen.getByLabelText('Önceki gün'));
    }
    await fireEvent.press(screen.getByLabelText('Gebelik takibini başlat'));

    expect(savedProfile()).toEqual({
      lastMenstrualPeriodStartDate: '2026-09-02',
      estimatedDueDate: '2027-06-09',
      dueDateSource: 'lmp',
    });
  });

  it('stores today when nothing was stepped', async () => {
    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Gebelik takibini başlat'));

    expect(savedProfile().lastMenstrualPeriodStartDate).toBe('2026-09-18');
    expect(savedProfile().dueDateSource).toBe('lmp');
  });

  it('goes back once the write lands', async () => {
    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Gebelik takibini başlat'));

    expect(repository.savePregnancyProfile).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('opens the database through the shared connection', async () => {
    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Gebelik takibini başlat'));

    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
  });

  it('locks the screen while the write is in flight', async () => {
    let finishWrite: () => void = () => {};
    repository.savePregnancyProfile.mockReturnValue(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      })
    );

    const screen = await render(<PregnancyStartScreen />);

    const press = fireEvent.press(screen.getByLabelText('Gebelik takibini başlat'));

    await waitFor(() => {
      expect(screen.getByText('Başlatılıyor...')).toBeTruthy();
    });

    expect(
      screen.getByLabelText('Gebelik takibini başlat').props.accessibilityState.disabled
    ).toBe(true);
    expect(screen.getByLabelText('Önceki gün').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Sonraki gün').props.accessibilityState.disabled).toBe(true);

    finishWrite();
    await press;

    expect(repository.savePregnancyProfile).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('PregnancyStartScreen when saving fails', () => {
  async function failToSave() {
    repository.savePregnancyProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Gebelik takibini başlat'));

    return screen;
  }

  it('says so', async () => {
    const screen = await failToSave();

    expect(screen.getByText('Gebelik takibi başlatılamadı.')).toBeTruthy();
  });

  it('announces it', async () => {
    const screen = await failToSave();

    expect(screen.getByText('Gebelik takibi başlatılamadı.').props.accessibilityRole).toBe(
      'alert'
    );
  });

  it('stays on the screen', async () => {
    const screen = await failToSave();

    expect(back).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Gebelik takibini başlat')).toBeTruthy();
  });

  it('keeps the date that was picked', async () => {
    const screen = await failToSave();

    expect(screen.getByLabelText('Seçilen son regl başlangıcı: 17 Eylül 2026')).toBeTruthy();
  });

  it('can be tried again', async () => {
    const screen = await failToSave();

    repository.savePregnancyProfile.mockResolvedValue(undefined);

    await fireEvent.press(screen.getByLabelText('Gebelik takibini başlat'));

    expect(repository.savePregnancyProfile).toHaveBeenCalledTimes(2);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('clears the error when the date is changed', async () => {
    const screen = await failToSave();

    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.queryByText('Gebelik takibi başlatılamadı.')).toBeNull();
  });
});

describe('PregnancyStartScreen scope', () => {
  it('offers back, the two day steps and start, and nothing else', async () => {
    const { queryAllByRole } = await render(<PregnancyStartScreen />);

    expect(
      queryAllByRole('button').map((node) => node.props.accessibilityLabel as string)
    ).toEqual(['Geri', 'Önceki gün', 'Sonraki gün', 'Gebelik takibini başlat']);
  });

  it('shows nothing about the pregnancy before it has started', async () => {
    const { queryByText } = await render(<PregnancyStartScreen />);

    // No week count, no due date, no mode switch: none of it exists yet.
    for (const forbidden of ['Tahmini doğum tarihi', 'Gebelik haftası', 'Hafta', 'Gebelik modu']) {
      expect(queryByText(forbidden)).toBeNull();
    }
  });
});

describe('PregnancyStartScreen weekly reminder sync', () => {
  it('syncs once the pregnancy is stored', async () => {
    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Gebelik takibini başlat'));

    expect(repository.savePregnancyProfile).toHaveBeenCalledTimes(1);
    expect(reminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs on the database the screen already opened', async () => {
    const handle = {};
    db.openAppDatabase.mockResolvedValue(handle);

    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Gebelik takibini başlat'));

    expect(reminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledWith(handle);
  });

  it('does not sync when the write failed', async () => {
    repository.savePregnancyProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Gebelik takibini başlat'));

    expect(reminderSync.syncPregnancyWeeklyReminderQuietly).not.toHaveBeenCalled();
  });

  it('keeps the start successful when the reminder could not be queued', async () => {
    reminderSync.syncPregnancyWeeklyReminderQuietly.mockResolvedValue(null);

    const screen = await render(<PregnancyStartScreen />);

    await fireEvent.press(screen.getByLabelText('Gebelik takibini başlat'));

    expect(screen.queryByText('Gebelik takibi başlatılamadı.')).toBeNull();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('does not sync when the screen is only opened', async () => {
    await render(<PregnancyStartScreen />);

    expect(reminderSync.syncPregnancyWeeklyReminderQuietly).not.toHaveBeenCalled();
  });
});
