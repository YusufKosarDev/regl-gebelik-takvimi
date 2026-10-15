import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import HistoryScreen from '@/app/(app)/(tabs)/history';
import {
  notifyLocalDataChanged,
  resetLocalDataChangeListenersForTests,
} from '@/shared/data-change/local-data-change';
import type { CycleProfile, PeriodRecord } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { getTodayLocalISODate } from '@/utils/today';
import { expectClearsTabBar } from '../../../../jest/assert-clears-tab-bar';
import { armAppState, returnToForeground } from '../../../../jest/app-state-driver';
import {
  HISTORY_DESCRIPTION,
  HISTORY_EMPTY_MESSAGE,
  HISTORY_TITLE,
} from '@/features/cycle/presentation/history-messages';
import { dailyLogCatalogueLabels } from '@/features/daily-log/presentation/daily-log-catalogues';
import { dailyLogMessages } from '@/features/daily-log/presentation/daily-log-messages';
import { Colors } from '@/constants/theme';
import { expectDestructiveConfirmation } from '../../../../jest/assert-destructive-confirmation';
import { dailyLogHistoryMessages } from '@/features/daily-log/presentation/daily-log-history-messages';

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

// The tab reads the daily log as well as the period records now: the counts
// and the distribution it opens with come from there. Empty by default, so
// every assertion about records is unchanged by it.
jest.mock('@/features/daily-log/data/daily-log-repository', () => ({
  loadAllDailyEntries: jest.fn(async () => []),
}));

// Screens re-read on focus now, so the mock has to behave like the real
// `useFocusEffect`. Shared, so four test files cannot drift apart.
jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

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

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const widgetSync = jest.requireMock('@/features/widget/application/sync-widget-snapshot');
const reminderSync = jest.requireMock('@/features/notifications/application/sync-period-reminder');
const dailyLogRepository = jest.requireMock('@/features/daily-log/data/daily-log-repository');
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
  widgetSync.syncWidgetSnapshotQuietly.mockReset();
  widgetSync.syncWidgetSnapshotQuietly.mockResolvedValue(null);
  reminderSync.syncPeriodReminderQuietly.mockReset();
  reminderSync.syncPeriodReminderQuietly.mockResolvedValue(null);
  // Reset like every other mock here rather than left as the module default:
  // a describe that gives the tab some days to count would otherwise leave
  // them for whatever runs next.
  dailyLogRepository.loadAllDailyEntries.mockReset();
  dailyLogRepository.loadAllDailyEntries.mockResolvedValue([]);

  back = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ back, push: jest.fn(), replace: jest.fn() });

  getTodayMock.mockReset();
  getTodayMock.mockReturnValue('2026-09-25' as ISODate);

  armAppState();
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
    expect(getByText(HISTORY_DESCRIPTION)).toBeTruthy();
  });
});

