import type { ISODate } from '@/types/iso-date';
import { toISODate } from '@/utils/date';

import { parseLastPeriodStartDateParam } from '../parse-last-period-start-date-param';

const TODAY = toISODate('2026-09-17');

describe('parseLastPeriodStartDateParam', () => {
  it('accepts today', () => {
    expect(parseLastPeriodStartDateParam('2026-09-17', TODAY)).toBe('2026-09-17');
  });

  it.each(['2026-09-16', '2026-08-31', '2025-12-31', '2024-02-29', '2000-01-01'])(
    'accepts the past date %s',
    (value) => {
      expect(parseLastPeriodStartDateParam(value, TODAY)).toBe(value);
    }
  );

  it.each(['2026-09-18', '2026-10-01', '2027-01-01'])('rejects the future date %s', (value) => {
    expect(parseLastPeriodStartDateParam(value, TODAY)).toBeNull();
  });

  it('rejects a missing value', () => {
    expect(parseLastPeriodStartDateParam(undefined, TODAY)).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(parseLastPeriodStartDateParam('', TODAY)).toBeNull();
  });

  it.each(['abc', '17-09-2026', '2026/09/17', '2026-9-7', '20260917'])(
    'rejects the malformed value %s',
    (value) => {
      expect(parseLastPeriodStartDateParam(value, TODAY)).toBeNull();
    }
  );

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '2026-09-00', '2026-02-29'])(
    'rejects the impossible date %s',
    (value) => {
      expect(parseLastPeriodStartDateParam(value, TODAY)).toBeNull();
    }
  );

  it('rejects an array of values', () => {
    expect(parseLastPeriodStartDateParam(['2026-09-17'], TODAY)).toBeNull();
    expect(parseLastPeriodStartDateParam([], TODAY)).toBeNull();
  });

  it('uses the supplied today rather than the clock', () => {
    const earlierToday = toISODate('2026-09-10');

    expect(parseLastPeriodStartDateParam('2026-09-17', earlierToday)).toBeNull();
    expect(parseLastPeriodStartDateParam('2026-09-10', earlierToday)).toBe('2026-09-10');
  });

  it('accepts a leap day when today is later that year', () => {
    const today2024 = '2024-06-01' as ISODate;

    expect(parseLastPeriodStartDateParam('2024-02-29', today2024)).toBe('2024-02-29');
  });
});
