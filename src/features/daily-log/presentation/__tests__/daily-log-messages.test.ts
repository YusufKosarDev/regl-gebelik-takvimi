import { dailyLogMessages } from '../daily-log-messages';

/**
 * The two catalogues held to each other.
 *
 * The compiler already refuses a missing or misspelled key — the English is
 * typed against the Turkish. These tests cover what types cannot see: a value
 * that was copied and never translated, a placeholder dropped in one language,
 * and a plural that only works for one number.
 */

const LANGUAGES = ['tr', 'en'] as const;

/** Every argument-taking message, with arguments to call it with. */
const FUNCTIONS: readonly (readonly [string, ...(readonly unknown[])[]])[] = [
  ['symptomCountLabel', [0], [1], [2], [11]],
  ['choiceAccessibilityLabel', ['Section', 'Choice']],
];

describe('key parity', () => {
  /**
   * Stated even though `DailyLogMessages` already enforces it.
   *
   * The type is the backstop and this is the intent. If somebody later loosens
   * the English side to a `Record<string, string>`, the compiler stops caring
   * and this does not.
   */
  it('the two catalogues have the same keys', () => {
    expect(Object.keys(dailyLogMessages.en).sort()).toEqual(
      Object.keys(dailyLogMessages.tr).sort()
    );
  });

  it('a key is a function in both languages or in neither', () => {
    for (const key of Object.keys(dailyLogMessages.tr)) {
      const tr = dailyLogMessages.tr[key as keyof typeof dailyLogMessages.tr];
      const en = dailyLogMessages.en[key as keyof typeof dailyLogMessages.en];

      expect(typeof en).toBe(typeof tr);
    }
  });
});

describe('no Turkish left in the English', () => {
  it('has none in any plain value', () => {
    for (const [key, value] of Object.entries(dailyLogMessages.en)) {
      if (typeof value !== 'string') continue;

      expect([key, value]).toEqual([key, expect.not.stringMatching(/[ğüşıöçĞÜŞİÖÇ]/)]);
    }
  });

  /**
   * Functions are checked by calling them, which is the case types cannot see:
   * a function body can hold Turkish no signature mentions.
   */
  it('has none in anything a function returns', () => {
    for (const [name, ...argumentSets] of FUNCTIONS) {
      const fn = dailyLogMessages.en[name as keyof typeof dailyLogMessages.en] as (
        ...args: unknown[]
      ) => string;

      for (const args of argumentSets) {
        expect([name, fn(...args)]).toEqual([
          name,
          expect.not.stringMatching(/[ğüşıöçĞÜŞİÖÇ]/),
        ]);
      }
    }
  });
});

describe('placeholder parity', () => {
  /**
   * Every argument has to appear in the output, in both languages.
   *
   * This is what catches a dropped count: `symptomCountLabel(3)` that returns
   * "symptoms" without the 3 is grammatical, passes the Turkish-letter check,
   * and is wrong.
   */
  it('mentions the count it was given', () => {
    for (const language of LANGUAGES) {
      expect(dailyLogMessages[language].symptomCountLabel(7)).toContain('7');
    }
  });

  it('mentions both the section and the choice', () => {
    for (const language of LANGUAGES) {
      const label = dailyLogMessages[language].choiceAccessibilityLabel('Akış', 'Yoğun');

      expect(label).toContain('Akış');
      expect(label).toContain('Yoğun');
    }
  });
});

describe('plural coverage', () => {
  /**
   * Turkish does not inflect the noun after a number — "3 belirti", not
   * "3 belirtiler" — and English does. This is the one place in the feature
   * where the two languages genuinely differ in shape, which is why the
   * catalogue holds functions rather than templates.
   */
  it('English switches at one and Turkish does not', () => {
    expect(dailyLogMessages.en.symptomCountLabel(1)).toBe('1 symptom');
    expect(dailyLogMessages.en.symptomCountLabel(0)).toBe('0 symptoms');
    expect(dailyLogMessages.en.symptomCountLabel(2)).toBe('2 symptoms');

    expect(dailyLogMessages.tr.symptomCountLabel(1)).toBe('1 belirti');
    expect(dailyLogMessages.tr.symptomCountLabel(2)).toBe('2 belirti');
  });
});

describe('the Turkish, unchanged', () => {
  it('still says what it said before the English was added', () => {
    // The whole migration rests on this: moving a string into a catalogue
    // changes where it is read from, never what it says.
    expect(dailyLogMessages.tr.cardEmptyTitle).toBe('Bugünü kaydet');
    expect(dailyLogMessages.tr.cardEmptyHint).toBe('Akış, belirti ve ruh hali');
    expect(dailyLogMessages.tr.screenTitle).toBe('Günlük kayıt');
    expect(dailyLogMessages.tr.emptySelectionMessage).toBe('Kaydetmek için en az bir şey seç.');
    expect(dailyLogMessages.tr.symptomCountLabel(3)).toBe('3 belirti');
  });
});

describe('what the English must not start doing', () => {
  /**
   * The rule the whole feature is built on: the app records and shows, and
   * says nothing back. Easy to lose in translation, because English health
   * copy reaches for reassurance by default.
   */
  it('interprets nothing and reassures nobody', () => {
    const forbidden = ['normal', 'don’t worry', "don't worry", 'should', 'healthy'];

    for (const value of Object.values(dailyLogMessages.en)) {
      if (typeof value !== 'string') continue;

      for (const phrase of forbidden) {
        expect(value.toLocaleLowerCase('en')).not.toContain(phrase);
      }
    }
  });
});
