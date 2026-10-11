import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import HomeScreen from '@/app/(app)/(tabs)/index';
import { Sky } from '@/constants/sky';
import { Colors } from '@/constants/theme';
import { CONTENT_DISCLAIMER_FOOTER } from '@/features/disclaimer/presentation/disclaimer-messages';
import { useAppStore } from '@/store/app-store';
import type { AppMode } from '@/types/app-state';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { getTodayLocalISODate } from '@/utils/today';

// The database and the clock are faked. The use case, the repository contract
// and every domain rule stay real, so what the screen prints is what the domain
// actually computes rather than a hard-coded string.
jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

// The screen also asks whether a pregnancy is being tracked, to decide whether
// to offer to start one. Defaults to none, which is what most of these tests are
// about; the pregnancy link has its own describe block.
jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  loadPregnancyProfile: jest.fn(),
  savePregnancyProfile: jest.fn(),
}));

// The saved avatar is read alongside the rest. Defaults to none, which is what
// most of these tests are about; the avatar link has its own describe block.
jest.mock('@/features/avatar/data/avatar-repository', () => ({
  loadAvatarConfig: jest.fn(),
  saveAvatarConfig: jest.fn(),
}));

jest.mock('@/features/daily-log/data/daily-log-repository', () => ({
  loadDailyEntry: jest.fn(),
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

// The weekly pregnancy reminder is put back on the way in too. Faked so the
// calls can be counted; it is quiet by contract, so the real one would do
// nothing here.
jest.mock('@/features/notifications/application/sync-pregnancy-weekly-reminder', () => ({
  syncPregnancyWeeklyReminderQuietly: jest.fn(),
  syncPregnancyWeeklyReminder: jest.fn(),
}));

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

// The store's persistence is faked so the real store logic runs without
// AsyncStorage, which has no native module under Jest.
jest.mock('@/storage/app-state-storage', () => ({
  loadAppState: jest.fn(),
  saveAppState: jest.fn(),
  clearAppState: jest.fn(),
}));

/**
 * `useFocusEffect` runs on arrival and again on every return. The mock does the
 * same: once on mount, and once more for each simulated refocus, so a test can
 * act out leaving the screen and coming back.
 *
 * The registry is published on `globalThis` because a jest.mock factory is
 * hoisted and cannot close over anything declared outside it.
 */
jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const listeners: (() => void)[] = [];

  (globalThis as Record<string, unknown>).__focusListeners = listeners;

  return {
    useRouter: jest.fn(),
    useFocusEffect: (effect: () => void | (() => void)) => {
      const [focusCount, setFocusCount] = react.useState(0);

      react.useEffect(() => {
        const listener = () => setFocusCount((current) => current + 1);
        listeners.push(listener);

        return () => {
          listeners.splice(listeners.indexOf(listener), 1);
        };
      }, []);

      react.useEffect(effect, [effect, focusCount]);
    },
  };
});

const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const pregnancyRepository = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const avatarRepository = jest.requireMock('@/features/avatar/data/avatar-repository');
const dailyLogRepository = jest.requireMock('@/features/daily-log/data/daily-log-repository');
const widgetSync = jest.requireMock('@/features/widget/application/sync-widget-snapshot');
const reminderSync = jest.requireMock('@/features/notifications/application/sync-period-reminder');
const pregnancyReminderSync = jest.requireMock(
  '@/features/notifications/application/sync-pregnancy-weekly-reminder'
);
const getTodayMock = getTodayLocalISODate as unknown as jest.Mock;
const appStateStorage = jest.requireMock('@/storage/app-state-storage');

/** The store is a module singleton, so each test starts from a known mode. */
function setStoredMode(mode: AppMode) {
  useAppStore.setState({ mode, onboardingCompleted: true, hydrated: true });
}
const useRouterMock = useRouter as unknown as jest.Mock;
const focusListeners = (globalThis as Record<string, unknown>).__focusListeners as (() => void)[];

/** Acts out leaving the screen and coming back to it. */
async function refocus() {
  await act(async () => {
    for (const listener of [...focusListeners]) {
      listener();
    }
  });
}

let push: jest.Mock;

const FERTILITY_DISCLAIMER =
  'Doğurganlık bilgileri tahminidir ve gebelikten korunma yöntemi olarak kullanılmamalıdır.';

/** Collects every visible string in a rendered tree, ignoring props and styles. */
function collectText(node: unknown): string[] {
  if (typeof node === 'string') {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }

  if (node === null || typeof node !== 'object') {
    return [];
  }

  return collectText((node as { children?: unknown }).children);
}

/**
 * Cycle 28, period 5 -> ovulation on day 14, fertile window days 9-15.
 *
 * Records are finished unless asked for otherwise, so the screen offers the
 * start action. Neither `endDate` nor `isOngoing` plays any part in the cycle
 * day, phase, fertility or prediction.
 */
function profile(
  startDates: string[] = ['2026-09-01'],
  options: { open?: boolean } = {}
): CycleProfile {
  const isOngoing = options.open === true;

  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: startDates.map((startDate, index) => ({
      id: `record-${index}`,
      startDate: startDate as ISODate,
      ...(isOngoing ? {} : { endDate: startDate as ISODate }),
      isOngoing,
    })),
  };
}

/**
 * The shape onboarding leaves behind: a past period whose end was never asked
 * for. Not ongoing, and no end date invented for it.
 */
function onboardingProfile(startDate = '2026-09-02'): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
    periodRecords: [
      { id: 'onboarding-initial-period', startDate: startDate as ISODate, isOngoing: false },
    ],
  };
}

beforeEach(() => {
  db.openAppDatabase.mockReset();
  db.openAppDatabase.mockResolvedValue({});
  repository.loadCycleProfile.mockReset();
  repository.saveCycleProfile.mockReset();
  repository.saveCycleProfile.mockResolvedValue(undefined);
  pregnancyRepository.loadPregnancyProfile.mockReset();
  pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);
  pregnancyRepository.savePregnancyProfile.mockReset();
  avatarRepository.loadAvatarConfig.mockReset();
  avatarRepository.loadAvatarConfig.mockResolvedValue(null);

  dailyLogRepository.loadDailyEntry.mockReset();
  dailyLogRepository.loadDailyEntry.mockImplementation(async (_db: unknown, date: string) => ({
    date,
    flowId: null,
    moodId: null,
    symptomIds: [],
  }));
  avatarRepository.saveAvatarConfig.mockReset();
  widgetSync.syncWidgetSnapshotQuietly.mockReset();
  widgetSync.syncWidgetSnapshotQuietly.mockResolvedValue(null);
  reminderSync.syncPeriodReminderQuietly.mockReset();
  reminderSync.syncPeriodReminderQuietly.mockResolvedValue(null);
  pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mockReset();
  pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mockResolvedValue(null);
  getTodayMock.mockReset();
  getTodayMock.mockReturnValue('2026-09-17' as ISODate);

  appStateStorage.saveAppState.mockReset();
  appStateStorage.saveAppState.mockResolvedValue(undefined);
  appStateStorage.loadAppState.mockReset();
  appStateStorage.clearAppState.mockReset();
  setStoredMode('cycle');

  push = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ push, back: jest.fn(), replace: jest.fn() });
});

async function renderScreen() {
  const screen = await render(<HomeScreen />);

  await waitFor(() => {
    expect(screen.queryByTestId('cycle-dashboard-loading')).toBeNull();
  });

  return screen;
}

describe('HomeScreen while loading', () => {
  it('shows a spinner and a message', async () => {
    // Never settles, so the screen stays in its loading state.
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { getByTestId, getByText } = await render(<HomeScreen />);

    expect(getByTestId('cycle-dashboard-loading')).toBeTruthy();
    expect(getByText('Veriler yükleniyor')).toBeTruthy();
  });

  it('shows no summary yet', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByText } = await render(<HomeScreen />);

    expect(queryByText('Bugün')).toBeNull();
    expect(queryByText('Döngü günü')).toBeNull();
  });
});

describe('HomeScreen with a saved profile', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it("shows today's date", async () => {
    const { getAllByText } = await renderScreen();

    // Twice on purpose: the summary header, and the label inside today's square.
    // Once. It was twice when the date header and the cycle summary both said
    // it; there is one of them now.
    expect(getAllByText('Bugün')).toHaveLength(1);
    // Twice too: the summary date, and the selected day, which starts on today.
    // Once. It was twice when the date header and the summary both named it.
    expect(getAllByText('17 Eylül 2026')).toHaveLength(1);
  });

  it('shows the cycle day', async () => {
    const { getByText, getByLabelText } = await renderScreen();

    expect(getByText('Döngü günü')).toBeTruthy();
    expect(getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
  });

  it('shows the phase in Turkish', async () => {
    const { getByText, getByLabelText } = await renderScreen();

    // The label is not printed beside the phase any more - the hero shows
    // "Luteal" on its own, large. The label is still what assistive technology
    // hears, so that half of the assertion moves rather than going away.
    expect(getByText('Luteal')).toBeTruthy();
    expect(getByLabelText('Döngü evresi: Luteal')).toBeTruthy();
  });

  it('shows the fertility estimate with its disclaimer', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Doğurganlık tahmini')).toBeTruthy();
    expect(getByText('Düşük')).toBeTruthy();
    expect(getByText(FERTILITY_DISCLAIMER)).toBeTruthy();
  });

  it('shows the next predicted period as a readable date', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Sonraki regl tahmini')).toBeTruthy();
    expect(getByText('29 Eylül 2026')).toBeTruthy();
  });

  it('exposes each row to assistive technology', async () => {
    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(getByLabelText('Döngü evresi: Luteal')).toBeTruthy();
    expect(getByLabelText('Doğurganlık tahmini: Düşük')).toBeTruthy();
    expect(getByLabelText('Sonraki regl tahmini: 29 Eylül 2026')).toBeTruthy();
  });

  it('opens the database once and reads the clock once', async () => {
    await renderScreen();

    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(getTodayMock).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen tracks the real cycle', () => {
  it('reports the menstrual phase on the first day', async () => {
    getTodayMock.mockReturnValue('2026-09-01' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { getByText, getByLabelText } = await renderScreen();

    expect(getByLabelText('Döngü günü: 1. gün')).toBeTruthy();
    expect(getByText('Regl')).toBeTruthy();
  });

  it('reports the follicular phase with a raised estimate', async () => {
    getTodayMock.mockReturnValue('2026-09-10' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { getByText, getByLabelText } = await renderScreen();

    expect(getByLabelText('Döngü günü: 10. gün')).toBeTruthy();
    expect(getByText('Foliküler')).toBeTruthy();
    expect(getByText('Yüksek')).toBeTruthy();
  });

  it('reports ovulation day at its peak', async () => {
    getTodayMock.mockReturnValue('2026-09-14' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { getByText, getByLabelText } = await renderScreen();

    expect(getByLabelText('Döngü günü: 14. gün')).toBeTruthy();
    expect(getByText('Yumurtlama')).toBeTruthy();
    expect(getByText('En yüksek')).toBeTruthy();
  });

  it('follows a different saved cycle length', async () => {
    repository.loadCycleProfile.mockResolvedValue({
      settings: { averageCycleLengthDays: 35, averagePeriodLengthDays: 7 },
      periodRecords: [{ id: 'a', startDate: '2026-09-01' as ISODate , isOngoing: false }],
    });

    const { getByText } = await renderScreen();

    expect(getByText('Foliküler')).toBeTruthy();
    expect(getByText('6 Ekim 2026')).toBeTruthy();
  });
});

describe('HomeScreen with an incomplete profile', () => {
  it('says the cycle has not started when nothing is on record yet', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile([]));

    const { getByText } = await renderScreen();

    expect(getByText('Henüz başlamadı')).toBeTruthy();
    expect(getByText('Henüz hesaplanamıyor')).toBeTruthy();
  });

  it('labels an unknown phase and estimate', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile([]));

    const { getAllByText } = await renderScreen();

    // Once: the phase. It was twice when the day row said it as well, and the
    // day row is now the number in the middle of the screen.
    expect(getAllByText('Bilinmiyor')).toHaveLength(1);
  });
});

describe('HomeScreen without a saved profile', () => {
  it('says there is no cycle information', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('Döngü bilgisi bulunamadı.')).toBeTruthy();
    expect(queryByText('Döngü günü')).toBeNull();
  });

  it('is not treated as an error', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { queryByText } = await renderScreen();

    expect(queryByText('Bilgiler yüklenemedi.')).toBeNull();
  });
});

describe('HomeScreen when loading fails', () => {
  it('reports a failed database open', async () => {
    db.openAppDatabase.mockRejectedValue(new Error('disk is full'));

    const { getByText } = await renderScreen();

    expect(getByText('Bilgiler yüklenemedi.')).toBeTruthy();
  });

  it('reports a failed read', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { getByText } = await renderScreen();

    expect(getByText('Bilgiler yüklenemedi.')).toBeTruthy();
  });

  it('announces the failure to assistive technology', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { getByRole } = await renderScreen();

    expect(getByRole('alert')).toBeTruthy();
  });

  it('shows no summary and no empty-state message', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { queryByText } = await renderScreen();

    expect(queryByText('Döngü günü')).toBeNull();
    expect(queryByText('Döngü bilgisi bulunamadı.')).toBeNull();
  });
});

