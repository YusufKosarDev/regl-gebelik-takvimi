import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import HistoryScreen from '@/app/(app)/history';
import type { CycleProfile, PeriodRecord } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { getTodayLocalISODate } from '@/utils/today';

// The database is faked. The use case, the repository contract and the ordering
// rule stay real, so what the screen lists is what the app would really read.
jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const useRouterMock = useRouter as unknown as jest.Mock;
const getTodayMock = getTodayLocalISODate as unknown as jest.Mock;

let back: jest.Mock;

type Spec = { id: string; startDate: string; endDate?: string; isOngoing?: boolean };

function profile(records: Spec[]): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
    periodRecords: records.map((record) => {
      const built: PeriodRecord = {
        id: record.id,
        startDate: record.startDate as ISODate,
        isOngoing: record.isOngoing === true,
      };

      return record.endDate === undefined
        ? built
        : { ...built, endDate: record.endDate as ISODate };
    }),
  };
}

beforeEach(() => {
  db.openAppDatabase.mockReset();
  db.openAppDatabase.mockResolvedValue({});
  repository.loadCycleProfile.mockReset();
  repository.saveCycleProfile.mockReset();

  back = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ back, push: jest.fn(), replace: jest.fn() });

  getTodayMock.mockReset();
  getTodayMock.mockReturnValue('2026-09-25' as ISODate);
});

async function renderScreen() {
  const screen = await render(<HistoryScreen />);

  await waitFor(() => {
    expect(screen.queryByTestId('period-history-loading')).toBeNull();
  });

  return screen;
}

describe('HistoryScreen while loading', () => {
  it('shows a spinner and a message', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { getByTestId, getByText } = await render(<HistoryScreen />);

    expect(getByTestId('period-history-loading')).toBeTruthy();
    expect(getByText('Veriler yükleniyor')).toBeTruthy();
  });

  it('lists nothing yet', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByText, queryAllByTestId } = await render(<HistoryScreen />);

    expect(queryByText('Geçmiş kayıtlar')).toBeNull();
    expect(queryAllByTestId(/^history-record-/)).toHaveLength(0);
  });
});

describe('HistoryScreen header', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile([{ id: 'a', startDate: '2026-09-02' }]));
  });

  it('names the screen', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Geçmiş kayıtlar')).toBeTruthy();
    expect(getByText('Kaydettiğin regl dönemlerini burada görebilirsin.')).toBeTruthy();
  });

  it('offers a way back', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Geri'));

    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('HistoryScreen with nothing saved', () => {
  it('says so when there is no profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { getByText, queryAllByTestId } = await renderScreen();

    expect(getByText('Henüz kayıt bulunamadı.')).toBeTruthy();
    expect(queryAllByTestId(/^history-record-/)).toHaveLength(0);
  });

  it('says so when the profile has no records', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile([]));

    const { getByText, queryAllByTestId } = await renderScreen();

    expect(getByText('Henüz kayıt bulunamadı.')).toBeTruthy();
    expect(queryAllByTestId(/^history-record-/)).toHaveLength(0);
  });
});

describe('HistoryScreen record display', () => {
  it('shows a finished period with both dates', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-17', endDate: '2026-09-22' }])
    );

    const { getByText } = await renderScreen();

    expect(getByText('17 Eylül 2026')).toBeTruthy();
    expect(getByText('22 Eylül 2026')).toBeTruthy();
  });

  it('shows a period that is still running', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-17', isOngoing: true }])
    );

    const { getByText } = await renderScreen();

    expect(getByText('17 Eylül 2026')).toBeTruthy();
    expect(getByText('Devam ediyor')).toBeTruthy();
  });

  it('says when the end was never recorded', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'onboarding-initial-period', startDate: '2026-09-02' }])
    );

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('2 Eylül 2026')).toBeTruthy();
    expect(getByText('Bitiş tarihi bilinmiyor')).toBeTruthy();
    expect(queryByText('Devam ediyor')).toBeNull();
  });

  it('labels the two columns', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-17', endDate: '2026-09-22' }])
    );

    const { getByText } = await renderScreen();

    expect(getByText('Başlangıç')).toBeTruthy();
    expect(getByText('Bitiş')).toBeTruthy();
  });

  it('estimates no end date from the average period length', async () => {
    // The profile says periods average 6 days, but this one's end is unknown.
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );

    const { queryByText } = await renderScreen();

    expect(queryByText('7 Eylül 2026')).toBeNull();
  });
});

