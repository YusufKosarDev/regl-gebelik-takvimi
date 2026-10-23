import { exportMessages } from '../export-messages';

/**
 * The rules the PDF's own sentences are held to.
 *
 * ## Why these are separate from `export-messages-parity.test.ts`
 *
 * That file asks the questions every catalogue gets: both halves hold the same
 * keys, neither was copied from the other, no Turkish word is left in an
 * English string. This file asks the question only this format raises.
 *
 * A `.txt` summary is a dump. A PDF is a document: it is typeset, it arrives
 * without the app, it may be scanned into a record and read a year later beside
 * results it was never about, and it may be read by somebody with the authority
 * to act on it. The form itself makes a claim the content does not, so the
 * content has to be held tighter than the format it shares its data with.
 *
 * The two word lists are the ones `records-summary-messages-parity.test.ts` and
 * `daily-log-history-messages-parity.test.ts` already hold their screens to.
 * Copied rather than shared deliberately: a list is a statement about what one
 * particular surface may say, and three surfaces agreeing is a fact worth being
 * able to read in one file rather than an import away.
 */

/** Every key the PDF adds. */
const PDF_KEYS = [
  'pdfIntro',
  'pdfEnteredNote',
  'pdfRecordedNote',
  'pdfCountsHeading',
  'pdfCountsNote',
  'pdfCountLine',
  'pdfCountsBelowFloor',
  'pdfCountsNone',
  'pdfButtonText',
  'pdfButtonLabel',
  'threeFilesNote',
] as const;

/** The PDF's sentences, in one language, with the functions called. */
function sentences(half: typeof exportMessages.tr): readonly string[] {
  return PDF_KEYS.map((key) => {
    const value = (half as Record<string, unknown>)[key];

    return typeof value === 'function'
      ? String((value as (...a: never[]) => string)('Kramp' as never, 11 as never))
      : String(value);
  });
}

describe('the PDF says nothing a document may not say', () => {
  it('has every key it is about to be checked for', () => {
    // A loop over keys that do not exist is a loop over nothing, and would
    // pass by being empty.
    for (const half of [exportMessages.tr, exportMessages.en]) {
      for (const key of PDF_KEYS) {
        expect([key, key in half]).toEqual([key, true]);
      }
    }
  });

  it('names no cause in either language', () => {
    const forbidden = [
      'neden',
      'yüzünden',
      'sebep',
      'bağlı',
      'ilişkili',
      'etkil',
      'causes',
      'caused',
      'because',
      'linked',
      'associated',
      'correlat',
      'due to',
    ];

    for (const half of [exportMessages.tr, exportMessages.en]) {
      for (const sentence of sentences(half)) {
        for (const word of forbidden) {
          expect([word, sentence.toLowerCase().includes(word)]).toEqual([word, false]);
        }
      }
    }
  });

  /**
   * No word for how regular a cycle is - the rule `build-cycle-outlook.ts`
   * dropped `assessCycleRegularity` for, and the one a page a clinician holds
   * would carry furthest.
   */
  it('puts no label on a body', () => {
    const labels = [
      'düzensiz',
      'düzenli',
      'irregular',
      'regular',
      'normal',
      'abnormal',
      'healthy',
      'sağlıklı',
    ];

    for (const half of [exportMessages.tr, exportMessages.en]) {
      for (const sentence of sentences(half)) {
        for (const label of labels) {
          expect([label, sentence.toLowerCase().includes(label)]).toEqual([label, false]);
        }
      }
    }
  });

  /**
   * No forecast on a clinical document.
   *
   * The `.txt` summary carries none today, and the reason it must stay that way
   * is sharper on paper: a predicted date printed beside recorded ones is a
   * guess wearing the same typeface as a fact.
   */
  it('promises nothing about a day that has not happened', () => {
    const forecasts = ['tahmin', 'beklenen', 'bekleniyor', 'predict', 'expected', 'forecast'];

    for (const half of [exportMessages.tr, exportMessages.en]) {
      for (const sentence of sentences(half)) {
        for (const word of forecasts) {
          expect([word, sentence.toLowerCase().includes(word)]).toEqual([word, false]);
        }
      }
    }
  });
});

