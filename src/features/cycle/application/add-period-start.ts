import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile, saveCycleProfile } from '../data/cycle-repository';
import { getOpenPeriodRecord } from '../domain/open-period';
import { canonicalPeriodRecordId } from '../domain/period-record-id';
import type { CycleProfile, PeriodRecord } from '../domain/types';
import { validateCycleProfile } from '../domain/validation';

import type { ISODate } from '@/types/iso-date';
import { daysBetween, isISODate } from '@/utils/date';

/**
 * `today` is passed in rather than read here, so the rule about future dates is
 * deterministic and the clock stays read in one place in the app.
 */
export type AddPeriodStartInput = {
  readonly startDate: ISODate;
  readonly today: ISODate;
};

/**
 * Records the day a period started.
 *
 * Start date only: when it ended is a separate thing to know and is not asked
 * for here.
 *
 * The stored profile is read, extended and written back whole. Nothing is
 * mutated in place, so a rejected write leaves the caller's profile as it was.
 */
export async function addPeriodStart(
  db: SQLiteDatabase,
  input: AddPeriodStartInput
): Promise<CycleProfile> {
  const { startDate, today } = input;

  if (!isISODate(startDate)) {
    throw new Error(
      `addPeriodStart received an invalid startDate. ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  if (!isISODate(today)) {
    throw new Error(
      `addPeriodStart received an invalid today. ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  if (daysBetween(startDate, today) < 0) {
    throw new Error('addPeriodStart cannot record a start date in the future.');
  }

  const profile = await loadCycleProfile(db);

  if (profile === null) {
    throw new Error('addPeriodStart found no saved cycle profile to add to.');
  }

  if (profile.periodRecords.some((record) => record.startDate === startDate)) {
    throw new Error('addPeriodStart found a period already recorded on that date.');
  }

  // One period at a time. Without this a second start could be added while the
  // first is still running, leaving two records nothing could choose between.
  if (getOpenPeriodRecord(profile) !== null) {
    throw new Error('addPeriodStart found a period already ongoing; end it first.');
  }

  const record: PeriodRecord = {
    id: canonicalPeriodRecordId(startDate),
    startDate,
    isOngoing: true,
  };

  // Appended, not inserted in order: the repository reads records back sorted,
  // and every domain function finds its own reference date rather than trusting
  // the order.
  const updated: CycleProfile = {
    settings: profile.settings,
    periodRecords: [...profile.periodRecords, record],
  };

  validateCycleProfile(updated);
  await saveCycleProfile(db, updated);

  return updated;
}
