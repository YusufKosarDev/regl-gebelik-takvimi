import type { Messages } from '@/i18n';

/**
 * The four words at the bottom of the screen.
 *
 * These belong to the app rather than to a feature, by the test `app-messages`
 * sets: the bar names one screen from the cycle feature, two more from it and
 * one from settings, so no single feature owns the set. They are here rather
 * than in `app-messages` because they are one thing - the navigation - and a
 * file that holds the back button, the error screen and the language setting
 * is already general enough without the map of the app going into it too.
 *
 * ## One word each
 *
 * A tab label is read in the corner of the eye while the thumb is already
 * moving, so each is the plainest noun for the screen behind it. Nothing is
 * "Döngü Takvimi" or "Regl Geçmişi": the bar is four words and the longest one
 * decides how wide every tab has to be.
 *
 * `profileLabel` names a tab that today opens the settings screen. The name is
 * for the question the tab answers - who am I, and where are my settings -
 * rather than for what happens to be under it at this stage.
 */

const tabMessagesTr = {
  /** Where am I in the cycle. The home screen. */
  cycleLabel: 'Döngü',

  /** What is coming. The month grid. */
  calendarLabel: 'Takvim',

  /** What happened. Period records, and in time the patterns in them. */
  historyLabel: 'Geçmiş',

  /** Who am I, and where are my settings. */
  profileLabel: 'Profil',
};

export type TabMessages = typeof tabMessagesTr;

const tabMessagesEn: TabMessages = {
  cycleLabel: 'Cycle',
  calendarLabel: 'Calendar',
  historyLabel: 'History',
  profileLabel: 'Profile',
};

export const tabMessages: Messages<TabMessages> = { tr: tabMessagesTr, en: tabMessagesEn };