describe('HistoryScreen ordering', () => {
  it('lists the newest record first', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'a', startDate: '2026-08-01' },
        { id: 'b', startDate: '2026-09-17' },
        { id: 'c', startDate: '2026-09-02' },
      ])
    );

    const { queryAllByTestId } = await renderScreen();

    expect(queryAllByTestId(/^history-record-/).map((node) => node.props.testID)).toEqual([
      'history-record-b',
      'history-record-c',
      'history-record-a',
    ]);
  });

  it('does not reorder the stored profile', async () => {
    const stored = profile([
      { id: 'a', startDate: '2026-08-01' },
      { id: 'b', startDate: '2026-09-17' },
      { id: 'c', startDate: '2026-09-02' },
    ]);
    repository.loadCycleProfile.mockResolvedValue(stored);

    await renderScreen();

    expect(stored.periodRecords.map((record) => record.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('HistoryScreen when loading fails', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));
  });

  it('says so', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Kayıtlar yüklenemedi.')).toBeTruthy();
  });

  it('announces it to assistive technology', async () => {
    const { getByRole } = await renderScreen();

    expect(getByRole('alert')).toBeTruthy();
  });

  it('lists nothing and does not claim the list is empty', async () => {
    const { queryAllByTestId, queryByText } = await renderScreen();

    expect(queryAllByTestId(/^history-record-/)).toHaveLength(0);
    expect(queryByText('Henüz kayıt bulunamadı.')).toBeNull();
  });
});

describe('HistoryScreen accessibility', () => {
  it('reads a finished period as one summary', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-17', endDate: '2026-09-22' }])
    );

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Başlangıç: 17 Eylül 2026, bitiş: 22 Eylül 2026')).toBeTruthy();
  });

  it('reads an ongoing period', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-17', isOngoing: true }])
    );

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Başlangıç: 17 Eylül 2026, devam ediyor')).toBeTruthy();
  });

  it('reads a period with no recorded end', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Başlangıç: 2 Eylül 2026, bitiş tarihi bilinmiyor')).toBeTruthy();
  });
});

describe('HistoryScreen scope', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'a', startDate: '2026-09-02' },
        { id: 'b', startDate: '2026-09-17', isOngoing: true },
      ])
    );
  });

  it('offers back, and both edits plus delete per record, and nothing else', async () => {
    const { queryAllByRole } = await renderScreen();

    // The fixture's newest record is ongoing, so it offers neither edit.
    expect(
      queryAllByRole('button').map((node) => node.props.accessibilityLabel as string)
    ).toEqual([
      'Geri',
      '17 Eylül 2026 regl kaydını sil',
      '2 Eylül 2026 regl kaydının başlangıç tarihini düzenle',
      '2 Eylül 2026 regl kaydının bitiş tarihini düzenle',
      '2 Eylül 2026 regl kaydını sil',
    ]);
  });

  it('writes nothing', async () => {
    await renderScreen();

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('reads the database once', async () => {
    await renderScreen();

    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('offers no way to add a record', async () => {
    const { queryByText } = await renderScreen();

    // Correcting either end of a record and removing one are offered; creating
    // a record from here is not.
    for (const forbidden of ['Ekle', 'Yeni kayıt']) {
      expect(queryByText(forbidden)).toBeNull();
    }
  });
});

describe('HistoryScreen delete action', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'onboarding-initial-period', startDate: '2026-09-02' },
        { id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' },
      ])
    );
    repository.saveCycleProfile.mockResolvedValue(undefined);
  });

  it('offers a delete on every record', async () => {
    const { getByLabelText, getAllByText } = await renderScreen();

    expect(getByLabelText('17 Eylül 2026 regl kaydını sil')).toBeTruthy();
    expect(getByLabelText('2 Eylül 2026 regl kaydını sil')).toBeTruthy();
    expect(getAllByText('Sil')).toHaveLength(2);
  });

  it('asks before deleting', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));

    expect(screen.getByText('Bu regl kaydını silmek istiyor musun?')).toBeTruthy();
    expect(screen.getByText('Bu işlem geri alınamaz.')).toBeTruthy();
  });

  it('names the record it would remove', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('2 Eylül 2026 regl kaydını sil'));

    // The row's own date plus the one inside the confirmation.
    expect(screen.getAllByText('2 Eylül 2026')).toHaveLength(2);
  });

  it('writes nothing while only asking', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('confirms one record at a time', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    expect(screen.queryAllByText('Bu regl kaydını silmek istiyor musun?')).toHaveLength(1);

    // The other row still offers its own delete, and pressing it moves the
    // confirmation rather than opening a second one.
    await fireEvent.press(screen.getByLabelText('2 Eylül 2026 regl kaydını sil'));

    expect(screen.queryAllByText('Bu regl kaydını silmek istiyor musun?')).toHaveLength(1);
    expect(screen.getByLabelText('17 Eylül 2026 regl kaydını sil')).toBeTruthy();
  });
});

