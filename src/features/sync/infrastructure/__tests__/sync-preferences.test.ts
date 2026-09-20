import {
  DEFAULT_SYNC_PREFERENCES,
  SYNC_PREFERENCES_STORAGE_KEY,
  clearSyncPreferences,
  loadSyncPreferences,
  saveSyncPreferences,
  setAutomaticSyncEnabled,
  validateSyncPreferences,
} from '../sync-preferences';

// The factory runs when the module under test is first imported, which is
// before anything in this file has been initialised, so the spies are created
// inside it and picked up afterwards.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

const mockStorage = jest.requireMock('@react-native-async-storage/async-storage')
  .default as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

beforeEach(() => {
  mockStorage.getItem.mockReset();
  mockStorage.getItem.mockResolvedValue(null);
  mockStorage.setItem.mockReset();
  mockStorage.setItem.mockResolvedValue(undefined);
  mockStorage.removeItem.mockReset();
  mockStorage.removeItem.mockResolvedValue(undefined);
});

describe('what somebody has before they have chosen', () => {
  it('is off', () => {
    expect(DEFAULT_SYNC_PREFERENCES).toEqual({ automaticSyncEnabled: false });
  });

  it('is off when nothing has been stored', async () => {
    await expect(loadSyncPreferences()).resolves.toEqual({ automaticSyncEnabled: false });
  });

  it('is not written down by being read', async () => {
    await loadSyncPreferences();

    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  it('is kept under a key of its own', () => {
    expect(SYNC_PREFERENCES_STORAGE_KEY).toBe('sync-preferences');
  });

  it('is off on a phone that has never been asked, however often it is asked', async () => {
    await expect(loadSyncPreferences()).resolves.toEqual(DEFAULT_SYNC_PREFERENCES);
    await expect(loadSyncPreferences()).resolves.toEqual(DEFAULT_SYNC_PREFERENCES);
  });
});

describe('reading what was stored', () => {
  it('gives back what was turned on', async () => {
    mockStorage.getItem.mockResolvedValue(JSON.stringify({ automaticSyncEnabled: true }));

    await expect(loadSyncPreferences()).resolves.toEqual({ automaticSyncEnabled: true });
  });

  it('gives back what was turned off', async () => {
    mockStorage.getItem.mockResolvedValue(JSON.stringify({ automaticSyncEnabled: false }));

    await expect(loadSyncPreferences()).resolves.toEqual({ automaticSyncEnabled: false });
  });

  it('reads the key it writes', async () => {
    await loadSyncPreferences();

    expect(mockStorage.getItem).toHaveBeenCalledWith(SYNC_PREFERENCES_STORAGE_KEY);
  });

  it('refuses text that is not JSON rather than guessing', async () => {
    mockStorage.getItem.mockResolvedValue('{ not json');

    await expect(loadSyncPreferences()).rejects.toThrow(/could not be read as JSON/);
  });

  it('keeps what it choked on out of the message', async () => {
    mockStorage.getItem.mockResolvedValue('{ "automaticSyncEnabled": nonsense-value }');

    const error = await loadSyncPreferences().then(
      () => {
        throw new Error('expected a rejection');
      },
      (thrown: unknown) => thrown as Error
    );

    expect(error.message).not.toContain('nonsense-value');
  });

  it.each([
    ['a number', { automaticSyncEnabled: 1 }],
    ['text', { automaticSyncEnabled: 'true' }],
    ['nothing at all', {}],
    ['null', null],
    ['a list', []],
  ])('refuses %s rather than reading it as a choice', async (_label, stored) => {
    mockStorage.getItem.mockResolvedValue(JSON.stringify(stored));

    await expect(loadSyncPreferences()).rejects.toThrow();
  });

  it('does not quietly fall back to off when the stored value is broken', async () => {
    // Falling back would also swallow the opposite case: somebody who turned it
    // on and is being quietly not synced.
    mockStorage.getItem.mockResolvedValue(JSON.stringify({ automaticSyncEnabled: 'yes' }));

    await expect(loadSyncPreferences()).rejects.toThrow(/must be a boolean/);
  });

  it('never repairs what it could not read', async () => {
    mockStorage.getItem.mockResolvedValue('{ not json');

    await loadSyncPreferences().catch(() => undefined);

    expect(mockStorage.setItem).not.toHaveBeenCalled();
    expect(mockStorage.removeItem).not.toHaveBeenCalled();
  });
});

describe('writing a choice down', () => {
  it('stores it as JSON under the one key', async () => {
    await saveSyncPreferences({ automaticSyncEnabled: true });

    expect(mockStorage.setItem).toHaveBeenCalledWith(
      SYNC_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ automaticSyncEnabled: true })
    );
  });

  it.each([
    ['a number', { automaticSyncEnabled: 1 }],
    ['text', { automaticSyncEnabled: 'true' }],
    ['nothing', {}],
  ])('refuses to store %s', async (_label, preferences) => {
    await expect(
      saveSyncPreferences(preferences as { automaticSyncEnabled: boolean })
    ).rejects.toThrow();

    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  it('can be read back as what was written', async () => {
    await saveSyncPreferences({ automaticSyncEnabled: true });

    mockStorage.getItem.mockResolvedValue(mockStorage.setItem.mock.calls[0][1]);

    await expect(loadSyncPreferences()).resolves.toEqual({ automaticSyncEnabled: true });
  });
});

describe('turning automatic sync on and off', () => {
  it('turns it on', async () => {
    await expect(setAutomaticSyncEnabled(true)).resolves.toEqual({ automaticSyncEnabled: true });
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      SYNC_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ automaticSyncEnabled: true })
    );
  });

  it('turns it off', async () => {
    mockStorage.getItem.mockResolvedValue(JSON.stringify({ automaticSyncEnabled: true }));

    await expect(setAutomaticSyncEnabled(false)).resolves.toEqual({ automaticSyncEnabled: false });
  });

  it('reads what is stored before it writes, so two quick taps cannot fight', async () => {
    await setAutomaticSyncEnabled(true);

    expect(mockStorage.getItem).toHaveBeenCalledWith(SYNC_PREFERENCES_STORAGE_KEY);
  });

  it('gives back what it stored, which is what a screen should follow', async () => {
    const result = await setAutomaticSyncEnabled(true);

    expect(JSON.parse(mockStorage.setItem.mock.calls[0][1])).toEqual(result);
  });

  it.each([1, 'true', null, undefined])('refuses %p as an answer', async (enabled) => {
    await expect(setAutomaticSyncEnabled(enabled as unknown as boolean)).rejects.toThrow(/boolean/);

    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  it('passes a storage failure on rather than pretending it was written', async () => {
    mockStorage.setItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(setAutomaticSyncEnabled(true)).rejects.toThrow('storage unavailable');
  });

  it('will not turn it on from a stored value it cannot read', async () => {
    mockStorage.getItem.mockResolvedValue('{ not json');

    await expect(setAutomaticSyncEnabled(true)).rejects.toThrow();
    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('forgetting the choice', () => {
  it('removes the key', async () => {
    await clearSyncPreferences();

    expect(mockStorage.removeItem).toHaveBeenCalledWith(SYNC_PREFERENCES_STORAGE_KEY);
  });

  it('leaves it off afterwards', async () => {
    await clearSyncPreferences();
    mockStorage.getItem.mockResolvedValue(null);

    await expect(loadSyncPreferences()).resolves.toEqual({ automaticSyncEnabled: false });
  });
});

describe('checking a value', () => {
  it('accepts a real choice', () => {
    expect(() => validateSyncPreferences({ automaticSyncEnabled: false })).not.toThrow();
  });

  it.each([
    ['nothing', null],
    ['a list', []],
    ['text', 'on'],
  ])('refuses %s', (_label, value) => {
    expect(() =>
      validateSyncPreferences(value as unknown as { automaticSyncEnabled: boolean })
    ).toThrow(/not preferences/);
  });

  it('names no stored value beyond the one it is refusing', () => {
    expect(() =>
      validateSyncPreferences({ automaticSyncEnabled: 'yes' } as unknown as {
        automaticSyncEnabled: boolean;
      })
    ).toThrow(/must be a boolean/);
  });
});

describe('what this module does not do', () => {
  it('starts no sync of its own', async () => {
    // It records a choice. Acting on it belongs to whatever holds the button,
    // and today nothing runs without one being pressed.
    await setAutomaticSyncEnabled(true);

    expect(mockStorage.getItem).toHaveBeenCalledTimes(1);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
    expect(mockStorage.removeItem).not.toHaveBeenCalled();
  });

  it('touches no other key', async () => {
    await loadSyncPreferences();

    expect(mockStorage.getItem).toHaveBeenCalledTimes(1);
    expect(mockStorage.getItem).not.toHaveBeenCalledWith('sync-device-id');
    expect(mockStorage.getItem).not.toHaveBeenCalledWith('app-state');
  });
});
