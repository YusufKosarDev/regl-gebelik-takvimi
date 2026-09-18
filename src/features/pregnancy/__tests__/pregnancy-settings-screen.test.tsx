import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import PregnancySettingsScreen from '@/app/(app)/pregnancy-settings';
import { calculateEstimatedDueDate } from '@/features/pregnancy/domain/due-date';
import type { PregnancyProfile } from '@/features/pregnancy/domain/types';
import type { ISODate } from '@/types/iso-date';
import { getTodayLocalISODate } from '@/utils/today';

// The database is faked. The use case, the repository contract and the domain
// rules stay real, so what the screen saves is what the app would store.
jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  savePregnancyProfile: jest.fn(),
  loadPregnancyProfile: jest.fn(),
  clearPregnancyProfile: jest.fn(),
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

const date = (value: string) => value as ISODate;

const LMP = '2026-09-02';
const CALCULATED = calculateEstimatedDueDate(date(LMP));

let back: jest.Mock;

function profile(overrides: Partial<PregnancyProfile> = {}): PregnancyProfile {
  return {
    lastMenstrualPeriodStartDate: date(LMP),
    estimatedDueDate: CALCULATED,
    dueDateSource: 'lmp',
    ...overrides,
  };
}

function savedProfile(): PregnancyProfile {
  return repository.savePregnancyProfile.mock.calls[0][1] as PregnancyProfile;
}

beforeEach(() => {
  db.openAppDatabase.mockReset();
  db.openAppDatabase.mockResolvedValue({});
  reminderSync.syncPregnancyWeeklyReminderQuietly.mockReset();
  reminderSync.syncPregnancyWeeklyReminderQuietly.mockResolvedValue(null);
  repository.loadPregnancyProfile.mockReset();
  repository.loadPregnancyProfile.mockResolvedValue(profile());
  repository.savePregnancyProfile.mockReset();
  repository.savePregnancyProfile.mockResolvedValue(undefined);
  repository.clearPregnancyProfile.mockReset();
  repository.clearPregnancyProfile.mockResolvedValue(undefined);

  back = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ back, push: jest.fn(), replace: jest.fn() });

  getTodayMock.mockReset();
  getTodayMock.mockReturnValue(date('2026-09-18'));
});

async function renderScreen() {
  const screen = await render(<PregnancySettingsScreen />);

  await waitFor(() => {
    expect(screen.queryByTestId('pregnancy-settings-loading')).toBeNull();
  });

  return screen;
}

describe('PregnancySettingsScreen while loading', () => {
  it('shows a spinner and a message', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { getByTestId, getByText } = await render(<PregnancySettingsScreen />);

    expect(getByTestId('pregnancy-settings-loading')).toBeTruthy();
    expect(getByText('Veriler yükleniyor')).toBeTruthy();
  });
});

describe('PregnancySettingsScreen header', () => {
  it('names the screen and says what it is for', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Gebelik ayarları')).toBeTruthy();
    expect(getByText(/Tahmini doğum tarihini düzeltebilir/)).toBeTruthy();
  });

  it('offers a way back', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Geri'));

    expect(back).toHaveBeenCalledTimes(1);
    expect(repository.savePregnancyProfile).not.toHaveBeenCalled();
  });
});

describe('PregnancySettingsScreen with nothing tracked', () => {
  beforeEach(() => {
    repository.loadPregnancyProfile.mockResolvedValue(null);
  });

  it('says so', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Takip edilen bir gebelik bulunamadı.')).toBeTruthy();
  });

  it('offers nothing to edit', async () => {
    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Tahmini doğum tarihini düzenle')).toBeNull();
    expect(queryByLabelText('Son regl tarihine göre hesaplanan tarihe dön')).toBeNull();
  });
});

describe('PregnancySettingsScreen when loading fails', () => {
  beforeEach(() => {
    repository.loadPregnancyProfile.mockRejectedValue(new Error('database is locked'));
  });

  it('says so and announces it', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Gebelik ayarları yüklenemedi.')).toBeTruthy();
    expect(getByText('Gebelik ayarları yüklenemedi.').props.accessibilityRole).toBe('alert');
  });

  it('offers nothing to edit', async () => {
    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Tahmini doğum tarihini düzenle')).toBeNull();
  });
});

