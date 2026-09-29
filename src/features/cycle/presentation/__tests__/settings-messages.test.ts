import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import { settingsMessages } from '../settings-messages';

/** The cycle settings screen, in both languages. */

describe('parity', () => {
  describeCatalogueParity(settingsMessages, {
    functions: [
      ['daysUnit', [0], [1], [2], [28]],
      ['lengthValueLabel', ['Average cycle length', 1], ['Average cycle length', 28]],
    ],
  });
});

describe('counting days', () => {
  it('keeps one Turkish word whatever the count', () => {
    for (const count of [0, 1, 2, 28]) {
      expect(settingsMessages.tr.daysUnit(count)).toBe('gün');
    }
  });

  it('pluralises in English', () => {
    expect(settingsMessages.en.daysUnit(1)).toBe('day');
    expect(settingsMessages.en.daysUnit(28)).toBe('days');
  });

  it('pluralises inside the screen-reader label too', () => {
    // Read aloud rather than shown, which is where "1 days" is obvious.
    expect(settingsMessages.en.lengthValueLabel('Average cycle length', 1)).toContain('1 day');
    expect(settingsMessages.en.lengthValueLabel('Average cycle length', 1)).not.toContain(
      '1 days'
    );
  });
});

describe('the two field notes', () => {
  it('still describe the two different measurements', () => {
    // One is first-day to first-day, the other is how long bleeding lasts.
    // Translating them into the same sentence would make the second stepper
    // ask the first question again.
    expect(settingsMessages.en.cycleLengthFieldNote).not.toBe(
      settingsMessages.en.periodLengthFieldNote
    );
    expect(settingsMessages.en.cycleLengthFieldNote).toMatch(/first day of the next/i);
    expect(settingsMessages.en.periodLengthFieldNote).toMatch(/stops completely/i);
  });
});
