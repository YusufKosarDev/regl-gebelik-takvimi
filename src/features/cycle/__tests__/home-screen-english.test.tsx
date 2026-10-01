import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import React from 'react';

import HomeScreen from '@/app/(app)/index';
import type { CycleProfile, PeriodRecord } from '@/features/cycle/domain/types';
import { homeMessages } from '@/features/cycle/presentation/home-messages';
import { useAppStore } from '@/store/app-store';
import type { ISODate } from '@/types/iso-date';
import { addDays, toISODate } from '@/utils/date';
import { getTodayLocalISODate } from '@/utils/today';

import { expectNoTurkishCatalogueText } from '../../../../jest/assert-english-render';

/**
 * The home screen on an English phone, with the records saying something.
 *
 * ## Why these scenarios and not a plain render
 *
 * `home-screen.test.tsx` beside it is 160 KB of Turkish assertions and is left
 * alone. None of its fixtures carry more than two period records, which is a
 * fact worth knowing: two records make one gap, and one gap is below the
 * minimum the outlook needs before it says anything. So every scenario that
 * file describes is one where the suggestion card and the range are absent -
 * which is why adding them did not move its button counts.
 *
 * This file is the other half: profiles with enough history for the new parts
 * to appear, rendered in English, with the sweep over every one of them. The
 * suggestion card and the range were the two surfaces most likely to ship with
 * a Turkish string in them, because neither existed when the migration was
 * done.
 */

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }],
  getCalendars: () => [{ calendar: 'gregory', uses24hourClock: true, firstWeekday: 2 }],
}));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  loadPregnancyProfile: jest.fn(),
  savePregnancyProfile: jest.fn(),
}));

jest.mock('@/features/avatar/data/avatar-repository', () => ({
  loadAvatarConfig: jest.fn(),
  saveAvatarConfig: jest.fn(),
}));

jest.mock('@/features/daily-log/data/daily-log-repository', () => ({
  loadDailyEntry: jest.fn(),
}));

jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshotQuietly: jest.fn(),
  syncWidgetSnapshot: jest.fn(),
}));

jest.mock('@/features/notifications/application/sync-period-reminder', () => ({
  syncPeriodReminderQuietly: jest.fn(),
  syncPeriodReminder: jest.fn(),
}));

jest.mock('@/features/notifications/application/sync-pregnancy-weekly-reminder', () => ({
  syncPregnancyWeeklyReminderQuietly: jest.fn(),
  syncPregnancyWeeklyReminder: jest.fn(),
}));

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

jest.mock('@/storage/app-state-storage', () => ({
  loadAppState: jest.fn(),
  saveAppState: jest.fn(),
  clearAppState: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const react = jest.requireActual<typeof import('react')>('react');

    react.useEffect(effect, [effect]);
  },
}));

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
const useRouterMock = useRouter as unknown as jest.Mock;

const FIRST_START = toISODate('2026-01-05');

/** Periods at the given gaps, starting from a fixed day. */
function profileWithGaps(settingDays: number, gaps: readonly number[]): CycleProfile {
  const records: PeriodRecord[] = [];
  let start = FIRST_START;

  records.push({ id: `period-${start}`, startDate: start, isOngoing: false });

  for (const gap of gaps) {
    start = addDays(start, gap);
    records.push({ id: `period-${start}`, startDate: start, isOngoing: false });
  }

  return {
    settings: { averageCycleLengthDays: settingDays, averagePeriodLengthDays: 5 },
    periodRecords: records,
  };
}

/** The day after the last recorded start, unless a test wants otherwise. */
function lastStartOf(profile: CycleProfile): ISODate {
  return profile.periodRecords[profile.periodRecords.length - 1].startDate;
}

async function renderWith(profile: CycleProfile, daysSinceLastStart = 3) {
  repository.loadCycleProfile.mockResolvedValue(profile);
  getTodayMock.mockReturnValue(addDays(lastStartOf(profile), daysSinceLastStart));

  const screen = await render(<HomeScreen />);

  await waitFor(() => {
    expect(screen.queryByTestId('cycle-dashboard-loading')).toBeNull();
  });

  return screen;
}