describe('HistoryScreen delete cancel', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17' }])
    );
  });

  it('closes the confirmation', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(screen.queryByText('Bu regl kaydını silmek istiyor musun?')).toBeNull();
    expect(screen.getByLabelText('17 Eylül 2026 regl kaydını sil')).toBeTruthy();
  });

  it('touches no storage', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('HistoryScreen delete', () => {
  function remaining(): CycleProfile {
    return profile([{ id: 'onboarding-initial-period', startDate: '2026-09-02' }]);
  }

  async function deleteNewest() {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    return screen;
  }

  beforeEach(() => {
    repository.saveCycleProfile.mockResolvedValue(undefined);
  });

  it('stores the profile without that record', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'onboarding-initial-period', startDate: '2026-09-02' },
        { id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' },
      ])
    );

    await deleteNewest();

    const [, saved] = repository.saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords.map((record) => record.id)).toEqual([
      'onboarding-initial-period',
    ]);
  });

  it('closes the confirmation', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(
        profile([
          { id: 'onboarding-initial-period', startDate: '2026-09-02' },
          { id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' },
        ])
      )
      .mockResolvedValueOnce(
        profile([
          { id: 'onboarding-initial-period', startDate: '2026-09-02' },
          { id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' },
        ])
      )
      .mockResolvedValue(remaining());

    const screen = await deleteNewest();

    expect(screen.queryByText('Bu regl kaydını silmek istiyor musun?')).toBeNull();
  });

  it('reloads and drops the deleted row', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(
        profile([
          { id: 'onboarding-initial-period', startDate: '2026-09-02' },
          { id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' },
        ])
      )
      .mockResolvedValueOnce(
        profile([
          { id: 'onboarding-initial-period', startDate: '2026-09-02' },
          { id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' },
        ])
      )
      .mockResolvedValue(remaining());

    const screen = await deleteNewest();

    expect(screen.queryByTestId('history-record-period-2026-09-17')).toBeNull();
    expect(screen.getByTestId('history-record-onboarding-initial-period')).toBeTruthy();
  });

  it('removes a record that is still running', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(
        profile([{ id: 'period-2026-09-17', startDate: '2026-09-17', isOngoing: true }])
      )
      .mockResolvedValueOnce(
        profile([{ id: 'period-2026-09-17', startDate: '2026-09-17', isOngoing: true }])
      )
      .mockResolvedValue(profile([]));

    const screen = await renderScreen();

    expect(screen.getByText('Devam ediyor')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    const [, saved] = repository.saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords).toEqual([]);
  });

  it('says the list is empty once the last record is gone', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile([{ id: 'period-2026-09-17', startDate: '2026-09-17' }]))
      .mockResolvedValueOnce(profile([{ id: 'period-2026-09-17', startDate: '2026-09-17' }]))
      .mockResolvedValue(profile([]));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    expect(screen.getByText('Henüz kayıt bulunamadı.')).toBeTruthy();
    expect(screen.queryAllByTestId(/^history-record-/)).toHaveLength(0);
  });

  it('deletes once however many times Sil is pressed', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    // The confirmation is gone after a successful delete, so there is nothing
    // left to press again.
    expect(screen.queryByLabelText('Vazgeç')).toBeNull();
    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('HistoryScreen delete failure', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17' }])
    );
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));
  });

  async function failToDelete() {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    return screen;
  }

  it('reports it with its own message', async () => {
    const screen = await failToDelete();

    expect(screen.getByText('Kayıt silinemedi.')).toBeTruthy();
    // Not the message for a failed read.
    expect(screen.queryByText('Kayıtlar yüklenemedi.')).toBeNull();
  });

  it('announces it to assistive technology', async () => {
    const screen = await failToDelete();

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('keeps the confirmation open so a retry is possible', async () => {
    const screen = await failToDelete();

    expect(screen.getByLabelText('Sil')).toBeTruthy();
    expect(screen.getByLabelText('Vazgeç')).toBeTruthy();
  });

  it('retries on a second press', async () => {
    const screen = await failToDelete();

    await fireEvent.press(screen.getByLabelText('Sil'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(2);
  });

  it('leaves the record on screen', async () => {
    const screen = await failToDelete();

    expect(screen.getByTestId('history-record-period-2026-09-17')).toBeTruthy();
  });

  it('clears the error when the confirmation is dismissed', async () => {
    const screen = await failToDelete();

    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));

    expect(screen.queryByText('Kayıt silinemedi.')).toBeNull();
  });
});

describe('HistoryScreen edit availability', () => {
  it('offers edit and delete on a record with no recorded end', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')).toBeTruthy();
    expect(getByLabelText('2 Eylül 2026 regl kaydını sil')).toBeTruthy();
  });

  it('offers edit and delete on a closed record', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')).toBeTruthy();
    expect(getByLabelText('2 Eylül 2026 regl kaydını sil')).toBeTruthy();
  });

  it('offers only delete on a record that is still running', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-17', isOngoing: true }])
    );

    const { getByLabelText, queryByLabelText } = await renderScreen();

    // Finishing a running period is Home's job, not a correction.
    expect(queryByLabelText('17 Eylül 2026 regl kaydının bitiş tarihini düzenle')).toBeNull();
    expect(getByLabelText('17 Eylül 2026 regl kaydını sil')).toBeTruthy();
  });
});