describe('HistoryScreen with nothing saved', () => {
  it('says so when there is no profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { getByText, queryAllByTestId } = await renderScreen();

    expect(getByText(HISTORY_EMPTY_MESSAGE)).toBeTruthy();
    expect(queryAllByTestId(/^history-record-/)).toHaveLength(0);
  });

  it('says so when the profile has no records', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile([]));

    const { getByText, queryAllByTestId } = await renderScreen();

    expect(getByText(HISTORY_EMPTY_MESSAGE)).toBeTruthy();
    expect(queryAllByTestId(/^history-record-/)).toHaveLength(0);
  });

  /**
   * Two empty lines on one screen, and they have to be told apart.
   *
   * This tab reports two kinds of record. It used to say "Henüz kayıt yok."
   * under the counts and "Henüz kayıt bulunamadı." three lines further down,
   * about daily entries and period records respectively, with nothing in
   * either sentence saying which.
   *
   * The assertion is not that the words are any particular words. It is that
   * the screen still has two distinct sentences in those two places: merge the
   * keys back into one string and `getByText` finds the same text twice and
   * fails, which is the edit this exists to catch.
   */
  it('tells its two empty lines apart', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile([]));

    const { getByText } = await renderScreen();

    expect(getByText(HISTORY_EMPTY_MESSAGE)).toBeTruthy();
    expect(getByText(dailyLogHistoryMessages.tr.mostLoggedEmpty)).toBeTruthy();
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
    expect(queryByText(HISTORY_EMPTY_MESSAGE)).toBeNull();
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

  it('offers both edits plus delete per record, and nothing else', async () => {
    const { queryAllByRole } = await renderScreen();

    // The fixture's newest record is ongoing, so it offers the start edit and
    // delete but no end edit: ending a period is the Cycle tab's job.
    expect(
      queryAllByRole('button').map((node) => node.props.accessibilityLabel as string)
    ).toEqual([
      '17 Eylül 2026 regl kaydının başlangıç tarihini düzenle',
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

/**
 * Which of the two buttons is the loud one.
 *
 * The rule and the reason are in `jest/assert-destructive-confirmation.ts`.
 * Nothing asserted this before, which is how the panel came to put the app's
 * one emphatic treatment on the irreversible action.
 */
describe('HistoryScreen delete confirmation weights', () => {
  it('fills Cancel and outlines the deletion, with Cancel first', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17' }])
    );

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));

    const buttons = screen.queryAllByRole('button').map((node) => ({
      label: String(node.props.accessibilityLabel ?? ''),
      style: node.props.style,
    }));

    expectDestructiveConfirmation(
      buttons,
      { cancel: 'Vazgeç', destructive: 'Sil' },
      Colors.light.primary
    );
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

    expect(screen.getByText(HISTORY_EMPTY_MESSAGE)).toBeTruthy();
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

describe('HistoryScreen delete when the read back fails', () => {
  // The delete is durable before the list re-reads it. That read used to
  // share a catch with the write, so its failure was announced as the delete
  // failing - and the confirmation stayed open over a record that no longer
  // existed, offering a retry that could only fail again.
  beforeEach(() => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile([{ id: 'period-2026-09-17', startDate: '2026-09-17' }]))
      .mockResolvedValueOnce(profile([{ id: 'period-2026-09-17', startDate: '2026-09-17' }]))
      .mockRejectedValueOnce(new Error('read back failed'))
      .mockResolvedValue(profile([]));
    repository.saveCycleProfile.mockResolvedValue(undefined);
  });

  async function deleteIt() {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    return screen;
  }

  it('does not report the durable delete as failed', async () => {
    const screen = await deleteIt();

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Kayıt silinemedi.')).toBeNull();
  });

  it('closes the confirmation, because the record is already gone', async () => {
    const screen = await deleteIt();

    expect(screen.queryByText('Bu regl kaydını silmek istiyor musun?')).toBeNull();
    expect(screen.queryByLabelText('Sil')).toBeNull();
  });

  it('keeps the list it had rather than an error screen', async () => {
    const screen = await deleteIt();

    expect(screen.queryByText('Kayıtlar yüklenemedi.')).toBeNull();
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

  it('offers no end edit on a record that is still running', async () => {
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

describe('HistoryScreen edit when the read back fails', () => {
  // Same shape as the delete above: the update is durable, only the list's
  // re-read failed. The start edit case matters most - the use case may give
  // the record a new id, so an editor left open would retry against an id
  // that no longer exists.
  beforeEach(() => {
    repository.saveCycleProfile.mockResolvedValue(undefined);
  });

  it('closes the end editor without calling the durable update failed', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile([{ id: 'a', startDate: '2026-09-02' }]))
      .mockResolvedValueOnce(profile([{ id: 'a', startDate: '2026-09-02' }]))
      .mockRejectedValueOnce(new Error('read back failed'))
      .mockResolvedValue(profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-03' }]));

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Sonraki gün'));
    await fireEvent.press(screen.getByLabelText('Bitiş tarihini kaydet'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Kayıt güncellenemedi.')).toBeNull();
    expect(screen.queryByLabelText('Bitiş tarihini kaydet')).toBeNull();
  });

  it('closes the start editor without calling the durable update failed', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile([{ id: 'a', startDate: '2026-09-02' }]))
      .mockResolvedValueOnce(profile([{ id: 'a', startDate: '2026-09-02' }]))
      .mockRejectedValueOnce(new Error('read back failed'))
      .mockResolvedValue(profile([{ id: 'a', startDate: '2026-09-01' }]));

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Kayıt güncellenemedi.')).toBeNull();
    expect(screen.queryByLabelText('Başlangıç tarihini kaydet')).toBeNull();
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

  /**
   * The asymmetry, on the one record where it shows.
   *
   * Both ends used to be hidden on a running period. When it ends is a state
   * change and belongs to the Cycle tab, which is still true; when it began is
   * a fact about the past whether or not it is still running, and hiding that
   * left a mistyped start with no remedy but Delete and re-record.
   */
  it('offers the start edit on a running record but not the end edit', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-17', isOngoing: true }])
    );

    const { getByLabelText, queryByLabelText } = await renderScreen();

    expect(
      getByLabelText('17 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    ).toBeTruthy();
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

  /**
   * The whole path, on the record the editor used not to open for.
   *
   * The application test holds the rule; this holds that a person can reach
   * it. The record is written back still running and still with no end date -
   * which is what a correction of the past must not quietly change about the
   * present.
   */
  it('corrects a running record from the screen and leaves it running', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17', isOngoing: true }])
    );

    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('17 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    const saved = repository.saveCycleProfile.mock.calls[0][1] as CycleProfile;

    expect(saved.periodRecords).toEqual([
      { id: 'period-2026-09-16', startDate: '2026-09-16', isOngoing: true },
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

describe('HistoryScreen widget snapshot sync', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17' }])
    );
  });

  it('syncs after a record is deleted', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs after a start date is edited', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydının başlangıç tarihini düzenle'));
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs for the day the screen is working with', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledWith(
      expect.anything(),
      '2026-09-25'
    );
  });

  it('does not sync when the delete failed', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    await waitFor(() => {
      expect(screen.getByText('Kayıt silinemedi.')).toBeTruthy();
    });

    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });

  it('keeps the delete successful when the sync writes nothing', async () => {
    widgetSync.syncWidgetSnapshotQuietly.mockResolvedValue(null);

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Kayıt silinemedi.')).toBeNull();
  });

  it('does not sync when nothing is changed', async () => {
    await renderScreen();

    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });
});

describe('HistoryScreen period reminder sync', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17' }])
    );
  });

  it('syncs after a record is deleted', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
    expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledWith(
      expect.anything(),
      '2026-09-25'
    );
  });

  it('syncs after a start date is edited', async () => {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('17 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );
    await fireEvent.press(screen.getByLabelText('Önceki gün'));
    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('does not sync when the write failed', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    await waitFor(() => {
      expect(screen.getByText('Kayıt silinemedi.')).toBeTruthy();
    });

    expect(reminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
  });

  it('keeps the delete successful when the reminder could not be scheduled', async () => {
    reminderSync.syncPeriodReminderQuietly.mockResolvedValue(null);

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('17 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Kayıt silinemedi.')).toBeNull();
  });

  it('does not sync when nothing is changed', async () => {
    await renderScreen();

    expect(reminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
  });
});

describe('when a sync replaces the history underneath', () => {
  beforeEach(() => {
    resetLocalDataChangeListenersForTests();
    repository.loadCycleProfile.mockResolvedValue(profile([{ id: 'a', startDate: '2026-09-02' }]));
  });

  it('shows the pulled records without the screen being left and reopened', async () => {
    const screen = await renderScreen();

    expect(screen.queryAllByTestId(/^history-record-/)).toHaveLength(1);

    repository.loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'a', startDate: '2026-09-02' },
        { id: 'b', startDate: '2026-08-01' },
      ])
    );

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(screen.queryAllByTestId(/^history-record-/)).toHaveLength(2);
    });
  });

  it('picks up a record another phone deleted', async () => {
    const screen = await renderScreen();

    repository.loadCycleProfile.mockResolvedValue(profile([]));

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(screen.queryAllByTestId(/^history-record-/)).toHaveLength(0);
    });
  });

  it('closes a delete confirmation a pull has invalidated, and says why', async () => {
    // The panel is about one record by id. After a pull that record may hold
    // different dates or be gone, so confirming would act on something that
    // has changed underneath them.
    const screen = await renderScreen();

    fireEvent.press(screen.getByLabelText('2 Eylül 2026 regl kaydını sil'));

    await waitFor(() => {
      expect(screen.getByLabelText('Sil')).toBeTruthy();
    });

    repository.loadCycleProfile.mockResolvedValue(profile([{ id: 'a', startDate: '2026-09-03' }]));

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(screen.getByText(/Veriler başka bir cihazdan güncellendi/)).toBeTruthy();
    });

    expect(screen.queryByLabelText('Sil')).toBeNull();
  });

  it('says nothing when no panel was open', async () => {
    const screen = await renderScreen();

    repository.loadCycleProfile.mockResolvedValue(profile([]));

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(screen.queryAllByTestId(/^history-record-/)).toHaveLength(0);
    });

    expect(screen.queryByText(/Veriler başka bir cihazdan güncellendi/)).toBeNull();
  });

  it('leaves a panel alone when the change came from this phone', async () => {
    const screen = await renderScreen();

    fireEvent.press(screen.getByLabelText('2 Eylül 2026 regl kaydını sil'));

    await waitFor(() => {
      expect(screen.getByLabelText('Sil')).toBeTruthy();
    });

    await act(async () => {
      notifyLocalDataChanged('local');
    });

    expect(screen.getByLabelText('Sil')).toBeTruthy();
    expect(screen.queryByText(/Veriler başka bir cihazdan güncellendi/)).toBeNull();
  });
});

