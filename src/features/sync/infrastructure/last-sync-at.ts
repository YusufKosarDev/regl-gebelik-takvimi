import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * When this phone last finished a sync, for the line under the switch.
 *
 * `sync_state.updatedAt` looks like it would do, and does not: that is the
 * server's stamp on the last agreement, which does not move when a sync finds
 * both sides already equal. "Son senkronizasyon" has to mean "the last time
 * this was checked", or an app syncing perfectly every hour would report a date
 * from last week.
 *
 * One timestamp, overwritten. No history is kept: a list of every time somebody
 * opened a period tracker is a behavioural record, and this app has no use for
 * one.
 */

export const LAST_SYNC_AT_STORAGE_KEY = 'sync-last-synced-at';

/** Remembers that a sync just finished. Anything unusable is refused. */
export async function saveLastSyncAt(isoTimestamp: string): Promise<void> {
  if (typeof isoTimestamp !== 'string' || Number.isNaN(Date.parse(isoTimestamp))) {
    throw new Error('saveLastSyncAt expects an ISO timestamp.');
  }

  await AsyncStorage.setItem(LAST_SYNC_AT_STORAGE_KEY, isoTimestamp);
}

/**
 * When the last sync finished, or `null`.
 *
 * Unreadable is `null` rather than a throw: the worst this can cause is a
 * status line that says "henüz senkronize edilmedi", and that is a better
 * failure than a screen that will not load.
 */
export async function loadLastSyncAt(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(LAST_SYNC_AT_STORAGE_KEY);

  if (stored === null || stored === undefined || Number.isNaN(Date.parse(stored))) {
    return null;
  }

  return stored;
}

/** Forgets it. Used by a wipe, where there is nothing left that was synced. */
export async function clearLastSyncAt(): Promise<void> {
  await AsyncStorage.removeItem(LAST_SYNC_AT_STORAGE_KEY);
}
