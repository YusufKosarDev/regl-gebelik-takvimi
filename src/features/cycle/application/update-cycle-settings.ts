import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile, saveCycleProfile } from '../data/cycle-repository';
import type { CycleProfile } from '../domain/types';
import { validateCycleProfile } from '../domain/validation';

export type UpdateCycleSettingsInput = {
  readonly averageCycleLengthDays: number;
  readonly averagePeriodLengthDays: number;
};

/**
 * Corrects the two averages the predictions are built from.
 *
 * Only the settings move. The recorded periods are what actually happened and
 * are carried through by reference, so there is no path here that could rewrite
 * one of them.
 *
 * What counts as a usable pair of averages — the bounds, the whole-number rule,
 * and a period never being longer than the cycle it sits in — stays the domain's
 * to decide, checked by `validateCycleProfile` rather than restated here. That
 * keeps this and the onboarding steppers answering to the same rules.
 */
export async function updateCycleSettings(
  db: SQLiteDatabase,
  input: UpdateCycleSettingsInput
): Promise<CycleProfile> {
  const { averageCycleLengthDays, averagePeriodLengthDays } = input;

  const profile = await loadCycleProfile(db);

  if (profile === null) {
    throw new Error('updateCycleSettings found no saved cycle profile to update.');
  }

  // Nothing to write when the answer is already what was asked for. Saving would
  // rewrite every period record for no change.
  if (
    profile.settings.averageCycleLengthDays === averageCycleLengthDays &&
    profile.settings.averagePeriodLengthDays === averagePeriodLengthDays
  ) {
    return profile;
  }

  const updated: CycleProfile = {
    settings: { averageCycleLengthDays, averagePeriodLengthDays },
    periodRecords: profile.periodRecords,
  };

  validateCycleProfile(updated);
  await saveCycleProfile(db, updated);

  return updated;
}
