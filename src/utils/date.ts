import type { ISODate } from '@/types/iso-date';

/**
 * Date-only helpers.
 *
 * Calendar days are represented as `YYYY-MM-DD` strings and all arithmetic runs
 * on integer day numbers, so nothing here depends on the host timezone, on DST
 * transitions, or on the current time. No `Date` object is created anywhere.
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Day number of 1970-01-01 in the proleptic Gregorian calendar. */
const UNIX_EPOCH_DAY_SHIFT = 719468;
const DAYS_PER_ERA = 146097;
const MIN_YEAR = 0;
const MAX_YEAR = 9999;

function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

/** Howard Hinnant's `days_from_civil`: (year, month, day) -> days since 1970-01-01. */
function daysFromCivil(year: number, month: number, day: number): number {
  const shiftedYear = year - (month <= 2 ? 1 : 0);
  const era = floorDiv(shiftedYear, 400);
  const yearOfEra = shiftedYear - era * 400;
  const shiftedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = floorDiv(153 * shiftedMonth + 2, 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + floorDiv(yearOfEra, 4) - floorDiv(yearOfEra, 100) + dayOfYear;

  return era * DAYS_PER_ERA + dayOfEra - UNIX_EPOCH_DAY_SHIFT;
}

/** Inverse of `daysFromCivil`. */
function civilFromDays(dayNumber: number): { year: number; month: number; day: number } {
  const shifted = dayNumber + UNIX_EPOCH_DAY_SHIFT;
  const era = floorDiv(shifted, DAYS_PER_ERA);
  const dayOfEra = shifted - era * DAYS_PER_ERA;
  const yearOfEra = floorDiv(
    dayOfEra - floorDiv(dayOfEra, 1460) + floorDiv(dayOfEra, 36524) - floorDiv(dayOfEra, 146096),
    365
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + floorDiv(yearOfEra, 4) - floorDiv(yearOfEra, 100));
  const shiftedMonth = floorDiv(5 * dayOfYear + 2, 153);
  const day = dayOfYear - floorDiv(153 * shiftedMonth + 2, 5) + 1;
  const month = shiftedMonth + (shiftedMonth < 10 ? 3 : -9);
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);

  return { year, month, day };
}

function parseParts(value: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return isValidYmd(year, month, day) ? { year, month, day } : null;
}

function toDayNumber(date: ISODate): number {
  const parts = parseParts(date);
  if (!parts) {
    throw new Error(`Invalid ISODate: "${date}".`);
  }

  return daysFromCivil(parts.year, parts.month, parts.day);
}

/**
 * True when `value` is exactly `YYYY-MM-DD` *and* a real calendar date.
 * Rejects overflow such as `2026-02-30` and out-of-range parts such as `2026-13-01`.
 */
export function isISODate(value: string): boolean {
  return parseParts(value) !== null;
}

/** Narrows a string to `ISODate`, throwing when it is not a real calendar date. */
export function toISODate(value: string): ISODate {
  if (!isISODate(value)) {
    throw new Error(
      `Invalid ISO date: "${value}". Expected a real calendar date in YYYY-MM-DD format.`
    );
  }

  return value as ISODate;
}

/**
 * Builds an `ISODate` from calendar parts, with `month` in 1-12.
 *
 * Unlike `new Date(2026, 1, 30)`, out-of-range days are rejected rather than
 * rolled over into the next month.
 */
export function formatLocalDate(year: number, month: number, day: number): ISODate {
  if (!isValidYmd(year, month, day)) {
    throw new Error(`Invalid calendar date: year=${year}, month=${month}, day=${day}.`);
  }

  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as ISODate;
}

/** Shifts a calendar date by whole days. `amount` may be negative. */
export function addDays(date: ISODate, amount: number): ISODate {
  if (!Number.isInteger(amount)) {
    throw new Error(`addDays expects an integer amount, received ${amount}.`);
  }

  const { year, month, day } = civilFromDays(toDayNumber(date) + amount);

  return formatLocalDate(year, month, day);
}

/**
 * Calendar days from `start` to `end`: zero on the same day, negative when
 * `end` precedes `start`.
 */
export function daysBetween(start: ISODate, end: ISODate): number {
  return toDayNumber(end) - toDayNumber(start);
}
