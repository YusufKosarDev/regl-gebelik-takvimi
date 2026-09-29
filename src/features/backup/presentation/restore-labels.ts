import type { Messages } from '@/i18n';
import { plural } from '@/i18n';

import type {
  CloudRestorePeriodRecordsPreview,
  CloudRestoreStatus,
} from '../domain/cloud-restore-preview-v1';

/**
 * How a restore preview reads.
 *
 * Verdicts and counts, in the future tense, because none of it has happened
 * yet: the person is being asked whether it should. Nothing here takes a date,
 * a record or a value — the preview does not carry any, and this is what turns
 * what it does carry into a sentence.
 *
 * ## The two languages disagree about where the verb goes
 *
 * Turkish counts then acts - "3 eklenecek". English needs the verb first for
 * the sentence to read at all - "3 will be added" - and needs the noun to agree
 * with the number. The catalogue pair is what lets the English half be a
 * different sentence rather than a translated placeholder.
 */

const restoreLabelsTr = {
  statusLabels: {
    unchanged: 'Aynı kalacak',
    replace: 'Değişecek',
    add: 'Eklenecek',
    remove: 'Silinecek',
  } as Readonly<Record<CloudRestoreStatus, string>>,

  /** When a list would not move at all. Said in words rather than three zeroes. */
  nothingWouldChange: 'Aynı kalacak',

  added: (count: number) => `${count} eklenecek`,
  changed: (count: number) => `${count} değişecek`,
  removed: (count: number) => `${count} silinecek`,
};

export type RestoreLabels = typeof restoreLabelsTr;

const restoreLabelsEn: RestoreLabels = {
  statusLabels: {
    unchanged: 'Will stay the same',
    replace: 'Will change',
    add: 'Will be added',
    remove: 'Will be removed',
  },

  nothingWouldChange: 'Will stay the same',

  added: (count: number) => plural(count, '1 will be added', `${count} will be added`),
  changed: (count: number) => plural(count, '1 will change', `${count} will change`),
  removed: (count: number) => plural(count, '1 will be removed', `${count} will be removed`),
};

export const restoreLabels: Messages<RestoreLabels> = {
  tr: restoreLabelsTr,
  en: restoreLabelsEn,
};

/** What would happen to one stored thing. */
export function restoreStatusLabelIn(
  labels: RestoreLabels,
  status: CloudRestoreStatus
): string {
  return labels.statusLabels[status] ?? labels.statusLabels.unchanged;
}

/**
 * What would happen to a list of stored things.
 *
 * Used for the period history and for the recorded days: both can gain, lose
 * and change entries in one restore, so a single verdict would say none of it.
 *
 * Only the parts that are not zero, so "3 eklenecek" does not arrive padded
 * with two noughts. When nothing would move at all it says so in words.
 *
 * Takes the catalogue half rather than reading one, because it is a plain
 * function and the language is the caller's to know.
 */
export function restorePeriodRecordsLabelIn(
  labels: RestoreLabels,
  records: CloudRestorePeriodRecordsPreview
): string {
  const parts: string[] = [];

  if (records.added > 0) {
    parts.push(labels.added(records.added));
  }

  if (records.changed > 0) {
    parts.push(labels.changed(records.changed));
  }

  if (records.removed > 0) {
    parts.push(labels.removed(records.removed));
  }

  return parts.length === 0 ? labels.nothingWouldChange : parts.join(', ');
}

/* ------------------------------------------------------------------------- */
/* The Turkish behaviour under the original names, for the assertions that    */
/* already call them. Not for screens - they pass the half they are showing.  */
/* ------------------------------------------------------------------------- */

export function restoreStatusLabel(status: CloudRestoreStatus): string {
  return restoreStatusLabelIn(restoreLabelsTr, status);
}

export function restorePeriodRecordsLabel(
  records: CloudRestorePeriodRecordsPreview
): string {
  return restorePeriodRecordsLabelIn(restoreLabelsTr, records);
}
