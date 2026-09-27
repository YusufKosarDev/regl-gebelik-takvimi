import { getCalendars, getLocales } from 'expo-localization';

import { getDeviceLanguageCode } from '../device-locale';
import { resolveLanguage } from '../language';

/**
 * What the suite itself runs on, asserted rather than assumed.
 *
 * ## Why this file exists
 *
 * Roughly two thousand assertions in this repository are written against
 * Turkish text — `getByText('Bugünü kaydet')` and its kin. The plan for adding
 * English rests on them all continuing to pass untouched, which requires the
 * app to resolve to Turkish under Jest.
 *
 * It does not. `jest-expo` does not leave `expo-localization` empty: it
 * provides a complete fake device, and that device is American. The values
 * below are measured, not guessed.
 *
 * So `getDeviceLanguageCode()` returns `'en'` here, and a screen that asked
 * `useMessages()` would render English to a suite that expects Turkish. That is
 * a decision for the project, not something to paper over inside these
 * functions — `resolveLanguage` reading `'en'` as English is correct behaviour
 * and must not be bent to suit a test runner.
 *
 * This file pins the two facts that matter. If `jest-expo` ever changes what it
 * provides, this fails on its own with one clear sentence instead of two
 * thousand assertions failing at once for no visible reason.
 *
 * Deliberately does **not** mock `expo-localization`: mocking it here would
 * test the mock and hide the thing this file is for.
 */
describe('the device jest-expo pretends to be', () => {
  it('is American English, not an absent device', () => {
    expect(getLocales()[0].languageTag).toBe('en-US');
    expect(getLocales()[0].languageCode).toBe('en');
  });

  it('has a calendar, a clock and a first weekday too', () => {
    // Recorded because the calendar grid and any future time formatting read
    // these. Note `firstWeekday: 1` — Sunday — while the app ships
    // Monday-first in both languages for now.
    expect(getCalendars()[0].uses24hourClock).toBe(true);
    expect(getCalendars()[0].firstWeekday).toBe(1);
  });
});

describe('what that means for the language under test', () => {
  it('reads as English, which is the problem to solve above this module', () => {
    expect(getDeviceLanguageCode()).toBe('en');
    expect(resolveLanguage('system', getDeviceLanguageCode())).toBe('en');
  });

  /**
   * The escape hatch that does exist, and the one the fix should use.
   *
   * A stored preference beats the device. Whatever mechanism ends up forcing
   * Turkish for the suite, it should work through this rather than by teaching
   * `resolveLanguage` that `'en'` sometimes means Turkish.
   */
  it('is overridden by a stored preference, device or no device', () => {
    expect(resolveLanguage('tr', getDeviceLanguageCode())).toBe('tr');
  });
});
