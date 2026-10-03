import React from 'react';

import { useAppStore } from '@/store/app-store';
import { addDays, toISODate } from '@/utils/date';
import { getTodayLocalISODate } from '@/utils/today';

import { expectNoTurkishCatalogueText } from '../../../jest/assert-english-render';
import { renderSettled } from '../../../jest/render-settled';

/**
 * Every screen in the app, rendered on an English phone, swept for Turkish.
 *
 * ## Why one file for all of them
 *
 * `expectNoTurkishCatalogueText` knows every Turkish string in every catalogue,
 * so it catches a leak nobody thought to assert. Until now it ran on five
 * screens out of twenty-two, and both leaks that reached the shipped app were on
 * screens it did not cover - found on an emulator by eye, which is the most
 * expensive way to find a string.
 *
 * A bespoke English test per screen would be the thorough version and would also
 * be seventeen files of mock setup, which is seventeen chances to mock one thing
 * differently and then believe the result. This asks every screen the same
 * narrow question instead: *rendered in English, with nothing recorded, does any
 * Turkish appear?* The per-screen files stay where they exist and keep asserting
 * what their screen actually says; this is the floor underneath them.
 *
 * ## What it does not prove
 *
 * It renders each screen in one state: English, empty repositories, no account,
 * no pregnancy, nothing logged. A string that appears only once there are three
 * period records, or only after a failed sign-in, is not reached here. That is a
 * real limit and it is why this does not replace the per-screen tests - but the
 * first render is also where most of a screen's text lives, and it was enough to
 * catch what this file caught when it was written.
 *
 * Function-valued catalogue keys are skipped by the sweep itself, for the reason
 * written in `jest/turkish-vocabulary.ts`.
 *
 * ## The mocks
 *
 * Everything that touches a device or a network is faked and answers "nothing
 * here": no database, no account, no profile, no reminders. Nothing in `domain/`
 * or `presentation/` is mocked, because those are what is under test - the
 * screens read the real catalogues through the real `useMessages`.
 */

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }],
  getCalendars: () => [{ calendar: 'gregory', uses24hourClock: true, firstWeekday: 2 }],
}));

jest.mock('expo-router', () => require('../../../jest/expo-router-mock'));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('../../../jest/async-storage-mock')
);

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/storage/app-state-storage', () => ({
  loadAppState: jest.fn(),
  saveAppState: jest.fn(),
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
  loadAllDailyEntries: jest.fn(),
  loadDailyEntry: jest.fn(),
  saveDailyEntry: jest.fn(),
  clearDailyEntry: jest.fn(),
  replaceDailyEntries: jest.fn(),
}));

jest.mock('@/features/notifications/data/notification-preferences-repository', () => ({
  loadNotificationPreferences: jest.fn(),
  saveNotificationPreferences: jest.fn(),
  loadDiscreetNotifications: jest.fn(),
  saveDiscreetNotifications: jest.fn(),
}));

jest.mock('@/features/auth/data/auth-repository', () => ({
  observeCurrentUser: jest.fn(),
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
  reauthenticate: jest.fn(),
  sendPasswordReset: jest.fn(),
}));

jest.mock('@/features/auth/infrastructure/firebase', () => ({
  isFirebaseConfigured: jest.fn(() => false),
  getFirebaseAuth: jest.fn(),
  getFirestore: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocFromServer: jest.fn(),
  deleteDoc: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
  getFirestore: jest.fn(),
}));

jest.mock('@/features/app-lock/infrastructure/biometrics', () => ({
  canUseBiometrics: jest.fn(),
  promptForBiometrics: jest.fn(),
}));

jest.mock('@/features/app-lock/infrastructure/screen-privacy', () => ({
  isScreenPrivacyAvailable: jest.fn(() => true),
  applyScreenPrivacy: jest.fn(),
  blocksScreenshots: jest.fn(() => true),
}));

jest.mock('@/features/sync/application/use-automatic-sync', () => ({
  useAutomaticSync: jest.fn(),
  currentUidOrNull: jest.fn(() => null),
}));

jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshot: jest.fn(),
}));

jest.mock('@/features/notifications/infrastructure/notification-permission', () => ({
  ensureNotificationPermission: jest.fn(),
}));

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

const db = jest.requireMock('@/storage/db');
const appState = jest.requireMock('@/storage/app-state-storage');
const cycle = jest.requireMock('@/features/cycle/data/cycle-repository');
const pregnancy = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const avatar = jest.requireMock('@/features/avatar/data/avatar-repository');
const dailyLog = jest.requireMock('@/features/daily-log/data/daily-log-repository');
const notifications = jest.requireMock(
  '@/features/notifications/data/notification-preferences-repository'
);
const auth = jest.requireMock('@/features/auth/data/auth-repository');
const biometrics = jest.requireMock('@/features/app-lock/infrastructure/biometrics');