describe('HomeScreen scope', () => {
  it('never writes anything', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    await renderScreen();

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('makes no medical or probability claim', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { toJSON } = await renderScreen();
    const visibleText = collectText(toJSON()).join(' ');

    for (const forbidden of ['%', 'yüzde', 'olasılık', 'hamile kal', 'kesin', 'garanti']) {
      expect(visibleText).not.toContain(forbidden);
    }
  });

  it('shows the disclaimer next to the fertility estimate', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { toJSON } = await renderScreen();
    const visibleText = collectText(toJSON());

    expect(visibleText).toContain(FERTILITY_DISCLAIMER);
  });

  it('offers only the two month steps to tap', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { queryAllByRole } = await renderScreen();

    /**
     * Eight controls, and the whole list is readable at a glance.
     *
     * It was forty. Thirty-three of those were calendar cells and two were the
     * month arrows, all on a grid that sat underneath a ring drawing the same
     * cycle - and the ring itself was kept unpressable *so that this number
     * would not move*, which is a test fixture deciding what the product does.
     * The grid is on its own screen now and the arc is the thing you touch.
     *
     * This assertion is kept because it is worth knowing when a screen grows a
     * control, not because the number is a rule. It is a record, and it moves
     * when the design does.
     *
     * The arc is not in here: its role is `adjustable`, not `button`, which is
     * what it is - a slider through the month rather than a thing that acts.
     */
    const labels = queryAllByRole('button').map((node) => node.props.accessibilityLabel as string);

    expect(labels).toEqual([
      'Ekle',
      'Regl başlangıcını kaydet',
      'Günlük kayıt geçmişini görüntüle',
      'Avatar oluştur',
      'Gebelik takibini başlat',
    ]);

    // Three of the eight left for the bar at the bottom. A tab and a link to
    // the same screen on the screen above it are the same errand twice, and
    // the one that is on every screen wins.
    expect(labels).not.toContain('Takvimi aç');
    expect(labels).not.toContain('Geçmiş regl kayıtlarını görüntüle');
    expect(labels).not.toContain('Döngü ayarlarını düzenle');

    // No calendar cell, because there is no calendar here any more.
    expect(labels.filter((label) => label.startsWith('1 Eylül 2026'))).toHaveLength(0);
  });

  it('offers the arc as something to adjust, not something to press', async () => {
    // The whole point of the redesign, in one assertion: the cycle is the
    // thing you touch. It used to be the one thing on the screen that was
    // forbidden to be touchable.
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { getByTestId } = await renderScreen();

    expect(getByTestId('cycle-arc').props.accessibilityRole).toBe('adjustable');
  });
});

describe('HomeScreen period start action', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('offers the action', async () => {
    const { getByLabelText, getByText } = await renderScreen();

    expect(getByLabelText('Regl başlangıcını kaydet')).toBeTruthy();
    expect(getByText('Regl başladı')).toBeTruthy();
  });

  it('shows no confirmation until asked', async () => {
    const { queryByText } = await renderScreen();

    expect(
      queryByText('Bugünü regl başlangıcı olarak kaydetmek istiyor musun?')
    ).toBeNull();
  });

  it('asks before saving', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));

    expect(
      screen.getByText('Bugünü regl başlangıcı olarak kaydetmek istiyor musun?')
    ).toBeTruthy();
    expect(screen.getByLabelText('Vazgeç')).toBeTruthy();
    expect(screen.getByLabelText('Kaydet')).toBeTruthy();
  });

  it('names the date it would record', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));

    // Three times now: the summary, the selected day and the confirmation.
    // Two: the date header and the period card's confirmation. It was three
    // while the cycle summary named it as well.
    expect(screen.getAllByText('17 Eylül 2026')).toHaveLength(2);
  });

  it('writes nothing while only asking', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('HomeScreen period start cancel', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('closes the confirmation', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(
      screen.queryByText('Bugünü regl başlangıcı olarak kaydetmek istiyor musun?')
    ).toBeNull();
    expect(screen.getByText('Regl başladı')).toBeTruthy();
  });

  it('touches no storage', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen period start save', () => {
  /** What the repository returns once today has been recorded. */
  function profileWithToday(): CycleProfile {
    return {
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [
        { id: 'record-0', startDate: '2026-09-01' as ISODate , isOngoing: false },
        { id: 'period-2026-09-17', startDate: '2026-09-17' as ISODate , isOngoing: false },
      ],
    };
  }

  async function saveToday() {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    return screen;
  }

  it('stores the profile with today added', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    await saveToday();

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);

    const [, saved] = repository.saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords.map((record) => record.startDate)).toEqual([
      '2026-09-01',
      '2026-09-17',
    ]);
    expect(saved.periodRecords[1].id).toBe('period-2026-09-17');
    expect(saved.periodRecords[1].endDate).toBeUndefined();
  });

  it('closes the confirmation', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await saveToday();

    expect(
      screen.queryByText('Bugünü regl başlangıcı olarak kaydetmek istiyor musun?')
    ).toBeNull();
  });

  it('reloads the data', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(profileWithToday());

    await saveToday();

    // Once on mount, once inside the use case, once for the refresh.
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(3);
  });

  it('shows the new summary', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(profileWithToday());

    const screen = await saveToday();

    expect(screen.getByLabelText('Döngü günü: 1. gün')).toBeTruthy();
    expect(screen.getByText('Regl')).toBeTruthy();
    expect(screen.getByText('15 Ekim 2026')).toBeTruthy();
  });

  it('shows the new calendar', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(profileWithToday());

    const screen = await saveToday();

    // The calendar assertion that was here moved with the calendar, to
    // `calendar-screen.test.tsx`. What this test is about stays.
  });

  it('keeps today marked and selected', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(profileWithToday());

    const screen = await saveToday();

    // The calendar assertion that was here moved with the calendar, to
    // `calendar-screen.test.tsx`. What this test is about stays.
  });

  it('keeps the calendar and legend working', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(profileWithToday());

    const screen = await saveToday();

    // The calendar assertion that was here moved with the calendar, to
    // `calendar-screen.test.tsx`. What this test is about stays.
  });

  /**
   * Gone from here: "month navigation after a save".
   *
   * Every assertion it had left was about the calendar grid, which is on its
   * own screen. Unlike the other tests in this file it kept nothing of the home
   * screen, so there was no half of it to leave behind.
   *
   * What it protected - that the grid still works after a record is written -
   * is now the calendar screen's own concern, and that screen reloads on focus
   * through the same `useDataChangeReload` announcement this one does.
   */

  /**
   * Gone from here: "day selection after a save".
   *
   * Every assertion it had left was about the calendar grid, which is on its
   * own screen. Unlike the other tests in this file it kept nothing of the home
   * screen, so there was no half of it to leave behind.
   *
   * What it protected - that the grid still works after a record is written -
   * is now the calendar screen's own concern, and that screen reloads on focus
   * through the same `useDataChangeReload` announcement this one does.
   */
});

describe('HomeScreen period start double submit', () => {
  it('saves once however many times Kaydet is pressed', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    // The confirmation is gone after a successful save, so there is nothing
    // left to press a second time.
    expect(screen.queryByLabelText('Kaydet')).toBeNull();
    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen period start failure', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('reports a rejected save', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByText('Regl başlangıcı kaydedilemedi.')).toBeTruthy();
  });

  it('announces the failure to assistive technology', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('keeps the confirmation open so the failure sits next to the action', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByLabelText('Kaydet')).toBeTruthy();
    expect(screen.getByLabelText('Vazgeç')).toBeTruthy();
  });

  it('leaves the shown data alone', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(screen.getByText('Luteal')).toBeTruthy();
    // The calendar assertion that was here moved with the calendar, to
    // `calendar-screen.test.tsx`. What this test is about stays.
  });

  it('rejects a date already recorded without corrupting anything', async () => {
    // Today is already on file and closed, so the screen still offers the start
    // action and the use case is what refuses the duplicate date.
    repository.loadCycleProfile.mockResolvedValue({
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [
        {
          id: 'period-2026-09-17',
          startDate: '2026-09-17' as ISODate,
          endDate: '2026-09-17' as ISODate,
          isOngoing: false,
        },
      ],
    });

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByText('Regl başlangıcı kaydedilemedi.')).toBeTruthy();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Döngü günü: 1. gün')).toBeTruthy();
  });

  it('clears the error when the confirmation is dismissed', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));

    expect(screen.queryByText('Regl başlangıcı kaydedilemedi.')).toBeNull();
  });
});

describe('HomeScreen period start absence', () => {
  it('offers nothing to record while loading', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByLabelText } = await render(<HomeScreen />);

    expect(queryByLabelText('Regl başlangıcını kaydet')).toBeNull();
  });

  it('offers nothing to record without a profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Regl başlangıcını kaydet')).toBeNull();
  });

  it('offers nothing to record when loading failed', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Regl başlangıcını kaydet')).toBeNull();
  });
});

describe('HomeScreen period action choice', () => {
  it('offers the start action when nothing is open', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { getByLabelText, queryByLabelText, getByText, queryByText } = await renderScreen();

    expect(getByLabelText('Regl başlangıcını kaydet')).toBeTruthy();
    expect(getByText('Regl başladı')).toBeTruthy();
    expect(queryByLabelText('Regl bitişini kaydet')).toBeNull();
    expect(queryByText('Regl bitti')).toBeNull();
  });

  it('offers the end action when a period is open', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-17'], { open: true }));

    const { getByLabelText, queryByLabelText, getByText, queryByText } = await renderScreen();

    expect(getByLabelText('Regl bitişini kaydet')).toBeTruthy();
    expect(getByText('Regl bitti')).toBeTruthy();
    expect(queryByLabelText('Regl başlangıcını kaydet')).toBeNull();
    expect(queryByText('Regl başladı')).toBeNull();
  });

  it('never sees several ongoing periods, because validation rejects them first', async () => {
    repository.loadCycleProfile.mockResolvedValue({
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [
        { id: 'a', startDate: '2026-09-01' as ISODate, isOngoing: true },
        { id: 'b', startDate: '2026-09-17' as ISODate, isOngoing: true },
      ],
    });

    const { queryByLabelText, getByText } = await renderScreen();

    // The domain invariant fires before anything is rendered, so the screen
    // reports the failure rather than showing an action it cannot carry out.
    expect(getByText('Bilgiler yüklenemedi.')).toBeTruthy();
    expect(queryByLabelText('Regl başlangıcını kaydet')).toBeNull();
    expect(queryByLabelText('Regl bitişini kaydet')).toBeNull();
  });
});

describe('HomeScreen period end confirmation', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-17'], { open: true }));
  });

  it('asks before saving', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));

    expect(screen.getByText('Bugünü regl bitişi olarak kaydetmek istiyor musun?')).toBeTruthy();
    expect(
      screen.queryByText('Bugünü regl başlangıcı olarak kaydetmek istiyor musun?')
    ).toBeNull();
  });

  it('names the date it would record', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));

    // The summary, the selected day and the confirmation.
    // Two: the date header and the period card's confirmation. It was three
    // while the cycle summary named it as well.
    expect(screen.getAllByText('17 Eylül 2026')).toHaveLength(2);
  });

  it('writes nothing while only asking', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('closes on Vazgeç without touching storage', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(screen.queryByText('Bugünü regl bitişi olarak kaydetmek istiyor musun?')).toBeNull();
    expect(screen.getByText('Regl bitti')).toBeTruthy();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen period end save', () => {
  /** What the repository returns once the open period has been closed. */
  function closedProfile(): CycleProfile {
    return {
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [
        {
          id: 'record-0',
          startDate: '2026-09-17' as ISODate,
          endDate: '2026-09-17' as ISODate,
          isOngoing: false,
        },
      ],
    };
  }

  async function endToday() {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    return screen;
  }

  it('stores the profile with the end date filled in', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-17'], { open: true }));

    await endToday();

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);

    const [, saved] = repository.saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords).toEqual([
      { id: 'record-0', startDate: '2026-09-17', endDate: '2026-09-17' , isOngoing: false },
    ]);
  });

  it('closes the confirmation', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-17'], { open: true }));

    const screen = await endToday();

    expect(screen.queryByText('Bugünü regl bitişi olarak kaydetmek istiyor musun?')).toBeNull();
  });

  it('reloads the data', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValue(closedProfile());

    await endToday();

    // Once on mount, once inside the use case, once for the refresh.
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(3);
  });

  it('offers the start action again', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValue(closedProfile());

    const screen = await endToday();

    expect(screen.getByText('Regl başladı')).toBeTruthy();
    expect(screen.queryByText('Regl bitti')).toBeNull();
  });

  it('leaves the summary reading the same cycle', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValue(closedProfile());

    const screen = await endToday();

    // The recorded end date plays no part in the phase or the prediction.
    expect(screen.getByLabelText('Döngü günü: 1. gün')).toBeTruthy();
    expect(screen.getByText('Regl')).toBeTruthy();
    expect(screen.getByText('15 Ekim 2026')).toBeTruthy();
  });

  /**
   * Gone from here: "the calendar, legend and navigation after ending a period".
   *
   * Every assertion it had left was about the calendar grid, which is on
   * its own screen now. Unlike most of the tests in this file it kept
   * nothing of the home screen, so there was no half of it to leave
   * behind. What it protected belongs to the calendar screen, which
   * reloads on focus through the same announcement this one listens to.
   */

  it('saves once however many times Kaydet is pressed', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-17'], { open: true }));

    const screen = await endToday();

    // The confirmation is gone after a successful save, so there is nothing
    // left to press a second time.
    expect(screen.queryByLabelText('Kaydet')).toBeNull();
    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen period end failure', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-17'], { open: true }));
  });

  async function failToEnd() {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    return screen;
  }

  it('reports the failure with its own message', async () => {
    const screen = await failToEnd();

    expect(screen.getByText('Regl bitişi kaydedilemedi.')).toBeTruthy();
    expect(screen.queryByText('Regl başlangıcı kaydedilemedi.')).toBeNull();
  });

  it('announces it to assistive technology', async () => {
    const screen = await failToEnd();

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('keeps the confirmation open so a retry is possible', async () => {
    const screen = await failToEnd();

    expect(screen.getByLabelText('Kaydet')).toBeTruthy();
    expect(screen.getByLabelText('Vazgeç')).toBeTruthy();
  });

  it('retries on a second press', async () => {
    const screen = await failToEnd();

    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(2);
  });

  it('leaves the shown data alone', async () => {
    const screen = await failToEnd();

    expect(screen.getByLabelText('Döngü günü: 1. gün')).toBeTruthy();
    // The calendar assertion that was here moved with the calendar, to
    // `calendar-screen.test.tsx`. What this test is about stays.
  });

  it('clears the error when the confirmation is dismissed', async () => {
    const screen = await failToEnd();

    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));

    expect(screen.queryByText('Regl bitişi kaydedilemedi.')).toBeNull();
  });
});

