import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppState } from '@/types/app-state';
import { DEFAULT_APP_STATE, validateAppState } from '@/types/app-state';
import { describeValue } from '@/shared/logging';

/**
 * Persistence for the small global app state.
 *
 * Deliberately separate from the SQLite layer: `mode` and `onboardingCompleted`
 * are two scalars, not a queryable time series, so a key-value store is the
 * right size for them.
 *
 * No versioning, no encryption, no cache and no retry. Corrupt data is reported,
 * never repaired: falling back to defaults would silently reset a user who has
 * already finished onboarding.
 */

const APP_STATE_STORAGE_KEY = 'app-state';

function assertAppStateShape(value: unknown): asserts value is AppState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Stored app state is not an object: ${describeValue(value)}.`);
  }
}

/** Writes the state after checking it, so nothing invalid is ever stored. */
export async function saveAppState(state: AppState): Promise<void> {
  validateAppState(state);

  await AsyncStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state));
}

/**
 * Reads the stored state.
 *
 * Returns `DEFAULT_APP_STATE` when nothing has been written yet — in memory
 * only; the default is not persisted as a side effect of reading.
 *
 * Anything stored but unreadable — malformed JSON, a non-object, an unknown mode
 * — raises rather than resolving to the default.
 */
export async function loadAppState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(APP_STATE_STORAGE_KEY);

  if (raw === null || raw === undefined) {
    return DEFAULT_APP_STATE;
  }

  const parsed: unknown = JSON.parse(raw);

  assertAppStateShape(parsed);
  validateAppState(parsed);

  return parsed;
}

export async function clearAppState(): Promise<void> {
  await AsyncStorage.removeItem(APP_STATE_STORAGE_KEY);
}
