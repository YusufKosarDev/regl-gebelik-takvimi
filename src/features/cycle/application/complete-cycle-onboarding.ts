import type { SQLiteDatabase } from 'expo-sqlite';

import { saveCycleProfile } from '../data/cycle-repository';
import type { CycleOnboardingInput } from '../domain/onboarding';
import { createInitialCycleProfile } from '../domain/onboarding';
import type { CycleProfile } from '../domain/types';

/**
 * Turns onboarding answers into a stored profile.
 *
 * The whole use case is a wiring step: the domain builds the profile, the
 * repository persists it, and neither job is reimplemented here.
 *
 * The database handle is a parameter, not something this function opens: opening
 * and migrating stay the caller's responsibility, so the use case can be driven
 * from a screen, a test or a script without each of them getting its own
 * connection.
 *
 * Failures propagate. A rejected save is not retried, not swallowed and not
 * replaced by a fallback profile — the caller has to decide, because a profile
 * that looks saved but is not would silently lose the user's first entry.
 */
export async function completeCycleOnboarding(
  db: SQLiteDatabase,
  input: CycleOnboardingInput
): Promise<CycleProfile> {
  const profile = createInitialCycleProfile(input);

  await saveCycleProfile(db, profile);

  return profile;
}