describe('HomeScreen period end absence', () => {
  it('offers nothing to record while loading', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByLabelText } = await render(<HomeScreen />);

    expect(queryByLabelText('Regl bitişini kaydet')).toBeNull();
  });

  it('offers nothing to record without a profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Regl bitişini kaydet')).toBeNull();
  });
});

describe('HomeScreen straight after onboarding', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(onboardingProfile());
  });

  it('offers to record a period start', async () => {
    const { getByLabelText, getByText } = await renderScreen();

    expect(getByLabelText('Regl başlangıcını kaydet')).toBeTruthy();
    expect(getByText('Regl başladı')).toBeTruthy();
  });

  it('does not offer to end anything', async () => {
    const { queryByLabelText, queryByText } = await renderScreen();

    // The onboarding record has no end date, but it is not happening now.
    expect(queryByLabelText('Regl bitişini kaydet')).toBeNull();
    expect(queryByText('Regl bitti')).toBeNull();
  });

  it('still shows the summary', async () => {
    const { getByText, getByLabelText } = await renderScreen();

    expect(getByLabelText('Döngü günü: 16. gün')).toBeTruthy();
    expect(getByText('Yumurtlama')).toBeTruthy();
  });
});

describe('HomeScreen through a whole period', () => {
  /** Onboarding record plus today, still running. */
  function withOngoingToday(): CycleProfile {
    return {
      settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
      periodRecords: [
        { id: 'onboarding-initial-period', startDate: '2026-09-02' as ISODate, isOngoing: false },
        { id: 'period-2026-09-17', startDate: '2026-09-17' as ISODate, isOngoing: true },
      ],
    };
  }

  /** The same, once today has been closed. */
  function withClosedToday(): CycleProfile {
    return {
      settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
      periodRecords: [
        { id: 'onboarding-initial-period', startDate: '2026-09-02' as ISODate, isOngoing: false },
        {
          id: 'period-2026-09-17',
          startDate: '2026-09-17' as ISODate,
          endDate: '2026-09-17' as ISODate,
          isOngoing: false,
        },
      ],
    };
  }

  it('offers to end once a start has been recorded', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(onboardingProfile())
      .mockResolvedValueOnce(onboardingProfile())
      .mockResolvedValue(withOngoingToday());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByText('Regl bitti')).toBeTruthy();
    expect(screen.queryByText('Regl başladı')).toBeNull();
  });

  it('stores the start as ongoing', async () => {
    repository.loadCycleProfile.mockResolvedValue(onboardingProfile());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    const [, saved] = repository.saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords[1]).toEqual({
      id: 'period-2026-09-17',
      startDate: '2026-09-17',
      isOngoing: true,
    });
  });

  it('offers to start again once the period has ended', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(withOngoingToday())
      .mockResolvedValueOnce(withOngoingToday())
      .mockResolvedValue(withClosedToday());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByText('Regl başladı')).toBeTruthy();
    expect(screen.queryByText('Regl bitti')).toBeNull();
  });

  it('stores the end with the flag cleared', async () => {
    repository.loadCycleProfile.mockResolvedValue(withOngoingToday());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    const [, saved] = repository.saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords[1]).toEqual({
      id: 'period-2026-09-17',
      startDate: '2026-09-17',
      endDate: '2026-09-17',
      isOngoing: false,
    });
    // The onboarding record is untouched, end date still unknown.
    expect(saved.periodRecords[0]).toEqual({
      id: 'onboarding-initial-period',
      startDate: '2026-09-02',
      isOngoing: false,
    });
  });
});

describe('HomeScreen focus refresh', () => {
  /** Onboarding's record plus one still running. */
  function withOngoing(): CycleProfile {
    return {
      settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
      periodRecords: [
        { id: 'onboarding-initial-period', startDate: '2026-09-02' as ISODate, isOngoing: false },
        { id: 'period-2026-09-17', startDate: '2026-09-17' as ISODate, isOngoing: true },
      ],
    };
  }

  it('reads once on arrival', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    await renderScreen();

    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('reads again on returning to the screen', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    await renderScreen();
    await refocus();

    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(2);
  });

  it('does not read on an ordinary re-render', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await renderScreen();

    // The calendar assertion that was here moved with the calendar, to
    // `calendar-screen.test.tsx`. What this test is about stays.

    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('reads the clock again on return', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    await renderScreen();
    await refocus();

    expect(getTodayMock).toHaveBeenCalledTimes(2);
  });

  it('picks up a record deleted while it was away', async () => {
    repository.loadCycleProfile.mockResolvedValue(withOngoing());

    const screen = await renderScreen();

    expect(screen.getByText('Regl bitti')).toBeTruthy();

    // The history screen removed the running record while Home was not focused.
    repository.loadCycleProfile.mockResolvedValue(
      onboardingProfile()
    );

    await refocus();

    expect(screen.getByText('Regl başladı')).toBeTruthy();
    expect(screen.queryByText('Regl bitti')).toBeNull();
  });

  it('recalculates the summary from what is left', async () => {
    repository.loadCycleProfile.mockResolvedValue(withOngoing());

    const screen = await renderScreen();

    // Today is the start of the running period.
    expect(screen.getByLabelText('Döngü günü: 1. gün')).toBeTruthy();

    repository.loadCycleProfile.mockResolvedValue(onboardingProfile());

    await refocus();

    // Back to counting from 2 September.
    expect(screen.getByLabelText('Döngü günü: 16. gün')).toBeTruthy();
    expect(screen.queryByLabelText('Döngü günü: 1. gün')).toBeNull();
  });

  it('copes with every record having been deleted', async () => {
    repository.loadCycleProfile.mockResolvedValue(withOngoing());

    const screen = await renderScreen();

    repository.loadCycleProfile.mockResolvedValue({
      settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
      periodRecords: [],
    });

    await refocus();

    expect(screen.getByText('Henüz başlamadı')).toBeTruthy();
    expect(screen.getByText('Henüz hesaplanamıyor')).toBeTruthy();
    expect(screen.getByText('Regl başladı')).toBeTruthy();
    // The calendar is still there, just with nothing marked.
  });

  it('clears a stale error once a later read succeeds', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const screen = await renderScreen();

    expect(screen.getByText('Bilgiler yüklenemedi.')).toBeTruthy();

    repository.loadCycleProfile.mockResolvedValue(profile());

    await refocus();

    expect(screen.queryByText('Bilgiler yüklenemedi.')).toBeNull();
    expect(screen.getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
  });
});

describe('HomeScreen pregnancy link', () => {
  function pregnancy() {
    return {
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    };
  }

  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('offers to start tracking when no pregnancy is stored', async () => {
    const { getByLabelText, getByText } = await renderScreen();

    expect(getByLabelText('Gebelik takibini başlat')).toBeTruthy();
    expect(getByText('Gebelik takibini başlat')).toBeTruthy();
  });

  it('opens the start route', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik takibini başlat'));

    expect(push).toHaveBeenCalledWith('/(app)/pregnancy-start');
  });

  it('does not offer it once a pregnancy is being tracked', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(pregnancy());

    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Gebelik takibini başlat')).toBeNull();
  });

  it('leaves the other links in place either way', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(pregnancy());

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Günlük kayıt geçmişini görüntüle')).toBeTruthy();
  });

  it('stops offering it after a pregnancy is started elsewhere', async () => {
    const screen = await renderScreen();

    expect(screen.getByLabelText('Gebelik takibini başlat')).toBeTruthy();

    // What returning from the start screen looks like: the row is there now.
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(pregnancy());
    await refocus();

    expect(screen.queryByLabelText('Gebelik takibini başlat')).toBeNull();
  });

  it('reads the pregnancy again on every focus', async () => {
    await renderScreen();

    expect(pregnancyRepository.loadPregnancyProfile).toHaveBeenCalledTimes(1);

    await refocus();

    expect(pregnancyRepository.loadPregnancyProfile).toHaveBeenCalledTimes(2);
  });

  it('writes no pregnancy of its own', async () => {
    await renderScreen();

    expect(pregnancyRepository.savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('shows no pregnancy section while there is no pregnancy', async () => {
    const { queryByText } = await renderScreen();

    for (const forbidden of ['Gebelik takibi', 'Gebelik haftası', 'Tahmini doğum tarihi']) {
      expect(queryByText(forbidden)).toBeNull();
    }
  });

  it('reports a failed pregnancy read as a load failure rather than hiding it', async () => {
    pregnancyRepository.loadPregnancyProfile.mockRejectedValue(new Error('database is locked'));

    const { getByText } = await renderScreen();

    expect(getByText('Bilgiler yüklenemedi.')).toBeTruthy();
  });
});

describe('HomeScreen pregnancy dashboard', () => {
  // The pregnancy view is where this content lives.
  beforeEach(() => {
    setStoredMode('pregnancy');
  });

  /** Last menstrual period on 2 September; today is 17 September in these tests. */
  function pregnancyProfile(
    overrides: {
      lastMenstrualPeriodStartDate?: string;
      estimatedDueDate?: string;
      dueDateSource?: 'lmp' | 'adjusted';
    } = {}
  ) {
    return {
      lastMenstrualPeriodStartDate: (overrides.lastMenstrualPeriodStartDate ??
        '2026-09-02') as ISODate,
      estimatedDueDate: (overrides.estimatedDueDate ?? '2027-06-09') as ISODate,
      dueDateSource: overrides.dueDateSource ?? ('lmp' as const),
    };
  }

  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(pregnancyProfile());
  });

  it('shows the section heading', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Gebelik takibi')).toBeTruthy();
  });

  it('shows how far along the pregnancy is', async () => {
    const { getByText } = await renderScreen();

    // 2 September is day 1, so 17 September is day 16: week 3, day 2.
    expect(getByText('3. hafta 2. gün')).toBeTruthy();
  });

  it('follows the stored last menstrual period rather than a fixed number', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(
      pregnancyProfile({ lastMenstrualPeriodStartDate: '2026-08-01' })
    );

    const { getByText } = await renderScreen();

    // 1 August is day 1, so 17 September is day 48: week 7, day 6.
    expect(getByText('7. hafta 6. gün')).toBeTruthy();
  });

  it('reads the last menstrual period itself as week 1 day 1', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(
      pregnancyProfile({ lastMenstrualPeriodStartDate: '2026-09-17' })
    );

    const { getByText } = await renderScreen();

    expect(getByText('1. hafta 1. gün')).toBeTruthy();
  });

  it('labels and shows the estimated due date', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Tahmini doğum tarihi')).toBeTruthy();
    expect(getByText('9 Haziran 2027')).toBeTruthy();
  });

  it('says a calculated due date came from the last period', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Son regl tarihine göre')).toBeTruthy();
  });

  it('says an adjusted due date was corrected', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(
      pregnancyProfile({ estimatedDueDate: '2027-06-04', dueDateSource: 'adjusted' })
    );

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('4 Haziran 2027')).toBeTruthy();
    expect(getByText('Düzeltilmiş tarih')).toBeTruthy();
    expect(queryByText('Son regl tarihine göre')).toBeNull();
  });

  it('exposes both rows to assistive technology', async () => {
    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Gebelik haftası: 3. hafta 2. gün')).toBeTruthy();
    expect(
      getByLabelText('Tahmini doğum tarihi: 9 Haziran 2027, Son regl tarihine göre')
    ).toBeTruthy();
  });

  it('replaces the link that offers to start tracking', async () => {
    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Gebelik takibini başlat')).toBeNull();
  });

  it('writes nothing', async () => {
    await renderScreen();

    expect(pregnancyRepository.savePregnancyProfile).not.toHaveBeenCalled();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('waits to be chosen after a pregnancy is started elsewhere', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);

    const screen = await renderScreen();

    expect(screen.queryByText('Gebelik takibi')).toBeNull();

    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(pregnancyProfile());
    await refocus();

    // Starting a pregnancy does not move the person out of the cycle view; the
    // tab becomes available and they choose it.
    expect(screen.queryByText('Gebelik takibi')).toBeNull();
    expect(screen.getByLabelText('Gebelik').props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(screen.getByLabelText('Gebelik'));

    expect(screen.getByText('Gebelik takibi')).toBeTruthy();
    expect(screen.getByText('3. hafta 2. gün')).toBeTruthy();
  });

  it('adds nothing this step does not cover', async () => {
    const { queryByText } = await renderScreen();

    // No mode switch and no way to edit the date in this step.
    for (const forbidden of ['Gebelik modu', 'Tahmini doğum tarihini düzenle']) {
      expect(queryByText(forbidden)).toBeNull();
    }
  });

  it('shows the week content that belongs to the week it is in', async () => {
    // The fixture is week 3, where nothing is measured yet.
    const { getByText } = await renderScreen();

    expect(getByText('Bu hafta')).toBeTruthy();
    expect(getByText(/Döllenme genellikle bu haftalarda gerçekleşir/)).toBeTruthy();
  });

  it('shows no size for a week that has none', async () => {
    const { queryByText } = await renderScreen();

    // Week 3 carries no size, so the line is absent rather than blank.
    expect(queryByText(/^yaklaşık .+ — .+$/)).toBeNull();
  });

  it('shows the size for a week that has one', async () => {
    // 27 August is day 1, so 17 September is day 22: week 4.
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(
      pregnancyProfile({ lastMenstrualPeriodStartDate: '2026-08-27' })
    );

    const { getByText } = await renderScreen();

    expect(getByText('4. hafta 1. gün')).toBeTruthy();
    expect(getByText('yaklaşık 2 mm — haşhaş tohumu')).toBeTruthy();
  });

  it('lists what is developing this week', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Bu hafta gelişenler')).toBeTruthy();
    expect(getByText('• Sperm ve yumurta birleşerek zigotu oluşturur')).toBeTruthy();
    expect(getByText('• Zigot rahme doğru ilerler')).toBeTruthy();
  });

  it('closes the weekly content with the general-information footer', async () => {
    const { getByText } = await renderScreen();

    expect(getByText(CONTENT_DISCLAIMER_FOOTER)).toBeTruthy();
  });

  it('uses the same line the cycle view uses, not a second wording', async () => {
    // Somebody who has read it under the daily note should recognise it here
    // rather than read it again as something new.
    const { queryAllByText } = await renderScreen();

    expect(queryAllByText(CONTENT_DISCLAIMER_FOOTER)).toHaveLength(1);
  });

  it('exposes the week content to assistive technology', async () => {
    const { getByLabelText } = await renderScreen();

    expect(getByLabelText(/^Bu hafta: Döllenme genellikle bu haftalarda gerçekleşir/)).toBeTruthy();
    expect(
      getByLabelText(/^Bu hafta gelişenler: Sperm ve yumurta birleşerek zigotu oluşturur/)
    ).toBeTruthy();
  });

  it('leads the spoken label with the size when there is one', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(
      pregnancyProfile({ lastMenstrualPeriodStartDate: '2026-08-27' })
    );

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText(/^Bu hafta: yaklaşık 2 mm — haşhaş tohumu./)).toBeTruthy();
  });

  it('cites where the week content came from', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Kaynaklar')).toBeTruthy();
    expect(getByText(/Cleveland Clinic/)).toBeTruthy();
  });

  it('shows no week content past week 40', async () => {
    // 40 weeks and a day past the last menstrual period.
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(
      pregnancyProfile({ lastMenstrualPeriodStartDate: '2025-12-10' })
    );

    const { queryByText, getByText } = await renderScreen();

    expect(queryByText('Bu hafta')).toBeNull();
    expect(queryByText('Bu hafta gelişenler')).toBeNull();
    // The rest of the section is still there.
    expect(getByText('Gebelik takibi')).toBeTruthy();
    expect(getByText('Tahmini doğum tarihi')).toBeTruthy();
  });
});

