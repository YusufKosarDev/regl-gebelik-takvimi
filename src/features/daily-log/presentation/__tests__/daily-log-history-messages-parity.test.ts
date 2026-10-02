import { dailyLogHistoryMessages } from '../daily-log-history-messages';

import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';

describe('parity', () => {
  describeCatalogueParity(dailyLogHistoryMessages, {
    functions: [
      ['markedDayLabel', ['17 September 2026', 'Cramps']],
      ['unmarkedDayLabel', ['17 September 2026']],
      ['summaryLine', ['Cramps', 12, 15, 'luteal']],
    ],
    // A date joined to a summary that both arrived already translated, and a
    // bullet, which is a shape rather than a word.
    identical: ['markedDayLabel', 'markedDayMarker'],
  });
});

describe('the sentences claim nothing they cannot', () => {
  it('names no cause in either language', () => {
    // The domain refuses to offer a share below five days or one that only
    // describes how long a phase is. This is the other half of that: the
    // wording must not turn a count into an explanation.
    const forbidden = [
      'neden',
      'yüzünden',
      'sebep',
      'bağlı',
      'ilişkili',
      'causes',
      'caused',
      'because',
      'linked',
      'associated',
      'correlat',
    ];

    for (const half of [dailyLogHistoryMessages.tr, dailyLogHistoryMessages.en]) {
      const sentence = half.summaryLine('Cramps', 12, 15, 'luteal').toLowerCase();

      for (const word of forbidden) {
        expect(sentence).not.toContain(word);
      }
    }
  });

  it('carries a disclaimer in both languages', () => {
    // Shown under the list every time, whether or not there is a line above it.
    expect(dailyLogHistoryMessages.tr.summaryDisclaimer.trim()).not.toBe('');
    expect(dailyLogHistoryMessages.en.summaryDisclaimer.trim()).not.toBe('');
  });

  it('says something rather than nothing when nothing stands out', () => {
    // An empty space would read as the screen having failed. "Nothing stands
    // out" is itself an answer.
    expect(dailyLogHistoryMessages.en.summaryNothingNotable).toContain('stands out');
  });
});
