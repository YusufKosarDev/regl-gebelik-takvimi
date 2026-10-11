/**
 * The month calendar, on the screen it now has to itself.
 *
 * Every describe in here was a `HomeScreen …` block in
 * `home-screen.test.tsx` until the grid came off the home screen. The
 * assertions are unchanged - same fixtures, same expectations, same strings -
 * because nothing about the calendar changed. Only the screen that renders it
 * did, so only the import and the describe names did.
 *
 * Two of the original sixteen are not here: "month navigation leaves the
 * summary alone" and "selection leaves the rest alone". Both asserted that
 * touching the grid did not disturb the cycle summary sitting above it. The two
 * are not on one screen any more and share no state, so there is nothing left
 * for either to disturb.
 */

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';

import CalendarScreen from '@/app/(app)/(tabs)/calendar';
import { CONTENT_DISCLAIMER_FOOTER } from '@/features/disclaimer/presentation/disclaimer-messages';
import { useAppStore } from '@/store/app-store';
import type { AppMode } from '@/types/app-state';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { getTodayLocalISODate } from '@/utils/today';
import { expectClearsTabBar } from '../../../../jest/assert-clears-tab-bar';

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
  const screen = await render(<CalendarScreen />);

  await waitFor(() => {
    expect(screen.queryByTestId('calendar-loading')).toBeNull();
  });

  return screen;
}

describe('CalendarScreen calendar section', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('shows the section heading', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Takvim')).toBeTruthy();
  });

  it('shows the month today falls in', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Eylül 2026')).toBeTruthy();
  });

  it('names the month for assistive technology', async () => {
    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Eylül 2026 takvimi')).toBeTruthy();
  });

  it('renders the weekday headers', async () => {
    const { getByText } = await renderScreen();

    for (const label of ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('renders every day of the month', async () => {
    const { queryAllByTestId } = await renderScreen();

    expect(queryAllByTestId(/^calendar-day-/)).toHaveLength(30);
  });

  it('renders the first and last day of the month', async () => {
    const { getByTestId } = await renderScreen();

    expect(getByTestId('calendar-day-2026-09-01')).toBeTruthy();
    expect(getByTestId('calendar-day-2026-09-30')).toBeTruthy();
  });

  it('does not reach into a neighbouring month', async () => {
    const { queryByTestId } = await renderScreen();

    expect(queryByTestId('calendar-day-2026-08-31')).toBeNull();
    expect(queryByTestId('calendar-day-2026-10-01')).toBeNull();
  });

  it('follows today into another month', async () => {
    getTodayMock.mockReturnValue('2026-10-05' as ISODate);

    const { getByText, queryAllByTestId } = await renderScreen();

    expect(getByText('Ekim 2026')).toBeTruthy();
    expect(queryAllByTestId(/^calendar-day-/)).toHaveLength(31);
  });

  /**
   * What this used to assert, and where it went.
   *
   * It checked that the cycle summary - today's date and "17. gün" - was on
   * screen beside the calendar, because both were on the home screen. They are
   * on two screens now, so there is no longer a co-location to protect.
   *
   * Neither fact was lost. The home screen's own tests assert the date and the
   * cycle day; this one keeps the half that is still true here.
   */
  it('shows the calendar', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Takvim')).toBeTruthy();
  });

  it('reads the profile once for both halves', async () => {
    await renderScreen();

    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
  });

  it('explains the calendar marks', async () => {
    const { getByText } = await renderScreen();

    for (const label of [
      'Regl günü',
      'Tahmini yumurtlama günü',
      'Doğurganlığın yüksek olduğu tahmini gün',
      'Sonraki regl başlangıcı tahmini',
    ]) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('says the calendar information is an estimate', async () => {
    const { getByText } = await renderScreen();

    expect(
      getByText('Takvimdeki doğurganlık ve yumurtlama bilgileri tahminidir.')
    ).toBeTruthy();
  });

  it('keeps the contraception disclaimer alongside the legend', async () => {
    const { getByText } = await renderScreen();

    // The disclaimer itself has not moved - it belongs to the fertility row in
    // the cycle summary, which is on the home screen, and
    // `home-screen.test.tsx` asserts it there under "shows the fertility
    // estimate with its disclaimer". What is checked here is the legend, which
    // is the part of this pairing that lives on this screen.
    expect(getByText('Regl günü')).toBeTruthy();
  });

  it('explains no mark the calendar does not draw', async () => {
    const { queryByText } = await renderScreen();

    expect(queryByText('●')).toBeNull();
  });

  it('makes every real day pressable and no padding cell', async () => {
    const { queryAllByRole, getByTestId, queryAllByTestId } = await renderScreen();

    expect(getByTestId('calendar-day-2026-09-17').props.accessibilityRole).toBe('button');

    for (const empty of queryAllByTestId(/^calendar-empty-/)) {
      expect(empty.props.accessibilityRole).toBeUndefined();
      expect(empty.props.onClick).toBeUndefined();
    }

    // 30 days, the two month steps, the record action, the two ways into a
    // daily entry, the period history link, the log history link, the avatar
    // link, the settings link and the pregnancy link.
    // Thirty-one calendar days plus the two month arrows. It was forty when
    // this ran on the home screen, where the grid shared a screen with the
    // mode switch, the links and the period card, and thirty-four until this
    // became a tab: a tab root has no back button, because the bar at the
    // bottom is how you leave it.
    //
    // This number is recorded, not enforced: the previous version of this
    // assertion is the one the old ring was kept unpressable for, which is a
    // fixture deciding a design. If a change to this screen moves it, move it.
    expect(queryAllByRole('button')).toHaveLength(33);
  });
});

describe('CalendarScreen calendar absence', () => {
  it('shows no calendar while loading', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByText, queryAllByTestId } = await render(<CalendarScreen />);

    expect(queryByText('Takvim')).toBeNull();
    expect(queryAllByTestId(/^calendar-day-/)).toHaveLength(0);
  });

  it('shows no calendar when there is no profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { getByText, queryByText, queryAllByTestId } = await renderScreen();

    expect(getByText('Döngü bilgisi bulunamadı.')).toBeTruthy();
    expect(queryByText('Takvim')).toBeNull();
    expect(queryAllByTestId(/^calendar-day-/)).toHaveLength(0);
  });

  it('shows no calendar when loading fails', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { getByText, queryByText, queryAllByTestId } = await renderScreen();

    expect(getByText('Bilgiler yüklenemedi.')).toBeTruthy();
    expect(queryByText('Takvim')).toBeNull();
    expect(queryAllByTestId(/^calendar-day-/)).toHaveLength(0);
  });
});