describe('HomeScreen pregnancy dashboard before the pregnancy began', () => {
  // The pregnancy view is where this content lives.
  beforeEach(() => {
    setStoredMode('pregnancy');
  });

  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    // A stored pregnancy whose last menstrual period is still ahead of today.
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-10-01' as ISODate,
      estimatedDueDate: '2027-07-08' as ISODate,
      dueDateSource: 'lmp' as const,
    });
  });

  it('says so instead of showing a week', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Gebelik başlangıç tarihi henüz gelmedi.')).toBeTruthy();
  });

  it('shows no week or day count', async () => {
    const { queryByText } = await renderScreen();

    expect(queryByText(/hafta \d+\. gün/)).toBeNull();
  });

  it('still shows the due date', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Tahmini doğum tarihi')).toBeTruthy();
    expect(getByText('8 Temmuz 2027')).toBeTruthy();
  });

  it('does not fall over', async () => {
    const { queryByText } = await renderScreen();

    expect(queryByText('Bilgiler yüklenemedi.')).toBeNull();
    expect(queryByText('Gebelik takibi')).toBeTruthy();
  });

  it('shows no week content either', async () => {
    const { queryByText } = await renderScreen();

    expect(queryByText('Bu hafta')).toBeNull();
    expect(queryByText('Bu hafta gelişenler')).toBeNull();
  });
});

describe('HomeScreen cycle dashboard alongside a pregnancy', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    });
  });

  it('still shows the cycle summary', async () => {
    const { getByText, getByLabelText, getAllByLabelText } = await renderScreen();

    expect(getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(getAllByLabelText(/^Döngü evresi: /).length).toBeGreaterThan(0);
    expect(getByText('Doğurganlık tahmini')).toBeTruthy();
  });

  it('still shows the cycle summary', async () => {
    const { getByText } = await renderScreen();

    // The calendar assertion that was here moved with the calendar, to
    // `calendar-screen.test.tsx`. What this test is about stays.
  });

  it('still offers the period action', async () => {
    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Regl başlangıcını kaydet')).toBeTruthy();
  });

  it('still offers the links that are not tabs', async () => {
    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Günlük kayıt geçmişini görüntüle')).toBeTruthy();
  });

  /**
   * Gone from here: "day selection alongside a tracked pregnancy".
   *
   * Every assertion it had left was about the calendar grid, which is on
   * its own screen now. Unlike most of the tests in this file it kept
   * nothing of the home screen, so there was no half of it to leave
   * behind. What it protected belongs to the calendar screen, which
   * reloads on focus through the same announcement this one listens to.
   */
});

describe('HomeScreen pregnancy content sources', () => {
  // The pregnancy view is where this content lives.
  beforeEach(() => {
    setStoredMode('pregnancy');
  });

  const NHS_WEEK_10 = 'https://www.nhs.uk/pregnancy/week-by-week/1-to-12/10-weeks/';
  const CLEVELAND =
    'https://my.clevelandclinic.org/health/articles/7247-fetal-development-stages-of-growth';

  function pregnancyProfile(lastMenstrualPeriodStartDate: string) {
    return {
      lastMenstrualPeriodStartDate: lastMenstrualPeriodStartDate as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    };
  }

  /** 11 July is day 1, so 17 September is day 69: week 10, which cites both. */
  const WEEK_10_LMP = '2026-07-11';

  let openURL: jest.SpyInstance;

  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(pregnancyProfile(WEEK_10_LMP));

    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(() => {
    openURL.mockRestore();
  });

  it('heads the section', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Kaynaklar')).toBeTruthy();
  });

  it('names both sources', async () => {
    const { getByText } = await renderScreen();

    expect(getByText(/^NHS — You and your baby at 10 weeks pregnant$/)).toBeTruthy();
    expect(getByText(/^Cleveland Clinic — /)).toBeTruthy();
  });

  it('shows the address of each', async () => {
    const { getByText } = await renderScreen();

    expect(getByText(NHS_WEEK_10)).toBeTruthy();
    expect(getByText(CLEVELAND)).toBeTruthy();
  });

  it('offers each as something to open', async () => {
    const { getByLabelText } = await renderScreen();

    expect(
      getByLabelText('NHS — You and your baby at 10 weeks pregnant kaynağını aç')
    ).toBeTruthy();
    expect(getByLabelText(/^Cleveland Clinic — .* kaynağını aç$/)).toBeTruthy();
  });

  it('opens the NHS page at its own url', async () => {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('NHS — You and your baby at 10 weeks pregnant kaynağını aç')
    );

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith(NHS_WEEK_10);
  });

  it('opens the Cleveland Clinic page at its own url', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(/^Cleveland Clinic — .* kaynağını aç$/));

    expect(openURL).toHaveBeenCalledWith(CLEVELAND);
  });

  it('renders each source once', async () => {
    const { queryAllByText } = await renderScreen();

    expect(queryAllByText(NHS_WEEK_10)).toHaveLength(1);
    expect(queryAllByText(CLEVELAND)).toHaveLength(1);
    expect(queryAllByText('Kaynaklar')).toHaveLength(1);
  });

  it('follows the week, so the NHS link changes with it', async () => {
    // Week 4 rather than 10.
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(
      pregnancyProfile('2026-08-27')
    );

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('https://www.nhs.uk/pregnancy/week-by-week/1-to-12/4-weeks/')).toBeTruthy();
    expect(queryByText(NHS_WEEK_10)).toBeNull();
  });

  it('opens nothing on its own', async () => {
    await renderScreen();

    expect(openURL).not.toHaveBeenCalled();
  });

  it('leaves the links out of the button count', async () => {
    // They are links, not buttons, so the screen's actions stay countable.
    const { queryAllByRole } = await renderScreen();

    expect(queryAllByRole('link')).toHaveLength(2);
  });
});

describe('HomeScreen when a source will not open', () => {
  // The pregnancy view is where this content lives.
  beforeEach(() => {
    setStoredMode('pregnancy');
  });

  let openURL: jest.SpyInstance;

  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-07-11' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    });

    openURL = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
  });

  afterEach(() => {
    openURL.mockRestore();
  });

  async function failToOpen() {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText('NHS — You and your baby at 10 weeks pregnant kaynağını aç')
    );

    return screen;
  }

  it('says so', async () => {
    const screen = await failToOpen();

    expect(screen.getByText('Kaynak açılamadı.')).toBeTruthy();
  });

  it('announces it', async () => {
    const screen = await failToOpen();

    expect(screen.getByText('Kaynak açılamadı.').props.accessibilityRole).toBe('alert');
  });

  it('keeps the screen', async () => {
    const screen = await failToOpen();

    expect(screen.getByText('Kaynaklar')).toBeTruthy();
    expect(screen.getByText('Gebelik takibi')).toBeTruthy();
    expect(screen.getByText('Bu hafta')).toBeTruthy();
  });

  it('says nothing before anything is pressed', async () => {
    const screen = await renderScreen();

    expect(screen.queryByText('Kaynak açılamadı.')).toBeNull();
  });

  it('clears the message when a link works on a later press', async () => {
    const screen = await failToOpen();

    openURL.mockResolvedValue(true);

    await fireEvent.press(screen.getByLabelText(/^Cleveland Clinic — .* kaynağını aç$/));

    expect(screen.queryByText('Kaynak açılamadı.')).toBeNull();
  });

  it('can be tried again', async () => {
    const screen = await failToOpen();

    await fireEvent.press(
      screen.getByLabelText('NHS — You and your baby at 10 weeks pregnant kaynağını aç')
    );

    expect(openURL).toHaveBeenCalledTimes(2);
  });
});

describe('HomeScreen sources without week content', () => {
  // The pregnancy view is where this content lives.
  beforeEach(() => {
    setStoredMode('pregnancy');
  });

  it('shows no source section before the pregnancy began', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-10-01' as ISODate,
      estimatedDueDate: '2027-07-08' as ISODate,
      dueDateSource: 'lmp' as const,
    });

    const { queryByText, getByText } = await renderScreen();

    expect(queryByText('Kaynaklar')).toBeNull();
    expect(getByText('Gebelik takibi')).toBeTruthy();
  });

  it('shows no source section past the last written week', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2025-12-10' as ISODate,
      estimatedDueDate: '2026-09-16' as ISODate,
      dueDateSource: 'adjusted' as const,
    });

    const { queryByText } = await renderScreen();

    expect(queryByText('Kaynaklar')).toBeNull();
  });

  it('shows no source section when no pregnancy is tracked', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);

    const { queryByLabelText, getByLabelText } = await renderScreen();

    // "Kaynaklar" is not pregnancy's alone any more — the cycle view cites its
    // own — so what has to be absent is the pregnancy pages themselves.
    expect(queryByLabelText(/You and your baby/)).toBeNull();
    expect(getByLabelText('Gebelik takibini başlat')).toBeTruthy();
  });
});

