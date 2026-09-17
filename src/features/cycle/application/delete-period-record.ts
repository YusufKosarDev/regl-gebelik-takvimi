import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile, saveCycleProfile } from '../data/cycle-repository';
import type { CycleProfile } from '../domain/types';
import { validateCycleProfile } from '../domain/validation';

export type DeletePeriodRecordInput = {
  readonly recordId: string;
};

/**
 * Removes one recorded period.
 *
 * Only that record goes. Nothing else is adjusted to compensate: deleting the
 * period that was running leaves none running rather than promoting another one,
 * and deleting the last record leaves the profile with no records at all, which
 * is a valid thing for it to be. No replacement is invented.
 *
 * The onboarding record is deletable like any other — the date entered during
 * onboarding can be wrong, and a record nobody can remove is a worse answer than
 * one they can.
 */
export async function deletePeriodRecord(
  db: SQLiteDatabase,
  input: DeletePeriodRecordInput
): Promise<CycleProfile> {
  const { recordId } = input;

  if (typeof recordId !== 'string' || recordId.trim() === '') {
    throw new Error('deletePeriodRecord requires a non-empty record id.');
  }

  const profile = await loadCycleProfile(db);

  if (profile === null) {
    throw new Error('deletePeriodRecord found no saved cycle profile to update.');
  }

  if (!profile.periodRecords.some((record) => record.id === recordId)) {
    throw new Error(`deletePeriodRecord found no period record with id "${recordId}".`);
  }

  const updated: CycleProfile = {
    settings: profile.settings,
    periodRecords: profile.periodRecords.filter((record) => record.id !== recordId),
  };

  validateCycleProfile(updated);
  await saveCycleProfile(db, updated);

  return updated;
}