describe('HistoryScreen edit panel', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
  });

  it('opens with the record it was asked about', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    expect(screen.getByText('Bitiş tarihini düzenle')).toBeTruthy();
    expect(screen.getByText('Başlangıç: 2 Eylül 2026')).toBeTruthy();
  });

  it('starts on the recorded end date', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    expect(screen.getByLabelText('Seçilen bitiş tarihi: 7 Eylül 2026')).toBeTruthy();
  });

  it('starts on the start date when no end was recorded', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    expect(screen.getByLabelText('Seçilen bitiş tarihi: 2 Eylül 2026')).toBeTruthy();
  });

  it('writes nothing while only editing', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('HistoryScreen edit date navigation', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
  });

  async function openEditor(startDate = '2026-09-02', endDate?: string) {
    repository.loadCycleProfile.mockResolvedValue(profile([{ id: 'a', startDate, endDate }]));

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText(
        `${startDate === '2026-09-02' ? '2 Eylül 2026' : formatted(startDate)} regl kaydının bitiş tarihini düzenle`
      )
    );

    return screen;
  }

  function formatted(iso: string): string {
    const [, month, day] = iso.split('-');
    const months = [
      'Ocak',
      'Şubat',
      'Mart',
      'Nisan',
      'Mayıs',
      'Haziran',
      'Temmuz',
      'Ağustos',
      'Eylül',
      'Ekim',
      'Kasım',
      'Aralık',
    ];
    return `${Number(day)} ${months[Number(month) - 1]} ${iso.slice(0, 4)}`;
  }

  it('moves a day forward', async () => {
    const screen = await openEditor();

    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(screen.getByLabelText('Seçilen bitiş tarihi: 3 Eylül 2026')).toBeTruthy();
  });

  it('moves a day back', async () => {
    const screen = await openEditor('2026-09-02', '2026-09-07');

    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.getByLabelText('Seçilen bitiş tarihi: 6 Eylül 2026')).toBeTruthy();
  });

  it('rolls over a month boundary', async () => {
    getTodayMock.mockReturnValue('2026-10-10' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-28', endDate: '2026-09-30' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('28 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(screen.getByLabelText('Seçilen bitiş tarihi: 1 Ekim 2026')).toBeTruthy();
  });

  it('rolls over a year boundary', async () => {
    getTodayMock.mockReturnValue('2027-01-10' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-12-29', endDate: '2026-12-31' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('29 Aralık 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(screen.getByLabelText('Seçilen bitiş tarihi: 1 Ocak 2027')).toBeTruthy();
  });

  it('cannot go earlier than the start date', async () => {
    const screen = await openEditor();

    // It opens on the start date, so back is already unavailable.
    expect(screen.getByLabelText('Önceki gün').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.getByLabelText('Seçilen bitiş tarihi: 2 Eylül 2026')).toBeTruthy();
  });

  it('cannot go past today', async () => {
    getTodayMock.mockReturnValue('2026-09-04' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-04' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    expect(screen.getByLabelText('Sonraki gün').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(screen.getByLabelText('Seçilen bitiş tarihi: 4 Eylül 2026')).toBeTruthy();
  });

  it('cannot go past the longest span the domain allows', async () => {
    // Today is far away, so the duration limit is what stops it: 2 September
    // plus 19 days is 21 September.
    getTodayMock.mockReturnValue('2026-12-01' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-21' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    expect(screen.getByLabelText('Sonraki gün').props.accessibilityState.disabled).toBe(true);
  });

  it('allows stepping up to that limit', async () => {
    getTodayMock.mockReturnValue('2026-12-01' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-20' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    expect(screen.getByLabelText('Sonraki gün').props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(screen.getByLabelText('Seçilen bitiş tarihi: 21 Eylül 2026')).toBeTruthy();
  });
});

describe('HistoryScreen edit save', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
    repository.saveCycleProfile.mockResolvedValue(undefined);
  });

  it('saves the date that was picked', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));
    await fireEvent.press(screen.getByLabelText('Bitiş tarihini kaydet'));

    const [, saved] = repository.saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords[0]).toEqual({
      id: 'a',
      startDate: '2026-09-02',
      endDate: '2026-09-04',
      isOngoing: false,
    });
  });

  it('closes the editor and shows the new date', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile([{ id: 'a', startDate: '2026-09-02' }]))
      .mockResolvedValueOnce(profile([{ id: 'a', startDate: '2026-09-02' }]))
      .mockResolvedValue(profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-03' }]));

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));
    await fireEvent.press(screen.getByLabelText('Bitiş tarihini kaydet'));

    expect(screen.queryByText('Bitiş tarihini düzenle')).toBeNull();
    expect(screen.getByText('3 Eylül 2026')).toBeTruthy();
    expect(screen.queryByText('Bitiş tarihi bilinmiyor')).toBeNull();
  });

  it('leaves the ordering alone', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(
        profile([
          { id: 'old', startDate: '2026-09-02' },
          { id: 'new', startDate: '2026-09-17', endDate: '2026-09-20' },
        ])
      )
      .mockResolvedValueOnce(
        profile([
          { id: 'old', startDate: '2026-09-02' },
          { id: 'new', startDate: '2026-09-17', endDate: '2026-09-20' },
        ])
      )
      .mockResolvedValue(
        profile([
          { id: 'old', startDate: '2026-09-02', endDate: '2026-09-03' },
          { id: 'new', startDate: '2026-09-17', endDate: '2026-09-20' },
        ])
      );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));
    await fireEvent.press(screen.getByLabelText('Bitiş tarihini kaydet'));

    expect(screen.queryAllByTestId(/^history-record-/).map((n) => n.props.testID)).toEqual([
      'history-record-new',
      'history-record-old',
    ]);
  });

  it('saves once however many times Kaydet is pressed', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));
    await fireEvent.press(screen.getByLabelText('Bitiş tarihini kaydet'));

    expect(screen.queryByLabelText('Bitiş tarihini kaydet')).toBeNull();
    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('HistoryScreen edit cancel', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );
  });

  it('closes without writing', async () => {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(screen.queryByText('Bitiş tarihini düzenle')).toBeNull();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(screen.getByText('7 Eylül 2026')).toBeTruthy();
  });

  it('forgets the date that was picked', async () => {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    expect(screen.getByLabelText('Seçilen bitiş tarihi: 7 Eylül 2026')).toBeTruthy();
  });
});