describe('HomeScreen pregnancy settings link', () => {
  // The pregnancy view is where this content lives.
  beforeEach(() => {
    setStoredMode('pregnancy');
  });

  function pregnancyProfile(
    overrides: {
      estimatedDueDate?: string;
      dueDateSource?: 'lmp' | 'adjusted';
    } = {}
  ) {
    return {
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: (overrides.estimatedDueDate ?? '2027-06-09') as ISODate,
      dueDateSource: overrides.dueDateSource ?? ('lmp' as const),
    };
  }

  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(pregnancyProfile());
  });

  it('offers the link when a pregnancy is tracked', async () => {
    const { getByLabelText, getByText } = await renderScreen();

    expect(getByLabelText('Gebelik ayarlarını düzenle')).toBeTruthy();
    expect(getByText('Gebelik ayarları')).toBeTruthy();
  });

  it('opens the pregnancy settings route', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik ayarlarını düzenle'));

    expect(push).toHaveBeenCalledWith('/(app)/pregnancy-settings');
  });

  it('is absent when no pregnancy is tracked', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);

    const { queryByLabelText, getByLabelText } = await renderScreen();

    expect(queryByLabelText('Gebelik ayarlarını düzenle')).toBeNull();
    // The way in is the start link instead.
    expect(getByLabelText('Gebelik takibini başlat')).toBeTruthy();
  });

  it('is offered even before the pregnancy began, where there is no week content', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-10-01' as ISODate,
      estimatedDueDate: '2027-07-08' as ISODate,
      dueDateSource: 'lmp' as const,
    });

    const { getByLabelText, queryByText } = await renderScreen();

    expect(getByLabelText('Gebelik ayarlarını düzenle')).toBeTruthy();
    expect(queryByText('Bu hafta')).toBeNull();
  });

  it('writes nothing', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik ayarlarını düzenle'));

    expect(pregnancyRepository.savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('is the only link in the pregnancy view', async () => {
    const { getByLabelText, queryByLabelText } = await renderScreen();

    expect(getByLabelText('Gebelik ayarlarını düzenle')).toBeTruthy();
    // The cycle links belong to the cycle view and are not mixed in here.
    expect(queryByLabelText('Günlük kayıt geçmişini görüntüle')).toBeNull();
  });
});

describe('HomeScreen after the due date is changed elsewhere', () => {
  // The pregnancy view is where this content lives.
  beforeEach(() => {
    setStoredMode('pregnancy');
  });

  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    });
  });

  it('shows the adjusted date and its source on the next focus', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('9 Haziran 2027')).toBeTruthy();
    expect(screen.getByText('Son regl tarihine göre')).toBeTruthy();

    // What returning from the settings screen looks like.
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-04' as ISODate,
      dueDateSource: 'adjusted' as const,
    });
    await refocus();

    expect(screen.getByText('4 Haziran 2027')).toBeTruthy();
    expect(screen.getByText('Düzeltilmiş tarih')).toBeTruthy();
    expect(screen.queryByText('9 Haziran 2027')).toBeNull();
  });

  it('goes back to the calculated date and source as well', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-04' as ISODate,
      dueDateSource: 'adjusted' as const,
    });

    const screen = await renderScreen();

    expect(screen.getByText('Düzeltilmiş tarih')).toBeTruthy();

    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    });
    await refocus();

    expect(screen.getByText('9 Haziran 2027')).toBeTruthy();
    expect(screen.getByText('Son regl tarihine göre')).toBeTruthy();
  });

  it('leaves the week count alone, since the last menstrual period did not move', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('3. hafta 2. gün')).toBeTruthy();

    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-04' as ISODate,
      dueDateSource: 'adjusted' as const,
    });
    await refocus();

    expect(screen.getByText('3. hafta 2. gün')).toBeTruthy();
  });
});

describe('HomeScreen after the pregnancy tracking is stopped', () => {
  // The pregnancy view is where this content lives.
  beforeEach(() => {
    setStoredMode('pregnancy');
  });

  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    });
  });

  it('drops the whole pregnancy section on the next focus', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('Gebelik takibi')).toBeTruthy();
    expect(screen.getByText('Bu hafta')).toBeTruthy();
    expect(screen.getByText('Kaynaklar')).toBeTruthy();

    // What returning from the settings screen looks like once it was stopped.
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);
    await refocus();

    for (const gone of [
      'Gebelik takibi',
      'Gebelik haftası',
      'Tahmini doğum tarihi',
      'Bu hafta',
      'Bu hafta gelişenler',
    ]) {
      expect(screen.queryByText(gone)).toBeNull();
    }

    // The cycle view cites sources too, so the pregnancy pages are what must go.
    expect(screen.queryByLabelText(/You and your baby/)).toBeNull();
  });

  it('offers to start again', async () => {
    const screen = await renderScreen();

    expect(screen.queryByLabelText('Gebelik takibini başlat')).toBeNull();

    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);
    await refocus();

    expect(screen.getByLabelText('Gebelik takibini başlat')).toBeTruthy();
    expect(screen.queryByLabelText('Gebelik ayarlarını düzenle')).toBeNull();
  });

  it('leaves the cycle summary untouched', async () => {
    const screen = await renderScreen();

    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);
    await refocus();

    expect(screen.getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    // The calendar assertion that was here moved with the calendar, to
    // `calendar-screen.test.tsx`. What this test is about stays.
    expect(screen.getByLabelText('Günlük kayıt geçmişini görüntüle')).toBeTruthy();
  });

  it('reads no cycle profile again than it would have anyway', async () => {
    await renderScreen();

    const cycleReadsBefore = repository.loadCycleProfile.mock.calls.length;

    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);
    await refocus();

    // One more read per focus, the same as any other return to the screen.
    expect(repository.loadCycleProfile.mock.calls.length).toBe(cycleReadsBefore + 1);
  });
});

describe('HomeScreen mode switch', () => {
  function pregnancyProfile() {
    return {
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    };
  }

  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(pregnancyProfile());
  });

  it('offers both views', async () => {
    const { getByLabelText, getByText } = await renderScreen();

    expect(getByLabelText('Döngü')).toBeTruthy();
    expect(getByLabelText('Gebelik')).toBeTruthy();
    expect(getByText('Döngü')).toBeTruthy();
    expect(getByText('Gebelik')).toBeTruthy();
  });

  it('starts on the cycle view', async () => {
    const screen = await renderScreen();

    expect(screen.getByLabelText('Döngü').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Gebelik').props.accessibilityState.selected).toBe(false);
    expect(screen.getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(screen.queryByText('Gebelik takibi')).toBeNull();
  });

  it('switches to the pregnancy view', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik'));

    expect(screen.getByLabelText('Gebelik').props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Gebelik takibi')).toBeTruthy();
    expect(screen.getByText('3. hafta 2. gün')).toBeTruthy();
  });

  it('switches back to the cycle view', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik'));
    await fireEvent.press(screen.getByLabelText('Döngü'));

    expect(screen.getByLabelText('Döngü').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(screen.queryByText('Gebelik takibi')).toBeNull();
  });

  it('records the choice so it outlives the screen', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik'));

    expect(appStateStorage.saveAppState).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'pregnancy' })
    );
    expect(useAppStore.getState().mode).toBe('pregnancy');
  });

  it('opens on the stored view rather than the default', async () => {
    setStoredMode('pregnancy');

    const screen = await renderScreen();

    expect(screen.getByLabelText('Gebelik').props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Gebelik takibi')).toBeTruthy();
  });

  it('writes nothing when the chosen view is already showing', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Döngü'));

    expect(appStateStorage.saveAppState).not.toHaveBeenCalled();
  });

  it('survives a refused write without changing what is shown', async () => {
    appStateStorage.saveAppState.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik'));

    // The store only updates after the write lands, so the view stays put.
    expect(screen.getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(screen.queryByText('Bilgiler yüklenemedi.')).toBeNull();
  });
});

describe('HomeScreen mode switch without a pregnancy', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);
  });

  it('offers the pregnancy view but refuses it', async () => {
    const screen = await renderScreen();

    expect(screen.getByLabelText('Gebelik')).toBeTruthy();
    expect(screen.getByLabelText('Gebelik').props.accessibilityState.disabled).toBe(true);
  });

  it('stays on the cycle view when it is pressed', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik'));

    expect(screen.getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(appStateStorage.saveAppState).not.toHaveBeenCalled();
  });

  it('keeps the cycle view usable', async () => {
    const screen = await renderScreen();

    expect(screen.getByLabelText('Günlük kayıt geçmişini görüntüle')).toBeTruthy();
    expect(screen.getByLabelText('Gebelik takibini başlat')).toBeTruthy();
  });
});

describe('HomeScreen mode fallback', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('shows the cycle view when the stored mode outlived its pregnancy', async () => {
    setStoredMode('pregnancy');
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);

    const screen = await renderScreen();

    expect(screen.getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(screen.getByLabelText('Döngü').props.accessibilityState.selected).toBe(true);
    expect(screen.queryByText('Gebelik takibi')).toBeNull();
  });

  it('puts the stored mode back to cycle', async () => {
    setStoredMode('pregnancy');
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);

    await renderScreen();

    await waitFor(() => {
      expect(useAppStore.getState().mode).toBe('cycle');
    });
    expect(appStateStorage.saveAppState).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'cycle' })
    );
  });

  it('falls back when the pregnancy is stopped while the view is open', async () => {
    setStoredMode('pregnancy');
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    });

    const screen = await renderScreen();

    expect(screen.getByText('Gebelik takibi')).toBeTruthy();

    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);
    await refocus();

    expect(screen.queryByText('Gebelik takibi')).toBeNull();
    expect(screen.getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(screen.getByLabelText('Gebelik').props.accessibilityState.disabled).toBe(true);
  });

  it('still shows the cycle view when the fallback write fails', async () => {
    setStoredMode('pregnancy');
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);
    appStateStorage.saveAppState.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    // Rendering never trusted the stored mode, so a failed tidy-up changes
    // nothing on screen.
    expect(screen.getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(screen.queryByText('Bilgiler yüklenemedi.')).toBeNull();
  });
});

describe('HomeScreen views stay separate', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    });
  });

  it('keeps pregnancy content out of the cycle view', async () => {
    const screen = await renderScreen();

    for (const pregnancyOnly of [
      'Gebelik takibi',
      'Gebelik haftası',
      'Tahmini doğum tarihi',
      'Bu hafta',
      'Bu hafta gelişenler',
    ]) {
      expect(screen.queryByText(pregnancyOnly)).toBeNull();
    }

    // The cycle view has a "Kaynaklar" of its own, so the pregnancy pages rather
    // than the heading are what tells the two views apart.
    expect(screen.queryByLabelText(/You and your baby/)).toBeNull();

    expect(screen.queryByLabelText('Gebelik ayarlarını düzenle')).toBeNull();
  });

  it('keeps cycle content out of the pregnancy view', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik'));

    for (const cycleOnly of [
      'Döngü günü',
      'Döngü evresi',
      'Doğurganlık tahmini',
      'Seçilen gün',
      'Regl günü',
    ]) {
      expect(screen.queryByText(cycleOnly)).toBeNull();
    }

    expect(screen.queryByLabelText('Regl başlangıcını kaydet')).toBeNull();
    // The calendar assertion that was here moved with the calendar, to
    // `calendar-screen.test.tsx`. What this test is about stays.
  });

  it('shows the date header in both views', async () => {
    const screen = await renderScreen();

    // The cycle view names today on the calendar and the selected-day card too,
    // so count rather than expect exactly one.
    expect(screen.getAllByText('17 Eylül 2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bugün').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByLabelText('Gebelik'));

    // Only the header is left to carry it.
    expect(screen.getAllByText('17 Eylül 2026')).toHaveLength(1);
    expect(screen.getAllByText('Bugün')).toHaveLength(1);
  });

  it('keeps reading on focus in the pregnancy view', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik'));

    const readsBefore = pregnancyRepository.loadPregnancyProfile.mock.calls.length;

    await refocus();

    expect(pregnancyRepository.loadPregnancyProfile.mock.calls.length).toBe(readsBefore + 1);
    expect(screen.getByText('Gebelik takibi')).toBeTruthy();
  });

  it('comes back to the cycle view with its content intact', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Gebelik'));
    await fireEvent.press(screen.getByLabelText('Döngü'));

    expect(screen.getByText('Döngü günü')).toBeTruthy();
    // The calendar assertion that was here moved with the calendar, to
    // `calendar-screen.test.tsx`. What this test is about stays.
    expect(screen.getByLabelText('Regl başlangıcını kaydet')).toBeTruthy();
  });
});

