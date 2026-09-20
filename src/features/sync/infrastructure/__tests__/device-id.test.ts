import {
  DEVICE_ID_STORAGE_KEY,
  clearDeviceId,
  fixedDeviceIdProvider,
  generateDeviceId,
  getDeviceId,
} from '../device-id';

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

describe('generating a device id', () => {
  it('gives a non-empty string', () => {
    expect(generateDeviceId().trim().length).toBeGreaterThan(8);
  });

  it('gives a different one every time', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateDeviceId()));

    expect(seen.size).toBe(200);
  });

  it('uses the runtime’s own generator when there is one', () => {
    const runtime = globalThis as { crypto?: { randomUUID?: () => string } };
    const original = runtime.crypto;

    runtime.crypto = { randomUUID: () => 'from-the-runtime' };

    try {
      expect(generateDeviceId()).toBe('from-the-runtime');
    } finally {
      runtime.crypto = original;
    }
  });

  it('manages without one', () => {
    const runtime = globalThis as { crypto?: unknown };
    const original = runtime.crypto;

    runtime.crypto = undefined;

    try {
      expect(generateDeviceId()).toMatch(/^device-[a-z0-9]+-[a-z0-9]+$/);
    } finally {
      runtime.crypto = original;
    }
  });
});

describe('what a device id is not', () => {
  it('is not built from anything about the person or the phone', () => {
    const runtime = globalThis as { crypto?: unknown };
    const original = runtime.crypto;
    runtime.crypto = undefined;

    try {
      const id = generateDeviceId();

      // No account, no address, no hardware: there is nothing in it to be
      // traced back to anybody.
      expect(id).not.toMatch(/@|uid|firebase|android|emulator|sdk|model/i);
    } finally {
      runtime.crypto = original;
    }
  });

  it('is kept under a key of its own, beside the other small state', () => {
    expect(DEVICE_ID_STORAGE_KEY).toBe('sync-device-id');
  });
});

describe('the device id this installation uses', () => {
  it('is made and stored the first time it is asked for', async () => {
    const id = await getDeviceId();

    expect(mockStorage.setItem).toHaveBeenCalledWith(DEVICE_ID_STORAGE_KEY, id);
  });

  it('is the stored one every time after that', async () => {
    mockStorage.getItem.mockResolvedValue('device-already-here');

    await expect(getDeviceId()).resolves.toBe('device-already-here');
    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  it('is the same across restarts, which is the whole point', async () => {
    // First run: nothing stored, so one is made and written.
    const first = await getDeviceId();

    // Every run after: the store answers with what was written.
    mockStorage.getItem.mockResolvedValue(first);

    await expect(getDeviceId()).resolves.toBe(first);
    await expect(getDeviceId()).resolves.toBe(first);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('reads the key it writes', async () => {
    await getDeviceId();

    expect(mockStorage.getItem).toHaveBeenCalledWith(DEVICE_ID_STORAGE_KEY);
  });

  it.each([null, undefined, '', '   ', 7])(
    'replaces an unusable stored value of %p rather than failing',
    async (stored) => {
      mockStorage.getItem.mockResolvedValue(stored);

      const id = await getDeviceId();

      expect(id.trim()).not.toBe('');
      expect(mockStorage.setItem).toHaveBeenCalledWith(DEVICE_ID_STORAGE_KEY, id);
    }
  );

  it('touches nothing else in storage', async () => {
    await getDeviceId();

    expect(mockStorage.getItem).toHaveBeenCalledTimes(1);
    expect(mockStorage.removeItem).not.toHaveBeenCalled();
  });

  it('passes a storage failure on rather than inventing an id', async () => {
    mockStorage.getItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(getDeviceId()).rejects.toThrow('storage unavailable');
  });
});

describe('clearing the device id', () => {
  it('removes the key', async () => {
    await clearDeviceId();

    expect(mockStorage.removeItem).toHaveBeenCalledWith(DEVICE_ID_STORAGE_KEY);
  });

  it('leads to a new id next time', async () => {
    await clearDeviceId();
    mockStorage.getItem.mockResolvedValue(null);

    const id = await getDeviceId();

    expect(id.trim()).not.toBe('');
  });
});

describe('a provider that can be handed to something else', () => {
  it('answers with the id it was given', async () => {
    await expect(fixedDeviceIdProvider('device-for-a-test')()).resolves.toBe('device-for-a-test');
  });

  it('answers with the same one every time', async () => {
    const provider = fixedDeviceIdProvider('device-for-a-test');

    await expect(provider()).resolves.toBe(await provider());
  });

  it('reads no storage at all', async () => {
    await fixedDeviceIdProvider('device-for-a-test')();

    expect(mockStorage.getItem).not.toHaveBeenCalled();
    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  it.each(['', '   ', null as unknown as string, 7 as unknown as string])(
    'refuses %p as an id',
    (deviceId) => {
      expect(() => fixedDeviceIdProvider(deviceId)).toThrow(/needs an id/);
    }
  );
});
