import type { PeriodRecord } from './types';

import type { ISODate } from '@/types/iso-date';

/**
 * Identity of a period record.
 *
 * Records the app creates itself are named after the day they start, so the id
 * is derivable and a second record cannot quietly appear for the same day. Other
 * records — the one onboarding seeds, and anything that arrives from elsewhere —
 * carry ids that mean something to whoever made them.
 */

/** The id a record the app created for `startDate` would have. */
export function canonicalPeriodRecordId(startDate: ISODate): string {
  return `period-${startDate}`;
}

/**
 * The id a record should carry after its start date is corrected.
 *
 * Only a record whose id still matches its own start date gets a new one: that
 * is the app's own naming, and leaving it pointing at the old day would make the
 * id a lie. Every other id is returned untouched, because it was not derived
 * from the start date and is not ours to rewrite — `onboarding-initial-period`
 * keeps its meaning, an imported id keeps whatever it referred to, and an id
 * that merely looks canonical but names a different day is treated as one of
 * those rather than repaired.
 */
export function getUpdatedPeriodRecordId(record: PeriodRecord, newStartDate: ISODate): string {
  if (record.id !== canonicalPeriodRecordId(record.startDate)) {
    return record.id;
  }

  return canonicalPeriodRecordId(newStartDate);
}