describe('HistoryScreen under the floating tab bar', () => {
  it('leaves room for the bar so its last row is not hidden under it', async () => {
    const screen = await renderScreen();

    expectClearsTabBar(screen.toJSON());
  });
});

/**
 * The tab leads with the answer.
 *
 * The correlation engine has been written and tested since before this stage,
 * and it was rendering - on `daily-log-history`, a screen reached from a link
 * on the home screen. The tab called "Geçmiş" showed period records and
 * nothing else, so the thing somebody opens an insights tab for was two taps
 * away behind a word that did not promise it.
 *
 * Cycles opens its insights with counts rather than with a chart. That order
 * is what this takes: what gets written down most, then where it falls across
 * the cycle, then the records themselves.
 */
describe('HistoryScreen insights', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile([{ id: 'a', startDate: '2026-09-02' }]));
  });

  it('opens with what gets written down most', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('En çok kaydettiklerin')).toBeTruthy();
  });

  it('shows the distribution underneath it, not instead of it', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('Evrelere göre dağılım')).toBeTruthy();
  });

  it('still lists the period records it always did', async () => {
    const screen = await renderScreen();

    expect(screen.getByText(HISTORY_TITLE)).toBeTruthy();
  });
});

/**
 * What the tab counts.
 *
 * `MostLoggedList` holds the rules about how the three groups are drawn. This
 * holds the one thing only the screen can be wrong about: which of them it
 * hands over. It passed `symptomIds` and `moodId` and nothing else, so flow -
 * the one thing a period day always has - never reached the list that is the
 * first answer on this screen.
 */