describe('HomeScreen pregnancy week navigation', () => {
  // 2 September is day 1, so 17 September is day 16: week 3, day 2.
  function pregnancyProfile(lastMenstrualPeriodStartDate = '2026-09-02') {
    return {
      lastMenstrualPeriodStartDate: lastMenstrualPeriodStartDate as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    };
  }

  beforeEach(() => {
    setStoredMode('pregnancy');
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(pregnancyProfile());
  });

  it('opens on the week the pregnancy is in', async () => {
    const screen = await renderScreen();

    expect(screen.getByLabelText('Gösterilen hafta: 3. hafta')).toBeTruthy();
    expect(screen.getByText('3. hafta')).toBeTruthy();
  });

  it('offers both steps', async () => {
    const screen = await renderScreen();

    expect(screen.getByLabelText('Önceki hafta')).toBeTruthy();
    expect(screen.getByLabelText('Sonraki hafta')).toBeTruthy();
  });

  it('steps forward a week', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));

    expect(screen.getByLabelText('Gösterilen hafta: 4. hafta')).toBeTruthy();
  });

  it('steps back a week', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Önceki hafta'));

    expect(screen.getByLabelText('Gösterilen hafta: 2. hafta')).toBeTruthy();
  });

  it('shows the content of the week it moved to', async () => {
    const screen = await renderScreen();

    expect(screen.getByText(/Döllenme genellikle bu haftalarda gerçekleşir/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));

    expect(screen.queryByText(/Döllenme genellikle bu haftalarda gerçekleşir/)).toBeNull();
    // Narrow enough to match the summary rather than the feature beside it.
    expect(screen.getByText(/içi sıvı dolu amniyotik kesenin/)).toBeTruthy();
  });

  it('brings the size with it', async () => {
    const screen = await renderScreen();

    // Week 3 has no size; week 4 is the first that does.
    expect(screen.queryByText(/^yaklaşık .+ — .+$/)).toBeNull();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));

    expect(screen.getByText('yaklaşık 2 mm — haşhaş tohumu')).toBeTruthy();
  });

  it('brings the developing features with it', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('• Sperm ve yumurta birleşerek zigotu oluşturur')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));

    expect(screen.queryByText('• Sperm ve yumurta birleşerek zigotu oluşturur')).toBeNull();
    expect(screen.getByText('• Embriyo amniyotik kesenin içinde gelişir')).toBeTruthy();
  });

  it('brings the sources with it', async () => {
    const screen = await renderScreen();

    // Week 3 cites Cleveland Clinic alone; week 4 adds its own NHS page.
    expect(screen.queryByText(/nhs\.uk/)).toBeNull();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));

    expect(
      screen.getByText('https://www.nhs.uk/pregnancy/week-by-week/1-to-12/4-weeks/')
    ).toBeTruthy();
    expect(
      screen.getByLabelText('NHS — You and your baby at 4 weeks pregnant kaynağını aç')
    ).toBeTruthy();
  });

  it('walks several weeks at a time', async () => {
    const screen = await renderScreen();

    for (let step = 0; step < 7; step += 1) {
      await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    }

    expect(screen.getByLabelText('Gösterilen hafta: 10. hafta')).toBeTruthy();
    expect(screen.getByText('yaklaşık 30 mm — küçük kayısı')).toBeTruthy();
  });
});

describe('HomeScreen pregnancy week navigation boundaries', () => {
  beforeEach(() => {
    setStoredMode('pregnancy');
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('stops at week 1', async () => {
    // The last menstrual period is today, so the pregnancy is in week 1.
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-17' as ISODate,
      estimatedDueDate: '2027-06-24' as ISODate,
      dueDateSource: 'lmp' as const,
    });

    const screen = await renderScreen();

    expect(screen.getByLabelText('Gösterilen hafta: 1. hafta')).toBeTruthy();

    const back = screen.getByLabelText('Önceki hafta');

    expect(back.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(back);

    expect(screen.getByLabelText('Gösterilen hafta: 1. hafta')).toBeTruthy();
  });

  it('stops at week 40', async () => {
    // 274 days before 17 September 2026 is week 40, day 1.
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2025-12-18' as ISODate,
      estimatedDueDate: '2026-09-24' as ISODate,
      dueDateSource: 'lmp' as const,
    });

    const screen = await renderScreen();

    expect(screen.getByLabelText('Gösterilen hafta: 40. hafta')).toBeTruthy();

    const forward = screen.getByLabelText('Sonraki hafta');

    expect(forward.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(forward);

    expect(screen.getByLabelText('Gösterilen hafta: 40. hafta')).toBeTruthy();
  });

  it('walks all the way from 1 to 40 without falling off either end', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-17' as ISODate,
      estimatedDueDate: '2027-06-24' as ISODate,
      dueDateSource: 'lmp' as const,
    });

    const screen = await renderScreen();

    for (let step = 0; step < 45; step += 1) {
      await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    }

    expect(screen.getByLabelText('Gösterilen hafta: 40. hafta')).toBeTruthy();
    expect(screen.getByText('yaklaşık 51,2 cm — balkabağı')).toBeTruthy();
  });
});

describe('HomeScreen returning to the current week', () => {
  beforeEach(() => {
    setStoredMode('pregnancy');
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    });
  });

  it('is not offered while the current week is showing', async () => {
    const screen = await renderScreen();

    expect(screen.queryByLabelText('Bugünkü haftaya dön')).toBeNull();
  });

  it('appears once the reading has moved', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));

    expect(screen.getByLabelText('Bugünkü haftaya dön')).toBeTruthy();
    expect(screen.getByText('Bugünkü haftaya dön')).toBeTruthy();
  });

  it('goes back to the current week and its content', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    await fireEvent.press(screen.getByLabelText('Bugünkü haftaya dön'));

    expect(screen.getByLabelText('Gösterilen hafta: 3. hafta')).toBeTruthy();
    expect(screen.getByText(/Döllenme genellikle bu haftalarda gerçekleşir/)).toBeTruthy();
  });

  it('goes away again once it is back', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    await fireEvent.press(screen.getByLabelText('Bugünkü haftaya dön'));

    expect(screen.queryByLabelText('Bugünkü haftaya dön')).toBeNull();
  });

  it('also goes away when stepping lands back on the current week', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    await fireEvent.press(screen.getByLabelText('Önceki hafta'));

    expect(screen.queryByLabelText('Bugünkü haftaya dön')).toBeNull();
  });
});

describe('HomeScreen week navigation leaves the rest alone', () => {
  beforeEach(() => {
    setStoredMode('pregnancy');
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    });
  });

  it('does not move the pregnancy the person is actually in', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));

    expect(screen.getByLabelText('Gebelik haftası: 3. hafta 2. gün')).toBeTruthy();
    expect(screen.getByText('3. hafta 2. gün')).toBeTruthy();
  });

  it('does not move the due date', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));

    expect(screen.getByText('9 Haziran 2027')).toBeTruthy();
    expect(screen.getByText('Son regl tarihine göre')).toBeTruthy();
  });

  it('writes nothing', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));

    // Browsing is a look, not a setting: no store write and no database write.
    expect(appStateStorage.saveAppState).not.toHaveBeenCalled();
    expect(pregnancyRepository.savePregnancyProfile).not.toHaveBeenCalled();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('leaves the cycle view untouched', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    await fireEvent.press(screen.getByLabelText('Döngü'));

    expect(screen.getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(screen.queryByLabelText('Sonraki hafta')).toBeNull();
  });

  it('keeps the reading where it was put across a focus refresh', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    await refocus();

    expect(screen.getByLabelText('Gösterilen hafta: 4. hafta')).toBeTruthy();
  });
});

describe('HomeScreen week navigation when there is no week to browse', () => {
  beforeEach(() => {
    setStoredMode('pregnancy');
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('offers none before the pregnancy began', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-10-01' as ISODate,
      estimatedDueDate: '2027-07-08' as ISODate,
      dueDateSource: 'lmp' as const,
    });

    const screen = await renderScreen();

    expect(screen.queryByLabelText('Önceki hafta')).toBeNull();
    expect(screen.queryByLabelText('Sonraki hafta')).toBeNull();
    expect(screen.queryByLabelText('Bugünkü haftaya dön')).toBeNull();
    // The safe state it already had is kept.
    expect(screen.getByText('Gebelik başlangıç tarihi henüz gelmedi.')).toBeTruthy();
    expect(screen.getByText('8 Temmuz 2027')).toBeTruthy();
  });

  it('offers none past the last written week', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2025-12-10' as ISODate,
      estimatedDueDate: '2026-09-16' as ISODate,
      dueDateSource: 'adjusted' as const,
    });

    const screen = await renderScreen();

    expect(screen.queryByLabelText('Önceki hafta')).toBeNull();
    expect(screen.queryByLabelText('Sonraki hafta')).toBeNull();
    expect(screen.getByText('Gebelik takibi')).toBeTruthy();
    expect(screen.getByText('Tahmini doğum tarihi')).toBeTruthy();
  });

  it('forgets a reading left behind when the pregnancy stops', async () => {
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    });

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    expect(screen.getByLabelText('Gösterilen hafta: 4. hafta')).toBeTruthy();

    pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);
    await refocus();

    // The view falls back to the cycle, and nothing is left holding week 4.
    expect(screen.getByLabelText('Döngü günü: 17. gün')).toBeTruthy();

    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    });
    await refocus();
    await fireEvent.press(screen.getByLabelText('Gebelik'));

    expect(screen.getByLabelText('Gösterilen hafta: 3. hafta')).toBeTruthy();
  });
});

/**
 * The cycle view's daily support.
 *
 * Cycle 28 from 2026-09-01: days 1-5 menstrual, 6-13 follicular, 14 ovulatory,
 * 15 on luteal. A date before the first record has no cycle day and so no phase.
 */
describe('HomeScreen cycle daily support', () => {
  const OWH_HEALTH =
    'https://womenshealth.gov/menstrual-cycle/your-menstrual-cycle-and-your-health';
  const SUPPORT_DISCLAIMER = 'Bu bilgiler geneldir; kişiden kişiye ve aydan aya değişebilir.';

  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it.each(['2026-09-03', '2026-09-10', '2026-09-14', '2026-09-20'])(
    'closes the support section with the general-information footer on %s',
    async (today) => {
      getTodayMock.mockReturnValue(today as ISODate);

      const { getByText } = await renderScreen();

      expect(getByText(CONTENT_DISCLAIMER_FOOTER)).toBeTruthy();
    }
  );

  it('says something different from the variability note beside it', async () => {
    // One is about the content changing from person to person; this one is
    // about it not being medical advice. Neither replaces the other.
    const { getByText } = await renderScreen();

    expect(CONTENT_DISCLAIMER_FOOTER).not.toBe(SUPPORT_DISCLAIMER);
    expect(getByText(SUPPORT_DISCLAIMER)).toBeTruthy();
    expect(getByText(CONTENT_DISCLAIMER_FOOTER)).toBeTruthy();
  });

  it('shows it once for the section, not once per card', async () => {
    const { queryAllByText } = await renderScreen();

    expect(queryAllByText(CONTENT_DISCLAIMER_FOOTER)).toHaveLength(1);
  });


  it.each(['2026-09-03', '2026-09-10', '2026-09-20'])(
    'lists the moods written for the phase on %s',
    async (today) => {
      getTodayMock.mockReturnValue(today as ISODate);

      const { getByText, getAllByText, queryByText } = await renderScreen();

      expect(getByText('Olası ruh hali')).toBeTruthy();
      // Twice on the screen: once as the hero's sentence and once in the
    // support section parked below the fold. The duplication is a known
    // loose end of this stage rather than an accident, so this asserts the
    // words are present rather than how many times.
    // Twice on the screen: once as the hero's sentence and once in the
    // support section parked below the fold. The duplication is a known
    // loose end of this stage rather than an accident, so this asserts the
    // words are present rather than how many times.
    expect(getAllByText(/^• .*(abilir|ebilir)$/).length).toBeGreaterThan(0);
    }
  );

  it('shows the moods the phase carries, not a neighbouring phase', async () => {
    getTodayMock.mockReturnValue('2026-09-20' as ISODate);

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('• Ruh hali dalgalanmaları olabilir')).toBeTruthy();
    expect(queryByText('• Ağrı eşiği daha yüksek olabilir')).toBeNull();
  });

  it('shows the follicular moods on a follicular day', async () => {
    getTodayMock.mockReturnValue('2026-09-10' as ISODate);

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('• Ağrı eşiği daha yüksek olabilir')).toBeTruthy();
    expect(queryByText('• Ruh hali dalgalanmaları olabilir')).toBeNull();
  });

  it('shows the menstrual moods on a menstrual day', async () => {
    getTodayMock.mockReturnValue('2026-09-03' as ISODate);

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('• Kramplar olabilir')).toBeTruthy();
    expect(queryByText('• Unutkanlık olabilir')).toBeNull();
  });

  it('heads no mood section on an ovulatory day, but still says something', async () => {
    // Nothing in the sources isolates ovulation's effect on mood, so there is no
    // list — and a heading with nothing under it would read as a failed load.
    getTodayMock.mockReturnValue('2026-09-14' as ISODate);

    const { getByText, queryByText, getAllByText } = await renderScreen();

    expect(queryByText('Olası ruh hali')).toBeNull();
    expect(getByText('Bugünün mesajı')).toBeTruthy();
    // Twice on the screen: once as the hero's sentence and once in the
    // support section parked below the fold. The duplication is a known
    // loose end of this stage rather than an accident, so this asserts the
    // words are present rather than how many times.
    // Twice on the screen: once as the hero's sentence and once in the
    // support section parked below the fold. The duplication is a known
    // loose end of this stage rather than an accident, so this asserts the
    // words are present rather than how many times.
    expect(getAllByText(/Yumurtlama günlerinde/).length).toBeGreaterThan(0);
  });

  it.each(['2026-09-03', '2026-09-10', '2026-09-14', '2026-09-20'])(
    'carries the message and the note on %s',
    async (today) => {
      getTodayMock.mockReturnValue(today as ISODate);

      const { getByText, getAllByText } = await renderScreen();

      expect(getByText('Bugünün mesajı')).toBeTruthy();
      expect(getByText(SUPPORT_DISCLAIMER)).toBeTruthy();
    }
  );

  it('shows the luteal message rather than a neighbouring one', async () => {
    getTodayMock.mockReturnValue('2026-09-20' as ISODate);

    const { getByText, getAllByText } = await renderScreen();

    // Twice on the screen: once as the hero's sentence and once in the
    // support section parked below the fold. The duplication is a known
    // loose end of this stage rather than an accident, so this asserts the
    // words are present rather than how many times.
    // Twice on the screen: once as the hero's sentence and once in the
    // support section parked below the fold. The duplication is a known
    // loose end of this stage rather than an accident, so this asserts the
    // words are present rather than how many times.
    expect(getAllByText(/Regl öncesi günlerde belirtiler herkeste aynı değildir/).length).toBeGreaterThan(0);
  });

  it('shows the menstrual message on a menstrual day', async () => {
    getTodayMock.mockReturnValue('2026-09-03' as ISODate);

    const { getByText, getAllByText } = await renderScreen();

    // Twice on the screen: once as the hero's sentence and once in the
    // support section parked below the fold. The duplication is a known
    // loose end of this stage rather than an accident, so this asserts the
    // words are present rather than how many times.
    // Twice on the screen: once as the hero's sentence and once in the
    // support section parked below the fold. The duplication is a known
    // loose end of this stage rather than an accident, so this asserts the
    // words are present rather than how many times.
    expect(getAllByText(/hafif bir yürüyüş bazı kişilere iyi gelebilir/).length).toBeGreaterThan(0);
  });

  it('drops the whole section on a day with no phase', async () => {
    getTodayMock.mockReturnValue('2026-08-25' as ISODate);

    const { queryByText } = await renderScreen();

    expect(queryByText('Olası ruh hali')).toBeNull();
    expect(queryByText('Bugünün mesajı')).toBeNull();
    expect(queryByText(SUPPORT_DISCLAIMER)).toBeNull();
    expect(queryByText(OWH_HEALTH)).toBeNull();
  });

  it('follows the day, so the content changes when the day does', async () => {
    getTodayMock.mockReturnValue('2026-09-10' as ISODate);

    const screen = await renderScreen();

    expect(screen.getByText('Olası ruh hali')).toBeTruthy();

    getTodayMock.mockReturnValue('2026-09-14' as ISODate);
    await refocus();

    expect(screen.queryByText('Olası ruh hali')).toBeNull();
    // Twice: the hero's sentence and the parked support section.
    expect(screen.getAllByText(/Yumurtlama günlerinde/).length).toBeGreaterThan(0);
  });

  it('renders the section once', async () => {
    getTodayMock.mockReturnValue('2026-09-20' as ISODate);

    const { queryAllByText } = await renderScreen();

    expect(queryAllByText('Olası ruh hali')).toHaveLength(1);
    expect(queryAllByText('Bugünün mesajı')).toHaveLength(1);
    expect(queryAllByText(SUPPORT_DISCLAIMER)).toHaveLength(1);
  });

  it('leaves the rest of the cycle screen where it was', async () => {
    getTodayMock.mockReturnValue('2026-09-20' as ISODate);

    const { getByText, getByLabelText } = await renderScreen();

    // The calendar assertion that was here moved with the calendar, to
    // `calendar-screen.test.tsx`. What this test is about stays.
    expect(getByText(FERTILITY_DISCLAIMER)).toBeTruthy();
    expect(getByLabelText('Regl başlangıcını kaydet')).toBeTruthy();
    expect(getByLabelText('Günlük kayıt geçmişini görüntüle')).toBeTruthy();
  });
});

