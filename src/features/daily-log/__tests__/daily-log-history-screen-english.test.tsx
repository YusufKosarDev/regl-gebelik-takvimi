import { render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import React from 'react';

import DailyLogHistoryScreen from '@/app/(app)/daily-log-history';
import type { CycleProfile } from '@/features/cycle/domain/types';
import { dailyLogHistoryMessages } from '@/features/daily-log/presentation/daily-log-history-messages';
import type { ISODate } from '@/types/iso-date';
import { toISODate } from '@/utils/date';
import { getTodayLocalISODate } from '@/utils/today';

import { expectNoTurkishCatalogueText } from '../../../../jest/assert-english-render';

/**
 * The log history screen on an English phone.
 *
 * ## What is worth asserting here
 *
 * Two things, and the second is the one that matters. That the screen renders
 * in English with nothing Turkish left in it, which is the sweep's job - and
 * that the summary refuses to speak when it has too little to go on, which is
 * the only part of this app that looks at several days at once and says
 * something about the pattern.
 *
 * The refusals are tested through the screen rather than only in the domain
 * because the domain being right is no use if the screen renders a row the
 * domain marked as not notable.
 */

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }],
  getCalendars: () => [{ calendar: 'gregory', uses24hourClock: true, firstWeekday: 2 }],
}));

jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/daily-log/data/daily-log-repository', () => ({
  loadAllDailyEntries: jest.fn(),
  loadDailyEntry: jest.fn(),
  saveDailyEntry: jest.fn(),
  clearDailyEntry: jest.fn(),
  replaceDailyEntries: jest.fn(),
}));

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

const db = jest.requireMock('@/storage/db');
const dailyLog = jest.requireMock('@/features/daily-log/data/daily-log-repository');
const cycle = jest.requireMock('@/features/cycle/data/cycle-repository');
const useRouterMock = useRouter as unknown as jest.Mock;
const getTodayMock = getTodayLocalISODate as unknown as jest.Mock;

/** Cycle 28 from 2 March, so the luteal phase runs from 16 March onwards. */
const PROFILE: CycleProfile = {
  settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
  periodRecords: [
    { id: 'period-2026-03-02', startDate: toISODate('2026-03-02'), isOngoing: false },
  ],
};

function entry(date: string, symptomIds: readonly string[]) {
  return { date: date as ISODate, flowId: null, moodId: null, symptomIds };
}

/** `count` luteal days in a row, each holding the given symptoms. */
function lutealDays(count: number, symptomIds: readonly string[]) {
  return Array.from({ length: count }, (_, index) =>
    entry(`2026-03-${String(16 + index).padStart(2, '0')}`, symptomIds)
  );
}

/**
 * `count` follicular days holding nothing, to give the baseline something to be.
 *
 * Needed by any test about a share being notable. With only luteal days logged,
 * every placed day is luteal, so a symptom falling entirely in the luteal phase
 * is describing the log rather than saying anything - and the summary correctly
 * refuses to speak. March 8 onwards is day 7 of the cycle, well into follicular.
 */
function quietFollicularDays(count: number) {
  return Array.from({ length: count }, (_, index) =>
    entry(`2026-03-${String(8 + index).padStart(2, '0')}`, ['headache'])
  );
}

async function renderScreen() {
  const screen = await render(<DailyLogHistoryScreen />);

  await waitFor(() => {
    expect(screen.queryByTestId('daily-log-history-loading')).toBeNull();
  });

  return screen;
}

beforeEach(() => {
  jest.clearAllMocks();
  getTodayMock.mockReturnValue(toISODate('2026-03-28'));
  db.openAppDatabase.mockResolvedValue({});
  cycle.loadCycleProfile.mockResolvedValue(PROFILE);
  dailyLog.loadAllDailyEntries.mockResolvedValue([]);
  useRouterMock.mockReturnValue({ back: jest.fn(), push: jest.fn(), replace: jest.fn() });
});

describe('the screen in English', () => {
  it('says so when nothing has been logged', async () => {
    const screen = await renderScreen();

    expect(screen.getByText(dailyLogHistoryMessages.en.emptyMessage)).toBeTruthy();

    expectNoTurkishCatalogueText(screen);
  });

  it('draws the month and the summary once there are days', async () => {
    dailyLog.loadAllDailyEntries.mockResolvedValue(lutealDays(6, ['cramps']));

    const screen = await renderScreen();

    expect(screen.getByText(dailyLogHistoryMessages.en.historyTitle)).toBeTruthy();
    expect(screen.getByText(dailyLogHistoryMessages.en.summaryTitle)).toBeTruthy();
    expect(screen.getByTestId('log-day-2026-03-16')).toBeTruthy();

    expectNoTurkishCatalogueText(screen);
  });
});

describe('what the summary refuses to say', () => {
  it('says nothing stands out below the minimum number of days', async () => {
    // Four luteal days, all holding the same symptom. The share is 100% and it
    // is still four days, which is not a finding.
    dailyLog.loadAllDailyEntries.mockResolvedValue(lutealDays(4, ['cramps']));

    const screen = await renderScreen();

    expect(screen.getByText(dailyLogHistoryMessages.en.summaryNothingNotable)).toBeTruthy();
  });

  it('says nothing stands out when every logged day is in one phase anyway', async () => {
    // Six luteal days, all with cramps, and nothing else logged. The share is
    // 100% and so is the baseline: every placed day is luteal, so "all your
    // cramps were luteal" describes the log rather than the person.
    dailyLog.loadAllDailyEntries.mockResolvedValue(lutealDays(6, ['cramps']));

    const screen = await renderScreen();

    expect(screen.getByText(dailyLogHistoryMessages.en.summaryNothingNotable)).toBeTruthy();
  });

  it('speaks once there are enough days and the share beats the days available', async () => {
    dailyLog.loadAllDailyEntries.mockResolvedValue([
      ...quietFollicularDays(6),
      ...lutealDays(6, ['cramps']),
    ]);

    const screen = await renderScreen();

    expect(screen.queryByText(dailyLogHistoryMessages.en.summaryNothingNotable)).toBeNull();
    expect(screen.getByText(/Cramps: 6 of your 6 entries fell in the/)).toBeTruthy();
  });

  it('carries the disclaimer whether or not it said anything', async () => {
    // It is about what the panel is, not about any particular line in it.
    dailyLog.loadAllDailyEntries.mockResolvedValue(lutealDays(4, ['cramps']));

    const quiet = await renderScreen();

    expect(quiet.getByText(dailyLogHistoryMessages.en.summaryDisclaimer)).toBeTruthy();
  });

  it('explains itself when there is no period to place the days against', async () => {
    cycle.loadCycleProfile.mockResolvedValue({
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [],
    });
    dailyLog.loadAllDailyEntries.mockResolvedValue(lutealDays(6, ['cramps']));

    const screen = await renderScreen();

    expect(screen.getByText(dailyLogHistoryMessages.en.summaryUnplaced)).toBeTruthy();
  });

  it('never uses a word that turns a count into a cause', async () => {
    // The domain refuses the numbers that would be misleading; this is the
    // other half, and it is checked on what the screen actually rendered.
    dailyLog.loadAllDailyEntries.mockResolvedValue([
      ...quietFollicularDays(6),
      ...lutealDays(6, ['cramps']),
    ]);

    const screen = await renderScreen();
    const text = JSON.stringify(screen.toJSON()).toLowerCase();

    for (const word of ['because', 'caused', 'causes', 'linked', 'associated', 'correlat']) {
      expect(text).not.toContain(word);
    }
  });
});
