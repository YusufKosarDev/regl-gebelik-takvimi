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

  it('offers no way to change a record', async () => {
    const { queryAllByRole } = await renderScreen();

    // Back is the only control on the screen.
    expect(
      queryAllByRole('button').map((node) => node.props.accessibilityLabel as string)
    ).toEqual(['Geri']);
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

  it('shows no edit or delete wording', async () => {
    const { queryByText } = await renderScreen();

    for (const forbidden of ['Düzenle', 'Sil', 'Kaydet', 'Ekle']) {
      expect(queryByText(forbidden)).toBeNull();
    }
  });
});
