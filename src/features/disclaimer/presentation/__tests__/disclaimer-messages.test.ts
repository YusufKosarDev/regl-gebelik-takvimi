import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import { disclaimerMessages } from '../disclaimer-messages';

/**
 * The disclaimer, in both languages.
 *
 * The shared parity checks plus the ones this feature needs on its own. These
 * are the sentences that say the app is not a doctor and not contraception, so
 * "the two catalogues have the same keys" is not enough - what matters is that
 * the English still makes every claim the Turkish makes.
 */

describe('parity', () => {
  describeCatalogueParity(disclaimerMessages, {
    functions: [
      ['aboutSupportLabel', ['help@example.com']],
      ['linkOpenFailedMessage', ['https://example.com']],
      ['mailOpenFailedMessage', ['help@example.com']],
      ['aboutVersionLabel', ['1.0.0']],
      ['aboutVersionText', ['1.0.0']],
    ],
    // The launcher and the Play listing both say this. A reader looking for it
    // should find the same word whichever language they are reading.
    identical: ['aboutAppName'],
  });
});

describe('the claims survive translation', () => {
  it('keeps all three onboarding points', () => {
    expect(disclaimerMessages.en.disclaimerPoints).toHaveLength(3);
    expect(disclaimerMessages.tr.disclaimerPoints).toHaveLength(3);
  });

  it('keeps all four paragraphs on the about screen', () => {
    expect(disclaimerMessages.en.aboutImportantParagraphs).toHaveLength(4);
    expect(disclaimerMessages.tr.aboutImportantParagraphs).toHaveLength(4);
  });

  it.each<[string, RegExp]>([
    ['not medical advice', /not a substitute for medical advice/i],
    ['not contraception', /not.*(method of )?contraception|must not be used on its own/i],
    ['see a professional', /healthcare professional/i],
  ])('still says it is %s', (_what, pattern) => {
    const everything = [
      ...disclaimerMessages.en.disclaimerPoints,
      ...disclaimerMessages.en.aboutImportantParagraphs,
    ].join(' ');

    expect(everything).toMatch(pattern);
  });

  it('keeps 112 in the Turkish, where it is the right number', () => {
    expect(disclaimerMessages.tr.disclaimerPoints.join(' ')).toContain('112');
    expect(disclaimerMessages.tr.aboutImportantParagraphs.join(' ')).toContain('112');
  });

  /**
   * The one place the two halves deliberately differ.
   *
   * A language is not a country: 112 reaches help in Turkey and the EU, 911 in
   * the US, 999 in the UK, and an English listing says nothing about where the
   * reader is. So the English names no number. Asserted as the absence of a
   * digit rather than the presence of a phrase, because the failure this guards
   * against is somebody "restoring parity" by copying the Turkish number across.
   */
  it.each<[string, readonly string[]]>([
    ['onboarding points', disclaimerMessages.en.disclaimerPoints],
    ['about paragraphs', disclaimerMessages.en.aboutImportantParagraphs],
  ])('names no emergency number in the English %s', (_where, strings) => {
    for (const value of strings) {
      expect([value, /\b(112|911|999|000|119)\b/.test(value)]).toEqual([value, false]);
    }
  });

  it('sends an English reader to their own emergency services', () => {
    const everything = [
      ...disclaimerMessages.en.disclaimerPoints,
      ...disclaimerMessages.en.aboutImportantParagraphs,
    ].join(' ');

    expect(everything).toMatch(/in an emergency, contact your local emergency services/i);
  });

  it('keeps the app name untranslated', () => {
    // It is what the launcher says and what the Play listing says. A reader
    // looking for it should find the same word.
    expect(disclaimerMessages.en.aboutAppName).toBe(disclaimerMessages.tr.aboutAppName);
  });

  it('still names KVKK in the English documents list', () => {
    // A Turkish legal instrument. Translating the name away would leave a
    // reader unable to match the link to the document it opens.
    expect(disclaimerMessages.en.aboutKvkkLabel).toContain('KVKK');
  });
});
