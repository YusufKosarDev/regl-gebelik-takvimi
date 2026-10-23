import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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

jest.mock('@/features/export/infrastructure/share-pdf-file', () => ({
  sharePdfFile: jest.fn(),
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
const pdfShare = jest.requireMock('@/features/export/infrastructure/share-pdf-file');
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
  pdfShare.sharePdfFile.mockResolvedValue('shared');
});

describe('the screen in English', () => {
  it('offers all three files and says they go separately', async () => {
    const screen = await render(<ExportScreen />);

    expect(screen.getByLabelText(exportMessages.en.summaryButtonLabel)).toBeTruthy();
    expect(screen.getByLabelText(exportMessages.en.csvButtonLabel)).toBeTruthy();
    expect(screen.getByLabelText(exportMessages.en.pdfButtonLabel)).toBeTruthy();
    expect(screen.getByText(exportMessages.en.threeFilesNote)).toBeTruthy();

    expectNoTurkishCatalogueText(screen);
  });

  /**
   * The `.txt` is not replaced by the PDF.
   *
   * It is the one of the three that depends on no renderer, so it is what is
   * left when `printToFileAsync` fails. A later tidy-up that collapsed the two
   * readable formats into one would take the fallback with it.
   */
  it('keeps the readable summary alongside the printable one', async () => {
    const screen = await render(<ExportScreen />);

    expect(screen.getByText(exportMessages.en.summaryButtonText)).toBeTruthy();
    expect(screen.getByText(exportMessages.en.pdfButtonText)).toBeTruthy();
  });

  /**
   * The buttons are in the order the note lists them.
   *
   * The note is read first and sends somebody looking down at the buttons for
   * the one it describes. `export-pdf-messages.test.ts` holds the note to this
   * order; this holds the buttons to it, so neither can move without the other
   * going red.
   */
  it('offers them in the order the note lists them', async () => {
    const screen = await render(<ExportScreen />);

    const order = [
      exportMessages.en.summaryButtonText,
      exportMessages.en.csvButtonText,
      exportMessages.en.pdfButtonText,
    ].map((text) => JSON.stringify(screen.toJSON()).indexOf(text));

    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((left, right) => left - right));
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

    await fireEvent.press(screen.getByLabelText(exportMessages.en.summaryButtonLabel));

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

    await fireEvent.press(screen.getByLabelText(exportMessages.en.csvButtonLabel));

    await waitFor(() => {
      expect(share.shareTextFile).toHaveBeenCalledTimes(1);
    });

    const file = share.shareTextFile.mock.calls[0][0];

    expect(file.fileName).toBe('period-records-2026-03-20.csv');
    expect(file.mimeType).toBe('text/csv');
    expect(file.contents.split('\r\n')[0]).toContain('date,is_period_day');
  });

  /**
   * The third button goes through `sharePdfFile`, not through the text share.
   *
   * It has to: the printed PDF lands outside the folder the wipe empties and
   * only that path moves it in. Wiring the third button to `shareTextFile`
   * would write the HTML out as a file named `.pdf` and leave the real one
   * behind, which is the failure the whole third file was arranged around.
   */
  it('prints and shares the document when the third is pressed', async () => {
    const screen = await render(<ExportScreen />);

    await fireEvent.press(screen.getByLabelText(exportMessages.en.pdfButtonLabel));

    await waitFor(() => {
      expect(pdfShare.sharePdfFile).toHaveBeenCalledTimes(1);
    });

    expect(share.shareTextFile).not.toHaveBeenCalled();

    const document = pdfShare.sharePdfFile.mock.calls[0][0];

    expect(document.fileName).toBe('period-summary-2026-03-20.pdf');
    expect(document.html).toContain(exportMessages.en.pdfIntro);
    expect(document.html).toContain(exportMessages.en.summaryFooter);
  });

  it('names the symptoms on the page in the language the app is in', async () => {
    dailyLog.loadAllDailyEntries.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({
        date: toISODate(`2026-03-0${index + 2}`),
        flowId: null,
        moodId: null,
        symptomIds: ['cramps'],
      }))
    );

    const screen = await render(<ExportScreen />);

    await fireEvent.press(screen.getByLabelText(exportMessages.en.pdfButtonLabel));

    await waitFor(() => {
      expect(pdfShare.sharePdfFile).toHaveBeenCalledTimes(1);
    });

    expect(pdfShare.sharePdfFile.mock.calls[0][0].html).toContain('Cramps — 5 days');
  });

  it('builds the file in the language the app is in', async () => {
    const screen = await render(<ExportScreen />);

    await fireEvent.press(screen.getByLabelText(exportMessages.en.summaryButtonLabel));

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

    await fireEvent.press(screen.getByLabelText(exportMessages.en.summaryButtonLabel));

    await waitFor(() => {
      expect(screen.getByText(exportMessages.en.sharingUnavailableMessage)).toBeTruthy();
    });
  });

  it('says so when the share fails', async () => {
    share.shareTextFile.mockRejectedValue(new Error('nope'));

    const screen = await render(<ExportScreen />);

    await fireEvent.press(screen.getByLabelText(exportMessages.en.summaryButtonLabel));

    await waitFor(() => {
      expect(screen.getByText(exportMessages.en.shareFailedMessage)).toBeTruthy();
    });
  });

  it('shares nothing at all when there is nothing recorded', async () => {
    cycle.loadCycleProfile.mockResolvedValue(null);

    const screen = await render(<ExportScreen />);

    await fireEvent.press(screen.getByLabelText(exportMessages.en.summaryButtonLabel));

    await waitFor(() => {
      expect(screen.getByText(exportMessages.en.emptyMessage)).toBeTruthy();
    });

    expect(share.shareTextFile).not.toHaveBeenCalled();
  });
});

