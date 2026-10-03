import {
  appMessages,
  BACK_LABEL,
  CANCEL_LABEL,
  ERROR_BODY,
  ERROR_RETRY_LABEL,
  ERROR_TITLE,
  LOADING_MESSAGE,
  NOT_FOUND_BODY,
  NOT_FOUND_HOME_LABEL,
  NOT_FOUND_TITLE,
  SAVE_LABEL,
  SAVING_LABEL,
} from '../app-messages';

/**
 * The two catalogues held to each other.
 *
 * The compiler already refuses a missing or misspelled key - the English is
 * typed against the Turkish. These tests cover what types cannot see: a value
 * copied from the other language and never translated.
 *
 * The second block is about this file specifically. Every string here is
 * reached by name from a dozen screens and from a few hundred assertions, so
 * the crutch exports have to keep meaning what they meant.
 */

describe('key parity', () => {
  /**
   * Stated even though `AppMessages` already enforces it.
   *
   * The type is the backstop and this is the intent. If somebody later loosens
   * the English side to a `Record<string, string>`, the compiler stops caring
   * and this does not.
   */
  it('the two catalogues have the same keys', () => {
    expect(Object.keys(appMessages.en).sort()).toEqual(Object.keys(appMessages.tr).sort());
  });

  it('every value is a plain string in both languages', () => {
    // Nothing here takes an argument, and nothing here should: these are the
    // words that belong to no feature, so none of them has anything to
    // interpolate. A function appearing would mean something feature-shaped
    // had drifted in.
    for (const key of Object.keys(appMessages.tr)) {
      expect(typeof appMessages.tr[key as keyof typeof appMessages.tr]).toBe('string');
      expect(typeof appMessages.en[key as keyof typeof appMessages.en]).toBe('string');
    }
  });

  it('no value is blank in either language', () => {
    for (const catalogue of [appMessages.tr, appMessages.en]) {
      for (const [key, value] of Object.entries(catalogue)) {
        expect([key, value.trim()]).not.toEqual([key, '']);
      }
    }
  });
});

/**
 * The two language names are the one pair that is meant to be identical, and
 * they carry a Turkish letter on purpose: somebody looking for their own
 * language should find it written the way they write it.
 */
const IDENTICAL = ['languageNameTurkish', 'languageNameEnglish'];

describe('no Turkish left in the English', () => {
  it('has none in any value', () => {
    for (const [key, value] of Object.entries(appMessages.en)) {
      if (IDENTICAL.includes(key)) continue;

      expect([key, value]).toEqual([key, expect.not.stringMatching(/[ğüşıöçĞÜŞİÖÇ]/)]);
    }
  });

  it('says something different from the Turkish for every key', () => {
    // The copy-paste detector. Every one of these is a word or a sentence that
    // differs between the two languages, so an English value equal to its
    // Turkish counterpart is a value somebody forgot.
    for (const key of Object.keys(appMessages.tr) as (keyof typeof appMessages.tr)[]) {
      if (IDENTICAL.includes(key)) continue;

      expect([key, appMessages.en[key]]).not.toEqual([key, appMessages.tr[key]]);
    }
  });
});

describe('the crutch exports', () => {
  /**
   * These are what a few hundred existing assertions name.
   *
   * They have to stay the Turkish values, and they have to stay attached to the
   * catalogue rather than being retyped beside it - a second copy would let the
   * two drift, which is the whole failure this file's shape exists to prevent.
   */
  it.each<[string, string, keyof typeof appMessages.tr]>([
    ['BACK_LABEL', BACK_LABEL, 'backLabel'],
    ['LOADING_MESSAGE', LOADING_MESSAGE, 'loadingMessage'],
    ['SAVE_LABEL', SAVE_LABEL, 'saveLabel'],
    ['SAVING_LABEL', SAVING_LABEL, 'savingLabel'],
    ['CANCEL_LABEL', CANCEL_LABEL, 'cancelLabel'],
    ['ERROR_TITLE', ERROR_TITLE, 'errorTitle'],
    ['ERROR_BODY', ERROR_BODY, 'errorBody'],
    ['ERROR_RETRY_LABEL', ERROR_RETRY_LABEL, 'errorRetryLabel'],
    ['NOT_FOUND_TITLE', NOT_FOUND_TITLE, 'notFoundTitle'],
    ['NOT_FOUND_BODY', NOT_FOUND_BODY, 'notFoundBody'],
    ['NOT_FOUND_HOME_LABEL', NOT_FOUND_HOME_LABEL, 'notFoundHomeLabel'],
  ])('%s is the Turkish catalogue value', (_name, value, key) => {
    expect(value).toBe(appMessages.tr[key]);
  });

  /**
   * Keys that deliberately have no crutch export.
   *
   * The crutch exists for strings that predate the second language, because a
   * few hundred assertions name them. A string added afterwards has no such
   * assertions, so giving it one would be adding a second way to reach it for
   * nobody's benefit.
   *
   * Listing them rather than dropping the check keeps the decision explicit: a
   * string added without an export has to be named here, which is the moment to
   * ask whether anything already names it.
   */
  const NO_CRUTCH_EXPORT = [
    'languageSectionTitle',
    'languageSectionDescription',
    'languageSystemLabel',
    'languageNameTurkish',
    'languageNameEnglish',

    // Added with the second language already in place: the hydration error was
    // a hardcoded English sentence until then, so nothing in the suite names a
    // Turkish constant for it.
    'hydrationErrorMessage',
  ];

  it('covers every key that predates the second language', () => {
    const exported = [
      BACK_LABEL,
      LOADING_MESSAGE,
      SAVE_LABEL,
      SAVING_LABEL,
      CANCEL_LABEL,
      ERROR_TITLE,
      ERROR_BODY,
      ERROR_RETRY_LABEL,
      NOT_FOUND_TITLE,
      NOT_FOUND_BODY,
      NOT_FOUND_HOME_LABEL,
    ];

    const expected = Object.keys(appMessages.tr).filter(
      (key) => !NO_CRUTCH_EXPORT.includes(key)
    );

    expect(exported).toHaveLength(expected.length);
  });

  it('has every listed exception actually in the catalogue', () => {
    // An exception for a key that no longer exists is an exception excusing
    // nothing, and the next person reads it as a rule.
    for (const key of NO_CRUTCH_EXPORT) {
      expect(Object.keys(appMessages.tr)).toContain(key);
    }
  });
});
