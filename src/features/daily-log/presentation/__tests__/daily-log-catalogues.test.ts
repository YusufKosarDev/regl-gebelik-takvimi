import { FLOW_LEVELS, MOODS, SYMPTOMS } from '../../domain/catalogues';
import type { DailyLogCatalogueLabels } from '../daily-log-catalogues';
import { dailyLogCatalogueLabels, labelFor } from '../daily-log-catalogues';

/**
 * The words for the three catalogues, in both languages.
 *
 * Several of these assertions were in `domain/__tests__/catalogues.test.ts`
 * until the labels moved out of the domain. They kept their exact Turkish text
 * and gained an English counterpart; what changed is which file they live in
 * and, for the two that named a language, that they now name both.
 */

const LANGUAGES = ['tr', 'en'] as const;

const SECTIONS = [
  ['flows', FLOW_LEVELS, (labels: DailyLogCatalogueLabels) => labels.flows],
  ['symptoms', SYMPTOMS, (labels: DailyLogCatalogueLabels) => labels.symptoms],
  ['moods', MOODS, (labels: DailyLogCatalogueLabels) => labels.moods],
] as const;

describe.each(LANGUAGES)('the %s catalogue labels', (language) => {
  const labels = dailyLogCatalogueLabels[language];

  describe.each(SECTIONS)('%s', (_name, catalogue, pick) => {
    const map = pick(labels);

    /**
     * Moved from the domain test, where it read `entry.label.trim()`.
     *
     * Now checked per language, which is the thing it was really about: a
     * blank is a chip with nothing on it, in whichever language is showing.
     */
    it('has a word for every id, and none of them blank', () => {
      for (const entry of catalogue) {
        expect(map[entry.id as keyof typeof map]).toBeDefined();
        expect(String(map[entry.id as keyof typeof map]).trim()).not.toBe('');
      }
    });

    /**
     * Moved from the domain test, where it compared `entry.label` values.
     *
     * Two rows reading the same would be indistinguishable on screen — and
     * that has to hold in each language separately, which the old single-
     * language version could not say.
     */
    it('has no two entries reading the same', () => {
      const words = Object.values(map);

      expect(new Set(words).size).toBe(words.length);
    });

    it('has a word for nothing that is not in the catalogue', () => {
      // The maps are typed against the catalogue ids, so this is really a
      // check that nothing was added by hand with a cast.
      const ids = new Set(catalogue.map((entry) => entry.id));

      for (const id of Object.keys(map)) {
        expect(ids.has(id as never)).toBe(true);
      }
    });
  });
});

describe('the Turkish words, unchanged from when they lived in the domain', () => {
  /** Moved from the domain test's `entryById(SYMPTOMS, 'cramps')?.label`. */
  it('still calls a cramp a Kramp', () => {
    expect(dailyLogCatalogueLabels.tr.symptoms.cramps).toBe('Kramp');
  });

  it('keeps every flow, symptom and mood word it had', () => {
    // Spelled out rather than snapshotted: this is the assertion that would
    // catch a translation pass quietly rewording the source language.
    expect(dailyLogCatalogueLabels.tr.flows).toEqual({
      spotting: 'Leke',
      light: 'Hafif',
      medium: 'Orta',
      heavy: 'Yoğun',
    });

    expect(dailyLogCatalogueLabels.tr.moods).toEqual({
      'very-good': 'Çok iyi',
      good: 'İyi',
      okay: 'Orta',
      bad: 'Kötü',
      'very-bad': 'Çok kötü',
    });

    expect(dailyLogCatalogueLabels.tr.symptoms).toEqual({
      cramps: 'Kramp',
      headache: 'Baş ağrısı',
      bloating: 'Şişkinlik',
      fatigue: 'Yorgunluk',
      'breast-tenderness': 'Göğüs hassasiyeti',
      'back-pain': 'Bel ağrısı',
      nausea: 'Mide bulantısı',
      acne: 'Akne',
      'appetite-change': 'İştah değişimi',
      'sleep-trouble': 'Uyku sorunu',
    });
  });
});

describe('what the English may not do', () => {
  it('has no Turkish left in it', () => {
    for (const map of Object.values(dailyLogCatalogueLabels.en)) {
      for (const word of Object.values(map)) {
        expect(word).not.toMatch(/[ğüşıöçĞÜŞİÖÇ]/);
      }
    }
  });

  /**
   * Moved from the domain test's "never calls a mood normal", and now says it
   * about both languages rather than only the one that existed.
   *
   * A scale with a normal on it turns a note into a verdict. "Average" is the
   * English trap rather than "normal": it implies a comparison with other
   * people, which is the one thing this feature never does.
   */
  it.each(LANGUAGES)('never calls a mood normal, in %s', (language) => {
    for (const word of Object.values(dailyLogCatalogueLabels[language].moods)) {
      expect(word.toLocaleLowerCase('tr')).not.toContain('normal');
      expect(word.toLocaleLowerCase('en')).not.toContain('average');
    }
  });

  /**
   * Nothing here names a condition.
   *
   * Somebody is noting what they felt, not classifying it. "Trouble sleeping",
   * not "insomnia"; "Breast tenderness", not "mastalgia".
   */
  it('names no diagnosis', () => {
    const forbidden = ['insomnia', 'mastalgia', 'dysmenorrhea', 'syndrome', 'disorder'];

    for (const word of Object.values(dailyLogCatalogueLabels.en.symptoms)) {
      for (const term of forbidden) {
        expect(word.toLocaleLowerCase('en')).not.toContain(term);
      }
    }
  });
});

describe('labelFor', () => {
  it('returns the word for an id', () => {
    expect(labelFor(dailyLogCatalogueLabels.tr.symptoms, 'cramps')).toBe('Kramp');
    expect(labelFor(dailyLogCatalogueLabels.en.symptoms, 'cramps')).toBe('Cramps');
  });

  /**
   * Moved from the domain test's `labelFor(SYMPTOMS, 'something-from-the-future')`.
   *
   * A stored day can name something a later build retired or something a newer
   * build knows and this one does not. `null` rather than the raw id, because
   * `sleep-trouble` on a card would be worse than one fewer word.
   */
  it('returns null for an id this build has no word for', () => {
    expect(labelFor(dailyLogCatalogueLabels.tr.symptoms, 'something-from-the-future')).toBeNull();
    expect(labelFor(dailyLogCatalogueLabels.en.symptoms, 'something-from-the-future')).toBeNull();
  });
});