describe('CalendarScreen legend absence', () => {
  it('shows no legend while loading', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByText } = await render(<CalendarScreen />);

    expect(queryByText('Regl günü')).toBeNull();
    expect(queryByText('Takvimdeki doğurganlık ve yumurtlama bilgileri tahminidir.')).toBeNull();
  });

  it('shows no legend when there is no profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('Döngü bilgisi bulunamadı.')).toBeTruthy();
    expect(queryByText('Regl günü')).toBeNull();
    expect(queryByText('Tahmini yumurtlama günü')).toBeNull();
  });

  it('shows no legend when loading fails', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('Bilgiler yüklenemedi.')).toBeTruthy();
    expect(queryByText('Regl günü')).toBeNull();
    expect(queryByText('Tahmini yumurtlama günü')).toBeNull();
  });
});

describe('CalendarScreen today highlight', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it("marks today's square in the calendar", async () => {
    const { getByTestId } = await renderScreen();

    expect(getByTestId('calendar-today-2026-09-17')).toBeTruthy();
  });

  it('marks exactly one square', async () => {
    const { queryAllByTestId } = await renderScreen();

    expect(queryAllByTestId(/^calendar-today-/)).toHaveLength(1);
  });

  it('says so in the accessibility label', async () => {
    const { getByTestId } = await renderScreen();

    // Today starts out selected, so the label says both.
    expect(getByTestId('calendar-day-2026-09-17').props.accessibilityLabel).toBe(
      '17 Eylül 2026, bugün, seçili'
    );
  });

  it('follows the date the use case reported', async () => {
    getTodayMock.mockReturnValue('2026-09-14' as ISODate);

    const { getByTestId, queryByTestId } = await renderScreen();

    expect(getByTestId('calendar-today-2026-09-14')).toBeTruthy();
    expect(queryByTestId('calendar-today-2026-09-17')).toBeNull();
    // The cycle state survives the highlight.
    expect(getByTestId('calendar-day-2026-09-14').props.accessibilityLabel).toBe(
      '14 Eylül 2026, Yumurtlama, doğurganlık en yüksek, bugün, seçili'
    );
  });

  it('reads the clock once for both the summary and the highlight', async () => {
    await renderScreen();

    expect(getTodayMock).toHaveBeenCalledTimes(1);
  });

  it('leaves the legend alone', async () => {
    const { getByText, queryByText } = await renderScreen();

    expect(getByText('Regl günü')).toBeTruthy();
    expect(queryByText('Bugünün tarihi')).toBeNull();
  });
});

