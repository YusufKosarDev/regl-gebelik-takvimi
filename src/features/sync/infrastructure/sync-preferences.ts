import AsyncStorage from '@react-native-async-storage/async-storage';

import { describeValue } from '@/shared/logging';

/**
 * Whether this installation may sync on its own.
 *
 * Off until somebody turns it on, and off again on a new phone. A health app
 * that started uploading a period history because an account happened to be
 * signed in would have decided something that was never its to decide, and
 * "the account was already signed in" is exactly the case where nobody was
 * asked.
 *
 * Kept per installation rather than per account, and kept here rather than in
 * the database. It is a decision about this phone: signing in on a second
 * device is not consent given on that device, and the answer should not travel
 * with the account. It is also deliberately nowhere near the health tables —
 * the payload builder reads those, and a sync preference is not a thing a sync
 * may ever carry.
 *
 * Nothing in this module acts on the answer. It records what the person chose;
 * whether a sync then happens is a question for whatever is holding the button,
 * and at the moment nothing runs without one being pressed.
 */

export const SYNC_PREFERENCES_STORAGE_KEY = 'sync-preferences';

export type SyncPreferences = {
  /** Whether a sync may be started without the person asking for it. */
  readonly automaticSyncEnabled: boolean;
};

/**
 * What someone has before they have chosen anything.
 *
 * Off. This is the only default that can be given to somebody who has not been
 * asked yet.
 */
export const DEFAULT_SYNC_PREFERENCES: SyncPreferences = {
  automaticSyncEnabled: false,
} as const;

/**
 * Checks a stored value, throwing on the first rule it breaks.
 *
 * A `1` or an `"on"` read out of storage would work everywhere it is tested and
 * then quietly make `!enabled` false for a switch somebody left off. Booleans,
 * and only booleans.
 */
export function validateSyncPreferences(preferences: SyncPreferences): void {
  if (typeof preferences !== 'object' || preferences === null || Array.isArray(preferences)) {
    throw new Error(
      `validateSyncPreferences received something that is not preferences: ${describeValue(
        preferences
      )}.`
    );
  }

  if (typeof preferences.automaticSyncEnabled !== 'boolean') {
    throw new Error(
      `SyncPreferences automaticSyncEnabled must be a boolean, received ` +
        `${describeValue(preferences.automaticSyncEnabled)}.`
    );
  }
}

/**
 * What is stored, or the defaults when nothing has been.
 *
 * The defaults are returned rather than written: reading an answer should not
 * be how an answer comes to exist.
 *
 * Anything stored but unreadable raises. It is tempting to fall back to "off"
 * — it is the safe direction, after all — but silently doing so would also
 * swallow the opposite case, where somebody turned it on and the app kept
 * quietly not syncing. A preference that cannot be read is a fault worth
 * showing, and the caller can still choose to treat a fault as off.
 */
export async function loadSyncPreferences(): Promise<SyncPreferences> {
  const raw = await AsyncStorage.getItem(SYNC_PREFERENCES_STORAGE_KEY);

  if (raw === null || raw === undefined) {
    return DEFAULT_SYNC_PREFERENCES;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    // The parser quotes what it choked on. Nothing in this key is health data,
    // but there is no reason for whatever is in there to travel either.
    throw new Error('Stored sync preferences could not be read as JSON.');
  }

  validateSyncPreferences(parsed as SyncPreferences);

  return parsed as SyncPreferences;
}

/** Writes the preferences after checking them, so nothing invalid is stored. */
export async function saveSyncPreferences(preferences: SyncPreferences): Promise<void> {
  validateSyncPreferences(preferences);

  await AsyncStorage.setItem(SYNC_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

/**
 * Turns automatic sync on or off.
 *
 * Reads what is stored rather than taking it as an argument, so two quick taps
 * cannot write a stale copy over each other — the same reason
 * `setReminderEnabled` reads before it writes.
 */
export async function setAutomaticSyncEnabled(enabled: boolean): Promise<SyncPreferences> {
  if (typeof enabled !== 'boolean') {
    throw new Error(
      `setAutomaticSyncEnabled expects a boolean, received ${describeValue(enabled)}.`
    );
  }

  const current = await loadSyncPreferences();
  const next: SyncPreferences = { ...current, automaticSyncEnabled: enabled };

  await saveSyncPreferences(next);

  return next;
}

/** Forgets the stored choice, which puts it back to off. */
export async function clearSyncPreferences(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_PREFERENCES_STORAGE_KEY);
}
