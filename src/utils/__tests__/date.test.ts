import {
  addDays,
  daysBetween,
  formatLocalDate,
  getDaysInMonth,
  getISOWeekday,
  isISODate,
  toISODate,
} from '@/utils/date';

describe('isISODate', () => {
  it('accepts a real calendar date', () => {
    expect(isISODate('2026-01-01')).toBe(true);
  });

  it('accepts 29 February in a leap year', () => {
    expect(isISODate('2024-02-29')).toBe(true);
  });

  it('rejects 29 February in a non-leap year', () => {
    expect(isISODate('2026-02-29')).toBe(false);
  });

  it('rejects a day past the end of the month', () => {
    expect(isISODate('2026-02-30')).toBe(false);
  });

  it('rejects an out-of-range month', () => {
    expect(isISODate('2026-13-01')).toBe(false);
  });

  it('rejects month zero', () => {
    expect(isISODate('2026-00-10')).toBe(false);
  });

  it('rejects day zero', () => {
    expect(isISODate('2026-01-00')).toBe(false);
  });

  it('rejects malformed shapes', () => {
    expect(isISODate('2026-1-01')).toBe(false);
    expect(isISODate('26-01-01')).toBe(false);
    expect(isISODate('2026/01/01')).toBe(false);
    expect(isISODate('2026-01-01T00:00:00Z')).toBe(false);
    expect(isISODate('')).toBe(false);
  });

  it('treats century years correctly', () => {
    expect(isISODate('2000-02-29')).toBe(true);
    expect(isISODate('1900-02-29')).toBe(false);
  });
});

describe('toISODate', () => {
  it('returns the value when it is a real calendar date', () => {
    expect(toISODate('2026-01-01')).toBe('2026-01-01');
  });

  it('throws on an invalid calendar date', () => {
    expect(() => toISODate('2026-02-30')).toThrow(/Invalid ISO date/);
  });
});

describe('formatLocalDate', () => {
  it('zero-pads month and day', () => {
    expect(formatLocalDate(2026, 1, 5)).toBe('2026-01-05');
  });

  it('does not roll overflowing days into the next month', () => {
    expect(() => formatLocalDate(2026, 2, 30)).toThrow(/Invalid calendar date/);
  });

  it('rejects out-of-range months', () => {
    expect(() => formatLocalDate(2026, 13, 1)).toThrow(/Invalid calendar date/);
    expect(() => formatLocalDate(2026, 0, 10)).toThrow(/Invalid calendar date/);
  });

  it('accepts 29 February in a leap year', () => {
    expect(formatLocalDate(2024, 2, 29)).toBe('2024-02-29');
  });
});

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays(toISODate('2026-01-31'), 1)).toBe('2026-02-01');
  });

  it('crosses a year boundary', () => {
    expect(addDays(toISODate('2026-12-31'), 1)).toBe('2027-01-01');
  });

  it('steps through 29 February in a leap year', () => {
    expect(addDays(toISODate('2024-02-28'), 1)).toBe('2024-02-29');
    expect(addDays(toISODate('2024-02-29'), 1)).toBe('2024-03-01');
  });

  it('skips 29 February in a non-leap year', () => {
    expect(addDays(toISODate('2026-02-28'), 1)).toBe('2026-03-01');
  });

  it('subtracts days', () => {
    expect(addDays(toISODate('2026-03-01'), -1)).toBe('2026-02-28');
    expect(addDays(toISODate('2024-03-01'), -1)).toBe('2024-02-29');
    expect(addDays(toISODate('2027-01-01'), -1)).toBe('2026-12-31');
  });

  it('returns the same day for zero', () => {
    expect(addDays(toISODate('2026-06-15'), 0)).toBe('2026-06-15');
  });

  it('is unaffected by DST transitions', () => {
    // 2026-03-29 is a European DST spring-forward date.
    expect(addDays(toISODate('2026-03-28'), 1)).toBe('2026-03-29');
    expect(addDays(toISODate('2026-03-29'), 1)).toBe('2026-03-30');
    // 2026-03-08 is a US DST spring-forward date.
    expect(addDays(toISODate('2026-03-07'), 2)).toBe('2026-03-09');
  });

  it('round-trips over a long span', () => {
    const start = toISODate('2026-01-01');
    expect(addDays(addDays(start, 400), -400)).toBe(start);
  });

  it('rejects a fractional amount', () => {
    expect(() => addDays(toISODate('2026-01-01'), 1.5)).toThrow(/integer amount/);
  });
});