describe('CalendarScreen month navigation', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  async function renderWithNavigation() {
    const screen = await renderScreen();

    return {
      ...screen,
      previous: () => screen.getByLabelText('Önceki ay'),
      next: () => screen.getByLabelText('Sonraki ay'),
    };
  }

  it('opens on the month today falls in', async () => {
    const { getByText } = await renderWithNavigation();

    expect(getByText('Eylül 2026')).toBeTruthy();
  });

  it('offers a step in each direction', async () => {
    const { previous, next } = await renderWithNavigation();

    expect(previous()).toBeTruthy();
    expect(next()).toBeTruthy();
  });

  it('moves forward a month', async () => {
    const screen = await renderWithNavigation();

    await fireEvent.press(screen.next());

    expect(screen.getByText('Ekim 2026')).toBeTruthy();
    expect(screen.queryByText('Eylül 2026')).toBeNull();
  });

  it('shows the new month in the grid', async () => {
    const screen = await renderWithNavigation();

    await fireEvent.press(screen.next());

    expect(screen.queryAllByTestId(/^calendar-day-/)).toHaveLength(31);
    expect(screen.getByTestId('calendar-day-2026-10-01')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-10-31')).toBeTruthy();
    expect(screen.queryByTestId('calendar-day-2026-09-17')).toBeNull();
  });

  it('moves back to the current month', async () => {
    const screen = await renderWithNavigation();

    await fireEvent.press(screen.next());
    await fireEvent.press(screen.previous());

    expect(screen.getByText('Eylül 2026')).toBeTruthy();
    expect(screen.queryAllByTestId(/^calendar-day-/)).toHaveLength(30);
  });

  it('moves back past the current month', async () => {
    const screen = await renderWithNavigation();

    await fireEvent.press(screen.previous());

    expect(screen.getByText('Ağustos 2026')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-08-31')).toBeTruthy();
  });

  it('steps across a year boundary', async () => {
    getTodayMock.mockReturnValue('2026-12-15' as ISODate);

    const screen = await renderWithNavigation();

    expect(screen.getByText('Aralık 2026')).toBeTruthy();

    await fireEvent.press(screen.next());

    expect(screen.getByText('Ocak 2027')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2027-01-31')).toBeTruthy();
  });

  it('steps back across a year boundary', async () => {
    getTodayMock.mockReturnValue('2026-01-15' as ISODate);

    const screen = await renderWithNavigation();

    await fireEvent.press(screen.previous());

    expect(screen.getByText('Aralık 2025')).toBeTruthy();
  });

  it('keeps moving in the same direction', async () => {
    const screen = await renderWithNavigation();

    await fireEvent.press(screen.next());
    await fireEvent.press(screen.next());
    await fireEvent.press(screen.next());

    expect(screen.getByText('Aralık 2026')).toBeTruthy();
  });
});

describe('CalendarScreen month navigation and today', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('marks today on the month it falls in', async () => {
    const { getByTestId } = await renderScreen();

    expect(getByTestId('calendar-today-2026-09-17')).toBeTruthy();
  });

  it('marks nothing on the next month', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));

    expect(screen.queryAllByTestId(/^calendar-today-/)).toHaveLength(0);
  });

  it('marks nothing on the previous month', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Önceki ay'));

    expect(screen.queryAllByTestId(/^calendar-today-/)).toHaveLength(0);
  });

  it('marks today again on the way back', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));
    await fireEvent.press(screen.getByLabelText('Önceki ay'));

    expect(screen.getByTestId('calendar-today-2026-09-17')).toBeTruthy();
  });
});