describe('PregnancySettingsScreen showing the stored date', () => {
  it('shows a calculated date and says where it came from', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Tahmini doğum tarihi')).toBeTruthy();
    expect(getByText('9 Haziran 2027')).toBeTruthy();
    expect(getByText('Son regl tarihine göre')).toBeTruthy();
  });

  it('shows an adjusted date and says it was corrected', async () => {
    repository.loadPregnancyProfile.mockResolvedValue(
      profile({ estimatedDueDate: date('2027-06-04'), dueDateSource: 'adjusted' })
    );

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('4 Haziran 2027')).toBeTruthy();
    expect(getByText('Düzeltilmiş tarih')).toBeTruthy();
    expect(queryByText('Son regl tarihine göre')).toBeNull();
  });

  it('exposes it to assistive technology', async () => {
    const { getByLabelText } = await renderScreen();

    expect(
      getByLabelText('Tahmini doğum tarihi: 9 Haziran 2027, Son regl tarihine göre')
    ).toBeTruthy();
  });

  it('writes nothing on arrival', async () => {
    await renderScreen();

    expect(repository.savePregnancyProfile).not.toHaveBeenCalled();
  });
});

describe('PregnancySettingsScreen going back to the calculated date', () => {
  it('is offered only when the date was adjusted', async () => {
    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Son regl tarihine göre hesaplanan tarihe dön')).toBeNull();
  });

  it('is offered when the date was adjusted', async () => {
    repository.loadPregnancyProfile.mockResolvedValue(
      profile({ estimatedDueDate: date('2027-06-04'), dueDateSource: 'adjusted' })
    );

    const { getByText } = await renderScreen();

    expect(getByText('LMP hesabına dön')).toBeTruthy();
  });

  it('stores the calculated date and leaves', async () => {
    repository.loadPregnancyProfile.mockResolvedValue(
      profile({ estimatedDueDate: date('2027-06-04'), dueDateSource: 'adjusted' })
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('Son regl tarihine göre hesaplanan tarihe dön')
    );

    expect(savedProfile()).toEqual({
      lastMenstrualPeriodStartDate: LMP,
      estimatedDueDate: CALCULATED,
      dueDateSource: 'lmp',
    });
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('PregnancySettingsScreen editing the date', () => {
  it('opens on the stored date', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));

    expect(screen.getByText('Tahmini doğum tarihini düzenle')).toBeTruthy();
    expect(screen.getByLabelText('Seçilen tahmini doğum tarihi: 9 Haziran 2027')).toBeTruthy();
  });

  it('shows the last menstrual period it is bounded by', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));

    expect(screen.getByText('Son regl başlangıcı: 2 Eylül 2026')).toBeTruthy();
  });

  it('steps back a day', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));
    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.getByLabelText('Seçilen tahmini doğum tarihi: 8 Haziran 2027')).toBeTruthy();
  });

  it('steps forward a day', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(screen.getByLabelText('Seçilen tahmini doğum tarihi: 10 Haziran 2027')).toBeTruthy();
  });

  it('rolls over into the next month', async () => {
    repository.loadPregnancyProfile.mockResolvedValue(
      profile({ estimatedDueDate: date('2027-06-30'), dueDateSource: 'adjusted' })
    );

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(screen.getByLabelText('Seçilen tahmini doğum tarihi: 1 Temmuz 2027')).toBeTruthy();
  });

  it('stops at the day the pregnancy began', async () => {
    repository.loadPregnancyProfile.mockResolvedValue(
      profile({ estimatedDueDate: date(LMP), dueDateSource: 'adjusted' })
    );

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));

    const back = screen.getByLabelText('Önceki gün');

    expect(back.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(back);

    expect(screen.getByLabelText('Seçilen tahmini doğum tarihi: 2 Eylül 2026')).toBeTruthy();
  });

  it('sets no upper bound on the way forward', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));

    expect(screen.getByLabelText('Sonraki gün').props.accessibilityState.disabled).toBe(false);
  });

  it('stores the picked date as a measured one and leaves', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini kaydet'));

    expect(savedProfile()).toEqual({
      lastMenstrualPeriodStartDate: LMP,
      estimatedDueDate: '2027-06-07',
      dueDateSource: 'adjusted',
    });
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('marks an unchanged date as measured, which is a real change', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));
    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini kaydet'));

    expect(savedProfile().dueDateSource).toBe('adjusted');
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when the editor is cancelled', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(repository.savePregnancyProfile).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Tahmini doğum tarihini düzenle')).toBeTruthy();
  });

  it('forgets the date that was picked when reopened', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));

    expect(screen.getByLabelText('Seçilen tahmini doğum tarihi: 9 Haziran 2027')).toBeTruthy();
  });
});

