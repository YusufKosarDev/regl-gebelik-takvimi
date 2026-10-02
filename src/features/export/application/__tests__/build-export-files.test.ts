import type { SQLiteDatabase } from 'expo-sqlite';

import { exportMessages } from '../../presentation/export-messages';
import { buildExportFiles } from '../build-export-files';

import { toISODate } from '@/utils/date';

/**
 * Both export files, from one read.
 *
 * The reads are faked at the repository boundary, so `buildCloudSyncPayloadV1`,
 * the phase index, the row builder and the CSV writer all stay real - this pins
 * what somebody actually receives rather than restating the pieces.
 */

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

const cycle = jest.requireMock('@/features/cycle/data/cycle-repository');
const pregnancy = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const avatar = jest.requireMock('@/features/avatar/data/avatar-repository');
const notifications = jest.requireMock(
  '@/features/notifications/data/notification-preferences-repository'
);
const dailyLog = jest.requireMock('@/features/daily-log/data/daily-log-repository');

const db = {} as SQLiteDatabase;
const TODAY = toISODate('2026-03-20');

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

function build(language: 'tr' | 'en' = 'en') {
  return buildExportFiles(db, {
    today: TODAY,
    language,
    messages: exportMessages[language],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  cycle.loadCycleProfile.mockResolvedValue(PROFILE);
  pregnancy.loadPregnancyProfile.mockResolvedValue(null);
  avatar.loadAvatarConfig.mockResolvedValue(null);
  notifications.loadNotificationPreferences.mockResolvedValue({
    periodReminderEnabled: false,
    pregnancyWeeklyReminderEnabled: false,
  });
  dailyLog.loadAllDailyEntries.mockResolvedValue([]);
});

describe('the two files', () => {
  it('names them for the day they were taken, in the chosen language', async () => {
    const english = await build('en');
    const turkish = await build('tr');

    expect(english.summary.fileName).toBe('period-summary-2026-03-20.txt');
    expect(english.csv.fileName).toBe('period-records-2026-03-20.csv');
    expect(turkish.summary.fileName).toBe('regl-ozeti-2026-03-20.txt');
  });

  it('gives each one the type a receiving app will recognise', async () => {
    const files = await build();

    expect(files.summary.mimeType).toBe('text/plain');
    expect(files.csv.mimeType).toBe('text/csv');
  });
});

describe('the readable summary', () => {
  it('is written in the chosen language', async () => {
    const files = await build('en');

    expect(files.summary.contents).toContain(exportMessages.en.summaryHeading);
    expect(files.summary.contents).not.toContain(exportMessages.tr.summaryHeading);
  });

  it('says what the settings are and what the records measure', async () => {
    const files = await build('en');

    expect(files.summary.contents).toContain(exportMessages.en.summaryCycleLengths(28, 5));
    // One record makes no gap, so there is nothing to measure yet - and saying
    // so is better than leaving the section looking broken.
    expect(files.summary.contents).toContain(exportMessages.en.summaryNoObservations);
  });

  it('lists the periods with the dates spelled out', async () => {
    const files = await build('en');

    expect(files.summary.contents).toContain('2 March 2026');
    expect(files.summary.contents).toContain('6 March 2026');
  });

  it('ends by saying it is not a medical assessment', async () => {
    const files = await build('en');

    expect(files.summary.contents.trimEnd().endsWith(exportMessages.en.summaryFooter)).toBe(true);
  });
});

describe('the CSV', () => {
  it('starts with the machine column names', async () => {
    const files = await build();

    expect(files.csv.contents.split('\r\n')[0]).toBe(
      'date,is_period_day,period_record_id,cycle_day,phase,flow,symptoms,mood'
    );
  });

  it('has the same columns whichever language was chosen', async () => {
    // The header is what a formula or a script depends on, so it must not move
    // with the app's language.
    const english = await build('en');
    const turkish = await build('tr');

    expect(turkish.csv.contents.split('\r\n')[0]).toBe(english.csv.contents.split('\r\n')[0]);
  });

  it('covers every day from the first record to today', async () => {
    const files = await build();
    const rows = files.csv.contents.trimEnd().split('\r\n').slice(1);

    // 2 March to 20 March inclusive.
    expect(rows).toHaveLength(19);
    expect(rows[0].startsWith('2026-03-02')).toBe(true);
    expect(rows[18].startsWith('2026-03-20')).toBe(true);
  });

  it('places each day in the cycle', async () => {
    const files = await build();
    const firstRow = files.csv.contents.split('\r\n')[1].split(',');

    // 2 March is day 1 of a five-day period.
    expect(firstRow[3]).toBe('1');
    expect(firstRow[4]).toBe('menstrual');
    expect(firstRow[1]).toBe('yes');
  });

  it('carries what was logged, as stored ids', async () => {
    dailyLog.loadAllDailyEntries.mockResolvedValue([
      {
        date: toISODate('2026-03-10'),
        flowId: null,
        moodId: 'bad',
        symptomIds: ['cramps', 'headache'],
      },
    ]);

    const files = await build('tr');
    const row = files.csv.contents
      .split('\r\n')
      .find((line) => line.startsWith('2026-03-10'));

    expect(row).toContain('cramps;headache');
    expect(row).toContain('bad');
  });
});

describe('with nothing recorded', () => {
  it('says so rather than producing a file of one empty day', async () => {
    cycle.loadCycleProfile.mockResolvedValue(null);

    const files = await build();

    expect(files.isEmpty).toBe(true);
  });

  it('still produces readable files rather than throwing', async () => {
    // The screen decides whether to offer the buttons. This layer must not fall
    // over on a profile that onboarding has not written yet.
    cycle.loadCycleProfile.mockResolvedValue(null);

    const files = await build('en');

    expect(files.summary.contents).toContain(exportMessages.en.summaryNoRecords);
    expect(files.csv.contents.split('\r\n')[0]).toContain('date');
  });
});

describe('it reads once', () => {
  it('goes through the same gather the backup uses', async () => {
    // The file somebody takes away and the data the app would back up are built
    // from one read, so they cannot describe different states.
    await build();

    expect(cycle.loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(dailyLog.loadAllDailyEntries).toHaveBeenCalledTimes(1);
  });

  it('does not reorder the records it was given', async () => {
    const before = PROFILE.periodRecords.map((record) => record.id);

    await build();

    expect(PROFILE.periodRecords.map((record) => record.id)).toEqual(before);
  });
});
