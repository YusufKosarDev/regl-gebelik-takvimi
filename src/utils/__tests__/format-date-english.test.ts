import type { ISODate } from '@/types/iso-date';
import { toISODate } from '@/utils/date';

import { formatDisplayDate, formatDisplayMonth } from '../format-date';

/**
 * The same two functions, asked for English.
 *
 * ## Why this is a separate file
 *
 * `format-date.test.ts` beside it calls both functions with one argument and
 * asserts Turkish. Those calls are what pin the default, so they are left
 * exactly as they were — English gets its own file rather than a second
 * describe block inside theirs, and the two can never interfere.
 *
 * The language is passed explicitly here. Nothing in this file touches the
 * device or the store: which language a *screen* ends up in is
 * `resolveLanguage`'s question and is tested where that lives.
 */

describe('formatDisplayDate in English', () => {
  it('formats a date in English', () => {
    expect(formatDisplayDate(toISODate('2026-09-17'), 'en')).toBe('17 September 2026');
  });

  it.each<[string, string]>([
    ['2026-01-01', '1 January 2026'],
    ['2026-02-28', '28 February 2026'],
    ['2026-03-09', '9 March 2026'],
    ['2026-04-30', '30 April 2026'],
    ['2026-05-15', '15 May 2026'],
    ['2026-06-01', '1 June 2026'],
    ['2026-07-04', '4 July 2026'],
    ['2026-08-31', '31 August 2026'],
    ['2026-09-17', '17 September 2026'],
    ['2026-10-10', '10 October 2026'],
    ['2026-11-11', '11 November 2026'],
    ['2026-12-31', '31 December 2026'],
  ])('formats %s as %s', (iso, expected) => {
    expect(formatDisplayDate(toISODate(iso), 'en')).toBe(expected);
  });

  it('drops the leading zero from single digit days', () => {
    expect(formatDisplayDate(toISODate('2026-09-01'), 'en')).toBe('1 September 2026');
  });

  it('formats a leap day', () => {
    expect(formatDisplayDate(toISODate('2024-02-29'), 'en')).toBe('29 February 2024');
  });

  it('does not depend on the device locale', () => {
    // A fixed table, so the output cannot change with Intl availability.
    const formatted = formatDisplayDate('2026-09-17' as ISODate, 'en');

    expect(formatted).toBe('17 September 2026');
    expect(formatted).not.toMatch(/Eylül|Eyl/);
  });

  it('puts the day first, as en-GB does', () => {
    // Not a style preference: the cross-check below and anything else that
    // splits a formatted date on spaces depends on the two languages agreeing
    // about which token is which.
    const [first] = formatDisplayDate(toISODate('2026-09-17'), 'en').split(' ');

    expect(first).toBe('17');
  });
});

describe('formatDisplayMonth in English', () => {
  it('renders a month and year', () => {
    expect(formatDisplayMonth(2026, 9, 'en')).toBe('September 2026');
  });

  it.each<[number, string]>([
    [1, 'January 2026'],
    [2, 'February 2026'],
    [3, 'March 2026'],
    [4, 'April 2026'],
    [5, 'May 2026'],
    [6, 'June 2026'],
    [7, 'July 2026'],
    [8, 'August 2026'],
    [9, 'September 2026'],
    [10, 'October 2026'],
    [11, 'November 2026'],
    [12, 'December 2026'],
  ])('renders month %i as %s', (month, expected) => {
    expect(formatDisplayMonth(2026, month, 'en')).toBe(expected);
  });

  it('uses the same month names as formatDisplayDate', () => {
    for (let month = 1; month <= 12; month += 1) {
      const iso = `2026-${String(month).padStart(2, '0')}-01`;
      const [, monthName] = formatDisplayDate(toISODate(iso), 'en').split(' ');

      expect(formatDisplayMonth(2026, month, 'en')).toBe(`${monthName} 2026`);
    }
  });

  it('rejects a month outside 1-12 in either language', () => {
    // The guard is on the number, not on the table the language selected, so
    // it has to answer the same way whichever language asked.
    expect(() => formatDisplayMonth(2026, 0, 'en')).toThrow(/month between 1 and 12/);
    expect(() => formatDisplayMonth(2026, 13, 'en')).toThrow(/month between 1 and 12/);
    expect(() => formatDisplayMonth(2026, 0, 'tr')).toThrow(/month between 1 and 12/);
    expect(() => formatDisplayMonth(2026, 13, 'tr')).toThrow(/month between 1 and 12/);
  });

  it('does not depend on the device locale', () => {
    expect(formatDisplayMonth(2026, 9, 'en')).not.toMatch(/Eylül|Eyl/);
  });
});