describe('PregnancySettingsScreen when saving fails', () => {
  async function failToSave() {
    repository.savePregnancyProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini kaydet'));

    return screen;
  }

  it('says so and announces it', async () => {
    const screen = await failToSave();

    expect(screen.getByText('Tahmini doğum tarihi güncellenemedi.')).toBeTruthy();
    expect(
      screen.getByText('Tahmini doğum tarihi güncellenemedi.').props.accessibilityRole
    ).toBe('alert');
  });

  it('stays on the screen with the date that was picked', async () => {
    const screen = await failToSave();

    expect(back).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Seçilen tahmini doğum tarihi: 8 Haziran 2027')).toBeTruthy();
  });

  it('can be tried again', async () => {
    const screen = await failToSave();

    repository.savePregnancyProfile.mockResolvedValue(undefined);

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini kaydet'));

    expect(repository.savePregnancyProfile).toHaveBeenCalledTimes(2);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('locks the screen while the write is in flight', async () => {
    let finishWrite: () => void = () => {};
    repository.savePregnancyProfile.mockReturnValue(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      })
    );

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));
    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    const press = fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Kaydediliyor...')).toBeTruthy();
    });

    expect(
      screen.getByLabelText('Tahmini doğum tarihini kaydet').props.accessibilityState.disabled
    ).toBe(true);
    expect(screen.getByLabelText('Önceki gün').props.accessibilityState.disabled).toBe(true);

    finishWrite();
    await press;

    expect(repository.savePregnancyProfile).toHaveBeenCalledTimes(1);
  });
});

describe('PregnancySettingsScreen scope', () => {
  it('offers back and the three actions, and nothing else', async () => {
    repository.loadPregnancyProfile.mockResolvedValue(
      profile({ estimatedDueDate: date('2027-06-04'), dueDateSource: 'adjusted' })
    );

    const { queryAllByRole } = await renderScreen();

    expect(
      queryAllByRole('button').map((node) => node.props.accessibilityLabel as string)
    ).toEqual([
      'Geri',
      'Tahmini doğum tarihini düzenle',
      'Son regl tarihine göre hesaplanan tarihe dön',
      'Gebelik takibini sonlandırmayı seç',
    ]);
  });

  it('offers no way to change the last menstrual period', async () => {
    const { queryByText } = await renderScreen();

    expect(queryByText('Son regl başlangıcını düzenle')).toBeNull();
  });
});

describe('PregnancySettingsScreen stopping the tracking', () => {
  it('offers it', async () => {
    const { getByText, getByLabelText } = await renderScreen();

    expect(getByText('Gebelik takibini sonlandır')).toBeTruthy();
    expect(getByLabelText('Gebelik takibini sonlandırmayı seç')).toBeTruthy();
  });

  it('is absent when nothing is tracked', async () => {
    repository.loadPregnancyProfile.mockResolvedValue(null);

    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Gebelik takibini sonlandırmayı seç')).toBeNull();
  });

  it('asks before doing anything', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandırmayı seç'));

    expect(screen.getByText('Gebelik takibini sonlandırmak istiyor musun?')).toBeTruthy();
    expect(screen.getByText('Gebelik takip bilgilerin silinecek.')).toBeTruthy();
    expect(repository.clearPregnancyProfile).not.toHaveBeenCalled();
  });

  it('offers both answers', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandırmayı seç'));

    expect(screen.getByLabelText('Vazgeç')).toBeTruthy();
    expect(screen.getByLabelText('Gebelik takibini sonlandır')).toBeTruthy();
  });

  it('closes the confirmation on Vazgeç without clearing', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandırmayı seç'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(repository.clearPregnancyProfile).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    expect(screen.queryByText('Gebelik takibini sonlandırmak istiyor musun?')).toBeNull();
    expect(screen.getByLabelText('Gebelik takibini sonlandırmayı seç')).toBeTruthy();
  });

  it('clears the pregnancy and leaves on confirmation', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandırmayı seç'));
    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandır'));

    expect(repository.clearPregnancyProfile).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('writes no pregnancy on the way out', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandırmayı seç'));
    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandır'));

    expect(repository.savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('gives way to the date editor rather than showing both', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandırmayı seç'));
    expect(screen.getByText('Gebelik takibini sonlandırmak istiyor musun?')).toBeTruthy();

    // The editor is reached by answering the confirmation first.
    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));

    expect(screen.queryByText('Gebelik takibini sonlandırmak istiyor musun?')).toBeNull();
    expect(screen.getByLabelText('Seçilen tahmini doğum tarihi: 9 Haziran 2027')).toBeTruthy();
  });

  it('is not offered while the date editor is open', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));

    expect(screen.queryByLabelText('Gebelik takibini sonlandırmayı seç')).toBeNull();
  });
});

