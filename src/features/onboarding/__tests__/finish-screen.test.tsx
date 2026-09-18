import { fireEvent, render } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import FinishScreen from '@/app/(onboarding)/finish';
import { completeCycleOnboarding } from '@/features/cycle/application/complete-cycle-onboarding';
import { useAppStore } from '@/store/app-store';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { getTodayLocalISODate } from '@/utils/today';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/cycle/application/complete-cycle-onboarding', () => ({
  completeCycleOnboarding: jest.fn(),
}));

// Guards: the screen must go through the use case, never these directly.
jest.mock('@/features/cycle/data/cycle-repository', () => ({
  saveCycleProfile: jest.fn(),
  loadCycleProfile: jest.fn(),
}));

jest.mock('@/storage/app-state-storage', () => ({
  loadAppState: jest.fn(),
  saveAppState: jest.fn(),
  clearAppState: jest.fn(),
}));

const useRouterMock = useRouter as unknown as jest.Mock;
const useLocalSearchParamsMock = useLocalSearchParams as unknown as jest.Mock;
const getTodayMock = getTodayLocalISODate as unknown as jest.Mock;
const openAppDatabaseMock = openAppDatabase as unknown as jest.Mock;
const completeCycleOnboardingMock = completeCycleOnboarding as unknown as jest.Mock;
const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const widgetSync = jest.requireMock('@/features/widget/application/sync-widget-snapshot');
const reminderSync = jest.requireMock('@/features/notifications/application/sync-period-reminder');

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
const appStateStorage = jest.requireMock('@/storage/app-state-storage');

let push: jest.Mock;
let replace: jest.Mock;
let back: jest.Mock;
let completeOnboarding: jest.Mock;

const FAKE_DB = { marker: 'the-one-database' };

beforeEach(() => {
  push = jest.fn();
  replace = jest.fn();
  back = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ push, replace, back });

  useLocalSearchParamsMock.mockReset();
  getTodayMock.mockReset().mockReturnValue('2026-09-17' as ISODate);

  openAppDatabaseMock.mockReset().mockResolvedValue(FAKE_DB);
  completeCycleOnboardingMock.mockReset().mockResolvedValue(undefined);
  widgetSync.syncWidgetSnapshotQuietly.mockReset();
  widgetSync.syncWidgetSnapshotQuietly.mockResolvedValue(null);
  reminderSync.syncPeriodReminderQuietly.mockReset();
  reminderSync.syncPeriodReminderQuietly.mockResolvedValue(null);

  completeOnboarding = jest.fn().mockResolvedValue(undefined);
  useAppStore.setState({
    mode: 'cycle',
    onboardingCompleted: false,
    hydrated: true,
    completeOnboarding: completeOnboarding as unknown as () => Promise<void>,
  });

  for (const fn of [
    repository.saveCycleProfile,
    repository.loadCycleProfile,
    appStateStorage.saveAppState,
    appStateStorage.loadAppState,
    appStateStorage.clearAppState,
  ]) {
    (fn as jest.Mock).mockReset();
  }
});

type ScreenParams = {
  cycleLength?: unknown;
  periodLength?: unknown;
  lastPeriodStartDate?: unknown;
  today?: string;
};

async function renderScreen(overrides: ScreenParams = {}) {
  // Presence check, not a destructuring default: an explicit `undefined` is a
  // missing param and must stay missing.
  const cycleLength = 'cycleLength' in overrides ? overrides.cycleLength : '28';
  const periodLength = 'periodLength' in overrides ? overrides.periodLength : '5';
  const lastPeriodStartDate =
    'lastPeriodStartDate' in overrides ? overrides.lastPeriodStartDate : '2026-09-17';
  const today = overrides.today ?? '2026-09-17';

  getTodayMock.mockReturnValue(today as ISODate);
  useLocalSearchParamsMock.mockReturnValue({ cycleLength, periodLength, lastPeriodStartDate });

  const screen = await render(<FinishScreen />);

  return {
    ...screen,
    submit: () => screen.getByRole('button', { name: 'Takibe başla' }),
  };
}

describe('FinishScreen with valid params', () => {
  it('renders the title', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Her şey hazır')).toBeTruthy();
  });

  it('renders the description', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Bilgilerini kaydedip döngü takibine başlayabilirsin.')).toBeTruthy();
  });

  it('renders the primary action', async () => {
    const { submit } = await renderScreen();

    expect(submit()).toBeTruthy();
  });

  it('shows no error before submitting', async () => {
    const { queryByText } = await renderScreen();

    expect(queryByText('Bilgiler kaydedilemedi. Lütfen tekrar dene.')).toBeNull();
  });

  it('writes nothing on render', async () => {
    await renderScreen();

    expect(openAppDatabaseMock).not.toHaveBeenCalled();
    expect(completeCycleOnboardingMock).not.toHaveBeenCalled();
    expect(completeOnboarding).not.toHaveBeenCalled();
  });
});

