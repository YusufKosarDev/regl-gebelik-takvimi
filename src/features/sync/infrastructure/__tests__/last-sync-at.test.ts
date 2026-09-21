import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  LAST_SYNC_AT_STORAGE_KEY,
  clearLastSyncAt,
  loadLastSyncAt,
  saveLastSyncAt,
} from '../last-sync-at';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('remembering when the last sync finished', () => {
  it('writes and reads the timestamp back', async () => {
    await saveLastSyncAt('2026-09-21T10:00:00.000Z');

    await expect(loadLastSyncAt()).resolves.toBe('2026-09-21T10:00:00.000Z');
  });

  it('keeps one timestamp rather than a history', async () => {
    // A list of every time somebody opened a period tracker is a behavioural
    // record, and this app has no use for one.
    await saveLastSyncAt('2026-09-20T10:00:00.000Z');
    await saveLastSyncAt('2026-09-21T10:00:00.000Z');

    await expect(loadLastSyncAt()).resolves.toBe('2026-09-21T10:00:00.000Z');
    await expect(AsyncStorage.getAllKeys()).resolves.toEqual([LAST_SYNC_AT_STORAGE_KEY]);
  });

  it('refuses something that is not a timestamp rather than storing it', async () => {
    await expect(saveLastSyncAt('dün')).rejects.toThrow('saveLastSyncAt');
    await expect(
      saveLastSyncAt(1_700_000_000_000 as unknown as string)
    ).rejects.toThrow('saveLastSyncAt');

    await expect(loadLastSyncAt()).resolves.toBeNull();
  });
});

describe('reading it back', () => {
  it('is null before anything has ever synced', async () => {
    await expect(loadLastSyncAt()).resolves.toBeNull();
  });

  it('reads nonsense as never, rather than throwing', async () => {
    // The worst this can cause is a status line that says "henüz senkronize
    // edilmedi", which is a better failure than a screen that will not load.
    await AsyncStorage.setItem(LAST_SYNC_AT_STORAGE_KEY, 'bozuk');

    await expect(loadLastSyncAt()).resolves.toBeNull();
  });
});

describe('forgetting it', () => {
  it('leaves nothing behind after a wipe', async () => {
    await saveLastSyncAt('2026-09-21T10:00:00.000Z');
    await clearLastSyncAt();

    await expect(loadLastSyncAt()).resolves.toBeNull();
    await expect(AsyncStorage.getItem(LAST_SYNC_AT_STORAGE_KEY)).resolves.toBeNull();
  });

  it('does not mind being asked twice', async () => {
    await clearLastSyncAt();

    await expect(clearLastSyncAt()).resolves.toBeUndefined();
  });
});