describe('HistoryScreen removing an end date', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
    repository.saveCycleProfile.mockResolvedValue(undefined);
  });

  async function openRemove() {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Bitiş tarihini kaldır'));

    return screen;
  }

  it('is offered only when there is one to remove', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    expect(screen.queryByLabelText('Bitiş tarihini kaldır')).toBeNull();
  });

  it('asks first', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );

    const screen = await openRemove();

    expect(screen.getByText('Bitiş tarihini kaldırmak istiyor musun?')).toBeTruthy();
    expect(
      screen.getByText('Bu kayıt bitiş tarihi bilinmiyor olarak gösterilecek.')
    ).toBeTruthy();
  });

  it('writes nothing while only asking', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );

    await openRemove();

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('goes back to the editor on Vazgeç', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );

    const screen = await openRemove();

    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(screen.getByText('Bitiş tarihini düzenle')).toBeTruthy();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('clears the end date without making the record ongoing', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );

    const screen = await openRemove();

    await fireEvent.press(screen.getByLabelText('Kaldır'));

    const [, saved] = repository.saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords[0]).toEqual({
      id: 'a',
      startDate: '2026-09-02',
      isOngoing: false,
    });
  });

  it('shows the record as end unknown, not as running', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }]))
      .mockResolvedValueOnce(profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }]))
      .mockResolvedValue(profile([{ id: 'a', startDate: '2026-09-02' }]));

    const screen = await openRemove();

    await fireEvent.press(screen.getByLabelText('Kaldır'));

    expect(screen.getByText('Bitiş tarihi bilinmiyor')).toBeTruthy();
    expect(screen.queryByText('Devam ediyor')).toBeNull();
    expect(screen.queryByText('7 Eylül 2026')).toBeNull();
  });
});

