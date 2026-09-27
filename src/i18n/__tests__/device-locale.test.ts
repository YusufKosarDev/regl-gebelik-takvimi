import {
  getDeviceFirstWeekday,
  getDeviceLanguageCode,
  getDeviceUses24HourClock,
} from '../device-locale';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
  getCalendars: jest.fn(),
}));

const localization = jest.requireMock('expo-localization');

beforeEach(() => {
  localization.getLocales.mockReset();
  localization.getCalendars.mockReset();
  localization.getLocales.mockReturnValue([{ languageCode: 'tr', languageTag: 'tr-TR' }]);
  localization.getCalendars.mockReturnValue([{ uses24hourClock: true, firstWeekday: 2 }]);
});

describe('getDeviceLanguageCode', () => {
  it('reads the first locale', () => {
    expect(getDeviceLanguageCode()).toBe('tr');
  });

  it('passes a code it does not know straight through', () => {
    // This module reports; deciding what a code means belongs to resolveLanguage.
    localization.getLocales.mockReturnValue([{ languageCode: 'de' }]);

    expect(getDeviceLanguageCode()).toBe('de');
  });

  it.each([
    ['a null code', [{ languageCode: null }]],
    ['an empty list', []],
  ])('says it does not know for %s', (_name, locales) => {
    localization.getLocales.mockReturnValue(locales);

    expect(getDeviceLanguageCode()).toBeNull();
  });

  /**
   * A native module that cannot be reached must not stop the app starting.
   *
   * This runs during the first render. `null` here means "the device did not
   * say", which `resolveLanguage` reads as the source language.
   */
  it('says it does not know rather than throwing', () => {
    localization.getLocales.mockImplementation(() => {
      throw new Error('native module unavailable');
    });

    expect(getDeviceLanguageCode()).toBeNull();
  });
});

describe('getDeviceUses24HourClock', () => {
  it('reads the first calendar', () => {
    expect(getDeviceUses24HourClock()).toBe(true);
  });

  it('reports a twelve-hour clock as false, not as unknown', () => {
    localization.getCalendars.mockReturnValue([{ uses24hourClock: false }]);

    expect(getDeviceUses24HourClock()).toBe(false);
  });

  it.each([
    ['a null value', [{ uses24hourClock: null }]],
    ['an empty list', []],
  ])('says it does not know for %s', (_name, calendars) => {
    localization.getCalendars.mockReturnValue(calendars);

    expect(getDeviceUses24HourClock()).toBeNull();
  });

  it('says it does not know rather than throwing', () => {
    localization.getCalendars.mockImplementation(() => {
      throw new Error('native module unavailable');
    });

    expect(getDeviceUses24HourClock()).toBeNull();
  });
});

describe('getDeviceFirstWeekday', () => {
  it('reads the first calendar', () => {
    expect(getDeviceFirstWeekday()).toBe(2);
  });

  it.each([
    ['a null value', [{ firstWeekday: null }]],
    ['an empty list', []],
  ])('says it does not know for %s', (_name, calendars) => {
    localization.getCalendars.mockReturnValue(calendars);

    expect(getDeviceFirstWeekday()).toBeNull();
  });

  it('says it does not know rather than throwing', () => {
    localization.getCalendars.mockImplementation(() => {
      throw new Error('native module unavailable');
    });

    expect(getDeviceFirstWeekday()).toBeNull();
  });
});

describe('what this module is allowed to ask for', () => {
  /**
   * Three facts and no more.
   *
   * `getLocales()` also carries a region, a currency, a decimal separator and a
   * measurement system. None of those are things this app should start reading
   * without deciding to, and the honest place to notice that is here.
   */
  it('reads nothing beyond the language, the clock and the first weekday', () => {
    getDeviceLanguageCode();
    getDeviceUses24HourClock();
    getDeviceFirstWeekday();

    expect(localization.getLocales).toHaveBeenCalledTimes(1);
    expect(localization.getCalendars).toHaveBeenCalledTimes(2);
  });

  it('asks for nothing at all by being imported', () => {
    // Importing a module should not reach a native surface. The counts above
    // are only meaningful if nothing happened before them.
    jest.resetModules();
    localization.getLocales.mockClear();
    localization.getCalendars.mockClear();

    jest.requireActual('../device-locale');

    expect(localization.getLocales).not.toHaveBeenCalled();
    expect(localization.getCalendars).not.toHaveBeenCalled();
  });
});
