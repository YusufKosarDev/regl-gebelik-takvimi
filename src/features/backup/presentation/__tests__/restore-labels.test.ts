import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import type { CloudRestorePeriodRecordsPreview } from '../../domain/cloud-restore-preview-v1';
import {
  restoreLabels,
  restorePeriodRecordsLabelIn,
  restoreStatusLabelIn,
} from '../restore-labels';

/**
 * What a restore preview says, in both languages.
 *
 * The verdicts are the part that matters: somebody is being told what would
 * happen to their period history before they agree to it, and "will be removed"
 * has to be as unmistakable as "Silinecek".
 */

describe('parity', () => {
  describeCatalogueParity(restoreLabels, {
    functions: [
      ['added', [1], [3]],
      ['changed', [1], [3]],
      ['removed', [1], [3]],
    ],
  });
});

describe('the four verdicts', () => {
  it.each<['unchanged' | 'replace' | 'add' | 'remove']>([
    ['unchanged'],
    ['replace'],
    ['add'],
    ['remove'],
  ])('has a word for %s in both languages', (status) => {
    expect(restoreStatusLabelIn(restoreLabels.tr, status).trim()).not.toBe('');
    expect(restoreStatusLabelIn(restoreLabels.en, status).trim()).not.toBe('');
  });

  it('never says the same thing for adding and removing', () => {
    for (const labels of [restoreLabels.tr, restoreLabels.en]) {
      expect(restoreStatusLabelIn(labels, 'add')).not.toBe(restoreStatusLabelIn(labels, 'remove'));
    }
  });

  it('keeps every verdict in the future tense', () => {
    // None of it has happened yet - the person is being asked whether it
    // should. A past tense here would read as a report rather than a question.
    for (const status of ['unchanged', 'replace', 'add', 'remove'] as const) {
      expect(restoreStatusLabelIn(restoreLabels.en, status)).toMatch(/^Will /);
    }
  });
});

describe('counting what would move', () => {
  const records = (
    added: number,
    changed: number,
    removed: number
  ): CloudRestorePeriodRecordsPreview => ({
    added,
    changed,
    removed,
    // Not read by the label, but part of the preview the repository builds.
    localCount: 0,
    remoteCount: 0,
  });

  it('says so in words when nothing would move', () => {
    expect(restorePeriodRecordsLabelIn(restoreLabels.en, records(0, 0, 0))).toBe(
      restoreLabels.en.nothingWouldChange
    );
    expect(restorePeriodRecordsLabelIn(restoreLabels.tr, records(0, 0, 0))).toBe(
      restoreLabels.tr.nothingWouldChange
    );
  });

  it('leaves out the parts that are zero', () => {
    expect(restorePeriodRecordsLabelIn(restoreLabels.en, records(3, 0, 0))).toBe(
      '3 will be added'
    );
    expect(restorePeriodRecordsLabelIn(restoreLabels.tr, records(3, 0, 0))).toBe('3 eklenecek');
  });

  it('joins the parts that are not', () => {
    expect(restorePeriodRecordsLabelIn(restoreLabels.en, records(3, 1, 2))).toBe(
      '3 will be added, 1 will change, 2 will be removed'
    );
    expect(restorePeriodRecordsLabelIn(restoreLabels.tr, records(3, 1, 2))).toBe(
      '3 eklenecek, 1 değişecek, 2 silinecek'
    );
  });

  it('pluralises in English and not in Turkish', () => {
    expect(restorePeriodRecordsLabelIn(restoreLabels.en, records(1, 0, 0))).toBe(
      '1 will be added'
    );
    expect(restorePeriodRecordsLabelIn(restoreLabels.tr, records(1, 0, 0))).toBe('1 eklenecek');
  });
});
