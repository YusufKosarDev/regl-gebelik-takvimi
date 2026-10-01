import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import type { SyncConflictSideSummary } from '../../application/build-conflict-preview';
import {
  comparisonRowLabelIn,
  conflictDeviceLabelIn,
  conflictFailureMessageIn,
  conflictLabels,
  conflictLastChangeLabelIn,
  conflictPresenceLabelIn,
  conflictRecordCountLabelIn,
} from '../conflict-labels';

/**
 * The conflict screen, in both languages.
 *
 * Its own file rather than a block inside `conflict-labels.test.ts`, which
 * asserts the Turkish and predates the second language. Nothing in it moved.
 *
 * This screen asks somebody to throw one of two versions of their own period
 * history away. Its three rules are asserted here rather than left to the copy:
 * say what will be destroyed, never show a date or a value, never imply a
 * merge.
 */

const FAILURES = [
  'revision-moved',
  'network-failed',
  'local-failed',
  'app-out-of-date',
  'unknown',
] as const;

describe('parity', () => {
  describeCatalogueParity(conflictLabels, {
    functions: [
      ['recordCount', [0], [1], [3]],
      ['lastChange', ['17/09/2026', '14:05']],
      ['comparisonRow', ['Period records', 'This device', '3 records', 'Cloud', '1 record']],
    ],
    // The first two are joins of values their callers have already translated.
    // 'Avatar' is the same word in both languages, and it is the one this app
    // draws rather than a noun it chose.
    identical: ['lastChange', 'comparisonRow', 'conflictRowAvatar'],
  });
});

describe('saying what will be destroyed', () => {
  it('tells each choice what it replaces, not only what it keeps', () => {
    // "Keep the cloud one" sounds additive and is not.
    expect(conflictLabels.en.conflictKeepLocalWarning).toMatch(/will be replaced/i);
    expect(conflictLabels.en.conflictKeepRemoteWarning).toMatch(/will be replaced/i);
  });

  it('says each one cannot be undone', () => {
    for (const catalogue of [conflictLabels.tr, conflictLabels.en]) {
      expect(catalogue.conflictKeepLocalWarning).toMatch(/geri alınamaz|cannot be undone/i);
      expect(catalogue.conflictKeepRemoteWarning).toMatch(/geri alınamaz|cannot be undone/i);
    }
  });

  it('keeps the two warnings pointing opposite ways', () => {
    // A translation that blurred them would let somebody destroy the side they
    // meant to keep.
    for (const catalogue of [conflictLabels.tr, conflictLabels.en]) {
      expect(catalogue.conflictKeepLocalWarning).not.toBe(catalogue.conflictKeepRemoteWarning);
    }
  });

  it('says the unchosen side is deleted, in the unresolved body', () => {
    expect(conflictLabels.en.conflictBodyUnresolved).toMatch(/will be deleted/i);
  });
});

describe('never showing a record', () => {
  it('reports a count and nothing else', () => {
    // The same line the restore preview holds: how many, never which day.
    const summary = { periodRecordCount: 3 } as SyncConflictSideSummary;

    expect(conflictRecordCountLabelIn(conflictLabels.en, summary)).toBe('3 records');
    expect(conflictRecordCountLabelIn(conflictLabels.tr, summary)).toBe('3 kayıt');
  });

  it('pluralises the count in English', () => {
    expect(conflictLabels.en.recordCount(1)).toBe('1 record');
    expect(conflictLabels.en.recordCount(0)).toBe('0 records');
  });

  it('says only whether the other three things are there', () => {
    for (const catalogue of [conflictLabels.tr, conflictLabels.en]) {
      expect(conflictPresenceLabelIn(catalogue, true)).not.toBe(
        conflictPresenceLabelIn(catalogue, false)
      );
    }
  });

  it('names a device only as this one or another one', () => {
    // The stored id is a random per-install string with no name in it, and the
    // distinction somebody needs is whether the other version is their own
    // older write or a different phone's.
    expect(conflictDeviceLabelIn(conflictLabels.en, true)).toBe('This device');
    expect(conflictDeviceLabelIn(conflictLabels.en, false)).toBe('Another device');
  });
});

describe('when the cloud side was last written', () => {
  it('separates the date the way the language does', () => {
    const at = new Date('2026-09-17T14:05:00').toISOString();

    expect(conflictLastChangeLabelIn(conflictLabels.en, 'en', at)).toContain('17/09/2026');
    expect(conflictLastChangeLabelIn(conflictLabels.tr, 'tr', at)).toContain('17.09.2026');
  });

  it('says it is not known rather than inventing one', () => {
    for (const catalogue of [conflictLabels.tr, conflictLabels.en]) {
      expect(conflictLastChangeLabelIn(catalogue, 'en', null)).toBe(catalogue.conflictUnknown);
      expect(conflictLastChangeLabelIn(catalogue, 'en', 'not a date')).toBe(
        catalogue.conflictUnknown
      );
    }
  });
});

describe('every failure has a sentence', () => {
  it.each(FAILURES)('%s is answered in both languages', (reason) => {
    for (const catalogue of [conflictLabels.tr, conflictLabels.en]) {
      expect(conflictFailureMessageIn(catalogue, reason).trim()).not.toBe('');
    }
  });

  it('says nothing was changed for every one that is a fault', () => {
    // A conflict that failed to resolve must never leave somebody thinking one
    // side won. 'revision-moved' is the exception and is checked below: it is
    // not a fault, and both languages answer it by asking for the choice again
    // rather than by reporting a failure.
    for (const reason of FAILURES.filter((r) => r !== 'revision-moved')) {
      expect(conflictFailureMessageIn(conflictLabels.en, reason)).toMatch(
        /nothing was changed|nothing would be overwritten/i
      );
    }
  });

  it('does not make a lost race read as a fault', () => {
    expect(conflictFailureMessageIn(conflictLabels.en, 'revision-moved')).toMatch(
      /make your choice again/i
    );
  });
});

describe('one comparison row, read as one thing', () => {
  it('names the two columns inside the row', () => {
    // The row prints a label and two values in columns, which a screen reader
    // would otherwise announce as three unrelated fragments.
    expect(comparisonRowLabelIn(conflictLabels.en, 'Period records', '3 records', '1 record')).toBe(
      'Period records: This device 3 records, Cloud 1 record'
    );
  });
});
