import { LANGUAGES } from '@/i18n/language';
import { toISODate } from '@/utils/date';

import { formatDisplayDate, formatDisplayMonth } from '../format-date';

/**
 * The two month tables, held against each other.
 *
 * The same job `daily-log-messages.test.ts` does for that feature's catalogue
 * pair: the type system can prove both tables exist and have the right shape,
 * but not that somebody filled the second one in. A table pasted from the first
 * and left unedited compiles, renders, and shows Turkish to an English reader.
 *
 * The tables are not exported — there is no reason for anything to read them
 * directly — so every assertion here goes through `formatDisplayMonth`, which
 * is the only way the words reach anybody anyway.
 */

/** Every month name a language produces, in order. */
function monthNames(language: (typeof LANGUAGES)[number]): readonly string[] {
  return Array.from({ length: 12 }, (_unused, index) => {
    const [name] = formatDisplayMonth(2026, index + 1, language).split(' ');

    return name;
  });
}

describe('the month tables', () => {
  it.each(LANGUAGES)('%s names all twelve months', (language) => {
    const names = monthNames(language);

    expect(names).toHaveLength(12);

    for (const name of names) {
      expect(name.trim()).not.toBe('');
    }
  });

  it.each(LANGUAGES)('%s repeats no month name', (language) => {
    const names = monthNames(language);

    expect(new Set(names).size).toBe(12);
  });

  it('gives every month a different word in each language', () => {
    // The copy-paste detector. It holds because no Turkish month name is
    // spelled the way its English counterpart is - if a language is ever added
    // where one of them legitimately matches, this assertion is the right place
    // to record that rather than a reason to delete the check.
    const turkish = monthNames('tr');
    const english = monthNames('en');

    for (let month = 0; month < 12; month += 1) {
      expect(english[month]).not.toBe(turkish[month]);
    }
  });

  it('writes no Turkish letter into an English month name', () => {
    for (const name of monthNames('en')) {
      expect(name).not.toMatch(/[ğüşıöçĞÜŞİÖÇ]/);
    }
  });

  it('keeps the day and the year identical across languages', () => {
    // Only the month name is a word. If a language ever reordered or
    // re-spelled the numbers, everything that reads a formatted date back
    // apart would start disagreeing with itself.
    const date = toISODate('2026-09-17');
    const [turkishDay, , turkishYear] = formatDisplayDate(date, 'tr').split(' ');
    const [englishDay, , englishYear] = formatDisplayDate(date, 'en').split(' ');

    expect(englishDay).toBe(turkishDay);
    expect(englishYear).toBe(turkishYear);
  });
});
