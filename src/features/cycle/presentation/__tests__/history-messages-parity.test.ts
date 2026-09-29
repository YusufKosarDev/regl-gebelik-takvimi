import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import { historyMessages, recordAccessibilityLabelIn, recordEndLabelIn } from '../history-messages';
import type { PeriodRecord } from '../../domain/types';

import { toISODate } from '@/utils/date';

/** The history screen's words, in both languages. */

describe('parity', () => {
  describeCatalogueParity(historyMessages, {
    functions: [
      ['recordEndSuffix', ['17 September 2026']],
      ['editStartLabel', ['17 September 2026']],
      ['editEndLabel', ['17 September 2026']],
      ['deleteRecordLabel', ['17 September 2026']],
      ['selectedStartDateLabel', ['17 September 2026']],
      ['selectedEndDateLabel', ['17 September 2026']],
      ['startDateLine', ['17 September 2026']],
      ['endDateLine', ['17 September 2026']],
    ],
  });
});

describe('a record, read as a sentence', () => {
  const record = (overrides: Partial<PeriodRecord> = {}): PeriodRecord => ({
    id: 'record-1',
    startDate: toISODate('2026-09-10'),
    endDate: toISODate('2026-09-14'),
    isOngoing: false,
    ...overrides,
  });

  it('reads a finished record as a start and an end', () => {
    expect(recordAccessibilityLabelIn(historyMessages.en, record(), 'en')).toBe(
      'Started: 10 September 2026, ended: 14 September 2026'
    );
  });

  it('reads a running record as still going', () => {
    expect(recordAccessibilityLabelIn(historyMessages.en, record({ isOngoing: true }), 'en')).toBe(
      'Started: 10 September 2026, still going'
    );
  });

  it('reads a record with no end as not known, which is a third thing', () => {
    // A period with no end date is not the same as one still running, and the
    // English must keep them apart the way the Turkish does.
    const label = recordAccessibilityLabelIn(
      historyMessages.en,
      record({ endDate: undefined }),
      'en'
    );

    expect(label).toBe('Started: 10 September 2026, end date not known');
    expect(label).not.toContain('still going');
  });

  it('keeps the three states distinct in Turkish too', () => {
    const states = [
      recordAccessibilityLabelIn(historyMessages.tr, record(), 'tr'),
      recordAccessibilityLabelIn(historyMessages.tr, record({ isOngoing: true }), 'tr'),
      recordAccessibilityLabelIn(historyMessages.tr, record({ endDate: undefined }), 'tr'),
    ];

    expect(new Set(states).size).toBe(3);
  });
});

describe('how a record end reads on its own', () => {
  const record = (overrides: Partial<PeriodRecord> = {}): PeriodRecord => ({
    id: 'record-1',
    startDate: toISODate('2026-09-10'),
    endDate: toISODate('2026-09-14'),
    isOngoing: false,
    ...overrides,
  });

  it('is the date when there is one', () => {
    expect(recordEndLabelIn(historyMessages.en, record(), 'en')).toBe('14 September 2026');
  });

  it('never estimates one from the average period length', () => {
    // What was never recorded stays unrecorded.
    expect(recordEndLabelIn(historyMessages.en, record({ endDate: undefined }), 'en')).toBe(
      historyMessages.en.recordUnknownEndLabel
    );
  });
});

describe('the words that warn', () => {
  it('still says deleting cannot be undone', () => {
    expect(historyMessages.en.deleteConsequence).toMatch(/cannot be undone/i);
  });

  it('still says what removing an end date does to the record', () => {
    expect(historyMessages.en.clearEndConsequence).toMatch(/not known/i);
  });
});