describe('CalendarScreen month navigation does not touch the database', () => {
  it('reads the profile once across several months', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));
    await fireEvent.press(screen.getByLabelText('Önceki ay'));
    await fireEvent.press(screen.getByLabelText('Önceki ay'));

    expect(screen.getByText('Ağustos 2026')).toBeTruthy();
    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(getTodayMock).toHaveBeenCalledTimes(1);
  });

  it('never shows the loading screen again', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));

    expect(screen.queryByTestId('calendar-loading')).toBeNull();
    expect(screen.queryByText('Veriler yükleniyor')).toBeNull();
  });
});

describe('CalendarScreen month navigation boundaries', () => {
  it('disables stepping back before year 0', async () => {
    getTodayMock.mockReturnValue('0000-01-15' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile(['0000-01-02']));

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Önceki ay').props.accessibilityState.disabled).toBe(true);
    expect(getByLabelText('Sonraki ay').props.accessibilityState.disabled).toBe(false);
  });

  it('disables stepping past year 9999', async () => {
    getTodayMock.mockReturnValue('9999-12-15' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile(['9999-12-02']));

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Sonraki ay').props.accessibilityState.disabled).toBe(true);
    expect(getByLabelText('Önceki ay').props.accessibilityState.disabled).toBe(false);
  });

  it('enables both steps in an ordinary month', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Önceki ay').props.accessibilityState.disabled).toBe(false);
    expect(getByLabelText('Sonraki ay').props.accessibilityState.disabled).toBe(false);
  });
});

describe('CalendarScreen month navigation absence', () => {
  it('offers no navigation when there is no profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Önceki ay')).toBeNull();
    expect(queryByLabelText('Sonraki ay')).toBeNull();
  });

  it('offers no navigation when loading fails', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Önceki ay')).toBeNull();
  });
});

describe('CalendarScreen selected day', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('shows the section', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Seçilen gün')).toBeTruthy();
  });

  it('starts on today', async () => {
    const { getByTestId, getByText } = await renderScreen();

    expect(getByTestId('calendar-day-2026-09-17').props.accessibilityState.selected).toBe(true);
    expect(getByText('Döngü günü: 17. gün')).toBeTruthy();
    expect(getByText('Döngü evresi: Luteal')).toBeTruthy();
    expect(getByText('Doğurganlık tahmini: Düşük')).toBeTruthy();
  });

  it('follows a tap onto another day', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-11'));

    expect(screen.getByText('11 Eylül 2026')).toBeTruthy();
    expect(screen.getByText('Döngü günü: 11. gün')).toBeTruthy();
    expect(screen.getByText('Döngü evresi: Foliküler')).toBeTruthy();
    expect(screen.getByText('Doğurganlık tahmini: Yüksek')).toBeTruthy();
  });

  it('moves the selection mark with the tap', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-11'));

    expect(screen.getByTestId('calendar-day-2026-09-11').props.accessibilityState.selected).toBe(
      true
    );
    expect(screen.getByTestId('calendar-day-2026-09-17').props.accessibilityState.selected).toBe(
      false
    );
  });

  it('keeps the today mark when another day is picked', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-11'));

    expect(screen.getByTestId('calendar-today-2026-09-17')).toBeTruthy();
  });

  it('shows the predicted period note on the predicted day', async () => {
    const screen = await renderScreen();

    // The legend already carries this wording for the same mark, so the detail
    // note is the second occurrence rather than the only one.
    expect(screen.getAllByText('Sonraki regl başlangıcı tahmini')).toHaveLength(1);

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-29'));

    // Once each. On the home screen this was twice - the cycle summary named
    // the predicted date and the selected-day card named it again. The summary
    // is on the other screen now, so only the card says it.
    expect(screen.getAllByText('29 Eylül 2026')).toHaveLength(1);
    expect(screen.getAllByText('Sonraki regl başlangıcı tahmini')).toHaveLength(2);
  });

  it('shows no predicted note on an ordinary day', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-20'));

    // Only the legend's row remains.
    expect(screen.getAllByText('Sonraki regl başlangıcı tahmini')).toHaveLength(1);
  });
});

