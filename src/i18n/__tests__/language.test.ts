import {
  DEFAULT_LANGUAGE_PREFERENCE,
  LANGUAGES,
  LANGUAGE_PREFERENCES,
  SOURCE_LANGUAGE,
  isLanguage,
  isLanguagePreference,
  resolveLanguage,
  validateLanguagePreference,
} from '../language';

describe('the languages this app has', () => {
  it('is exactly Turkish and English', () => {
    expect([...LANGUAGES]).toEqual(['tr', 'en']);
  });

  /**
   * "Follow the phone" is a third stored value, not a synonym for Turkish.
   *
   * Collapsing them would make a Turkish phone and a stated preference for
   * Turkish indistinguishable, and the difference shows up the moment somebody
   * travels or changes their phone's language.
   */
  it('stores a third preference for following the phone', () => {
    expect([...LANGUAGE_PREFERENCES]).toEqual(['system', 'tr', 'en']);
  });

  it('follows the phone before anybody has chosen', () => {
    expect(DEFAULT_LANGUAGE_PREFERENCE).toBe('system');
  });

  it('names Turkish as the language the app is written in', () => {
    expect(SOURCE_LANGUAGE).toBe('tr');
  });
});

describe('isLanguage', () => {
  it.each(['tr', 'en'])('accepts %s', (value) => {
    expect(isLanguage(value)).toBe(true);
  });

  it.each([['system'], ['TR'], ['tr-TR'], ['de'], [''], [null], [undefined], [1], [{}]])(
    'refuses %p',
    (value) => {
      expect(isLanguage(value)).toBe(false);
    }
  );
});

describe('isLanguagePreference', () => {
  it.each(['system', 'tr', 'en'])('accepts %s', (value) => {
    expect(isLanguagePreference(value)).toBe(true);
  });

  it.each([['auto'], ['TR'], [null], [undefined], [0], [[]]])('refuses %p', (value) => {
    expect(isLanguagePreference(value)).toBe(false);
  });
});

describe('validateLanguagePreference', () => {
  it('passes a stored value this app knows', () => {
    expect(() => validateLanguagePreference('en')).not.toThrow();
  });

  it('raises rather than falling back', () => {
    // A stored value that has been outside this app's memory and came back
    // wrong should be loud. Quietly picking a branch is how somebody's chosen
    // language becomes whichever one an `if` happens to take.
    expect(() => validateLanguagePreference('klingon')).toThrow(/language preference/);
  });

  it('says what kind of thing it received, never the value', () => {
    expect(() => validateLanguagePreference(7)).toThrow(/a number/);
  });
});

describe('resolveLanguage when somebody has chosen', () => {
  it.each([
    ['tr', 'en'],
    ['en', 'tr'],
    ['tr', null],
    ['en', null],
  ] as const)('shows %s whatever the phone says (%p)', (preference, device) => {
    expect(resolveLanguage(preference, device)).toBe(preference);
  });

  it('is not overruled by a phone that agrees with the other one', () => {
    // The point of storing a choice is that it survives the phone changing.
    expect(resolveLanguage('tr', 'de')).toBe('tr');
    expect(resolveLanguage('en', 'tr')).toBe('en');
  });
});

describe('resolveLanguage when following the phone', () => {
  it('shows Turkish to a Turkish phone', () => {
    expect(resolveLanguage('system', 'tr')).toBe('tr');
  });

  /**
   * Anything else gets English, not Turkish.
   *
   * A Turkish speaker with an English phone can find the language setting.
   * Somebody handed a language they cannot read has no idea what they are
   * looking for.
   */
  it.each(['en', 'de', 'fr', 'ar', 'az', 'ru'])('shows English to a %s phone', (code) => {
    expect(resolveLanguage('system', code)).toBe('en');
  });

  /**
   * A device that will not answer is a third case, and it reads as Turkish.
   *
   * `null` is not a phone asking for English; it is a phone that said nothing.
   * Turkish is the source language, so it is the conservative reading — and it
   * is what keeps the existing suite, which has no device at all, in Turkish.
   */
  it('shows the source language when the device will not say', () => {
    expect(resolveLanguage('system', null)).toBe('tr');
  });

  it('matches the code exactly rather than by prefix', () => {
    // `languageCode` is documented as the bare lowercase code. Anything that
    // arrives as a tag is not something to half-understand.
    expect(resolveLanguage('system', 'tr-TR')).toBe('en');
    expect(resolveLanguage('system', 'TR')).toBe('en');
  });
});
