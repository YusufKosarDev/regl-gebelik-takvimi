import { MAX_PERIOD_DURATION_DAYS } from '../limits';
import {
  maxSelectableEndDate,
  maxSelectableStartDate,
  minSelectableStartDate,
} from '../record-bounds';
import type { PeriodRecord } from '../types';

import { toISODate } from '@/utils/date';

/**
 * The bounds the history screen's steppers are held to.
 *
 * These moved out of `app/(app)/history.tsx`, where they had no tests of their
 * own - the screen's assertions reached them only through the buttons they
 * disable, so a wrong bound showed up as a button that would not press rather
 * than as a failing rule.
 */

function record(overrides: Partial<PeriodRecord> = {}): PeriodRecord {
  return {
    id: 'record-1',
    startDate: toISODate('2026-09-10'),
    endDate: toISODate('2026-09-14'),
    isOngoing: false,
    ...overrides,
  };
}

describe('maxSelectableEndDate', () => {
  it('stops at today when the duration limit is further away', () => {
    expect(maxSelectableEndDate(toISODate('2026-09-10'), toISODate('2026-09-12'))).toBe(
      '2026-09-12'
    );
  });

  it('stops at the duration limit when today is further away', () => {
    // The limit counts both end days, so a start on the 10th allows an end
    // MAX_PERIOD_DURATION_DAYS - 1 days later.
    const limit = maxSelectableEndDate(toISODate('2026-09-10'), toISODate('2026-12-31'));

    expect(limit).toBe('2026-09-29');
    expect(MAX_PERIOD_DURATION_DAYS).toBe(20);
  });

  it('allows the start day itself, for a period that began and ended in a day', () => {
    expect(maxSelectableEndDate(toISODate('2026-09-10'), toISODate('2026-09-10'))).toBe(
      '2026-09-10'
    );
  });
});

describe('maxSelectableStartDate', () => {
  it('is today when nothing was recorded as an end', () => {
    expect(maxSelectableStartDate(record({ endDate: undefined }), toISODate('2026-09-20'))).toBe(
      '2026-09-20'
    );
  });

  it('is the end date when that is earlier than today', () => {
    // A period that finished on the 14th cannot have started on the 20th.
    expect(maxSelectableStartDate(record(), toISODate('2026-09-20'))).toBe('2026-09-14');
  });

  it('is today when the end date is somehow later than today', () => {
    expect(maxSelectableStartDate(record(), toISODate('2026-09-11'))).toBe('2026-09-11');
  });
});

describe('minSelectableStartDate', () => {
  it('has no floor when nothing was recorded as an end', () => {
    expect(minSelectableStartDate(record({ endDate: undefined }))).toBeNull();
  });

  it('reaches back exactly as far as the duration limit allows', () => {
    // Ending on the 14th, a record may span at most MAX_PERIOD_DURATION_DAYS
    // days counting both ends, so the earliest start is 19 days before it.
    expect(minSelectableStartDate(record())).toBe('2026-08-26');
  });

  it('never returns a floor later than the end date', () => {
    const floor = minSelectableStartDate(record());

    expect(floor).not.toBeNull();
    expect(floor! <= '2026-09-14').toBe(true);
  });
});
