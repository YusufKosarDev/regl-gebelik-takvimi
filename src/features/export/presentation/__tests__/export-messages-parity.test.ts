import { exportMessages } from '../export-messages';

import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';

describe('parity', () => {
  describeCatalogueParity(exportMessages, {
    functions: [
      ['summaryGeneratedOn', ['17 September 2026']],
      ['summaryCycleLengths', [28, 5]],
      ['summaryObservedLength', [31, 5]],
      ['summaryObservedRange', [26, 34]],
      ['summaryRecordLine', ['1 September 2026', '5 September 2026']],
      ['summaryRecordOngoing', ['1 September 2026']],
      ['summaryRecordUnknownEnd', ['1 September 2026']],
      ['summaryLogCount', [42]],
      ['summaryFileName', ['2026-09-17']],
      ['csvFileName', ['2026-09-17']],
    ],
    // Two dates that were already formatted in the chosen language, joined by
    // an en dash. The join itself has nothing to translate.
    identical: ['summaryRecordLine'],
  });
});

describe('the file names', () => {
  it('are ASCII in both languages', () => {
    // A share sheet hands the name to whatever receives it - a mail client, a
    // messaging app, a file manager - and a non-ASCII attachment name is a
    // real-world hazard in all three. Turkish characters are spelled out
    // rather than accented for exactly this reason.
    for (const half of [exportMessages.tr, exportMessages.en]) {
      expect(half.summaryFileName('2026-09-17')).toMatch(/^[\x20-\x7e]+$/);
      expect(half.csvFileName('2026-09-17')).toMatch(/^[\x20-\x7e]+$/);
    }
  });

  it('carry the date and the right extension', () => {
    for (const half of [exportMessages.tr, exportMessages.en]) {
      expect(half.summaryFileName('2026-09-17')).toMatch(/2026-09-17\.txt$/);
      expect(half.csvFileName('2026-09-17')).toMatch(/2026-09-17\.csv$/);
    }
  });

  it('differ between the two languages, so neither reads as the other', () => {
    expect(exportMessages.tr.summaryFileName('2026-09-17')).not.toBe(
      exportMessages.en.summaryFileName('2026-09-17')
    );
  });
});

describe('what the summary says about itself', () => {
  it('says it is not a medical assessment, in both languages', () => {
    // The document leaves the phone and may be read by somebody who has never
    // seen the app, which is where this matters most.
    expect(exportMessages.tr.summaryFooter).toContain('tıbbi');
    expect(exportMessages.en.summaryFooter.toLowerCase()).toContain('not a medical');
  });

  it('warns that a shared file is out of the app’s hands', () => {
    expect(exportMessages.tr.exportDescription).toContain('denetiminden çıkar');
    expect(exportMessages.en.exportDescription.toLowerCase()).toContain('leaves the app');
  });
});
