import {
  PENDING_ACCOUNT_DELETION_STORAGE_KEY,
  clearPendingAccountDeletion,
  getPendingAccountDeletion,
  isAccountDeletionPending,
  markAccountDeletionPending,
} from '../pending-account-deletion';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

const mockStorage = jest.requireMock('@react-native-async-storage/async-storage').default as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStorage.getItem.mockResolvedValue(null);
  mockStorage.setItem.mockResolvedValue(undefined);
  mockStorage.removeItem.mockResolvedValue(undefined);
});

describe('marking a deletion as under way', () => {
  it('stores the uid under its own key', async () => {
    await markAccountDeletionPending('uid-1');

    expect(mockStorage.setItem).toHaveBeenCalledWith(
      PENDING_ACCOUNT_DELETION_STORAGE_KEY,
      'uid-1'
    );
  });

  it('uses a key of its own rather than sharing one', () => {
    expect(PENDING_ACCOUNT_DELETION_STORAGE_KEY).toBe('pending-account-deletion');
  });

  it.each([
    ['an empty string', ''],
    ['whitespace', '   '],
  ])('refuses %s, which would block nothing', async (_label, uid) => {
    await expect(markAccountDeletionPending(uid)).rejects.toThrow(/expects a uid/);
    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  it('writes no health data, only the account id', async () => {
    await markAccountDeletionPending('uid-1');

    const [, written] = mockStorage.setItem.mock.calls[0] as [string, string];

    expect(written).toBe('uid-1');
  });
});

describe('reading the note', () => {
  it('is null when nothing is stored', async () => {
    mockStorage.getItem.mockResolvedValue(null);

    expect(await getPendingAccountDeletion()).toBeNull();
  });

  it('is null for a blank value rather than raising', async () => {
    // A guard that threw on its own stored value would turn a stuck deletion
    // into a screen that cannot load.
    mockStorage.getItem.mockResolvedValue('  ');

    expect(await getPendingAccountDeletion()).toBeNull();
  });

  it('returns the stored uid', async () => {
    mockStorage.getItem.mockResolvedValue('uid-1');

    expect(await getPendingAccountDeletion()).toBe('uid-1');
  });
});

describe('asking about one account', () => {
  it('is true for the account being deleted', async () => {
    mockStorage.getItem.mockResolvedValue('uid-1');

    expect(await isAccountDeletionPending('uid-1')).toBe(true);
  });

  it('is false for a different account on the same phone', async () => {
    // Two accounts can be used here. A half-deleted one must not block the other.
    mockStorage.getItem.mockResolvedValue('uid-1');

    expect(await isAccountDeletionPending('uid-2')).toBe(false);
  });

  it('is false when nothing is pending', async () => {
    mockStorage.getItem.mockResolvedValue(null);

    expect(await isAccountDeletionPending('uid-1')).toBe(false);
  });

  it.each([
    ['an empty uid', ''],
    ['a whitespace uid', '  '],
  ])('is false for %s without reading storage', async (_label, uid) => {
    expect(await isAccountDeletionPending(uid)).toBe(false);
  });
});

describe('clearing the note', () => {
  it('removes the key', async () => {
    await clearPendingAccountDeletion();

    expect(mockStorage.removeItem).toHaveBeenCalledWith(PENDING_ACCOUNT_DELETION_STORAGE_KEY);
  });

  it('can be called when nothing is stored', async () => {
    await expect(clearPendingAccountDeletion()).resolves.toBeUndefined();
  });
});