describe('FinishScreen success flow', () => {
  it('opens the database, saves the profile, then marks onboarding done', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());

    expect(openAppDatabaseMock).toHaveBeenCalledTimes(1);
    expect(completeCycleOnboardingMock).toHaveBeenCalledTimes(1);
    expect(completeOnboarding).toHaveBeenCalledTimes(1);

    const dbOrder = openAppDatabaseMock.mock.invocationCallOrder[0];
    const useCaseOrder = completeCycleOnboardingMock.mock.invocationCallOrder[0];
    const flagOrder = completeOnboarding.mock.invocationCallOrder[0];

    expect(useCaseOrder).toBeGreaterThan(dbOrder);
    expect(flagOrder).toBeGreaterThan(useCaseOrder);
  });

  it('passes the opened database to the use case', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());

    expect(completeCycleOnboardingMock.mock.calls[0][0]).toBe(FAKE_DB);
  });

  it('passes the parsed onboarding input', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());

    expect(completeCycleOnboardingMock.mock.calls[0][1]).toEqual({
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
      lastPeriodStartDate: '2026-09-17',
    });
  });

  it('passes other valid values through', async () => {
    const { submit } = await renderScreen({
      cycleLength: '35',
      periodLength: '7',
      lastPeriodStartDate: '2026-01-01',
    });

    await fireEvent.press(submit());

    expect(completeCycleOnboardingMock.mock.calls[0][1]).toEqual({
      averageCycleLengthDays: 35,
      averagePeriodLengthDays: 7,
      lastPeriodStartDate: '2026-01-01',
    });
  });

  it('does not navigate itself', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());

    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('never touches the repository or storage directly', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(repository.loadCycleProfile).not.toHaveBeenCalled();
    expect(appStateStorage.saveAppState).not.toHaveBeenCalled();
  });
});

describe('FinishScreen double submit protection', () => {
  it('ignores a second press once the flow has started', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());
    await fireEvent.press(submit());
    await fireEvent.press(submit());

    expect(openAppDatabaseMock).toHaveBeenCalledTimes(1);
    expect(completeCycleOnboardingMock).toHaveBeenCalledTimes(1);
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
  });

  it('leaves the button disabled and showing progress after a successful submit', async () => {
    const { submit, getByText } = await renderScreen();

    await fireEvent.press(submit());

    // The root gate unmounts this screen on success, so the control stays shut.
    expect(submit().props.accessibilityState.disabled).toBe(true);
    expect(getByText('Kaydediliyor...')).toBeTruthy();
  });

  it('reopens the guard after a failure so the user can retry', async () => {
    openAppDatabaseMock.mockRejectedValueOnce(new Error('disk I/O error'));
    const { submit } = await renderScreen();

    await fireEvent.press(submit());
    expect(submit().props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(submit());

    expect(openAppDatabaseMock).toHaveBeenCalledTimes(2);
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
  });
});

describe('FinishScreen when opening the database fails', () => {
  beforeEach(() => {
    openAppDatabaseMock.mockRejectedValue(new Error('disk I/O error'));
  });

  it('shows the error message', async () => {
    const { submit, findByText } = await renderScreen();

    await fireEvent.press(submit());

    expect(await findByText('Bilgiler kaydedilemedi. Lütfen tekrar dene.')).toBeTruthy();
  });

  it('does not save anything', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());

    expect(completeCycleOnboardingMock).not.toHaveBeenCalled();
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it('lets the user try again', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());

    expect(submit().props.accessibilityState.disabled).toBe(false);

    openAppDatabaseMock.mockResolvedValue(FAKE_DB);
    await fireEvent.press(submit());

    expect(openAppDatabaseMock).toHaveBeenCalledTimes(2);
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
  });
});

