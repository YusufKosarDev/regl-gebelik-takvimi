import { observeCycleLengths } from '../observed-cycle-lengths';
import { STALE_PREDICTION_DAYS, assessPredictionConfidence } from '../prediction-confidence';
import type { CycleProfile, PeriodRecord } from '../types';

import type { ISODate } from '@/types/iso-date';
import { addDays, toISODate } from '@/utils/date';

/**
 * How much the app should claim about the next period.
 *
 * The case this module was written for is the one in the last block: after a
 * pregnancy the old records are still there, and the arithmetic will happily
 * report a date from last spring. The rule is deliberately about the age of the
 * records rather than about pregnancy, because the same thing happens to
 * anybody who stops logging.
 */

function profileWithGaps(gaps: readonly number[]): { profile: CycleProfile; lastStart: ISODate } {
  const records: PeriodRecord[] = [];
  let start = toISODate('2026-01-01');

  records.push({ id: `period-${start}`, startDate: start, isOngoing: false });

  for (const gap of gaps) {
    start = addDays(start, gap);
    records.push({ id: `period-${start}`, startDate: start, isOngoing: false });
  }

  return {
    profile: {
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: records,
    },
    lastStart: start,
  };
}

function confidenceAfter(gaps: readonly number[], daysSinceLastStart: number) {
  const { profile, lastStart } = profileWithGaps(gaps);

  return assessPredictionConfidence(
    profile,
    observeCycleLengths(profile),
    addDays(lastStart, daysSinceLastStart)
  );
}

describe('nothing to count from', () => {
  it('is none with no records', () => {
    const empty: CycleProfile = {
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [],
    };

    expect(assessPredictionConfidence(empty, observeCycleLengths(empty), toISODate('2026-05-01')))
      .toBe('none');
  });
});

describe('a fresh record', () => {
  it('is a single date when the cycles agree', () => {
    expect(confidenceAfter([28, 29, 30], 10)).toBe('single');
  });

  it('is a range when the cycles vary', () => {
    expect(confidenceAfter([24, 30, 36], 10)).toBe('ranged');
  });

  it('is a single date when there is not enough to call it irregular', () => {
    // 'unknown' regularity is not 'irregular'. One recorded gap says nothing
    // about variation, so the app keeps showing the one date it can justify.
    expect(confidenceAfter([28], 10)).toBe('single');
  });
});

describe('a record too old to mean anything', () => {
  it('is stale past the longest a cycle can be', () => {
    expect(confidenceAfter([28, 29, 30], STALE_PREDICTION_DAYS + 1)).toBe('stale');
  });

  it('is not stale at exactly the threshold', () => {
    expect(confidenceAfter([28, 29, 30], STALE_PREDICTION_DAYS)).not.toBe('stale');
  });

  it('is stale after a pregnancy, without knowing anything about pregnancies', () => {
    // Nine months of no periods with pre-pregnancy records still on file. This
    // is the case that prompted the module; nothing in it mentions pregnancy,
    // which is the point.
    expect(confidenceAfter([28, 29, 30], 280)).toBe('stale');
  });

  it('is stale for somebody who simply stopped logging', () => {
    // The same answer for the same reason. A pregnancy-specific rule would have
    // left this person looking at a date from four months ago.
    expect(confidenceAfter([28, 29, 30], 120)).toBe('stale');
  });

  it('outranks irregularity', () => {
    // A stale range is not better than a stale date. When the records are too
    // old, the honest answer is that the app does not know.
    expect(confidenceAfter([24, 30, 36], 280)).toBe('stale');
  });
});
