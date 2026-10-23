import { recordsSummaryMessages } from '../records-summary-messages';

import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';

describe('parity', () => {
  describeCatalogueParity(recordsSummaryMessages, {
    functions: [
      ['phaseCount', ['Luteal', 12]],
      ['barHeading', ['Cramps', 15]],
      ['cycleLengthMedian', [29]],
      ['cycleLengthShortest', [27]],
      ['cycleLengthLongest', [31]],
      ['cycleLengthSpread', [4]],
      ['cycleLengthFrom', [7]],
      ['cycleLengthDiscarded', [1]],
      ['countOnly', ['Cramps', 3]],
    ],
  });
});

/**
 * The rules this screen is held to, as tests rather than as intentions.
 *
 * The panel this screen opens from carries the same first rule, in
 * `daily-log-history-messages-parity.test.ts`, with the same word list. A
 * screen headed "summary" is where an explanation is most tempting to write,
 * so it gets the check too — over every sentence, not only the one the panel
 * has.
 */
describe('the summary claims nothing it cannot', () => {
  /** Every string the catalogue holds, with the functions called. */
  function sentences(half: typeof recordsSummaryMessages.tr): readonly string[] {
    return Object.values(half).map((value) =>
      typeof value === 'function'
        ? String((value as (...a: never[]) => string)('Cramps' as never, 12 as never))
        : String(value)
    );
  }

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

    for (const half of [recordsSummaryMessages.tr, recordsSummaryMessages.en]) {
      for (const sentence of sentences(half)) {
        for (const word of forbidden) {
          // The disclaimer is the one place "neden-sonuç" may appear, because
          // it is denying one. It is checked separately below.
          if (sentence === half.disclaimer) {
            continue;
          }

          expect([word, sentence.toLowerCase().includes(word)]).toEqual([word, false]);
        }
      }
    }
  });

  /**
   * No word for how regular a cycle is.
   *
   * `build-cycle-outlook.ts` dropped `assessCycleRegularity` on purpose and
   * said why: a label would be the app telling somebody something about their
   * body. This screen reports the spread in days and stops there, and this is
   * what stops the adjective coming back as a heading.
   */
  it('puts no label on how regular a cycle is', () => {
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

    for (const half of [recordsSummaryMessages.tr, recordsSummaryMessages.en]) {
      for (const sentence of sentences(half)) {
        for (const label of labels) {
          expect([label, sentence.toLowerCase().includes(label)]).toEqual([label, false]);
        }
      }
    }
  });

  it('carries a disclaimer in both languages', () => {
    expect(recordsSummaryMessages.tr.disclaimer.trim()).not.toBe('');
    expect(recordsSummaryMessages.en.disclaimer.trim()).not.toBe('');
  });

  it('denies a cause in the disclaimer rather than staying silent about it', () => {
    expect(recordsSummaryMessages.tr.disclaimer).toContain('neden-sonuç');
    expect(recordsSummaryMessages.en.disclaimer).toContain('not a cause');
  });

  /**
   * The baseline note has to say what the baseline is for.
   *
   * Without it the four bars are just four numbers, and the reader is left to
   * work out on their own that a distribution matching the baseline says
   * nothing. That sentence is the whole reason the baseline is drawn.
   */
  it('explains what the baseline means', () => {
    expect(recordsSummaryMessages.tr.baselineNote).toContain('döngünün şekli');
    expect(recordsSummaryMessages.en.baselineNote).toContain('shape of a cycle');
  });

  it('says why a short bar is a number instead', () => {
    expect(recordsSummaryMessages.tr.belowThresholdNote).toContain('istatistik');
    expect(recordsSummaryMessages.en.belowThresholdNote).toContain('statistic');
  });
});
