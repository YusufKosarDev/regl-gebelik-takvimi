import { MAX_PREGNANCY_WEEK, MIN_PREGNANCY_WEEK } from '../../domain/weekly-content';
import { pregnancyWeeklyContent } from '../pregnancy-weekly-content';

/**
 * Forty weeks of written content, in both languages.
 *
 * This is the only health content in the app long enough that a missing or
 * mismatched entry could go unnoticed, so the structural checks come first:
 * same weeks, same order, same sources, same number of bullets.
 *
 * The citations are the part that must not be translated. The cited pages are
 * English-language health bodies and their titles are what somebody would
 * search for, so a translated name or a changed URL would make the claim
 * harder to check - which is the one thing a citation is for.
 */

const LANGUAGES = ['tr', 'en'] as const;

describe('the two halves line up', () => {
  it.each(LANGUAGES)('%s covers every week from the first to the last', (language) => {
    const weeks = pregnancyWeeklyContent[language].map((entry) => entry.week);

    expect(weeks).toEqual(
      Array.from(
        { length: MAX_PREGNANCY_WEEK - MIN_PREGNANCY_WEEK + 1 },
        (_unused, index) => MIN_PREGNANCY_WEEK + index
      )
    );
  });

  it('has the same weeks in the same order', () => {
    expect(pregnancyWeeklyContent.en.map((entry) => entry.week)).toEqual(
      pregnancyWeeklyContent.tr.map((entry) => entry.week)
    );
  });

  it('agrees about which weeks have a size', () => {
    // Weeks 1 to 3 carry none on purpose: gestational age is counted from the
    // last period, so there is nothing yet whose size is worth stating.
    const hasSize = (language: 'tr' | 'en') =>
      pregnancyWeeklyContent[language].map((entry) => entry.size !== undefined);

    expect(hasSize('en')).toEqual(hasSize('tr'));
    expect(hasSize('en').slice(0, 3)).toEqual([false, false, false]);
  });

  it('agrees about how many things each week develops', () => {
    // A dropped bullet is a claim that stopped being made.
    for (let index = 0; index < pregnancyWeeklyContent.tr.length; index += 1) {
      const turkish = pregnancyWeeklyContent.tr[index];
      const english = pregnancyWeeklyContent.en[index];

      expect([turkish.week, english.developingFeatures.length]).toEqual([
        turkish.week,
        turkish.developingFeatures.length,
      ]);
    }
  });
});

describe('the citations are the same citations', () => {
  it('cites the same sources, in the same order, for every week', () => {
    for (let index = 0; index < pregnancyWeeklyContent.tr.length; index += 1) {
      const turkish = pregnancyWeeklyContent.tr[index];
      const english = pregnancyWeeklyContent.en[index];

      expect([turkish.week, english.sources]).toEqual([turkish.week, turkish.sources]);
    }
  });

  it('gives every week at least one source', () => {
    for (const language of LANGUAGES) {
      for (const entry of pregnancyWeeklyContent[language]) {
        expect([entry.week, entry.sources.length]).not.toEqual([entry.week, 0]);
      }
    }
  });

  it('points every source at a real address', () => {
    for (const entry of pregnancyWeeklyContent.en) {
      for (const source of entry.sources) {
        expect(source.url).toMatch(/^https:\/\//);
        expect(source.name.trim()).not.toBe('');
      }
    }
  });
});

describe('the English says what the Turkish says', () => {
  it('writes every summary and bullet in English', () => {
    for (const entry of pregnancyWeeklyContent.en) {
      expect([entry.week, entry.developmentSummary]).toEqual([
        entry.week,
        expect.not.stringMatching(/[ğüşıöçĞÜŞİÖÇ]/),
      ]);

      for (const feature of entry.developingFeatures) {
        expect([entry.week, feature]).toEqual([
          entry.week,
          expect.not.stringMatching(/[ğüşıöçĞÜŞİÖÇ]/),
        ]);
      }
    }
  });

  it('translates every summary rather than copying it', () => {
    for (let index = 0; index < pregnancyWeeklyContent.tr.length; index += 1) {
      const turkish = pregnancyWeeklyContent.tr[index];
      const english = pregnancyWeeklyContent.en[index];

      expect([turkish.week, english.developmentSummary]).not.toEqual([
        turkish.week,
        turkish.developmentSummary,
      ]);
    }
  });

  it('quotes the same measurement for every week that has one', () => {
    // The figures are the NHS page's own, recorded as each page states them.
    // A number that drifted between the languages would be a different claim.
    const digits = (text: string) => text.replace(/[^0-9]/g, '');

    for (let index = 0; index < pregnancyWeeklyContent.tr.length; index += 1) {
      const turkish = pregnancyWeeklyContent.tr[index];
      const english = pregnancyWeeklyContent.en[index];

      if (turkish.size === undefined || english.size === undefined) continue;

      expect([turkish.week, digits(english.size.label)]).toEqual([
        turkish.week,
        digits(turkish.size.label),
      ]);
    }
  });
});

describe('the weeks that carry advice', () => {
  it.each([31, 40])('week %i still says to contact a doctor or midwife', (week) => {
    // The NHS says it on both pages, and it is the one piece of content in here
    // that is an instruction rather than a description.
    const english = pregnancyWeeklyContent.en.find((entry) => entry.week === week);
    const turkish = pregnancyWeeklyContent.tr.find((entry) => entry.week === week);

    expect(english?.developmentSummary).toMatch(/doctor or midwife/i);
    expect(turkish?.developmentSummary).toMatch(/doktoruna ya da ebene/);
  });

  it('still describes week 24 as the point of viability with support', () => {
    const week24 = pregnancyWeeklyContent.en.find((entry) => entry.week === 24);

    expect(week24?.developmentSummary).toMatch(/chance of surviving/i);
    expect(week24?.developmentSummary).toMatch(/right support/i);
  });
});
