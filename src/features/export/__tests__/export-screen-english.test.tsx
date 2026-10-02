import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import ExportScreen from '@/app/(app)/export';
import { exportMessages } from '@/features/export/presentation/export-messages';
import { toISODate } from '@/utils/date';
import { getTodayLocalISODate } from '@/utils/today';

import { expectNoTurkishCatalogueText } from '../../../../jest/assert-english-render';

/**
 * The export screen on an English phone.
 *
 * ## What is faked and what is not
 *
 * `share-file.ts` is faked, because it is the one file in this feature that
 * touches the device and there is nothing in it but two library calls. Below
 * it, `buildExportFiles` and everything it uses stay real, so what the share
 * sheet would receive is what this test receives.
 *
 * The repositories are faked at their own boundary, the way the rest of the
 * suite does it.
 */

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }],
  getCalendars: () => [{ calendar: 'gregory', uses24hourClock: true, firstWeekday: 2 }],
}));

jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

jest.mock('@/features/export/infrastructure/share-file', () => ({
  shareTextFile: jest.fn(),
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

jest.mock('@/features/notifications/data/notification-preferences-repository', () => ({
  loadNotificationPreferences: jest.fn(),
  saveNotificationPreferences: jest.fn(),
  loadDiscreetNotifications: jest.fn(),
  saveDiscreetNotifications: jest.fn(),
}));

jest.mock('@/features/daily-log/data/daily-log-repository', () => ({
  loadAllDailyEntries: jest.fn(),
  loadDailyEntry: jest.fn(),
  saveDailyEntry: jest.fn(),
  clearDailyEntry: jest.fn(),
  replaceDailyEntries: jest.fn(),
}));

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

const share = jest.requireMock('@/features/export/infrastructure/share-file');
const db = jest.requireMock('@/storage/db');
const cycle = jest.requireMock('@/features/cycle/data/cycle-repository');
const pregnancy = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const avatar = jest.requireMock('@/features/avatar/data/avatar-repository');
const notifications = jest.requireMock(
  '@/features/notifications/data/notification-preferences-repository'
);
const dailyLog = jest.requireMock('@/features/daily-log/data/daily-log-repository');
const getTodayMock = getTodayLocalISODate as unknown as jest.Mock;

const PROFILE = {
  settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
  periodRecords: [
    {
      id: 'period-2026-03-02',
      startDate: toISODate('2026-03-02'),
      endDate: toISODate('2026-03-06'),
      isOngoing: false,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  getTodayMock.mockReturnValue(toISODate('2026-03-20'));
  db.openAppDatabase.mockResolvedValue({});
  cycle.loadCycleProfile.mockResolvedValue(PROFILE);
  pregnancy.loadPregnancyProfile.mockResolvedValue(null);
  avatar.loadAvatarConfig.mockResolvedValue(null);
  notifications.loadNotificationPreferences.mockResolvedValue({
    periodReminderEnabled: false,
    pregnancyWeeklyReminderEnabled: false,
  });
  dailyLog.loadAllDailyEntries.mockResolvedValue([]);
  share.shareTextFile.mockResolvedValue('shared');
});

describe('the screen in English', () => {
  it('offers both files and says they go separately', async () => {
    const screen = await render(<ExportScreen />);

    expect(screen.getByLabelText(exportMessages.en.summaryButtonLabel)).toBeTruthy();
    expect(screen.getByLabelText(exportMessages.en.csvButtonLabel)).toBeTruthy();
    expect(screen.getByText(exportMessages.en.twoFilesNote)).toBeTruthy();

    expectNoTurkishCatalogueText(screen);
  });

  it('says plainly that a shared file leaves the app', async () => {
    // This app's whole argument is that the records stay on the phone, and this
    // is the one screen that hands them to something else.
    const screen = await render(<ExportScreen />);

    expect(screen.getByText(exportMessages.en.exportDescription)).toBeTruthy();
  });
});

describe('sharing', () => {
  it('hands the summary over when the first button is pressed', async () => {
    const screen = await render(<ExportScreen />);

    fireEvent.press(screen.getByLabelText(exportMessages.en.summaryButtonLabel));

    await waitFor(() => {
      expect(share.shareTextFile).toHaveBeenCalledTimes(1);
    });

    const file = share.shareTextFile.mock.calls[0][0];

    expect(file.fileName).toBe('period-summary-2026-03-20.txt');
    expect(file.mimeType).toBe('text/plain');
    expect(file.contents).toContain(exportMessages.en.summaryHeading);
  });

  it('hands the CSV over when the second is pressed', async () => {
    const screen = await render(<ExportScreen />);

    fireEvent.press(screen.getByLabelText(exportMessages.en.csvButtonLabel));

    await waitFor(() => {
      expect(share.shareTextFile).toHaveBeenCalledTimes(1);
    });

    const file = share.shareTextFile.mock.calls[0][0];

    expect(file.fileName).toBe('period-records-2026-03-20.csv');
    expect(file.mimeType).toBe('text/csv');
    expect(file.contents.split('\r\n')[0]).toContain('date,is_period_day');
  });

  it('builds the file in the language the app is in', async () => {
    const screen = await render(<ExportScreen />);

    fireEvent.press(screen.getByLabelText(exportMessages.en.summaryButtonLabel));

    await waitFor(() => {
      expect(share.shareTextFile).toHaveBeenCalledTimes(1);
    });

    expect(share.shareTextFile.mock.calls[0][0].contents).not.toContain(
      exportMessages.tr.summaryHeading
    );
  });
});

describe('when it cannot', () => {
  it('says so when the device has no share sheet', async () => {
    share.shareTextFile.mockResolvedValue('unavailable');

    const screen = await render(<ExportScreen />);

    fireEvent.press(screen.getByLabelText(exportMessages.en.summaryButtonLabel));

    await waitFor(() => {
      expect(screen.getByText(exportMessages.en.sharingUnavailableMessage)).toBeTruthy();
    });
  });

  it('says so when the share fails', async () => {
    share.shareTextFile.mockRejectedValue(new Error('nope'));

    const screen = await render(<ExportScreen />);

    fireEvent.press(screen.getByLabelText(exportMessages.en.summaryButtonLabel));

    await waitFor(() => {
      expect(screen.getByText(exportMessages.en.shareFailedMessage)).toBeTruthy();
    });
  });

  it('shares nothing at all when there is nothing recorded', async () => {
    cycle.loadCycleProfile.mockResolvedValue(null);

    const screen = await render(<ExportScreen />);

    fireEvent.press(screen.getByLabelText(exportMessages.en.summaryButtonLabel));

    await waitFor(() => {
      expect(screen.getByText(exportMessages.en.emptyMessage)).toBeTruthy();
    });

    expect(share.shareTextFile).not.toHaveBeenCalled();
  });
});