describe('HistoryScreen what you log most', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );

    dailyLogRepository.loadAllDailyEntries.mockResolvedValue([
      { date: '2026-09-02' as ISODate, flowId: 'medium', moodId: 'good', symptomIds: ['cramps'] },
      { date: '2026-09-03' as ISODate, flowId: 'medium', moodId: null, symptomIds: [] },
    ]);
  });

  it('counts the flow that was recorded, not only symptoms and moods', async () => {
    const { getByText } = await renderScreen();

    expect(getByText(dailyLogMessages.tr.flowSectionTitle)).toBeTruthy();
    expect(getByText(dailyLogCatalogueLabels.tr.flows.medium)).toBeTruthy();
    expect(getByText('2 gün')).toBeTruthy();
  });

  it('still counts the other two', async () => {
    const { getByText } = await renderScreen();

    expect(getByText(dailyLogCatalogueLabels.tr.symptoms.cramps)).toBeTruthy();
    expect(getByText(dailyLogCatalogueLabels.tr.moods.good)).toBeTruthy();
  });
});

/**
 * The row actions look like controls.
 *
 * All three were `small` text in `textSecondary` with no border and no glyph -
 * the same treatment as the "Başlangıç" and "Bitiş" labels above them. The hit
 * area was always right; nothing said they were pressable, so three controls
 * read as a caption. A screen reader was told and a sighted person was not.
 *
 * The assertion is about the two channels rather than the exact style: a
 * border, and the accent rather than the secondary text colour. That is the
 * app's existing treatment for a pressable that is not a filled button.
 */
