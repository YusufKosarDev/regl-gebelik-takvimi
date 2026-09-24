import type { DailyEntry } from './catalogues';

import { describeValue } from '@/shared/logging';
import { isISODate } from '@/utils/date';

/**
 * Rules for one recorded day.
 *
 * Pure: reads its argument, throws on the first rule it breaks, never mutates
 * or reorders. No storage, no clock.
 *
 * What is deliberately *not* checked: whether an id is in a catalogue. A stored
 * day can name something a later build retired or something a newer build knows
 * and this one does not, and refusing the day for that would throw away what
 * somebody wrote. Ids are checked for being usable text; what they mean is the
 * catalogue's business and the screen skips what it cannot name.
 *
 * No message repeats a value. What is in here is a record of somebody's body.
 */

function assertId(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`DailyEntry ${field} must be non-blank text, received ${describeValue(value)}.`);
  }
}

export function validateDailyEntry(entry: DailyEntry): void {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new Error(`validateDailyEntry received something that is not an entry.`);
  }

  if (!isISODate(entry.date)) {
    throw new Error('DailyEntry has a date that is not YYYY-MM-DD.');
  }

  if (entry.flowId !== null) {
    assertId(entry.flowId, 'flowId');
  }

  if (entry.moodId !== null) {
    assertId(entry.moodId, 'moodId');
  }

  if (!Array.isArray(entry.symptomIds)) {
    throw new Error(
      `DailyEntry has symptomIds that are not a list: ${describeValue(entry.symptomIds)}.`
    );
  }

  const seen = new Set<string>();

  for (const id of entry.symptomIds) {
    assertId(id, 'symptomIds entry');

    if (seen.has(id)) {
      throw new Error('DailyEntry lists the same symptom twice.');
    }

    seen.add(id);
  }
}

/**
 * Checks a whole list of days, as a payload or a restore carries it.
 *
 * One day per date. Two rows for the same day would leave nothing able to say
 * which one the person meant, and the table's primary key refuses it anyway —
 * this is the same rule stated where a payload from outside the device meets
 * it.
 *
 * An empty day is refused rather than tolerated. A day with nothing in it is
 * deleted, not stored, so one arriving here means something upstream is writing
 * rows nobody asked for, and the payload would grow with them forever.
 */
export function validateDailyEntries(entries: readonly DailyEntry[]): void {
  if (!Array.isArray(entries)) {
    throw new Error(`Daily entries are not a list: ${describeValue(entries)}.`);
  }

  const seen = new Set<string>();

  for (const entry of entries) {
    validateDailyEntry(entry);

    if (seen.has(entry.date)) {
      throw new Error('Two daily entries fall on the same day.');
    }

    seen.add(entry.date);

    if (entry.flowId === null && entry.moodId === null && entry.symptomIds.length === 0) {
      throw new Error('A daily entry holds nothing; an empty day is deleted, not stored.');
    }
  }
}

/**
 * The same days, in an order two devices will agree on.
 *
 * Needed because a fingerprint has to reduce the same data to the same text
 * wherever it is computed, and neither SQLite nor a document that has been to
 * Firestore and back promises an order.
 *
 * Pure: a new list, sorted by date, with each day's symptoms sorted too.
 */
export function sortDailyEntries(entries: readonly DailyEntry[]): readonly DailyEntry[] {
  return [...entries]
    .map((entry) => ({ ...entry, symptomIds: [...entry.symptomIds].sort() }))
    .sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0));
}
