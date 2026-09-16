import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearAppState, loadAppState, saveAppState } from '../app-state-storage';

import type { AppState } from '@/types/app-state';
import { DEFAULT_APP_STATE } from '@/types/app-state';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const removeItem = AsyncStorage.removeItem as jest.Mock;

const STORAGE_KEY = 'app-state';

beforeEach(() => {
  getItem.mockReset().mockResolvedValue(null);
  setItem.mockReset().mockResolvedValue(undefined);
  removeItem.mockReset().mockResolvedValue(undefined);
});

describe('saveAppState', () => {
  it('stores a cycle state', async () => {
    const state: AppState = { mode: 'cycle', onboardingCompleted: false };

    await saveAppState(state);

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify({ mode: 'cycle', onboardingCompleted: false })
    );
  });

  it('stores a pregnancy state', async () => {
    const state: AppState = { mode: 'pregnancy', onboardingCompleted: true };

    await saveAppState(state);

    expect(setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify({ mode: 'pregnancy', onboardingCompleted: true })
    );
  });

  it('writes under the app-state key', async () => {
    await saveAppState(DEFAULT_APP_STATE);

    expect(setItem.mock.calls[0][0]).toBe(STORAGE_KEY);
  });

  it('writes JSON that parses back to the same state', async () => {
    const state: AppState = { mode: 'pregnancy', onboardingCompleted: true };

    await saveAppState(state);

    expect(JSON.parse(setItem.mock.calls[0][1] as string)).toEqual(state);
  });

  it('never writes an invalid state', async () => {
    const corrupt = { mode: 'sleep', onboardingCompleted: false } as unknown as AppState;

    await expect(saveAppState(corrupt)).rejects.toThrow(/Invalid AppState mode/);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('never writes a state with a non-boolean flag', async () => {
    const corrupt = { mode: 'cycle', onboardingCompleted: 'yes' } as unknown as AppState;

    await expect(saveAppState(corrupt)).rejects.toThrow(/onboardingCompleted must be a boolean/);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('propagates a storage failure', async () => {
    setItem.mockRejectedValue(new Error('disk full'));

    await expect(saveAppState(DEFAULT_APP_STATE)).rejects.toThrow('disk full');
  });

  it('does not mutate the state it is given', async () => {
    const state: AppState = { mode: 'pregnancy', onboardingCompleted: true };
    const snapshot = JSON.parse(JSON.stringify(state));

    await saveAppState(state);

    expect(JSON.parse(JSON.stringify(state))).toEqual(snapshot);
    expect(Object.keys(state).sort()).toEqual(['mode', 'onboardingCompleted']);
  });
});

describe('loadAppState', () => {
  it('reads from the app-state key', async () => {
    await loadAppState();

    expect(getItem).toHaveBeenCalledTimes(1);
    expect(getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('returns the default when nothing is stored', async () => {
    getItem.mockResolvedValue(null);

    await expect(loadAppState()).resolves.toEqual(DEFAULT_APP_STATE);
  });

  it('does not persist the default as a side effect', async () => {
    getItem.mockResolvedValue(null);

    await loadAppState();

    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('returns a stored cycle state', async () => {
    getItem.mockResolvedValue(JSON.stringify({ mode: 'cycle', onboardingCompleted: true }));

    await expect(loadAppState()).resolves.toEqual({
      mode: 'cycle',
      onboardingCompleted: true,
    });
  });

  it('returns a stored pregnancy state', async () => {
    getItem.mockResolvedValue(
      JSON.stringify({ mode: 'pregnancy', onboardingCompleted: false })
    );

    await expect(loadAppState()).resolves.toEqual({
      mode: 'pregnancy',
      onboardingCompleted: false,
    });
  });

  it('raises on malformed JSON instead of falling back', async () => {
    getItem.mockResolvedValue('{not json');

    await expect(loadAppState()).rejects.toThrow();
    expect(setItem).not.toHaveBeenCalled();
  });

  it.each<[string, string]>([
    ['a JSON null', 'null'],
    ['a JSON number', '42'],
    ['a JSON string', '"cycle"'],
    ['a JSON array', '[]'],
  ])('raises when the stored value is %s', async (_label, raw) => {
    getItem.mockResolvedValue(raw);

    await expect(loadAppState()).rejects.toThrow(/Stored app state is not an object/);
  });

  it('raises on an unknown mode', async () => {
    getItem.mockResolvedValue(JSON.stringify({ mode: 'sleep', onboardingCompleted: true }));

    await expect(loadAppState()).rejects.toThrow(/Invalid AppState mode/);
  });

  it('raises on a missing mode', async () => {
    getItem.mockResolvedValue(JSON.stringify({ onboardingCompleted: true }));

    await expect(loadAppState()).rejects.toThrow(/Invalid AppState mode/);
  });

  it('raises on a non-boolean onboardingCompleted', async () => {
    getItem.mockResolvedValue(JSON.stringify({ mode: 'cycle', onboardingCompleted: 'yes' }));

    await expect(loadAppState()).rejects.toThrow(/onboardingCompleted must be a boolean/);
  });

  it('does not repair corrupt data', async () => {
    getItem.mockResolvedValue(JSON.stringify({ mode: 'sleep', onboardingCompleted: true }));

    await expect(loadAppState()).rejects.toThrow();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('propagates a storage failure', async () => {
    getItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(loadAppState()).rejects.toThrow('storage unavailable');
  });
});

describe('clearAppState', () => {
  it('removes the app-state key', async () => {
    await clearAppState();

    expect(removeItem).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('propagates a storage failure', async () => {
    removeItem.mockRejectedValue(new Error('remove failed'));

    await expect(clearAppState()).rejects.toThrow('remove failed');
  });
});
