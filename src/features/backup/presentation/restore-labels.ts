import type {
  CloudRestorePeriodRecordsPreview,
  CloudRestoreStatus,
} from '../domain/cloud-restore-preview-v1';

/**
 * How a restore preview reads in Turkish.
 *
 * Verdicts and counts, in the future tense, because none of it has happened
 * yet: the person is being asked whether it should. Nothing here takes a date,
 * a record or a value — the preview does not carry any, and this is what turns
 * what it does carry into a sentence.
 */

const STATUS_LABELS: Readonly<Record<CloudRestoreStatus, string>> = {
  unchanged: 'Aynı kalacak',
  replace: 'Değişecek',
  add: 'Eklenecek',
  remove: 'Silinecek',
};

/** What would happen to one stored thing. */
export function restoreStatusLabel(status: CloudRestoreStatus): string {
  return STATUS_LABELS[status] ?? STATUS_LABELS.unchanged;
}

/**
 * What would happen to a list of stored things.
 *
 * Used for the period history and for the recorded days: both can gain, lose
 * and change entries in one restore, so a single verdict would say none of it.
 *
 * Only the parts that are not zero, so "3 eklenecek" does not arrive padded
 * with two noughts. When nothing would move at all it says so in words rather
 * than in three zeroes.
 */
export function restorePeriodRecordsLabel(
  records: CloudRestorePeriodRecordsPreview
): string {
  const parts: string[] = [];

  if (records.added > 0) {
    parts.push(`${records.added} eklenecek`);
  }

  if (records.changed > 0) {
    parts.push(`${records.changed} değişecek`);
  }

  if (records.removed > 0) {
    parts.push(`${records.removed} silinecek`);
  }

  return parts.length === 0 ? 'Aynı kalacak' : parts.join(', ');
}
