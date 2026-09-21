import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  UNRESOLVED_CONFLICT_STORAGE_KEY,
  clearUnresolvedConflict,
  getUnresolvedConflict,
  isConflictUnresolved,
  markConflictUnresolved,
} from '../unresolved-conflict';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('noting a conflict nobody has settled', () => {
  it('writes the account it belongs to and reads it back', async () => {
    await markConflictUnresolved('uid-1');

    await expect(getUnresolvedConflict()).resolves.toBe('uid-1');
    await expect(isConflictUnresolved('uid-1')).resolves.toBe(true);
  });

  it('does not stop a second account on the same phone from syncing', async () => {
    // Two accounts can be used on one phone. A conflict in one is not a reason
    // to stop the other.
    await markConflictUnresolved('uid-1');

    await expect(isConflictUnresolved('uid-2')).resolves.toBe(false);
  });

  it('holds an account id and nothing else', async () => {
    await markConflictUnresolved('uid-1');

    await expect(AsyncStorage.getItem(UNRESOLVED_CONFLICT_STORAGE_KEY)).resolves.toBe('uid-1');
  });

  it('refuses anything that is not a uid', async () => {
    await expect(markConflictUnresolved('')).rejects.toThrow('markConflictUnresolved');
    await expect(markConflictUnresolved('   ')).rejects.toThrow('markConflictUnresolved');
    await expect(
      markConflictUnresolved(null as unknown as string)
    ).rejects.toThrow('markConflictUnresolved');

    await expect(getUnresolvedConflict()).resolves.toBeNull();
  });
});

describe('asking whether one is waiting', () => {
  it('is no when nothing was ever noted', async () => {
    await expect(getUnresolvedConflict()).resolves.toBeNull();
    await expect(isConflictUnresolved('uid-1')).resolves.toBe(false);
  });

  it('reads a blank value as none rather than throwing', async () => {
    // This gates syncing. A guard that threw on a value it wrote itself would
    // stop the account screen loading.
    await AsyncStorage.setItem(UNRESOLVED_CONFLICT_STORAGE_KEY, '   ');

    await expect(getUnresolvedConflict()).resolves.toBeNull();
    await expect(isConflictUnresolved('uid-1')).resolves.toBe(false);
  });

  it('answers no for a caller with no uid, whatever is stored', async () => {
    await markConflictUnresolved('uid-1');

    await expect(isConflictUnresolved('')).resolves.toBe(false);
    await expect(isConflictUnresolved(null as unknown as string)).resolves.toBe(false);
  });
});

describe('clearing it', () => {
  it('lets automatic sync start again', async () => {
    await markConflictUnresolved('uid-1');
    await clearUnresolvedConflict();

    await expect(isConflictUnresolved('uid-1')).resolves.toBe(false);
  });

  it('does not mind being asked twice', async () => {
    await expect(clearUnresolvedConflict()).resolves.toBeUndefined();
    await expect(clearUnresolvedConflict()).resolves.toBeUndefined();
  });
});
