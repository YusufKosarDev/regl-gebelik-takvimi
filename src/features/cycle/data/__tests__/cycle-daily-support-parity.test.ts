import { CYCLE_PHASES } from '../../domain/phases';
import { cycleDailySupport } from '../cycle-daily-support';

/**
 * The four phases' written content, in both languages.
 *
 * The hedges are the content here. Every mood label in both languages is a
 * "may" or a "might", because the cited pages hedge and because a label that
 * read as a statement would be the app telling somebody how they feel.
 */

const LANGUAGES = ['tr', 'en'] as const;

describe('the two halves line up', () => {
  it.each(LANGUAGES)('%s covers all four phases, in order', (language) => {
    expect(cycleDailySupport[language].map((entry) => entry.phase)).toEqual([...CYCLE_PHASES]);
  });

  it('agrees about how many mood labels each phase has', () => {
    for (let index = 0; index < cycleDailySupport.tr.length; index += 1) {
      const turkish = cycleDailySupport.tr[index];
      const english = cycleDailySupport.en[index];

      expect([turkish.phase, english.moodLabels?.length ?? 0]).toEqual([
        turkish.phase,
        turkish.moodLabels?.length ?? 0,
      ]);
    }
  });

  it('leaves ovulation without mood labels in both languages', () => {
    // Neither source isolates ovulation's effect on mood or energy. The popular
    // "energetic, cheerful ovulation" label has nothing behind it in these
    // pages, so it is not written - in either language.
    for (const language of LANGUAGES) {
      const ovulatory = cycleDailySupport[language].find((entry) => entry.phase === 'ovulatory');

      expect(ovulatory?.moodLabels).toBeUndefined();
    }
  });

  it('still says plainly that the sources are silent about ovulation', () => {
    const ovulatory = cycleDailySupport.en.find((entry) => entry.phase === 'ovulatory');

    expect(ovulatory?.supportMessage).toMatch(/nothing definite/i);
  });
});

describe('the citations are the same citations', () => {
  it('cites the same sources, in the same order, for every phase', () => {
    for (let index = 0; index < cycleDailySupport.tr.length; index += 1) {
      const turkish = cycleDailySupport.tr[index];
      const english = cycleDailySupport.en[index];

      expect([turkish.phase, english.sources]).toEqual([turkish.phase, turkish.sources]);
    }
  });
});

describe('every label stays a hedge', () => {
  it('writes no English mood label as a statement of fact', () => {
    // "may", "might", "can", "possible" - never "you will feel".
    for (const entry of cycleDailySupport.en) {
      for (const label of entry.moodLabels ?? []) {
        expect([entry.phase, label]).toEqual([
          entry.phase,
          expect.stringMatching(/\bmay\b|\bmight\b|\bcan\b|\bpossible\b/i),
        ]);
      }
    }
  });

  it('keeps the luteal message saying symptoms differ between people and months', () => {
    // The NHS hedges it this way, so neither language may offer it as a
    // description of the reader.
    const luteal = cycleDailySupport.en.find((entry) => entry.phase === 'luteal');

    expect(luteal?.supportMessage).toMatch(/not the same for everybody/i);
    expect(luteal?.supportMessage).toMatch(/month to month/i);
  });

  it('writes every summary and label in English', () => {
    for (const entry of cycleDailySupport.en) {
      expect([entry.phase, entry.supportMessage]).toEqual([
        entry.phase,
        expect.not.stringMatching(/[ğüşıöçĞÜŞİÖÇ]/),
      ]);

      for (const label of entry.moodLabels ?? []) {
        expect([entry.phase, label]).toEqual([
          entry.phase,
          expect.not.stringMatching(/[ğüşıöçĞÜŞİÖÇ]/),
        ]);
      }
    }
  });
});