/**
 * The busy text belongs to whichever export is running.
 *
 * `isBusy` was one boolean for the screen and the busy text was written onto
 * the summary button, so pressing "Share the raw data (CSV)" made the *other*
 * button read "Preparing…" while the CSV button looked idle. Found on a
 * device; nothing here saw it, because both buttons were present and correct
 * and only the words on them were swapped.
 *
 * The lock stays screen-wide - both reads hit the same database and both end
 * in a share sheet - so both buttons still disable together. Only the label
 * knows which one is working.
 */
describe('which button says it is working', () => {
  /** Holds the share open so the busy state can be observed mid-flight. */
  function shareThatNeverFinishes() {
    let release: () => void = () => {};

    share.shareTextFile.mockImplementation(
      () => new Promise<void>((resolve) => { release = () => resolve(); })
    );

    return () => release();
  }

  it('is the summary button when the summary is being prepared', async () => {
    const release = shareThatNeverFinishes();
    const screen = await render(<ExportScreen />);

    await fireEvent.press(screen.getByLabelText(exportMessages.en.summaryButtonLabel));

    await waitFor(() => {
      expect(screen.getByText(exportMessages.en.preparingMessage)).toBeTruthy();
    });

    // And the other button is still itself.
    expect(screen.getByText(exportMessages.en.csvButtonText)).toBeTruthy();

    await act(async () => {
      release();
    });
  });

  it('is the CSV button when the CSV is being prepared', async () => {
    // The defect, exactly: this used to put "Preparing…" on the summary.
    const release = shareThatNeverFinishes();
    const screen = await render(<ExportScreen />);

    await fireEvent.press(screen.getByLabelText(exportMessages.en.csvButtonLabel));

    await waitFor(() => {
      expect(screen.getByText(exportMessages.en.preparingMessage)).toBeTruthy();
    });

    expect(screen.getByText(exportMessages.en.summaryButtonText)).toBeTruthy();

    await act(async () => {
      release();
    });
  });

  it('never says it twice', async () => {
    const release = shareThatNeverFinishes();
    const screen = await render(<ExportScreen />);

    await fireEvent.press(screen.getByLabelText(exportMessages.en.csvButtonLabel));

    await waitFor(() => {
      expect(screen.queryAllByText(exportMessages.en.preparingMessage)).toHaveLength(1);
    });

    await act(async () => {
      release();
    });
  });
});