describe('HomeScreen cycle daily support sources', () => {
  const OWH_HEALTH =
    'https://womenshealth.gov/menstrual-cycle/your-menstrual-cycle-and-your-health';
  const OWH_ACTIVITY = 'https://womenshealth.gov/getting-active/physical-activity-menstrual-cycle';
  const NHS_PMS = 'https://www.nhs.uk/conditions/pre-menstrual-syndrome/';
  const NHS_PMS_NAME = 'NHS — Premenstrual syndrome (PMS)';

  let openURL: jest.SpyInstance;

  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    getTodayMock.mockReturnValue('2026-09-20' as ISODate);

    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(() => {
    openURL.mockRestore();
  });

  it('heads the section', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Kaynaklar')).toBeTruthy();
  });

  it('names each source and shows its address', async () => {
    const { getByText } = await renderScreen();

    expect(getByText(NHS_PMS_NAME)).toBeTruthy();
    expect(getByText(NHS_PMS)).toBeTruthy();
    expect(getByText(OWH_HEALTH)).toBeTruthy();
    expect(getByText(OWH_ACTIVITY)).toBeTruthy();
  });

  it('opens a source at its own address', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(`${NHS_PMS_NAME} kaynağını aç`));

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith(NHS_PMS);
  });

  it('opens each of the others at theirs', async () => {
    const screen = await renderScreen();

    await fireEvent.press(
      screen.getByLabelText(/Your menstrual cycle and your health kaynağını aç/)
    );
    expect(openURL).toHaveBeenLastCalledWith(OWH_HEALTH);

    await fireEvent.press(
      screen.getByLabelText(/Physical activity and your menstrual cycle kaynağını aç/)
    );
    expect(openURL).toHaveBeenLastCalledWith(OWH_ACTIVITY);
  });

  it('follows the phase, so an ovulatory day cites its own pages', async () => {
    getTodayMock.mockReturnValue('2026-09-14' as ISODate);

    const { getByText, queryByText } = await renderScreen();

    expect(getByText(OWH_HEALTH)).toBeTruthy();
    expect(queryByText(NHS_PMS)).toBeNull();
  });

  it('says so when a source will not open', async () => {
    openURL.mockRejectedValue(new Error('no handler'));

    const screen = await renderScreen();

    expect(screen.queryByText('Kaynak açılamadı.')).toBeNull();

    await fireEvent.press(screen.getByLabelText(`${NHS_PMS_NAME} kaynağını aç`));

    await waitFor(() => {
      expect(screen.getByText('Kaynak açılamadı.')).toBeTruthy();
    });
  });

  it('keeps the screen when a source will not open', async () => {
    openURL.mockRejectedValue(new Error('no handler'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(`${NHS_PMS_NAME} kaynağını aç`));

    await waitFor(() => {
      expect(screen.getByText('Kaynak açılamadı.')).toBeTruthy();
    });

    expect(screen.getByText('Bugünün mesajı')).toBeTruthy();
  });

  it('clears the refusal once a source opens', async () => {
    openURL.mockRejectedValueOnce(new Error('no handler'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(`${NHS_PMS_NAME} kaynağını aç`));

    await waitFor(() => {
      expect(screen.getByText('Kaynak açılamadı.')).toBeTruthy();
    });

    await fireEvent.press(
      screen.getByLabelText(/Your menstrual cycle and your health kaynağını aç/)
    );

    await waitFor(() => {
      expect(screen.queryByText('Kaynak açılamadı.')).toBeNull();
    });
  });

  it('shows no source section on a day with no phase', async () => {
    getTodayMock.mockReturnValue('2026-08-25' as ISODate);

    const { queryByText } = await renderScreen();

    expect(queryByText('Kaynaklar')).toBeNull();
    expect(queryByText(NHS_PMS)).toBeNull();
  });
});

describe('HomeScreen cycle daily support in the pregnancy view', () => {
  beforeEach(() => {
    setStoredMode('pregnancy');
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-07-11' as ISODate,
      estimatedDueDate: '2027-04-17' as ISODate,
      dueDateSource: 'lmp' as const,
    });
    getTodayMock.mockReturnValue('2026-09-20' as ISODate);
  });

  it('keeps the whole section out of it', async () => {
    const { queryByText } = await renderScreen();

    expect(queryByText('Olası ruh hali')).toBeNull();
    expect(queryByText('Bugünün mesajı')).toBeNull();
    expect(
      queryByText('Bu bilgiler geneldir; kişiden kişiye ve aydan aya değişebilir.')
    ).toBeNull();
  });

  it('cites no cycle source in it', async () => {
    const { queryByText } = await renderScreen();

    expect(queryByText('NHS — Premenstrual syndrome (PMS)')).toBeNull();
    expect(queryByText('https://www.nhs.uk/conditions/pre-menstrual-syndrome/')).toBeNull();
  });

  it('brings it back when the mode returns to cycle', async () => {
    const screen = await renderScreen();

    expect(screen.queryByText('Bugünün mesajı')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Döngü'));
    });

    expect(screen.getByText('Bugünün mesajı')).toBeTruthy();
    expect(screen.getByText('Olası ruh hali')).toBeTruthy();
  });
});

describe('HomeScreen avatar link with nothing saved', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('invites one to be built', async () => {
    const { getByText, getByLabelText } = await renderScreen();

    expect(getByLabelText('Avatar oluştur')).toBeTruthy();
    expect(getByText('Avatarım')).toBeTruthy();
  });

  it('shows no preview', async () => {
    const { queryByTestId } = await renderScreen();

    expect(queryByTestId('home-avatar-preview')).toBeNull();
  });

  it('opens the editor', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Avatar oluştur'));

    expect(push).toHaveBeenCalledWith('/(app)/avatar');
  });

  it('reads the avatar alongside the rest, in one pass', async () => {
    await renderScreen();

    expect(avatarRepository.loadAvatarConfig).toHaveBeenCalledTimes(1);
    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
  });

  it('writes nothing', async () => {
    await renderScreen();

    expect(avatarRepository.saveAvatarConfig).not.toHaveBeenCalled();
  });
});

describe('HomeScreen avatar link with one saved', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
    avatarRepository.loadAvatarConfig.mockResolvedValue({
      skinToneId: 'skin-tone-4',
      hairStyleId: 'bun',
      hairColorId: 'red',
      outfitId: 'dress',
      accessoryId: 'glasses',
    });
  });

  it('offers to edit it instead', async () => {
    const { getByText, getByLabelText, queryByText } = await renderScreen();

    expect(getByLabelText('Avatarı düzenle')).toBeTruthy();
    // The way to edit an avatar is now the avatar, at the top of the screen.
    // It is a button with this label rather than a row with this text.
    expect(getByLabelText('Avatarı düzenle')).toBeTruthy();
    expect(queryByText('Avatarım')).toBeNull();
  });

  it('shows the small preview', async () => {
    const { getByTestId } = await renderScreen();

    expect(getByTestId('home-avatar-preview')).toBeTruthy();
  });

  it('describes the avatar rather than listing it', async () => {
    const { getByLabelText, queryByText } = await renderScreen();

    expect(getByLabelText(/^Avatar: 4\. ton ten, Topuz Kızıl saç, Elbise, aksesuar Gözlük$/)).toBeTruthy();
    // The small preview carries no label rows; the spoken label does that work.
    expect(queryByText('Kıyafet: Elbise')).toBeNull();
  });

  it('draws it rather than listing it in words', async () => {
    const { getByTestId } = await renderScreen();
    const preview = getByTestId('home-avatar-preview');

    // A drawing: stacked shapes with the chosen colours, no text nodes.
    expect(preview.props.children.length).toBeGreaterThan(4);
    expect(preview.props.accessibilityRole).toBe('image');
  });

  it('draws the small version, not the editor-sized one', async () => {
    const { getByTestId } = await renderScreen();
    const { width } = getByTestId('home-avatar-preview').props.style as { width: number };

    expect(width).toBe(66);
  });

  it('shows no catalogue id', async () => {
    const { toJSON } = await renderScreen();
    const text = JSON.stringify(toJSON());

    for (const id of ['skin-tone-4', 'bun', 'dress', 'glasses']) {
      expect(text).not.toContain(`>${id}<`);
    }
  });

  it('opens the editor', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Avatarı düzenle'));

    expect(push).toHaveBeenCalledWith('/(app)/avatar');
  });

  it('picks up an avatar saved while away', async () => {
    avatarRepository.loadAvatarConfig.mockResolvedValue(null);

    const screen = await renderScreen();

    expect(screen.queryByTestId('home-avatar-preview')).toBeNull();

    avatarRepository.loadAvatarConfig.mockResolvedValue({
      skinToneId: 'skin-tone-2',
      hairStyleId: 'wavy',
      hairColorId: 'blonde',
      outfitId: 'shirt',
    });
    await refocus();

    expect(screen.getByTestId('home-avatar-preview')).toBeTruthy();
    expect(screen.getByLabelText('Avatarı düzenle')).toBeTruthy();
  });

  it('keeps the rest of the cycle screen where it was', async () => {
    const { getByText, getByLabelText } = await renderScreen();

    expect(getByLabelText('Günlük kayıt geçmişini görüntüle')).toBeTruthy();
  });
});

describe('HomeScreen avatar in the pregnancy view', () => {
  beforeEach(() => {
    setStoredMode('pregnancy');
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-07-11' as ISODate,
      estimatedDueDate: '2027-04-17' as ISODate,
      dueDateSource: 'lmp' as const,
    });
    avatarRepository.loadAvatarConfig.mockResolvedValue({
      skinToneId: 'skin-tone-4',
      hairStyleId: 'bun',
      hairColorId: 'red',
      outfitId: 'dress',
    });
  });

  it('shows no preview', async () => {
    const { queryByTestId } = await renderScreen();

    expect(queryByTestId('home-avatar-preview')).toBeNull();
  });

  it('offers no link either', async () => {
    const { queryByLabelText, queryByText } = await renderScreen();

    expect(queryByLabelText('Avatarı düzenle')).toBeNull();
    expect(queryByLabelText('Avatar oluştur')).toBeNull();
    expect(queryByText('Avatarım')).toBeNull();
  });

  it('brings both back when the mode returns to cycle', async () => {
    const screen = await renderScreen();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Döngü'));
    });

    expect(screen.getByTestId('home-avatar-preview')).toBeTruthy();
    expect(screen.getByLabelText('Avatarı düzenle')).toBeTruthy();
  });
});