describe('PregnancySettingsScreen when stopping fails', () => {
  async function failToStop() {
    repository.clearPregnancyProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandırmayı seç'));
    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandır'));

    return screen;
  }

  it('says so and announces it', async () => {
    const screen = await failToStop();

    expect(screen.getByText('Gebelik takibi sonlandırılamadı.')).toBeTruthy();
    expect(screen.getByText('Gebelik takibi sonlandırılamadı.').props.accessibilityRole).toBe(
      'alert'
    );
  });

  it('keeps the confirmation open and stays on the screen', async () => {
    const screen = await failToStop();

    expect(back).not.toHaveBeenCalled();
    expect(screen.getByText('Gebelik takibini sonlandırmak istiyor musun?')).toBeTruthy();
  });

  it('can be tried again', async () => {
    const screen = await failToStop();

    repository.clearPregnancyProfile.mockResolvedValue(undefined);

    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandır'));

    expect(repository.clearPregnancyProfile).toHaveBeenCalledTimes(2);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('clears the message when the confirmation is dismissed', async () => {
    const screen = await failToStop();

    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandırmayı seç'));

    expect(screen.queryByText('Gebelik takibi sonlandırılamadı.')).toBeNull();
  });

  it('refuses when there is nothing to stop', async () => {
    // The row disappeared between the screen loading and the confirmation.
    repository.loadPregnancyProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(null);

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandırmayı seç'));
    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandır'));

    expect(repository.clearPregnancyProfile).not.toHaveBeenCalled();
    expect(screen.getByText('Gebelik takibi sonlandırılamadı.')).toBeTruthy();
    expect(back).not.toHaveBeenCalled();
  });

  it('locks the screen while the delete is in flight', async () => {
    let finishDelete: () => void = () => {};
    repository.clearPregnancyProfile.mockReturnValue(
      new Promise<void>((resolve) => {
        finishDelete = resolve;
      })
    );

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandırmayı seç'));

    const press = fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandır'));

    await waitFor(() => {
      expect(screen.getByText('Sonlandırılıyor...')).toBeTruthy();
    });

    expect(
      screen.getByLabelText('Gebelik takibini sonlandır').props.accessibilityState.disabled
    ).toBe(true);
    expect(screen.getByLabelText('Vazgeç').props.accessibilityState.disabled).toBe(true);

    finishDelete();
    await press;

    expect(repository.clearPregnancyProfile).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('PregnancySettingsScreen weekly reminder sync', () => {
  async function stop(screen: Awaited<ReturnType<typeof renderScreen>>) {
    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandırmayı seç'));
    await fireEvent.press(screen.getByLabelText('Gebelik takibini sonlandır'));
  }

  it('syncs once the pregnancy is cleared, so the nudges stop', async () => {
    const screen = await renderScreen();

    await stop(screen);

    expect(repository.clearPregnancyProfile).toHaveBeenCalledTimes(1);
    expect(reminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs on the database the screen already opened', async () => {
    const handle = {};
    db.openAppDatabase.mockResolvedValue(handle);

    const screen = await renderScreen();

    await stop(screen);

    expect(reminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledWith(handle);
  });

  it('does not sync when the stop failed', async () => {
    repository.clearPregnancyProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await stop(screen);

    expect(reminderSync.syncPregnancyWeeklyReminderQuietly).not.toHaveBeenCalled();
  });

  it('keeps the stop successful when the reminder could not be dequeued', async () => {
    reminderSync.syncPregnancyWeeklyReminderQuietly.mockResolvedValue(null);

    const screen = await renderScreen();

    await stop(screen);

    expect(screen.queryByText('Gebelik takibi sonlandırılamadı.')).toBeNull();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('does not sync for a due date edit, which moves no reminder', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini düzenle'));
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Tahmini doğum tarihini kaydet'));

    expect(repository.savePregnancyProfile).toHaveBeenCalledTimes(1);
    expect(reminderSync.syncPregnancyWeeklyReminderQuietly).not.toHaveBeenCalled();
  });

  it('does not sync when the screen is only opened', async () => {
    await renderScreen();

    expect(reminderSync.syncPregnancyWeeklyReminderQuietly).not.toHaveBeenCalled();
  });
});