beforeEach(() => {
  jest.clearAllMocks();
  useAppStore.setState({ mode: 'cycle', onboardingCompleted: true, hydrated: true });
  db.openAppDatabase.mockResolvedValue({});
  pregnancyRepository.loadPregnancyProfile.mockResolvedValue(null);
  avatarRepository.loadAvatarConfig.mockResolvedValue(null);
  // The real repository answers with an empty day rather than null, and the
  // screen relies on that. A null here fails the load and the screen shows its
  // error state instead of anything this file is about.
  dailyLogRepository.loadDailyEntry.mockImplementation(async (_db: unknown, date: string) => ({
    date,
    flowId: null,
    moodId: null,
    symptomIds: [],
  }));
  useRouterMock.mockReturnValue({ push: jest.fn(), back: jest.fn(), replace: jest.fn() });

  // The screen chains `.catch` onto these without awaiting them, so a mock that
  // returns undefined is a TypeError inside the load rather than a quiet no-op.
  widgetSync.syncWidgetSnapshotQuietly.mockResolvedValue(null);
  reminderSync.syncPeriodReminderQuietly.mockResolvedValue(null);
  pregnancyReminderSync.syncPregnancyWeeklyReminderQuietly.mockResolvedValue(null);
});

describe('the cycle length suggestion', () => {
  it('offers the observed length against the setting, in English', async () => {
    const screen = await renderWith(profileWithGaps(28, [31, 31, 31]));

    expect(
      screen.getByText(homeMessages.en.cycleLengthSuggestionBody(31, 28, 3))
    ).toBeTruthy();
    expect(
      screen.getByLabelText(homeMessages.en.cycleLengthSuggestionAcceptLabel(31))
    ).toBeTruthy();

    expectNoTurkishCatalogueText(screen);
  });

  it('is absent when the records agree with the setting', async () => {
    const screen = await renderWith(profileWithGaps(30, [30, 30, 30]));

    expect(screen.queryByText(homeMessages.en.cycleLengthSuggestionTitle)).toBeNull();
  });

  it('is absent with too little history, which is why the older tests still pass', async () => {
    // Two records, one gap. Stated here because it is the property that kept
    // 160 KB of existing assertions green rather than a coincidence.
    const screen = await renderWith(profileWithGaps(28, [31]));

    expect(screen.queryByText(homeMessages.en.cycleLengthSuggestionTitle)).toBeNull();
  });

  it('goes away when it is waved off', async () => {
    const screen = await renderWith(profileWithGaps(28, [31, 31, 31]));

    fireEvent.press(screen.getByLabelText(homeMessages.en.cycleLengthSuggestionDismissLabel));

    await waitFor(() => {
      expect(screen.queryByText(homeMessages.en.cycleLengthSuggestionTitle)).toBeNull();
    });
  });
});

describe('the next period row', () => {
  it('shows a span when the recorded cycles vary', async () => {
    const screen = await renderWith(profileWithGaps(28, [24, 30, 36]));

    expect(screen.getByText(homeMessages.en.irregularCycleNote)).toBeTruthy();

    expectNoTurkishCatalogueText(screen);
  });

  it('shows a single date when they agree', async () => {
    const screen = await renderWith(profileWithGaps(28, [28, 29, 30]));

    expect(screen.queryByText(homeMessages.en.irregularCycleNote)).toBeNull();
    expect(screen.queryByText(homeMessages.en.nextPeriodStale)).toBeNull();
  });

  it('withholds the date when the last record is too old', async () => {
    const screen = await renderWith(profileWithGaps(28, [28, 29, 30]), 200);

    expect(screen.getByText(homeMessages.en.nextPeriodStale)).toBeTruthy();
    expect(screen.getByText(homeMessages.en.predictionStaleNote)).toBeTruthy();

    expectNoTurkishCatalogueText(screen);
  });

  it('prefers withholding to widening when the records are both old and varied', async () => {
    // Stale outranks ranged. A span built on a record from seven months ago is
    // the same claim as a date built on it, only wider.
    const screen = await renderWith(profileWithGaps(28, [24, 30, 36]), 200);

    expect(screen.getByText(homeMessages.en.nextPeriodStale)).toBeTruthy();
    expect(screen.queryByText(homeMessages.en.irregularCycleNote)).toBeNull();
  });
});
