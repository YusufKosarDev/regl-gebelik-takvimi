import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import HistoryScreen from '@/app/(app)/history';
import type { CycleProfile, PeriodRecord } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

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

const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const useRouterMock = useRouter as unknown as jest.Mock;

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

  it('offers back and one delete per record, and nothing else', async () => {
    const { queryAllByRole } = await renderScreen();

    expect(
      queryAllByRole('button').map((node) => node.props.accessibilityLabel as string)
    ).toEqual([
      'Geri',
      '17 Eylül 2026 regl kaydını sil',
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

  it('offers no way to edit or add a record', async () => {
    const { queryByText } = await renderScreen();

    // Removing a wrong entry is offered; changing or adding one is not.
    for (const forbidden of ['Düzenle', 'Kaydet', 'Ekle', 'Değiştir']) {
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