beforeEach(() => {
  jest.clearAllMocks();

  getTodayMock.mockReturnValue(TODAY);
  db.openAppDatabase.mockResolvedValue({});
  appState.loadAppState.mockResolvedValue(null);
  appState.saveAppState.mockResolvedValue(undefined);

  cycle.loadCycleProfile.mockResolvedValue(null);
  pregnancy.loadPregnancyProfile.mockResolvedValue(null);
  avatar.loadAvatarConfig.mockResolvedValue(null);
  dailyLog.loadAllDailyEntries.mockResolvedValue([]);
  dailyLog.loadDailyEntry.mockResolvedValue({
    date: toISODate('2026-03-20'),
    flowId: null,
    moodId: null,
    symptomIds: [],
  });

  notifications.loadNotificationPreferences.mockResolvedValue({
    periodReminderEnabled: false,
    pregnancyWeeklyReminderEnabled: false,
  });
  notifications.loadDiscreetNotifications.mockResolvedValue(false);

  // Nobody is signed in, and the observer never fires.
  auth.observeCurrentUser.mockImplementation(() => () => undefined);

  biometrics.canUseBiometrics.mockResolvedValue(false);
});

/**
 * The screens, named as a person would name them.
 *
 * `require`d inside each case rather than imported at the top, so one screen
 * that cannot even be loaded fails its own case instead of taking the file
 * down with it - which is the difference between "the lock screen is broken"
 * and "the sweep is broken".
 */
const SCREENS: readonly [string, () => React.ComponentType][] = [
  ['the home screen', () => require('@/app/(app)/index').default],
  ['the history screen', () => require('@/app/(app)/history').default],
  ['the settings screen', () => require('@/app/(app)/settings').default],
  ['the account screen', () => require('@/app/(app)/account').default],
  ['the about screen', () => require('@/app/(app)/about').default],
  ['the app lock screen', () => require('@/app/(app)/app-lock').default],
  ['the avatar screen', () => require('@/app/(app)/avatar').default],
  ['the daily entry screen', () => require('@/app/(app)/daily-entry').default],
  ['the daily log history screen', () => require('@/app/(app)/daily-log-history').default],
  ['the export screen', () => require('@/app/(app)/export').default],
  ['the pregnancy settings screen', () => require('@/app/(app)/pregnancy-settings').default],
  ['the pregnancy start screen', () => require('@/app/(app)/pregnancy-start').default],
  ['the sync conflict screen', () => require('@/app/(app)/sync-conflict').default],
  ['the lock screen', () => require('@/app/(lock)/index').default],
  ['the lock recovery screen', () => require('@/app/(lock)/recover').default],
  ['the onboarding welcome screen', () => require('@/app/(onboarding)/index').default],
  ['the onboarding disclaimer screen', () => require('@/app/(onboarding)/disclaimer').default],
  ['the onboarding last period screen', () => require('@/app/(onboarding)/last-period').default],
  [
    'the onboarding cycle settings screen',
    () => require('@/app/(onboarding)/cycle-settings').default,
  ],
  [
    'the onboarding period length screen',
    () => require('@/app/(onboarding)/period-length').default,
  ],
  ['the onboarding review screen', () => require('@/app/(onboarding)/review').default],
  ['the onboarding finish screen', () => require('@/app/(onboarding)/finish').default],
  ['the not-found screen', () => require('@/app/+not-found').default],
];

const TODAY = toISODate('2026-03-20');

const getTodayMock = getTodayLocalISODate as unknown as jest.Mock;

/**
 * A cycle with enough history for the screens to have something to say.
 *
 * Four starts at 29, 31 and 30 days: three gaps, which is the minimum the
 * outlook needs before it offers a suggestion, and uneven enough that the
 * regularity and the ranged prediction are both reached rather than skipped.
 */
const PROFILE_WITH_RECORDS = {
  settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
  periodRecords: [
    { id: 'period-1', startDate: toISODate('2026-01-05'), endDate: toISODate('2026-01-10'), isOngoing: false },
    { id: 'period-2', startDate: addDays(toISODate('2026-01-05'), 29), endDate: addDays(toISODate('2026-01-05'), 34), isOngoing: false },
    { id: 'period-3', startDate: addDays(toISODate('2026-01-05'), 60), endDate: addDays(toISODate('2026-01-05'), 65), isOngoing: false },
    { id: 'period-4', startDate: addDays(toISODate('2026-01-05'), 90), isOngoing: false },
  ],
};