describe('HistoryScreen edit failure', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));
  });

  async function failToSave() {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));
    await fireEvent.press(screen.getByLabelText('Bitiş tarihini kaydet'));

    return screen;
  }

  it('reports it with its own message', async () => {
    const screen = await failToSave();

    expect(screen.getByText('Kayıt güncellenemedi.')).toBeTruthy();
    expect(screen.queryByText('Kayıtlar yüklenemedi.')).toBeNull();
    expect(screen.queryByText('Kayıt silinemedi.')).toBeNull();
  });

  it('announces it to assistive technology', async () => {
    const screen = await failToSave();

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('keeps the editor open so a retry is possible', async () => {
    const screen = await failToSave();

    expect(screen.getByLabelText('Bitiş tarihini kaydet')).toBeTruthy();
    expect(screen.getByLabelText('Seçilen bitiş tarihi: 3 Eylül 2026')).toBeTruthy();
  });

  it('retries on a second press', async () => {
    const screen = await failToSave();

    await fireEvent.press(screen.getByLabelText('Bitiş tarihini kaydet'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(2);
  });

  it('clears the error when the editor is closed', async () => {
    const screen = await failToSave();

    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    expect(screen.queryByText('Kayıt güncellenemedi.')).toBeNull();
  });
});

describe('HistoryScreen edit and delete together', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );
  });

  it('shows only the editor on the card being edited', async () => {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    // That card's own actions give way to the editor, so the two can never be
    // open on the same record at once.
    expect(screen.queryByLabelText('2 Eylül 2026 regl kaydını sil')).toBeNull();
    expect(screen.getByText('Bitiş tarihini düzenle')).toBeTruthy();
  });

  it('closes the editor when another card starts a delete', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' },
        { id: 'b', startDate: '2026-09-17', endDate: '2026-09-20' },
      ])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));

    expect(screen.getByText('Bu regl kaydını silmek istiyor musun?')).toBeTruthy();
    expect(screen.queryByText('Bitiş tarihini düzenle')).toBeNull();
  });

  it('closes the delete confirmation when an edit is started', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('2 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    expect(screen.getByText('Bitiş tarihini düzenle')).toBeTruthy();
    expect(screen.queryByText('Bu regl kaydını silmek istiyor musun?')).toBeNull();
  });
});

describe('HistoryScreen start edit availability', () => {
  it('offers a start edit on a record with no recorded end', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')).toBeTruthy();
  });

  it('offers a start edit on a closed record', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')).toBeTruthy();
  });

  it('names the two edits apart', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );

    const { getByText } = await renderScreen();

    expect(getByText('Başlangıcı düzenle')).toBeTruthy();
    expect(getByText('Bitişi düzenle')).toBeTruthy();
  });

  it('offers only delete on a record that is still running', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-17', isOngoing: true }])
    );

    const { getByLabelText, queryByLabelText } = await renderScreen();

    // When a running period began is what the person is living through, and
    // when it ends is Home's job: neither end is corrected here.
    expect(
      queryByLabelText('17 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    ).toBeNull();
    expect(queryByLabelText('17 Eylül 2026 regl kaydının bitiş tarihini düzenle')).toBeNull();
    expect(getByLabelText('17 Eylül 2026 regl kaydını sil')).toBeTruthy();
  });
});

describe('HistoryScreen start edit panel', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
  });

  async function openStartEditor(records: Spec[], label: string) {
    repository.loadCycleProfile.mockResolvedValue(profile(records));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(label));

    return screen;
  }

  it('opens on the record it was asked about', async () => {
    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }],
      '2 Eylül 2026 regl kaydının başlangıç tarihini düzenle'
    );

    expect(screen.getByText('Başlangıç tarihini düzenle')).toBeTruthy();
    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 2 Eylül 2026')).toBeTruthy();
  });

  it('shows the end date without offering to change it', async () => {
    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }],
      '2 Eylül 2026 regl kaydının başlangıç tarihini düzenle'
    );

    expect(screen.getByText('Bitiş: 7 Eylül 2026')).toBeTruthy();
    expect(screen.queryByLabelText('Seçilen bitiş tarihi: 7 Eylül 2026')).toBeNull();
    expect(screen.queryByLabelText('Bitiş tarihini kaldır')).toBeNull();
  });

  it('says so when the end was never recorded', async () => {
    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-09-02' }],
      '2 Eylül 2026 regl kaydının başlangıç tarihini düzenle'
    );

    expect(screen.getByText('Bitiş: Bitiş tarihi bilinmiyor')).toBeTruthy();
  });

  it('steps back a day', async () => {
    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }],
      '2 Eylül 2026 regl kaydının başlangıç tarihini düzenle'
    );

    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 1 Eylül 2026')).toBeTruthy();
  });

  it('steps forward a day', async () => {
    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }],
      '2 Eylül 2026 regl kaydının başlangıç tarihini düzenle'
    );

    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 3 Eylül 2026')).toBeTruthy();
  });

  it('rolls over into the previous month', async () => {
    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-09-01', endDate: '2026-09-05' }],
      '1 Eylül 2026 regl kaydının başlangıç tarihini düzenle'
    );

    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 31 Ağustos 2026')).toBeTruthy();
  });

  it('rolls over into the previous year', async () => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);

    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-01-01', endDate: '2026-01-05' }],
      '1 Ocak 2026 regl kaydının başlangıç tarihini düzenle'
    );

    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 31 Aralık 2025')).toBeTruthy();
  });
});