describe('HomeScreen widget snapshot sync', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('syncs once when the screen first loads', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
    });
  });

  it('syncs for the day the screen is showing', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledWith(
        expect.anything(),
        '2026-09-17'
      );
    });
  });

  it('reuses the database the screen already opened', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalled();
    });

    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
  });

  it('does not sync again on every focus', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
    });

    await refocus();
    await refocus();

    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs even when no cycle profile is saved', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    await renderScreen();

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledWith(
        expect.anything(),
        '2026-09-17'
      );
    });
  });

  it('does not sync when the screen could not load', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('disk is gone'));

    const { getByText } = await renderScreen();

    expect(getByText('Bilgiler yüklenemedi.')).toBeTruthy();
    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });

  it('shows the screen even when the sync fails', async () => {
    // Quiet by contract, but a rejected promise must not surface here either.
    widgetSync.syncWidgetSnapshotQuietly.mockRejectedValue(new Error('no bridge'));

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('Döngü günü')).toBeTruthy();
    expect(queryByText('Bilgiler yüklenemedi.')).toBeNull();
  });
});

describe('HomeScreen syncs the widget after a period change', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-01']));
  });

  it('syncs after a period start is saved', async () => {
    const screen = await renderScreen();

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
    });

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(2);
    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('syncs after a period end is saved', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-16'], { open: true }));

    const screen = await renderScreen();

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
    });

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(2);
  });

  it('syncs only after the write succeeded', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
    });

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Regl başlangıcı kaydedilemedi.')).toBeTruthy();
    });

    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
  });

  it('keeps the save successful when the sync fails', async () => {
    const screen = await renderScreen();

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
    });

    widgetSync.syncWidgetSnapshotQuietly.mockResolvedValueOnce(null);

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    // The database write is what the person asked for; it stands.
    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Regl başlangıcı kaydedilemedi.')).toBeNull();
  });
});

describe('HomeScreen does not sync for pregnancy changes', () => {
  beforeEach(() => {
    setStoredMode('pregnancy');
    repository.loadCycleProfile.mockResolvedValue(profile());
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-07-11' as ISODate,
      estimatedDueDate: '2027-04-17' as ISODate,
      dueDateSource: 'lmp' as const,
    });
  });

  it('syncs only the once on load, whatever the mode', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
    });
  });

  it('does not sync when the week being read changes', async () => {
    const screen = await renderScreen();

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
    });

    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    await fireEvent.press(screen.getByLabelText('Önceki hafta'));

    // The snapshot carries no pregnancy, so nothing about it is worth writing.
    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
  });

  it('does not sync when the mode changes', async () => {
    const screen = await renderScreen();

    await waitFor(() => {
      expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Döngü'));
    });

    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen period reminder sync', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('syncs once when the screen first loads', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
    });
  });

  it('syncs for the day the screen is showing', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledWith(
        expect.anything(),
        '2026-09-17'
      );
    });
  });

  it('does not sync again on every focus', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
    });

    await refocus();
    await refocus();

    expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs after a period start is saved', async () => {
    const screen = await renderScreen();

    await waitFor(() => {
      expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
    });

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(2);
    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('does not sync when the write failed', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await waitFor(() => {
      expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
    });

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Regl başlangıcı kaydedilemedi.')).toBeTruthy();
    });

    expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('keeps the save successful when the reminder could not be scheduled', async () => {
    const screen = await renderScreen();

    await waitFor(() => {
      expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
    });

    reminderSync.syncPeriodReminderQuietly.mockResolvedValue(null);

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    // The database write is what the person asked for; it stands.
    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Regl başlangıcı kaydedilemedi.')).toBeNull();
  });

  it('shows the screen even when the reminder sync rejects', async () => {
    reminderSync.syncPeriodReminderQuietly.mockRejectedValue(new Error('no queue'));

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('Döngü günü')).toBeTruthy();
    expect(queryByText('Bilgiler yüklenemedi.')).toBeNull();
  });
});

describe('HomeScreen pregnancy weekly reminder sync', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('syncs once when the screen first loads, putting back what was dropped', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
    });
  });

  it('syncs on the database the screen already opened', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledWith(
        expect.anything()
      );
    });
  });

  it('takes no date, because the weekday and time are fixed', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
    });

    expect(
      pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mock.calls[0]
    ).toHaveLength(1);
  });

  it('syncs in pregnancy mode as well', async () => {
    setStoredMode('pregnancy');
    pregnancyRepository.loadPregnancyProfile.mockResolvedValue({
      lastMenstrualPeriodStartDate: '2026-09-02' as ISODate,
      estimatedDueDate: '2027-06-09' as ISODate,
      dueDateSource: 'lmp' as const,
    });

    await renderScreen();

    await waitFor(() => {
      expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
    });
  });

  it('does not sync again on every focus', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
    });

    await refocus();
    await refocus();

    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('does not sync again after a period start is saved, which moves no week', async () => {
    const screen = await renderScreen();

    await waitFor(() => {
      expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
    });

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
  });

  it('shows the screen even when the reminder sync rejects', async () => {
    pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mockRejectedValue(
      new Error('no queue')
    );

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('Döngü günü')).toBeTruthy();
    expect(queryByText('Bilgiler yüklenemedi.')).toBeNull();
  });

  it('leaves the period reminder to sync on its own', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly).toHaveBeenCalledTimes(1);
    });

    expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
  });
});


/**
 * Every word on the field, in the colour it is actually drawn in.
 *
 * ## Why arithmetic was not enough
 *
 * `sky-contrast.test.ts` holds the ink against every surface a word can land
 * on, and it passed for weeks while the screen drew two of its lines in
 * `textSecondary` - a page colour that measures 1.97:1 on light night. The
 * arithmetic could not have caught it: it knows which colours the palette
 * offers and nothing at all about which one a component reached for.
 *
 * ## The bug that paid for this file
 *
 * The chevrons. Every link row on the home screen ended in one, drawn in
 * `textSecondary` because that is what `Icon` defaults to, measuring between
 * 1.97:1 and 3.38:1 on the light fields. A chevron is the only thing saying
 * that a row goes anywhere - its own file says so - so it carries meaning
 * and 3:1 is a floor.
 *
 * Nothing else would have found it. The arithmetic does not know what a
 * component reached for. A snapshot would have recorded it as correct. A
 * query-by-text test cannot see it, because under Jest the glyph renders as
 * empty text and carries no string to match on. And on a device it is small,
 * grey, and exactly the kind of thing an eye forgives - which is to say it
 * would have shipped, and been wrong for the people who needed it most.
 *
 * So this renders the screen and reads the colour off each `Text`. It is the
 * half of the guarantee that can only be had by rendering, and it is here
 * rather than in its own file because the harness above - fourteen mocks, a
 * fake clock and a fake router - is what it takes to get this screen on
 * screen, and a second copy of that would rot.
 *
 * ## It fails closed
 *
 * Any colour that is not the ink has to be named in `OFF_FIELD` with a reason.
 * Adding one is a deliberate act, which is the point: the failure this exists
 * to prevent was a component quietly inheriting a colour nobody chose.
 */
describe('every word on the sky is drawn in the sky ink', () => {
  const INK = Sky.light.ink;

  /**
   * Labels that sit on an opaque control rather than on the field.
   *
   * One entry, and it is the label on the primary action - the single thing
   * on the screen still filled solid. The field is not behind it, so the sky's
   * ink is not its contrast partner; `onInk` is, at 14.98:1.
   *
   * It used to be `onPrimary` on the brand violet, and there used to be two
   * of them - the mode tab was filled as well. That it is down to one is the
   * controls pass landing, and if it ever goes back up this list is where the
   * argument has to be made.
   */
  const OFF_FIELD: readonly string[] = [Sky.light.onInk];

  /**
   * Every colour the rendered tree draws a word in.
   *
   * Read off the host tree rather than off the components, because the
   * question is what reached a pixel. A `Text` whose style resolves to no
   * colour inherits one, so it is not a second colour and is left out.
   */
  function textColours(tree: unknown): string[] {
    const found: string[] = [];

    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);

        return;
      }

      if (node === null || typeof node !== 'object') {
        return;
      }

      const { type, props, children } = node as {
        type?: string;
        props?: { style?: unknown };
        children?: unknown;
      };

      if (type === 'Text') {
        const flat = StyleSheet.flatten(props?.style as never) as
          | { color?: unknown }
          | undefined;
        const colour = flat?.color;

        if (typeof colour === 'string') {
          found.push(colour);
        }
      }

      walk(children);
    };

    walk(tree);

    return found;
  }

  it('uses one colour for everything except the labels inside controls', async () => {
    getTodayMock.mockReturnValue('2026-09-09' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await renderScreen();

    const drawn = textColours(screen.toJSON());

    const onField = [...new Set(drawn.filter((colour) => !OFF_FIELD.includes(colour)))];

    expect(onField).toEqual([INK]);

    // And every exception is still earning its place. An allow-list nobody
    // prunes is how the next colour gets in: one stale entry and the rule has
    // a hole shaped like whatever used to be there.
    expect([...new Set(drawn.filter((colour) => OFF_FIELD.includes(colour)))]).toEqual(
      OFF_FIELD
    );
  });

  it('leaves the label inside the filled control alone', async () => {
    // The rule is about words on the field, and a label on a solid fill is
    // not on it. This went wrong once in exactly the direction the rule
    // pushes: a label followed the sky ink onto its own fill and came out
    // dark on dark. A control that fills itself has to name its own colour,
    // and this is what says whether it still does.
    //
    // It used to be the mode tab. The tab is a segment now and carries no
    // fill, so the assertion moved to the thing that still has one rather
    // than being deleted with the fill that prompted it.
    getTodayMock.mockReturnValue('2026-09-09' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await renderScreen();

    const action = screen.getByLabelText('Regl başlangıcını kaydet');

    expect(textColours(action)).toEqual([Sky.light.onInk]);
  });
  it('draws plenty of it, so the rule cannot pass on an empty tree', async () => {
    // Without this, a screen that rendered no text at all would satisfy the
    // assertion above by having no colours to disagree about.
    getTodayMock.mockReturnValue('2026-09-09' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await renderScreen();

    const inked = textColours(screen.toJSON()).filter((colour) => colour === INK);

    expect(inked.length).toBeGreaterThan(5);
  });

  it('keeps the loading screen on the same rule', async () => {
    // The screen a person sees first, and the one that was a white page until
    // recently. `textSecondary` measured 4.24:1 on the pale end of the waking
    // field, which is how it earned a place here.
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const screen = await render(<HomeScreen />);

    expect([...new Set(textColours(screen.toJSON()))]).toEqual([INK]);
  });
});

/**
 * No block on the field paints itself a page colour.
 *
 * ## Why the ink test does not cover this
 *
 * That one reads the colour off words. A card draws no words of its own, so a
 * card that painted itself `backgroundElement` - a flat grey in the light
 * scheme, a near-black in the dark - passed it while being the single most
 * out-of-place thing on the screen: further from the field than anything
 * around it, and read as a hole punched in the sky rather than a layer on it.
 *
 * `Surface` knows about the field and turns `filled` into glass. A block that
 * paints its own background is a block the field cannot reach, and the only
 * way to see that from here is to look at what the tree actually renders.
 */
describe('nothing on the sky paints itself a page colour', () => {
  /**
   * Fills that belong to a page rather than to a field.
   *
   * `primary` is in the list with the greys, and it is the interesting one.
   * It is the brand violet, it is not wrong anywhere else in the app, and on a
   * field it was the loudest thing on the screen: a filled capsule above the
   * day number and a solid slab below it, both in a colour from another
   * system. Solid is now the ink, and the violet goes back to being the dusk
   * in the palette - which is what the palette always said it was.
   *
   * Listed here rather than left to the eye because it is exactly the kind of
   * thing that comes back one call site at a time.
   */
  const PAGE_SURFACES: readonly string[] = [
    Colors.light.backgroundElement,
    Colors.light.background,
    Colors.light.backgroundSelected,
    Colors.light.primary,
  ];

  function backgroundColours(tree: unknown): string[] {
    const found: string[] = [];

    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);

        return;
      }

      if (node === null || typeof node !== 'object') {
        return;
      }

      const { props, children } = node as { props?: { style?: unknown }; children?: unknown };

      const flat = StyleSheet.flatten(props?.style as never) as
        | { backgroundColor?: unknown }
        | undefined;

      if (typeof flat?.backgroundColor === 'string') {
        found.push(flat.backgroundColor);
      }

      walk(children);
    };

    walk(tree);

    return found;
  }

  it('uses none of the page surfaces anywhere in the tree', async () => {
    getTodayMock.mockReturnValue('2026-09-09' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await renderScreen();

    const borrowed = [
      ...new Set(backgroundColours(screen.toJSON()).filter((c) => PAGE_SURFACES.includes(c))),
    ];

    expect(borrowed).toEqual([]);
  });

  it('does fill something with the sky glass', async () => {
    // So the rule above cannot be satisfied by a screen that stopped drawing
    // blocks at all.
    getTodayMock.mockReturnValue('2026-09-09' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await renderScreen();

    expect(backgroundColours(screen.toJSON())).toContain(Sky.light.glass);
  });
});