/** Week 11 or so on the fixed today, which is inside the weekly content. */
const PREGNANCY = {
  lastMenstrualPeriodStartDate: toISODate('2026-01-05'),
  estimatedDueDate: toISODate('2026-10-12'),
  dueDateSource: 'lmp' as const,
};

const AVATAR = {
  skinToneId: 'skin-tone-4',
  hairStyleId: 'long',
  hairColorId: 'brown',
  outfitId: 'dress',
  accessoryId: 'glasses',
};

const DAILY_ENTRIES = [
  { date: toISODate('2026-03-18'), flowId: 'medium', moodId: 'calm', symptomIds: ['cramps'] },
  { date: toISODate('2026-03-19'), flowId: 'light', moodId: null, symptomIds: [] },
];

describe('no screen shows Turkish on an English phone', () => {
  it.each(SCREENS)('%s', async (_name, load) => {
    const Screen = load();

    const screen = await renderSettled(<Screen />);

    expectNoTurkishCatalogueText(screen);
  });

  it('covers every screen in src/app', () => {
    // The list above is written by hand, so this is what stops a screen added
    // next year from being quietly outside the sweep. Layouts and the error
    // boundary are not screens; they have their own tests.
    const { readdirSync } = require('fs');
    const { join } = require('path');

    const appDir = join(__dirname, '..');

    const routes = ['(app)', '(lock)', '(onboarding)']
      .flatMap((group) =>
        readdirSync(join(appDir, group))
          .filter((file: string) => file.endsWith('.tsx') && !file.startsWith('_'))
          .map((file: string) => `${group}/${file}`)
      )
      .concat(['+not-found.tsx']);

    expect(routes).toHaveLength(SCREENS.length);
  });
});

/**
 * The same sweep with something recorded, which is where the leaks actually are.
 *
 * ## Why the empty pass above is not enough
 *
 * The delete button that read "Sil" in English (a3d7b13) is rendered once per
 * period record. On a screen with no records it does not exist, so an empty
 * render cannot see it - and that bug is the exact reason this file was asked
 * for. A sweep that could not have caught the bug it was written for would be
 * reassurance rather than a test.
 *
 * So: four period records, a tracked pregnancy, a saved avatar, two logged days
 * and a signed-in account. Both modes of the home screen, because the pregnancy
 * half is a different tree.
 *
 * ## What is still out of reach
 *
 * Text assembled at render time. The pregnancy week stepper that read
 * "9. hafta" (eb40d1b) was the JSX `{shownWeek}. hafta`, which is not a
 * catalogue value and never will be in the vocabulary - the sweep matches whole
 * node text against strings that exist in a catalogue. That half is covered by
 * `pregnancy-section-english`, which names the string, and the limit is stated
 * in `jest/turkish-vocabulary.ts`. Of the two shipped leaks this file can catch
 * one; the other needed a test that knew what to look for.
 */
describe('no screen shows Turkish once something is recorded', () => {
  beforeEach(() => {
    cycle.loadCycleProfile.mockResolvedValue(PROFILE_WITH_RECORDS);
    pregnancy.loadPregnancyProfile.mockResolvedValue(PREGNANCY);
    avatar.loadAvatarConfig.mockResolvedValue(AVATAR);
    dailyLog.loadAllDailyEntries.mockResolvedValue(DAILY_ENTRIES);
    dailyLog.loadDailyEntry.mockResolvedValue(DAILY_ENTRIES[0]);

    notifications.loadNotificationPreferences.mockResolvedValue({
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: true,
    });
    notifications.loadDiscreetNotifications.mockResolvedValue(true);

    auth.observeCurrentUser.mockImplementation((listener: (user: unknown) => void) => {
      listener({ uid: 'uid-1', email: 'somebody@example.com', emailVerified: true });

      return () => undefined;
    });
  });

  it.each(SCREENS)('%s', async (_name, load) => {
    const Screen = load();

    const screen = await renderSettled(<Screen />);

    expectNoTurkishCatalogueText(screen);
  });

  it('the home screen in pregnancy mode', async () => {
    useAppStore.setState({ mode: 'pregnancy', onboardingCompleted: true, hydrated: true });

    const HomeScreen = require('@/app/(app)/index').default;

    const screen = await renderSettled(<HomeScreen />);

    expectNoTurkishCatalogueText(screen);
  });
});