describe('FinishScreen when saving the profile fails', () => {
  beforeEach(() => {
    completeCycleOnboardingMock.mockRejectedValue(new Error('constraint failed'));
  });

  it('shows the error message', async () => {
    const { submit, findByText } = await renderScreen();

    await fireEvent.press(submit());

    expect(await findByText('Bilgiler kaydedilemedi. Lütfen tekrar dene.')).toBeTruthy();
  });

  it('never marks onboarding as done', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());

    expect(completeCycleOnboardingMock).toHaveBeenCalledTimes(1);
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it('lets the user try again', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());
    expect(submit().props.accessibilityState.disabled).toBe(false);

    completeCycleOnboardingMock.mockResolvedValue(undefined);
    await fireEvent.press(submit());

    expect(completeOnboarding).toHaveBeenCalledTimes(1);
  });

  it('does not navigate', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());

    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('FinishScreen when the app state flag fails', () => {
  beforeEach(() => {
    completeOnboarding.mockRejectedValue(new Error('storage unavailable'));
    useAppStore.setState({
      completeOnboarding: completeOnboarding as unknown as () => Promise<void>,
    });
  });

  it('shows the error message', async () => {
    const { submit, findByText } = await renderScreen();

    await fireEvent.press(submit());

    expect(await findByText('Bilgiler kaydedilemedi. Lütfen tekrar dene.')).toBeTruthy();
  });

  it('leaves the profile already written — no rollback is attempted', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());

    // Documented, accepted behaviour for now: the profile is in the database but
    // the flag is not set, so the next launch shows onboarding again.
    expect(completeCycleOnboardingMock).toHaveBeenCalledTimes(1);
    expect(repository.loadCycleProfile).not.toHaveBeenCalled();
    expect(appStateStorage.clearAppState).not.toHaveBeenCalled();
  });

  it('does not navigate', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());

    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('lets the user try again', async () => {
    const { submit } = await renderScreen();

    await fireEvent.press(submit());
    expect(submit().props.accessibilityState.disabled).toBe(false);

    completeOnboarding.mockResolvedValue(undefined);
    await fireEvent.press(submit());

    expect(completeOnboarding).toHaveBeenCalledTimes(2);
  });
});

describe('FinishScreen with unusable params', () => {
  it.each<[string, ScreenParams]>([
    ['a missing cycle length', { cycleLength: undefined }],
    ['a non-numeric cycle length', { cycleLength: 'abc' }],
    ['a cycle length below the minimum', { cycleLength: '14' }],
    ['a missing period length', { periodLength: undefined }],
    ['a zero period length', { periodLength: '0' }],
    ['a period longer than the cycle', { cycleLength: '15', periodLength: '16' }],
    ['a missing start date', { lastPeriodStartDate: undefined }],
    ['an impossible start date', { lastPeriodStartDate: '2026-02-30' }],
    ['a future start date', { lastPeriodStartDate: '2026-09-18' }],
    ['an array start date', { lastPeriodStartDate: ['2026-09-17'] }],
  ])('shows the error screen for %s', async (_label, overrides) => {
    const { getByText } = await renderScreen(overrides);

    expect(getByText('Geçersiz döngü bilgisi.')).toBeTruthy();
  });

  it('offers no action', async () => {
    const { queryAllByRole, queryByText } = await renderScreen({ cycleLength: 'abc' });

    expect(queryAllByRole('button')).toHaveLength(0);
    expect(queryByText('Takibe başla')).toBeNull();
    expect(queryByText('Her şey hazır')).toBeNull();
  });

  it('opens nothing and saves nothing', async () => {
    await renderScreen({ lastPeriodStartDate: '2026-09-18' });

    expect(openAppDatabaseMock).not.toHaveBeenCalled();
    expect(completeCycleOnboardingMock).not.toHaveBeenCalled();
    expect(completeOnboarding).not.toHaveBeenCalled();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(appStateStorage.saveAppState).not.toHaveBeenCalled();
  });
});

describe('FinishScreen widget snapshot sync', () => {
  it('syncs once the onboarding write succeeded', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.submit());

    expect(completeCycleOnboardingMock).toHaveBeenCalledTimes(1);
    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs for the day onboarding finished on', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.submit());

    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledWith(
      expect.anything(),
      '2026-09-17'
    );
  });

  it('does not sync when the onboarding write failed', async () => {
    completeCycleOnboardingMock.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.submit());

    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });

  it('finishes onboarding even when the sync writes nothing', async () => {
    widgetSync.syncWidgetSnapshotQuietly.mockResolvedValue(null);

    const screen = await renderScreen();

    await fireEvent.press(screen.submit());

    expect(completeOnboarding).toHaveBeenCalledTimes(1);
  });

  it('does not sync when the screen is only shown', async () => {
    await renderScreen();

    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });
});

describe('FinishScreen period reminder sync', () => {
  it('syncs once the onboarding write succeeded', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.submit());

    expect(completeCycleOnboardingMock).toHaveBeenCalledTimes(1);
    expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledTimes(1);
    expect(reminderSync.syncPeriodReminderQuietly).toHaveBeenCalledWith(
      expect.anything(),
      '2026-09-17'
    );
  });

  it('does not sync when the onboarding write failed', async () => {
    completeCycleOnboardingMock.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.submit());

    expect(reminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
  });

  it('finishes onboarding even when the reminder could not be scheduled', async () => {
    reminderSync.syncPeriodReminderQuietly.mockResolvedValue(null);

    const screen = await renderScreen();

    await fireEvent.press(screen.submit());

    expect(completeOnboarding).toHaveBeenCalledTimes(1);
  });

  it('does not sync when the screen is only shown', async () => {
    await renderScreen();

    expect(reminderSync.syncPeriodReminderQuietly).not.toHaveBeenCalled();
  });
});
