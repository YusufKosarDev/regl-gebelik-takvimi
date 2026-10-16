import { getOpenPeriodRecord } from './open-period';
import type { CycleProfile } from './types';

import type { ISODate } from '@/types/iso-date';
import { daysBetween } from '@/utils/date';

/**
 * Which period action the stored data allows, if any.
 *
 * `getOpenPeriodRecord` refuses to choose between several open records rather
 * than closing one the person did not mean to close. The screen cannot act on
 * that either, so it offers nothing instead of crashing on the way past.
 *
 * A day an existing record already covers gets 'none' too. The
 * neighbour-aware bounds put the earliest legal start at the previous end
 * plus one, so a start button on the day a period ended was a dead end that
 * could only collect the overlap refusal. A record with no recorded end
 * covers only the day it started - the same reading the CSV export wrote
 * down, because nothing is known about the days after it.
 */
export function resolvePeriodAction(
  profile: CycleProfile,
  today: ISODate
): 'start' | 'end' | 'none' {
  try {
    if (getOpenPeriodRecord(profile) !== null) {
      return 'end';
    }
  } catch {
    return 'none';
  }

  const coversToday = profile.periodRecords.some((record) => {
    const end = record.endDate ?? record.startDate;

    return daysBetween(record.startDate, today) >= 0 && daysBetween(today, end) >= 0;
  });

  return coversToday ? 'none' : 'start';
}
