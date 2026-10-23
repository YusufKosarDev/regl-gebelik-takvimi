import type { ISODate } from '@/types/iso-date';
import { getISOWeekday, toISODate } from '@/utils/date';

import {
  formatDisplayDate,
  formatDisplayDateWithWeekday,
  formatDisplayMonth,
} from '../format-date';

describe('formatDisplayDate', () => {
  it('formats a date in Turkish', () => {
    expect(formatDisplayDate(toISODate('2026-09-17'))).toBe('17 Eylül 2026');
  });

  it.each<[string, string]>([
    ['2026-01-01', '1 Ocak 2026'],
    ['2026-02-28', '28 Şubat 2026'],
    ['2026-03-09', '9 Mart 2026'],
    ['2026-04-30', '30 Nisan 2026'],
    ['2026-05-15', '15 Mayıs 2026'],
    ['2026-06-01', '1 Haziran 2026'],
    ['2026-07-04', '4 Temmuz 2026'],
    ['2026-08-31', '31 Ağustos 2026'],
    ['2026-09-17', '17 Eylül 2026'],
    ['2026-10-10', '10 Ekim 2026'],
    ['2026-11-11', '11 Kasım 2026'],
    ['2026-12-31', '31 Aralık 2026'],
  ])('formats %s as %s', (iso, expected) => {
    expect(formatDisplayDate(toISODate(iso))).toBe(expected);
  });

  it('drops the leading zero from single digit days', () => {
    expect(formatDisplayDate(toISODate('2026-09-01'))).toBe('1 Eylül 2026');
  });

  it('formats a leap day', () => {
    expect(formatDisplayDate(toISODate('2024-02-29'))).toBe('29 Şubat 2024');
  });

  it('does not depend on the device locale', () => {
    // A fixed table, so the output cannot change with Intl availability.
    const formatted = formatDisplayDate('2026-09-17' as ISODate);

    expect(formatted).toBe('17 Eylül 2026');
    expect(formatted).not.toMatch(/September|Sep/);
  });
});

describe('formatDisplayMonth', () => {
  it('renders a month and year', () => {
    expect(formatDisplayMonth(2026, 9)).toBe('Eylül 2026');
  });

  it.each<[number, string]>([
    [1, 'Ocak 2026'],
    [2, 'Şubat 2026'],
    [3, 'Mart 2026'],
    [4, 'Nisan 2026'],
    [5, 'Mayıs 2026'],
    [6, 'Haziran 2026'],
    [7, 'Temmuz 2026'],
    [8, 'Ağustos 2026'],
    [9, 'Eylül 2026'],
    [10, 'Ekim 2026'],
    [11, 'Kasım 2026'],
    [12, 'Aralık 2026'],
  ])('renders month %i as %s', (month, expected) => {
    expect(formatDisplayMonth(2026, month)).toBe(expected);
  });

  it('uses the same month names as formatDisplayDate', () => {
    for (let month = 1; month <= 12; month += 1) {
      const iso = `2026-${String(month).padStart(2, '0')}-01`;
      const [, monthName] = formatDisplayDate(toISODate(iso)).split(' ');

      expect(formatDisplayMonth(2026, month)).toBe(`${monthName} 2026`);
    }
  });

  it('rejects a month outside 1-12', () => {
    expect(() => formatDisplayMonth(2026, 0)).toThrow(/month between 1 and 12/);
    expect(() => formatDisplayMonth(2026, 13)).toThrow(/month between 1 and 12/);
  });

  it('does not depend on the device locale', () => {
    expect(formatDisplayMonth(2026, 9)).not.toMatch(/September|Sep/);
  });
});

describe('formatDisplayDateWithWeekday', () => {
  /**
   * The weekday a seven-column grid cannot say out loud.
   *
   * Both calendar grids draw their column headers for the eye and hide them
   * from assistive technology, so the weekday has to be in the square itself.
   * These dates are a known week: 19 October 2026 is a Monday.
   */
  it('names the weekday in front of the date', () => {
    expect(formatDisplayDateWithWeekday(toISODate('2026-10-19'))).toBe(
      'Pazartesi, 19 Ekim 2026'
    );
  });

  it('walks the whole week in order, Monday first', () => {
    const week = ['19', '20', '21', '22', '23', '24', '25'].map((day) =>
      formatDisplayDateWithWeekday(toISODate(`2026-10-${day}`)).split(',')[0]
    );

    expect(week).toEqual([
      'Pazartesi',
      'Salı',
      'Çarşamba',
      'Perşembe',
      'Cuma',
      'Cumartesi',
      'Pazar',
    ]);
  });

  it('says it in English for an English reader', () => {
    expect(formatDisplayDateWithWeekday(toISODate('2026-10-25'), 'en')).toBe(
      'Sunday, 25 October 2026'
    );
  });

  it('keeps the date exactly as the plain formatter renders it', () => {
    // The weekday is a prefix, not a reformatting. Anything that splits a date
     // on spaces still finds the same three tokens after the comma.
    for (const language of ['tr', 'en'] as const) {
      const date = toISODate('2026-03-07');

      expect(formatDisplayDateWithWeekday(date, language)).toContain(
        formatDisplayDate(date, language)
      );
    }
  });

  it('agrees with getISOWeekday rather than keeping its own count', () => {
    // A second opinion about which day is Monday is how the grid and the label
    // end up one column apart.
    const date = toISODate('2026-02-28');
    const names = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

    expect(formatDisplayDateWithWeekday(date).split(',')[0]).toBe(
      names[getISOWeekday(date) - 1]
    );
  });
});
