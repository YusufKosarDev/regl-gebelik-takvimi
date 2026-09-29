import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import { onboardingMessages } from '../onboarding-messages';

/**
 * The onboarding flow, in both languages.
 *
 * These are the first words anybody reads, and on an English phone they are
 * read before there is any way to change the language - the picker is in
 * settings, which is behind finishing this flow. So there is no "they can
 * switch if it looks wrong" here.
 */

describe('parity', () => {
  describeCatalogueParity(onboardingMessages, {
    functions: [
      ['daysUnit', [0], [1], [2], [28]],
      ['cycleLengthValueLabel', [1], [28]],
      ['periodLengthValueLabel', [1], [5]],
      ['selectedDateLabel', ['17 September 2026']],
      ['reviewRowLabel', ['Cycle length', '28 days']],
      ['reviewDaysValue', [0], [1], [2], [28]],
    ],
  });
});

describe('counting days', () => {
  /**
   * Turkish does not pluralise a noun after a number and English does, which is
   * the first place in this app where the two languages need different shapes
   * rather than different words.
   */
  it('keeps one Turkish word whatever the count', () => {
    for (const count of [0, 1, 2, 28]) {
      expect(onboardingMessages.tr.daysUnit(count)).toBe('gün');
    }
  });

  it.each<[number, string]>([
    [0, 'days'],
    [1, 'day'],
    [2, 'days'],
    [28, 'days'],
  ])('says %i %s in English', (count, expected) => {
    expect(onboardingMessages.en.daysUnit(count)).toBe(expected);
  });

  it('pluralises the review value the same way', () => {
    expect(onboardingMessages.en.reviewDaysValue(1)).toBe('1 day');
    expect(onboardingMessages.en.reviewDaysValue(28)).toBe('28 days');
    expect(onboardingMessages.tr.reviewDaysValue(1)).toBe('1 gün');
    expect(onboardingMessages.tr.reviewDaysValue(28)).toBe('28 gün');
  });

  it('pluralises inside the screen-reader labels too', () => {
    // These are read aloud rather than shown, and "1 days" is exactly the kind
    // of thing a screen reader makes obvious and a glance does not.
    expect(onboardingMessages.en.cycleLengthValueLabel(1)).toContain('1 day');
    expect(onboardingMessages.en.cycleLengthValueLabel(1)).not.toContain('1 days');
    expect(onboardingMessages.en.periodLengthValueLabel(1)).toContain('1 day');
    expect(onboardingMessages.en.periodLengthValueLabel(1)).not.toContain('1 days');
  });
});

describe('the flow still reads as a flow', () => {
  it('keeps the note that predictions are not medical advice', () => {
    expect(onboardingMessages.en.welcomeNote).toMatch(/not a substitute for medical advice/i);
  });

  it('asks both length questions as questions', () => {
    expect(onboardingMessages.en.cycleLengthTitle).toMatch(/\?$/);
    expect(onboardingMessages.en.periodLengthTitle).toMatch(/\?$/);
    expect(onboardingMessages.tr.cycleLengthTitle).toMatch(/\?$/);
    expect(onboardingMessages.tr.periodLengthTitle).toMatch(/\?$/);
  });
});
