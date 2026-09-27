import { getCalendars, getLocales } from 'expo-localization';

import { getDeviceLanguageCode } from '../device-locale';
import { resolveLanguage } from '../language';
import { useLanguage } from '../use-language';

import { renderHook } from '@testing-library/react-native';

/**
 * What the suite itself runs on, asserted rather than assumed.
 *
 * ## Why this file exists
 *
 * Roughly 2,250 assertions in this repository are written against Turkish text
 * — `getByLabelText('Bugünü kaydet')` and its kin. Adding English only works
 * without rewriting them if the app resolves to Turkish under Jest.
 *
 * It does not do that on its own. `jest-expo` provides a complete fake device
 * and that device is American: `en-US`, `America/New_York`, Sunday-first,
 * 24-hour. Measured during the scaffolding stage, not guessed. Left alone,
 * `resolveLanguage` would read it as English — correctly — and every converted
 * screen would render English into a Turkish suite.
 *
 * `jest/expo-localization-mock.js`, wired in through `setupFiles`, replaces
 * that device with a Turkish one. It carries the full reasoning; this file is
 * the tripwire that proves it is still in effect.
 *
 * If somebody removes the `setupFiles` entry, or `jest-expo` changes what it
 * ships, these three tests fail with one sentence each — instead of two
 * thousand assertions failing at once with no visible cause. That is the whole
 * job of this file.
 *
 * It deliberately does **not** call `jest.mock` itself. Mocking here would test
 * the mock and hide exactly what it is watching for.
 */
describe('the device the suite runs on', () => {
  it('is Turkish, because the setup file replaces jest-expo default of en-US', () => {
    expect(getLocales()[0].languageTag).toBe('tr-TR');
    expect(getLocales()[0].languageCode).toBe('tr');
  });

  /**
   * Recorded because the calendar grid and any future time formatting read
   * these, and because jest-expo's own defaults differ on both counts —
   * Sunday-first rather than Monday, in `America/New_York`.
   *
   * The app ships Monday-first in both languages for now. When the grid starts
   * following the device, `firstWeekday: 2` is the value its tests will read,
   * and a test wanting Sunday-first will have to say so locally.
   */
  it('has a Monday-first, 24-hour calendar', () => {
    expect(getCalendars()[0].uses24hourClock).toBe(true);
    expect(getCalendars()[0].firstWeekday).toBe(2);
  });
});

describe('what that means for the language under test', () => {
  it('reads as Turkish through the device, not through a special case', () => {
    // The resolver is untouched: it sees 'tr' and answers 'tr', exactly as it
    // would on a real Turkish phone. Nothing here teaches it that 'en'
    // sometimes means Turkish.
    expect(getDeviceLanguageCode()).toBe('tr');
    expect(resolveLanguage('system', getDeviceLanguageCode())).toBe('tr');
  });

  it('renders Turkish, which is what keeps the Turkish assertions passing', async () => {
    const { result } = await renderHook(() => useLanguage());

    expect(result.current).toBe('tr');
  });

  it('still lets a test ask for English by overriding the device locally', () => {
    // The English catalogues are not untested: parity tests call them
    // directly, and a test that wants English rendering mocks the device for
    // itself, as use-language.test.ts does.
    expect(resolveLanguage('system', 'en')).toBe('en');
    expect(resolveLanguage('en', 'tr')).toBe('en');
  });
});