describe('CalendarScreen selected day before the first record', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-10']));
  });

  it('reports an unknown day', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-01'));

    expect(screen.getByText('1 Eylül 2026')).toBeTruthy();
    expect(screen.getByText('Döngü günü: Henüz başlamadı')).toBeTruthy();
    expect(screen.getByText('Döngü evresi: Bilinmiyor')).toBeTruthy();
    expect(screen.getByText('Doğurganlık tahmini: Bilinmiyor')).toBeTruthy();
  });
});

describe('CalendarScreen selection across months', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('clears the selection when the month changes', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));

    expect(screen.getByText('Bir gün seç.')).toBeTruthy();
  });

  it('leaves no stale date behind', async () => {
    const screen = await renderScreen();

    // One, not two: the home screen printed today's date in its header as
    // well, and this screen has no header date.
    expect(screen.getAllByText('17 Eylül 2026')).toHaveLength(1);

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));

    // And none once the card has gone, since nothing else here names it. That
    // is a stronger assertion than the original, which could only check that
    // the count fell from two to one.
    expect(screen.queryAllByText('17 Eylül 2026')).toHaveLength(0);
    expect(screen.queryByText('Döngü günü: 17. gün')).toBeNull();
  });

  it('marks nothing as selected in another month', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));

    for (const cell of screen.queryAllByTestId(/^calendar-day-/)) {
      expect(cell.props.accessibilityState.selected).toBe(false);
    }
  });

  it('accepts a pick in the new month', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));
    await fireEvent.press(screen.getByTestId('calendar-day-2026-10-02'));

    expect(screen.getByText('2 Ekim 2026')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-10-02').props.accessibilityState.selected).toBe(
      true
    );
  });

  it('selects today again on the way back', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));
    await fireEvent.press(screen.getByTestId('calendar-day-2026-10-02'));
    await fireEvent.press(screen.getByLabelText('Önceki ay'));

    expect(screen.getByTestId('calendar-day-2026-09-17').props.accessibilityState.selected).toBe(
      true
    );
    expect(screen.getByText('Döngü günü: 17. gün')).toBeTruthy();
    expect(screen.queryByText('2 Ekim 2026')).toBeNull();
  });

  it('says to pick a day in a month without today', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Önceki ay'));

    expect(screen.getByText('Bir gün seç.')).toBeTruthy();
  });
});

describe('CalendarScreen selected day entry link', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  // The card shows today until a square is tapped, so the link under it has to
  // describe today. It used to offer to add an entry to a day that already had
  // one, because only a tapped day was ever read.
  it('offers to edit today when today already has an entry, before anything is tapped', async () => {
    dailyLogRepository.loadDailyEntry.mockImplementation(async (_db: unknown, date: string) => ({
      date,
      flowId: 'heavy',
      moodId: null,
      symptomIds: [],
    }));

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Bu günü düzenle')).toBeTruthy();
  });

  it('offers to add to today when today has nothing recorded', async () => {
    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Bu güne ekle')).toBeTruthy();
  });

  // Tapping a different day must still swap the link over to that day, which is
  // what it did before and the reason the tapped day is read at all.
  it('follows the tapped day away from today', async () => {
    dailyLogRepository.loadDailyEntry.mockImplementation(async (_db: unknown, date: string) => ({
      date,
      flowId: date === '2026-09-17' ? 'heavy' : null,
      moodId: null,
      symptomIds: [],
    }));

    const screen = await renderScreen();

    expect(screen.getByLabelText('Bu günü düzenle')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-03'));

    expect(screen.getByLabelText('Bu güne ekle')).toBeTruthy();
  });
});

describe('CalendarScreen selected day absence', () => {
  it('shows no selected card while loading', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByText } = await render(<CalendarScreen />);

    expect(queryByText('Seçilen gün')).toBeNull();
  });

  it('shows no selected card when there is no profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { queryByText } = await renderScreen();

    expect(queryByText('Seçilen gün')).toBeNull();
    expect(queryByText('Bir gün seç.')).toBeNull();
  });

  it('shows no selected card when loading fails', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { queryByText } = await renderScreen();

    expect(queryByText('Seçilen gün')).toBeNull();
  });
});


describe('CalendarScreen under the floating tab bar', () => {
  it('leaves room for the bar so its last row is not hidden under it', async () => {
    const screen = await renderScreen();

    expectClearsTabBar(screen.toJSON());
  });
});