describe('HistoryScreen row actions read as controls', () => {
  it('gives all three a border and the accent, not the caption colour', async () => {
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );

    const screen = await renderScreen();

    const labels = [
      '2 Eylül 2026 regl kaydının başlangıç tarihini düzenle',
      '2 Eylül 2026 regl kaydının bitiş tarihini düzenle',
      '2 Eylül 2026 regl kaydını sil',
    ];

    for (const label of labels) {
      const control = screen.getByLabelText(label);
      const style = StyleSheet.flatten(control.props.style);

      expect([label, style?.borderWidth]).toEqual([label, 1]);
      expect([label, style?.borderColor]).toEqual([label, Colors.light.primary]);
    }

    // And the words inside them are the accent, not the grey the labels use.
    for (const text of ['Başlangıcı düzenle', 'Bitişi düzenle', 'Sil']) {
      const node = screen.getByText(text);

      expect([text, StyleSheet.flatten(node.props.style)?.color]).toEqual([
        text,
        Colors.light.primary,
      ]);
    }
  });
});

/**
 * The day moving while the screen is open.
 *
 * ## Why this tab and not another
 *
 * It is the one that both measures against today and writes. The editors'
 * calendars stop at today, the use cases refuse a date after today, and every
 * save rebuilds the reminder queue and the widget snapshot from today. A
 * screen a day behind is therefore a calendar that will not offer the day it
 * actually is, with nothing on screen saying which day it thinks it is, and a
 * reminder recomputed from a yesterday nothing will correct.
 *
 * It used to read the clock once, in `useState(() => ...)`, with a comment
 * saying every edit should measure against the same day. True for one sitting.
 * A phone left on this tab at 23:58 and picked up at 00:05 kept yesterday for
 * as long as it stayed there.
 */
describe('HistoryScreen when the day moves under it', () => {
  beforeEach(() => {
    getTodayMock.mockReturnValue('2026-09-04' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-04' }])
    );
  });

  it('offers the new day in the editor once the app comes back', async () => {
    // The visible half. Before, the calendar stopped at the day the screen was
    // opened and the only way past it was to leave the tab.
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    expect(screen.getByLabelText('Sonraki gün').props.accessibilityState.disabled).toBe(true);

    getTodayMock.mockReturnValue('2026-09-05' as ISODate);

    await returnToForeground();

    await waitFor(() => {
      expect(screen.getByLabelText('Sonraki gün').props.accessibilityState.disabled).toBe(false);
    });
  });

  it('rebuilds the queue from the day it is now, not the day it opened', async () => {
    // The invisible half, and the one that costs something. A reminder
    // recomputed from yesterday is not on screen to be noticed and nothing
    // later puts it right.
    const screen = await renderScreen();

    getTodayMock.mockReturnValue('2026-09-05' as ISODate);

    await fireEvent.press(screen.getByLabelText('2 Eylül 2026 regl kaydını sil'));
    await fireEvent.press(screen.getByLabelText('Sil'));

    await waitFor(() => {
      expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledWith(
        expect.anything(),
        '2026-09-05'
      );
    });

    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledWith(
      expect.anything(),
      '2026-09-05'
    );
  });

  it('takes the day at the moment of the write, without waiting to be refocused', async () => {
    // Nothing brought the screen back here: the day simply turned while
    // somebody was looking at it, and then they pressed save. The write reads
    // the clock itself rather than trusting the screen's copy, so there is no
    // window at all on the side that cannot be seen.
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının bitiş tarihini düzenle')
    );

    getTodayMock.mockReturnValue('2026-09-05' as ISODate);

    await fireEvent.press(screen.getByLabelText('Bitiş tarihini kaydet'));

    await waitFor(() => {
      expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledWith(
        expect.anything(),
        '2026-09-05'
      );
    });
  });

  it('does the same on the start date, which is a separate path', async () => {
    // Three writes on this screen take the day, and a sweep that checked one
    // of them would have found the other two agreeing with it by luck. The
    // start-date save was uncovered until a mutation said so.
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('2 Eylül 2026 regl kaydının başlangıç tarihini düzenle')
    );

    getTodayMock.mockReturnValue('2026-09-05' as ISODate);

    await fireEvent.press(screen.getByLabelText('Başlangıç tarihini kaydet'));

    await waitFor(() => {
      expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledWith(
        expect.anything(),
        '2026-09-05'
      );
    });

    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledWith(
      expect.anything(),
      '2026-09-05'
    );
  });
});
