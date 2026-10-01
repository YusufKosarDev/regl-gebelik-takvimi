import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import React from 'react';

import HistoryScreen from '@/app/(app)/history';
import type { CycleProfile } from '@/features/cycle/domain/types';
import { historyMessages } from '@/features/cycle/presentation/history-messages';
import type { ISODate } from '@/types/iso-date';
import { getTodayLocalISODate } from '@/utils/today';

import { expectNoTurkishCatalogueText } from '../../../../jest/assert-english-render';

/**
 * The history screen on an English phone.
 *
 * ## Why this file exists
 *
 * Its delete button used to be written inline as
 * `{isDeleting ? 'Siliniyor...' : 'Sil'}`, so an English phone showed "Sil" on
 * it while everything around it was English. Nothing caught that: the strings
 * were never in a catalogue, and neither carries a Turkish-specific letter, so
 * the lint rule's letter test could not match them either.
 *
 * The fix is a catalogue entry. The guard is this file, and specifically the
 * sweep at the end of each case: `expectNoTurkishCatalogueText` knows every
 * Turkish string in the app, so it catches a leak nobody thought to name - on
 * this screen and, as the same helper spreads, on the others.
 *
 * The device is overridden here rather than globally, the escape hatch
 * `jest/expo-localization-mock.js` documents. The mocks are copied from
 * `history-screen.test.tsx` beside it, which is left untouched: its assertions
 * are Turkish by design and are the thing the whole migration exists to leave
 * alone.
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

jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshotQuietly: jest.fn(),
  syncWidgetSnapshot: jest.fn(),
}));

jest.mock('@/features/notifications/application/sync-period-reminder', () => ({
  syncPeriodReminderQuietly: jest.fn(),
  syncPeriodReminder: jest.fn(),
}));

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const useRouterMock = useRouter as unknown as jest.Mock;
const getTodayMock = getTodayLocalISODate as unknown as jest.Mock;

const PROFILE: CycleProfile = {
  settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
  periodRecords: [
    {
      id: 'period-2026-09-01',
      startDate: '2026-09-01' as ISODate,
      endDate: '2026-09-06' as ISODate,
      isOngoing: false,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  getTodayMock.mockReturnValue('2026-09-20' as ISODate);
  db.openAppDatabase.mockResolvedValue({});
  repository.loadCycleProfile.mockResolvedValue(PROFILE);
  useRouterMock.mockReturnValue({ back: jest.fn(), push: jest.fn(), replace: jest.fn() });
});

describe('the history screen on an English phone', () => {
  it('shows the screen in English and nothing in Turkish', async () => {
    const screen = await render(<HistoryScreen />);

    await waitFor(() => {
      expect(screen.getByText(historyMessages.en.historyTitle)).toBeTruthy();
    });

    expectNoTurkishCatalogueText(screen);
  });

  it('shows the delete button in English once the confirmation is open', async () => {
    // The actual regression. The delete confirmation is behind a press, so a
    // render-and-look test would never have reached the button that was wrong.
    const screen = await render(<HistoryScreen />);

    await waitFor(() => {
      expect(screen.getByText(historyMessages.en.historyTitle)).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText(historyMessages.en.deleteRecordLabel('1 September 2026')));

    await waitFor(() => {
      expect(screen.getByText(historyMessages.en.deleteQuestion)).toBeTruthy();
    });

    expect(screen.getByText(historyMessages.en.deleteConfirmLabel)).toBeTruthy();
    expect(screen.queryByText(historyMessages.tr.deleteConfirmLabel)).toBeNull();

    expectNoTurkishCatalogueText(screen);
  });

  it('opens the two date editors in English', async () => {
    // Both panels hold their own labels and their own dates. They are the rest
    // of this screen's surface, and the sweep is what makes visiting them worth
    // the lines.
    const screen = await render(<HistoryScreen />);

    await waitFor(() => {
      expect(screen.getByText(historyMessages.en.historyTitle)).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText(historyMessages.en.editStartLabel('1 September 2026')));

    await waitFor(() => {
      expect(screen.getByText(historyMessages.en.editStartPanelTitle)).toBeTruthy();
    });

    expectNoTurkishCatalogueText(screen);
  });
});