describe('what the PDF says about where its numbers came from', () => {
  /**
   * The split `data-category.ts` draws - "something a person entered or chose"
   * against "something this device worked out" - survives the trip to paper.
   *
   * In the CSV a reader can look up a column name: `cycle_day` and `phase` are
   * the worked-out ones. A page has no column headers, so the document itself
   * has to say which half is which. This is the claim-rule consequence that
   * costs the most if it is dropped.
   */
  it('says in the opening line that everything is either entered or counted', () => {
    expect(exportMessages.tr.pdfIntro).toContain('girilen');
    expect(exportMessages.tr.pdfIntro).toContain('sayım');

    expect(exportMessages.en.pdfIntro.toLowerCase()).toContain('entered');
    expect(exportMessages.en.pdfIntro.toLowerCase()).toContain('count');
  });

  it('marks the entered line of the cycle section apart from the worked-out ones', () => {
    expect(exportMessages.tr.pdfEnteredNote).toContain('girildi');
    expect(exportMessages.tr.pdfEnteredNote).toContain('hesaplandı');

    expect(exportMessages.en.pdfEnteredNote.toLowerCase()).toContain('entered');
    expect(exportMessages.en.pdfEnteredNote.toLowerCase()).toContain('worked out');
  });

  it('says the period dates are as they were entered', () => {
    expect(exportMessages.tr.pdfRecordedNote).toContain('girildiği gibi');
    expect(exportMessages.en.pdfRecordedNote.toLowerCase()).toContain('as they were entered');
  });

  /**
   * `most-logged.ts` wrote this rule for the screen and it matters more here:
   * "'Cramps, eleven days' is a count of what somebody wrote down. It is not a
   * measure of how often they had cramps, and nothing downstream may dress it
   * as one." A document beside a clinician is where it would be dressed.
   */
  it('says the counts are not a measurement of how often anything happened', () => {
    expect(exportMessages.tr.pdfCountsNote).toContain('sayım');
    expect(exportMessages.tr.pdfCountsNote).toContain('ölçümü değil');

    expect(exportMessages.en.pdfCountsNote.toLowerCase()).toContain('counts');
    expect(exportMessages.en.pdfCountsNote.toLowerCase()).toContain('not a measurement');
  });

  /**
   * Named absence, which is the CSV's "an empty cell means the app has nothing
   * to say" convention carried into a format with no cells. A section that
   * silently dropped the short counts would break it.
   */
  it('says what was left out rather than leaving a gap', () => {
    expect(exportMessages.tr.pdfCountsBelowFloor).toContain('Beşten az');
    expect(exportMessages.en.pdfCountsBelowFloor.toLowerCase()).toContain('fewer than five');
  });

  it('says so in words when nothing reached the floor', () => {
    expect(exportMessages.tr.pdfCountsNone.trim()).not.toBe('');
    expect(exportMessages.en.pdfCountsNone.trim()).not.toBe('');
  });
});

describe('the PDF file name', () => {
  it('is ASCII in both languages, like the other two', () => {
    // A share sheet hands the name to whatever receives it, and a non-ASCII
    // attachment name is a real-world hazard in a mail client.
    for (const half of [exportMessages.tr, exportMessages.en]) {
      expect(half.pdfFileName('2026-09-17')).toMatch(/^[\x20-\x7e]+$/);
      expect(half.pdfFileName('2026-09-17')).toMatch(/2026-09-17\.pdf$/);
    }
  });

  it('cannot collide with the summary it is a document of', () => {
    // Both land in the same folder, under the same date.
    for (const half of [exportMessages.tr, exportMessages.en]) {
      expect(half.pdfFileName('2026-09-17')).not.toBe(half.summaryFileName('2026-09-17'));
    }
  });
});

describe('the note under the buttons', () => {
  /**
   * Three buttons rather than two, for the reason the note existed at all: the
   * system share sheet takes one file at a time, and somebody who pressed once
   * would reasonably assume that was all of it.
   */
  it('accounts for all three files', () => {
    expect(exportMessages.tr.threeFilesNote).toContain('Üç dosya');
    expect(exportMessages.tr.threeFilesNote).toContain('PDF');
    expect(exportMessages.tr.threeFilesNote).toContain('CSV');

    expect(exportMessages.en.threeFilesNote.toLowerCase()).toContain('three files');
    expect(exportMessages.en.threeFilesNote).toContain('PDF');
    expect(exportMessages.en.threeFilesNote).toContain('CSV');
  });

  it('no longer claims there are two', () => {
    expect('twoFilesNote' in exportMessages.tr).toBe(false);
  });
});
