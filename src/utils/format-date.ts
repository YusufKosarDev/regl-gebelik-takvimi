import type { Language } from '@/i18n/language';
import { SOURCE_LANGUAGE } from '@/i18n/language';
import type { ISODate } from '@/types/iso-date';

/**
 * Renders an `ISODate` for display, in the language the reader is being shown.
 *
 * Month names are local tables rather than `Intl`: Hermes ships without full
 * ICU data on Android unless it is explicitly enabled, so `Intl` would quietly
 * fall back to English on some devices and not on others. A fixed table is
 * small and always right, and that argument did not change when a second
 * language arrived — it doubled.
 *
 * Display only — the ISO string stays the value that moves through navigation
 * and storage.
 *
 * ## Why the import is `@/i18n/language` and not `@/i18n`
 *
 * The barrel re-exports `use-language.ts`, which reaches `expo-localization`
 * and the app store. Importing it here would drag a platform module and a
 * React hook into every consumer of a pure formatting util, and — because the
 * store's state type imports this file's neighbours — would close an import
 * cycle. `language.ts` is a pure leaf, so naming it directly is deliberate
 * rather than a shortcut past the barrel convention.
 *
 * ## Why `language` is optional
 *
 * So that the eighty-odd existing assertions, which predate the second
 * language and call these functions with one argument, keep passing unchanged
 * and go on proving that the Turkish output is what it always was.
 *
 * The price is that a call site which forgets the argument renders Turkish to
 * an English reader, and nothing in the type system or the suite would notice:
 * a string is a valid string, and the suite renders Turkish anyway. That is
 * the same hole `no-turkish-outside-catalogues` exists to close, so it is
 * closed the same way — `require-language-argument` in that file makes the
 * argument mandatory everywhere except the tests that are pinning the default.
 */

/**
 * The month names, one row per language.
 *
 * English is day-first ("17 September 2026") rather than the American
 * month-first. Two reasons, and the second is the one that decided it: it is
 * what `en-GB` does, which is the locale this app's English tests declare; and
 * it keeps the token order identical in both languages, so anything that takes
 * a date apart by splitting on spaces — the cross-check test below does — works
 * the same way whichever language produced it.
 */
const MONTH_NAMES: Readonly<Record<Language, readonly string[]>> = {
  tr: [
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

export function formatDisplayDate(date: ISODate, language: Language = SOURCE_LANGUAGE): string {
  const [year, month, day] = date.split('-');
  const monthName = MONTH_NAMES[language][Number(month) - 1];

  return `${Number(day)} ${monthName} ${Number(year)}`;
}

/**
 * Renders a calendar month for display, e.g. "Eylül 2026" / "September 2026".
 * `month` is 1-12.
 *
 * The range is checked against the month number itself rather than against the
 * table the language selected. Both tables have twelve entries, so the two
 * checks agree today — but a language added with a short table would otherwise
 * turn a bad month number into a bad language report, and the caller passing 13
 * would be told the wrong thing about which of its two arguments was wrong.
 */
export function formatDisplayMonth(
  year: number,
  month: number,
  language: Language = SOURCE_LANGUAGE
): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`formatDisplayMonth expects a month between 1 and 12, received ${month}.`);
  }

  return `${MONTH_NAMES[language][month - 1]} ${year}`;
}