describe('HistoryScreen start edit boundaries', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
  });

  async function openStartEditor(records: Spec[], label: string) {
    repository.loadCycleProfile.mockResolvedValue(profile(records));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(label));

    return screen;
  }

  it('stops at the day the period ended', async () => {
    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-09-06', endDate: '2026-09-07' }],
      '6 Eylül 2026 regl kaydının başlangıç tarihini düzenle'
    );

    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 7 Eylül 2026')).toBeTruthy();
    expect(screen.getByLabelText('Sonraki gün').props.accessibilityState.disabled).toBe(true);
  });

  it('will not step past the end date', async () => {
    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-09-07', endDate: '2026-09-07' }],
      '7 Eylül 2026 regl kaydının başlangıç tarihini düzenle'
    );

    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 7 Eylül 2026')).toBeTruthy();
  });

  it('stops at today when the end was never recorded', async () => {
    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-09-24' }],
      '24 Eylül 2026 regl kaydının başlangıç tarihini düzenle'
    );

    await fireEvent.press(screen.getByLabelText('Sonraki gün'));

    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 25 Eylül 2026')).toBeTruthy();
    expect(screen.getByLabelText('Sonraki gün').props.accessibilityState.disabled).toBe(true);
  });

  it('stops at the earliest day the domain would still accept', async () => {
    // 20 days inclusive back from 2026-09-20 is 2026-09-01.
    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-20' }],
      '2 Eylül 2026 regl kaydının başlangıç tarihini düzenle'
    );

    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 1 Eylül 2026')).toBeTruthy();
    expect(screen.getByLabelText('Önceki gün').props.accessibilityState.disabled).toBe(true);
  });

  it('will not step past that earliest day', async () => {
    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-09-01', endDate: '2026-09-20' }],
      '1 Eylül 2026 regl kaydının başlangıç tarihini düzenle'
    );

    await fireEvent.press(screen.getByLabelText('Önceki gün'));

    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 1 Eylül 2026')).toBeTruthy();
  });

  it('leaves the past open when the end was never recorded', async () => {
    const screen = await openStartEditor(
      [{ id: 'a', startDate: '2026-09-02' }],
      '2 Eylül 2026 regl kaydının başlangıç tarihini düzenle'
    );

    // Nothing to measure a maximum duration against, so there is no floor.
    for (let step = 0; step < 30; step += 1) {
      await fireEvent.press(screen.getByLabelText('Önceki gün'));
    }

    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 3 Ağustos 2026')).toBeTruthy();
    expect(screen.getByLabelText('Önceki gün').props.accessibilityState.disabled).toBe(false);
  });
});

