import { act, render } from '@testing-library/react-native';
import { formatDisplayDate } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';
import React from 'react';

import DailyEntryScreen from '@/app/(app)/daily-entry';

/**
 * The same screen, on an English phone.
 *
 * ## Why this is a separate file
 *
 * `daily-entry-screen.test.tsx` beside it asserts Turkish, as does most of this
 * repository. Those assertions are the thing the whole migration is built to
 * leave alone, so English gets its own file rather than a second describe block
 * inside theirs — nothing existing is edited, and the two can never interfere.
 *
 * ## What it actually proves
 *
 * That the chain works end to end: a device reporting English reaches
 * `resolveLanguage`, which reaches `useMessages`, which reaches this screen and
 * the catalogue labels inside it. The per-catalogue tests check the words; this
 * checks that the words arrive.
 *
 * The device is overridden here rather than globally. `jest/expo-localization-mock.js`
 * pins the suite to a Turkish phone; this file says otherwise for itself, which
 * is the escape hatch that mock documents.
 */

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }],
  getCalendars: () => [{ calendar: 'gregory', uses24hourClock: true, firstWeekday: 2 }],
}));

jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(async () => ({}) as unknown),
}));

jest.mock('@/features/daily-log/data/daily-log-repository', () => ({
  loadDailyEntry: jest.fn(),
  saveDailyEntry: jest.fn(),
  deleteDailyEntry: jest.fn(),
}));

const repository = jest.requireMock('@/features/daily-log/data/daily-log-repository');

beforeEach(() => {
  repository.loadDailyEntry.mockReset();
  repository.loadDailyEntry.mockResolvedValue({
    date: '2026-10-14',
    flowId: null,
    symptomIds: [],
    moodId: null,
  });
});

async function renderScreen() {
  const view = await render(<DailyEntryScreen />);

  await act(async () => {});

  return view;
}

describe('the daily entry screen in English', () => {
  it('titles itself and its three sections in English', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('Daily record')).toBeTruthy();
    expect(screen.getByText('Flow')).toBeTruthy();
    expect(screen.getByText('Symptoms')).toBeTruthy();
    expect(screen.getByText('Mood')).toBeTruthy();
  });

  it('offers the catalogue choices in English', async () => {
    // The labels come from the presentation catalogue keyed by the domain's
    // ids, so this is the proof that the id-to-word lookup is wired up.
    const screen = await renderScreen();

    expect(screen.getByText('Spotting')).toBeTruthy();
    expect(screen.getByText('Heavy')).toBeTruthy();
    expect(screen.getByText('Trouble sleeping')).toBeTruthy();
    expect(screen.getByText('Very good')).toBeTruthy();
  });

  it('names its buttons in English', async () => {
    const screen = await renderScreen();

    expect(screen.getByLabelText('Save')).toBeTruthy();
  });

  /**
   * The date, now that the date-formatting stage has landed.
   *
   * This assertion used to say the opposite. It named `27 Eylül 2026` as
   * something the daily log does not own and a later stage would fix, so that
   * a half-translated screen could not look finished. That stage is this one:
   * `utils/format-date.ts` has an English table and takes the language, so the
   * line flips from "still Turkish" to "English, and no longer Turkish".
   *
   * Both halves are asserted on purpose. Checking only for `September` would
   * still pass if the screen somehow rendered the date twice.
   */
  it('shows the date in English', async () => {
    // Asserted against today rather than against a month name. The screen shows
    // the day it was opened on, so naming one month made this pass for four
    // weeks a year and fail for the rest - which is exactly the kind of test
    // that gets deleted rather than understood.
    const screen = await renderScreen();
    const today = getTodayLocalISODate();

    expect(screen.getByText(formatDisplayDate(today, 'en'))).toBeTruthy();
    expect(screen.queryByText(formatDisplayDate(today, 'tr'))).toBeNull();
  });

  /**
   * The back label, now that the shared strings have converted.
   *
   * This is the second and last of the two assertions that named something on
   * this screen as still Turkish. Both have now flipped, which means the screen
   * is finished: every word on it, including the ones it does not own, is in
   * the language the reader asked for.
   *
   * What is left is the blunt check below, which is what this file was always
   * going to end up as.
   */
  it('shows the back label in English', async () => {
    const screen = await renderScreen();

    expect(screen.getByLabelText('Back')).toBeTruthy();
    expect(screen.queryByLabelText('Geri')).toBeNull();
  });

  it('shows no Turkish anywhere on the screen', async () => {
    // Not "nothing the daily log owns" any more. Nothing at all.
    const screen = await renderScreen();

    expect(JSON.stringify(screen.toJSON())).not.toMatch(/[ğüşıöçĞÜŞİÖÇ]/);
  });

  it('shows no Turkish in anything the daily log itself owns', async () => {
    const screen = await renderScreen();
    const tree = JSON.stringify(screen.toJSON());

    // Everything this feature renders, in English, with no stray source string.
    for (const word of ['Daily record', 'Flow', 'Symptoms', 'Mood', 'Spotting', 'Very good']) {
      expect(tree).toContain(word);
    }

    for (const source of ['Günlük kayıt', 'Akış', 'Belirtiler', 'Ruh hali', 'Leke', 'Çok iyi']) {
      expect(tree).not.toContain(source);
    }
  });
});