describe('daysBetween', () => {
  it('is zero for the same day', () => {
    expect(daysBetween(toISODate('2026-05-10'), toISODate('2026-05-10'))).toBe(0);
  });

  it('is positive when end follows start', () => {
    expect(daysBetween(toISODate('2026-01-01'), toISODate('2026-01-31'))).toBe(30);
  });

  it('is negative when end precedes start', () => {
    expect(daysBetween(toISODate('2026-01-31'), toISODate('2026-01-01'))).toBe(-30);
  });

  it('counts across a year boundary', () => {
    expect(daysBetween(toISODate('2026-12-31'), toISODate('2027-01-01'))).toBe(1);
  });

  it('counts a leap year as 366 days', () => {
    expect(daysBetween(toISODate('2024-01-01'), toISODate('2025-01-01'))).toBe(366);
    expect(daysBetween(toISODate('2026-01-01'), toISODate('2027-01-01'))).toBe(365);
  });

  it('is unaffected by DST transitions', () => {
    expect(daysBetween(toISODate('2026-03-07'), toISODate('2026-03-09'))).toBe(2);
    expect(daysBetween(toISODate('2026-03-28'), toISODate('2026-03-30'))).toBe(2);
    expect(daysBetween(toISODate('2026-10-24'), toISODate('2026-10-26'))).toBe(2);
  });

  it('agrees with addDays', () => {
    const start = toISODate('2026-02-10');
    expect(daysBetween(start, addDays(start, 45))).toBe(45);
    expect(daysBetween(start, addDays(start, -45))).toBe(-45);
  });
});

describe('getDaysInMonth', () => {
  it.each<[number, number, number]>([
    [2026, 1, 31],
    [2026, 2, 28],
    [2026, 3, 31],
    [2026, 4, 30],
    [2026, 5, 31],
    [2026, 6, 30],
    [2026, 7, 31],
    [2026, 8, 31],
    [2026, 9, 30],
    [2026, 10, 31],
    [2026, 11, 30],
    [2026, 12, 31],
  ])('counts %i-%i as %i days', (year, month, expected) => {
    expect(getDaysInMonth(year, month)).toBe(expected);
  });

  it('follows the leap year rules for February', () => {
    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2000, 2)).toBe(29);
    expect(getDaysInMonth(1900, 2)).toBe(28);
  });

  it('answers for December 9999, where counting to the next month cannot reach', () => {
    expect(getDaysInMonth(9999, 12)).toBe(31);
  });

  it('agrees with counting to the first of the next month', () => {
    for (let month = 1; month <= 11; month += 1) {
      const first = formatLocalDate(2024, month, 1);
      const nextFirst = formatLocalDate(2024, month + 1, 1);

      expect(getDaysInMonth(2024, month)).toBe(daysBetween(first, nextFirst));
    }
  });

  it('rejects a month outside 1-12', () => {
    expect(() => getDaysInMonth(2026, 0)).toThrow(/month between 1 and 12/);
    expect(() => getDaysInMonth(2026, 13)).toThrow(/month between 1 and 12/);
  });

  it('rejects a non-integer month', () => {
    expect(() => getDaysInMonth(2026, 1.5)).toThrow(/month between 1 and 12/);
  });

  it('rejects a year outside 0-9999', () => {
    expect(() => getDaysInMonth(-1, 1)).toThrow(/year between 0 and 9999/);
    expect(() => getDaysInMonth(10000, 1)).toThrow(/year between 0 and 9999/);
  });

  it('rejects a non-integer year', () => {
    expect(() => getDaysInMonth(2026.5, 1)).toThrow(/year between 0 and 9999/);
  });
});

describe('getISOWeekday', () => {
  it.each<[string, number, string]>([
    ['2026-09-17', 4, 'Thursday'],
    ['2026-09-01', 2, 'Tuesday'],
    ['2026-01-01', 4, 'Thursday'],
    ['2024-02-29', 4, 'Thursday'],
    ['2000-01-01', 6, 'Saturday'],
    ['1970-01-01', 4, 'Thursday'],
  ])('reads %s as %i (%s)', (iso, expected) => {
    expect(getISOWeekday(toISODate(iso))).toBe(expected);
  });

  it('runs Monday to Sunday as 1 to 7', () => {
    // 2026-06-01 is a Monday.
    const monday = toISODate('2026-06-01');

    for (let offset = 0; offset < 7; offset += 1) {
      expect(getISOWeekday(addDays(monday, offset))).toBe(offset + 1);
    }
  });

  it('advances by one and wraps after Sunday', () => {
    const start = toISODate('2026-09-01');

    for (let offset = 0; offset < 40; offset += 1) {
      const current = getISOWeekday(addDays(start, offset));
      const next = getISOWeekday(addDays(start, offset + 1));

      expect(next).toBe((current % 7) + 1);
    }
  });

  it('stays in range for dates before 1970', () => {
    // Floor-mod check: a plain `%` would go negative here.
    expect(getISOWeekday(toISODate('1969-12-31'))).toBe(3);
    expect(getISOWeekday(toISODate('1900-01-01'))).toBe(1);
  });

  it('holds at the year 0 boundary', () => {
    expect(() => getISOWeekday(toISODate('0000-01-01'))).not.toThrow();

    const weekday = getISOWeekday(toISODate('0000-01-01'));

    expect(Number.isInteger(weekday)).toBe(true);
    expect(weekday).toBeGreaterThanOrEqual(1);
    expect(weekday).toBeLessThanOrEqual(7);
  });

  it('never leaves 1-7 across a long span', () => {
    const start = toISODate('2020-01-01');

    for (let offset = 0; offset < 3000; offset += 7) {
      const weekday = getISOWeekday(addDays(start, offset));

      expect(weekday).toBeGreaterThanOrEqual(1);
      expect(weekday).toBeLessThanOrEqual(7);
    }
  });

  it('rejects a value that is not a real calendar date', () => {
    expect(() => getISOWeekday('2026-02-30' as never)).toThrow(/Invalid ISODate/);
  });
});