describe('HistoryScreen start edit save', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
    repository.saveCycleProfile.mockResolvedValue(undefined);
  });

  it('sends the original record id, the new date and today', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('17 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    const saved = repository.saveCycleProfile.mock.calls[0][1] as CycleProfile;

    expect(saved.periodRecords).toEqual([
      {
        id: 'period-2026-09-16',
        startDate: '2026-09-16',
        endDate: '2026-09-17',
        isOngoing: false,
      },
    ]);
  });

  it('keeps the onboarding record its own id', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'onboarding-initial-period', startDate: '2026-09-02' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    const saved = repository.saveCycleProfile.mock.calls[0][1] as CycleProfile;

    expect(saved.periodRecords).toEqual([
      { id: 'onboarding-initial-period', startDate: '2026-09-01', isOngoing: false },
    ]);
  });

  it('closes the editor and shows the new date', async () => {
    repository.loadCycleProfile
      // The mount read, then the use case's own read of what is stored now.
      .mockResolvedValueOnce(
        profile([{ id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' }])
      )
      .mockResolvedValueOnce(
        profile([{ id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' }])
      )
      .mockResolvedValue(
        profile([{ id: 'period-2026-09-16', startDate: '2026-09-16', endDate: '2026-09-17' }])
      );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('17 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    expect(screen.queryByText('Başlangıç tarihini düzenle')).toBeNull();
    expect(screen.getByText('16 Eylül 2026')).toBeTruthy();
    expect(screen.queryByTestId('history-record-period-2026-09-17')).toBeNull();
    expect(screen.getByTestId('history-record-period-2026-09-16')).toBeTruthy();
  });

  it('reorders the list when the record moves past another', async () => {
    // 'a' has no recorded end, so nothing stops it moving forward past 'b'.
    const stored = () =>
      profile([
        { id: 'a', startDate: '2026-09-02' },
        { id: 'b', startDate: '2026-09-10', endDate: '2026-09-12' },
      ]);

    repository.loadCycleProfile
      // The mount read, then the use case's own read of what is stored now.
      .mockResolvedValueOnce(stored())
      .mockResolvedValueOnce(stored())
      // What the reload would find after 'a' moves past 'b'.
      .mockResolvedValue(
        profile([
          { id: 'a', startDate: '2026-09-11' },
          { id: 'b', startDate: '2026-09-10', endDate: '2026-09-12' },
        ])
      );

    const screen = await renderScreen();

    const order = () =>
      screen.queryAllByTestId(/^history-record-/).map((node) => node.props.testID as string);

    expect(order()).toEqual(['history-record-b', 'history-record-a']);

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    for (let step = 0; step < 9; step += 1) {
      await fireEvent.press(screen.getByLabelText('Sonraki gün'));
    }
    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    // Newest first is the use case's rule, so the reload alone reorders them.
    expect(order()).toEqual(['history-record-a', 'history-record-b']);
  });

  it('writes nothing when the date has not moved', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('17 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(screen.queryByText('Başlangıç tarihini düzenle')).toBeNull();
  });

  it('saves once however many times Kaydet is pressed', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('17 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    expect(screen.queryByLabelText('Başlangıç tarihini kaydet')).toBeNull();
    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('HistoryScreen start edit cancel', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );
  });

  it('writes nothing', async () => {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('closes the panel and brings the actions back', async () => {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(screen.queryByText('Başlangıç tarihini düzenle')).toBeNull();
    expect(screen.getByLabelText('2 Eylül 2026 regl kaydını sil')).toBeTruthy();
  });

  it('forgets the date that was picked', async () => {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );

    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 2 Eylül 2026')).toBeTruthy();
  });
});

describe('HistoryScreen start edit failure', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' }])
    );
  });

  async function failToSave() {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk full'));

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('17 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    return screen;
  }

  it('says so', async () => {
    const screen = await failToSave();

    expect(screen.getByText('Kayıt güncellenemedi.')).toBeTruthy();
  });

  it('announces it', async () => {
    const screen = await failToSave();

    expect(screen.getByText('Kayıt güncellenemedi.').props.accessibilityRole).toBe('alert');
  });

  it('keeps the panel open on the date that was picked', async () => {
    const screen = await failToSave();

    expect(screen.getByText('Başlangıç tarihini düzenle')).toBeTruthy();
    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 16 Eylül 2026')).toBeTruthy();
  });

  it('leaves the record showing its old date', async () => {
    const screen = await failToSave();

    // Nothing was written, so the card still reads as it did before the edit.
    expect(
      screen.getByLabelText('Başlangıç: 17 Eylül 2026, bitiş: 17 Eylül 2026')
    ).toBeTruthy();
    expect(screen.getByTestId('history-record-period-2026-09-17')).toBeTruthy();
    expect(screen.queryByTestId('history-record-period-2026-09-16')).toBeNull();
  });

  it('can be tried again', async () => {
    const screen = await failToSave();

    repository.saveCycleProfile.mockResolvedValue(undefined);

    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(2);
  });

  it('clears the error when the panel is closed', async () => {
    const screen = await failToSave();

    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(
      screen.getByLabelText('17 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );

    expect(screen.queryByText('Kayıt güncellenemedi.')).toBeNull();
  });
});

describe('HistoryScreen panel exclusivity', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-25' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );
  });

  it('replaces the start editor with the end editor', async () => {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );

    // The card's own actions give way to the panel, so the end edit has to be
    // reached by closing this one first.
    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    expect(screen.getByText('Bitiş tarihini düzenle')).toBeTruthy();
    expect(screen.queryByText('Başlangıç tarihini düzenle')).toBeNull();
  });

  it('replaces the end editor with the start editor', async () => {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );

    expect(screen.getByText('Başlangıç tarihini düzenle')).toBeTruthy();
    expect(screen.queryByText('Bitiş tarihini düzenle')).toBeNull();
  });

  it('shows only the start editor on the card being edited', async () => {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );

    expect(screen.queryByLabelText('2 Eylül 2026 regl kaydını sil')).toBeNull();
    expect(screen.queryByText('Bu regl kaydını silmek istiyor musun?')).toBeNull();
  });

  it('closes the start editor when another card starts a delete', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' },
        { id: 'b', startDate: '2026-09-17', endDate: '2026-09-20' },
      ])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));

    expect(screen.getByText('Bu regl kaydını silmek istiyor musun?')).toBeTruthy();
    expect(screen.queryByText('Başlangıç tarihini düzenle')).toBeNull();
  });

  it('closes the start editor when another card starts a start edit', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' },
        { id: 'b', startDate: '2026-09-17', endDate: '2026-09-20' },
      ])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(
      screen.getByLabelText('17 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );

    expect(screen.getByLabelText('Seçilen başlangıç tarihi: 17 Eylül 2026')).toBeTruthy();
    expect(screen.queryByLabelText('Seçilen başlangıç tarihi: 2 Eylül 2026')).toBeNull();
  });

  it('closes the delete confirmation when a start edit is started', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('2 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );

    expect(screen.getByText('Başlangıç tarihini düzenle')).toBeTruthy();
    expect(screen.queryByText('Bu regl kaydını silmek istiyor musun?')).toBeNull();
  });
});
