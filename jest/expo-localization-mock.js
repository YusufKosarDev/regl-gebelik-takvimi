// The suite runs on a Turkish phone.
//
// ## Why this file exists
//
// `jest-expo` does not leave `expo-localization` empty. It ships a complete
// fake device, and that device is American: `en-US`, `America/New_York`,
// Sunday-first, 24-hour. Measured, not assumed — `src/i18n/__tests__/
// jest-environment-language.test.ts` pins those values and explains them.
//
// Without this file, `resolveLanguage` would correctly read that device as
// English, and every screen converted to `useMessages()` would render English
// into a suite whose assertions are Turkish. There are roughly 2,250 of those:
// `getByLabelText('Bugünü kaydet')` and its kin, spread across every feature.
// Adding English would mean rewriting all of them, which is precisely what the
// staged migration exists to avoid.
//
// ## Why it is a device mock and not something in the app
//
// The alternative was to teach `resolveLanguage` that `'en'` sometimes means
// Turkish. That would put a lie in production code to suit a test runner, and
// it would be wrong for every real phone. This works through the mechanism
// that should win — what the device reports — and leaves the resolver honest.
//
// ## What this does and does not cover
//
// It makes *rendering* Turkish. It does not make the English catalogues
// untested: the per-feature parity tests call both catalogues directly, and any
// test that wants English overrides this mock locally, as
// `src/i18n/__tests__/use-language.test.ts` does.
//
// It does mean a screen that ignored `useMessages()` and hard-coded Turkish
// would still pass here. The ESLint rule that forbids Turkish string literals
// outside a presentation catalogue is what catches that, and it is why that
// rule is not optional.
//
// The calendar values are the Turkish device's, not jest-expo's: Monday-first
// and a 24-hour clock.
jest.mock('expo-localization', () => ({
  getLocales: () => [
    {
      languageTag: 'tr-TR',
      languageCode: 'tr',
      languageScriptCode: 'Latn',
      regionCode: 'TR',
      languageRegionCode: 'TR',
      currencyCode: 'TRY',
      currencySymbol: '₺',
      languageCurrencyCode: 'TRY',
      languageCurrencySymbol: '₺',
      decimalSeparator: ',',
      digitGroupingSeparator: '.',
      textDirection: 'ltr',
      measurementSystem: 'metric',
      temperatureUnit: 'celsius',
    },
  ],
  getCalendars: () => [
    {
      calendar: 'gregory',
      uses24hourClock: true,
      // Monday. The app ships Monday-first in both languages for now; when the
      // calendar grid starts following the device, this is the value its tests
      // will be reading.
      firstWeekday: 2,
      timeZone: 'Europe/Istanbul',
    },
  ],
  useLocales: () => [{ languageTag: 'tr-TR', languageCode: 'tr' }],
  useCalendars: () => [{ calendar: 'gregory', uses24hourClock: true, firstWeekday: 2 }],
}));
