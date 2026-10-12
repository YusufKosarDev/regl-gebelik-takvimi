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

/**
 * The account row says what it does for the state the person is in.
 *
 * It used one constant for both, so somebody signed in read "Hesabı aç" -
 * open an account - on the line directly under their own address, which
 * `ProfileIdentity` had just drawn. The screen was offering to open a thing it
 * had told them they had.
 */
describe('the account row', () => {
  it('has a different label for each state, in both languages', () => {
    for (const catalogue of [settingsMessages.tr, settingsMessages.en]) {
      expect(catalogue.accountOpenLabel).not.toBe(catalogue.accountManageLabel);
    }
  });

  it('offers to open one only when there is not one', () => {
    expect(settingsMessages.en.accountOpenLabel).toMatch(/open/i);
    expect(settingsMessages.tr.accountOpenLabel).toMatch(/aç/i);
  });

  it('offers to manage one when there is', () => {
    expect(settingsMessages.en.accountManageLabel).toMatch(/manage/i);
    expect(settingsMessages.tr.accountManageLabel).toMatch(/yönet/i);
    // The half that was wrong: the signed-in line must not say "open".
    expect(settingsMessages.en.accountManageLabel).not.toMatch(/\bopen\b/i);
    expect(settingsMessages.tr.accountManageLabel).not.toMatch(/\baç\b/i);
  });
});
