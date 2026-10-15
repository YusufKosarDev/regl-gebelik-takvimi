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

/**
 * The steppers cannot offer a day inside the record next door.
 *
 * These bounds exist so "a control cannot offer a date that saving would then
 * refuse" - and saving now refuses overlaps. The whole record list is passed
 * so the bounds can find the neighbours; a record with no end date bounds
 * nothing beyond its start, the same stance the floor already documents.
 */
describe('bounds beside a neighbouring record', () => {
  const previous: PeriodRecord = {
    id: 'previous',
    startDate: toISODate('2026-08-25'),
    endDate: toISODate('2026-09-01'),
    isOngoing: false,
  };

  const next: PeriodRecord = {
    id: 'next',
    startDate: toISODate('2026-09-20'),
    endDate: toISODate('2026-09-24'),
    isOngoing: false,
  };

  it('keeps a start after the previous period ended', () => {
    const edited: PeriodRecord = {
      id: 'edited',
      startDate: toISODate('2026-09-10'),
      isOngoing: true,
    };

    expect(minSelectableStartDate(edited, [previous, edited])).toBe('2026-09-02');
  });

  it('keeps whichever floor is nearer: the duration limit or the neighbour', () => {
    const edited: PeriodRecord = {
      id: 'edited',
      startDate: toISODate('2026-09-10'),
      endDate: toISODate('2026-09-14'),
      isOngoing: false,
    };

    // The duration floor alone would reach back to 26 August; the previous
    // record ends on 1 September, so 2 September is as far as a start may go.
    expect(minSelectableStartDate(edited, [previous, edited])).toBe('2026-09-02');
  });

  it('keeps an endless record from starting on top of the next one', () => {
    const edited: PeriodRecord = {
      id: 'edited',
      startDate: toISODate('2026-09-10'),
      isOngoing: false,
    };

    expect(maxSelectableStartDate(edited, toISODate('2026-12-31'), [edited, next])).toBe(
      '2026-09-19'
    );
  });

  it('keeps an end before the next period begins', () => {
    expect(
      maxSelectableEndDate(toISODate('2026-09-10'), toISODate('2026-12-31'), [next])
    ).toBe('2026-09-19');
  });

  it('bounds nothing when there is no neighbour on that side', () => {
    const edited: PeriodRecord = {
      id: 'edited',
      startDate: toISODate('2026-09-10'),
      isOngoing: true,
    };

    expect(minSelectableStartDate(edited, [edited, next])).toBeNull();
  });

  it('lets a previous record with no end date bound nothing', () => {
    const openEnded: PeriodRecord = {
      id: 'open-ended',
      startDate: toISODate('2026-08-25'),
      isOngoing: false,
    };
    const edited: PeriodRecord = {
      id: 'edited',
      startDate: toISODate('2026-09-10'),
      isOngoing: true,
    };

    expect(minSelectableStartDate(edited, [openEnded, edited])).toBeNull();
  });
});
