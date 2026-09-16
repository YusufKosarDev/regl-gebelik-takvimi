import { clearAppState, loadAppState, saveAppState } from '@/storage/app-state-storage';
import type { AppState } from '@/types/app-state';
import { DEFAULT_APP_STATE } from '@/types/app-state';

import { useAppStore } from '../app-store';

jest.mock('@/storage/app-state-storage', () => ({
  loadAppState: jest.fn(),
  saveAppState: jest.fn(),
  clearAppState: jest.fn(),
}));

const loadAppStateMock = loadAppState as jest.Mock;
const saveAppStateMock = saveAppState as jest.Mock;
const clearAppStateMock = clearAppState as jest.Mock;

/** The store is a module singleton, so each test starts from a known state. */
function resetStore(overrides: Partial<{ mode: AppState['mode']; onboardingCompleted: boolean; hydrated: boolean }> = {}) {
  useAppStore.setState({
    mode: DEFAULT_APP_STATE.mode,
    onboardingCompleted: DEFAULT_APP_STATE.onboardingCompleted,
    hydrated: false,
    ...overrides,
  });
}

beforeEach(() => {
  loadAppStateMock.mockReset().mockResolvedValue(DEFAULT_APP_STATE);
  saveAppStateMock.mockReset().mockResolvedValue(undefined);
  clearAppStateMock.mockReset().mockResolvedValue(undefined);
  resetStore();
});

describe('initial state', () => {
  it('starts from the default mode', () => {
    expect(useAppStore.getState().mode).toBe('cycle');
  });

  it('starts with onboarding incomplete', () => {
    expect(useAppStore.getState().onboardingCompleted).toBe(false);
  });

  it('starts unhydrated', () => {
    expect(useAppStore.getState().hydrated).toBe(false);
  });

  it('exposes only the agreed fields', () => {
    const state = useAppStore.getState();
    const dataKeys = Object.keys(state).filter(
      (key) => typeof (state as Record<string, unknown>)[key] !== 'function'
    );

    expect(dataKeys.sort()).toEqual(['hydrated', 'mode', 'onboardingCompleted']);
  });
});

describe('hydrate', () => {
  it('applies a stored cycle state', async () => {
    loadAppStateMock.mockResolvedValue({ mode: 'cycle', onboardingCompleted: true });

    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().mode).toBe('cycle');
    expect(useAppStore.getState().onboardingCompleted).toBe(true);
  });

  it('applies a stored pregnancy state', async () => {
    loadAppStateMock.mockResolvedValue({ mode: 'pregnancy', onboardingCompleted: true });

    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().mode).toBe('pregnancy');
    expect(useAppStore.getState().onboardingCompleted).toBe(true);
  });

  it('marks the store hydrated', async () => {
    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().hydrated).toBe(true);
  });

  it('reads storage exactly once', async () => {
    await useAppStore.getState().hydrate();

    expect(loadAppStateMock).toHaveBeenCalledTimes(1);
  });

  it('propagates a read failure', async () => {
    loadAppStateMock.mockRejectedValue(new Error('storage unavailable'));

    await expect(useAppStore.getState().hydrate()).rejects.toThrow('storage unavailable');
  });

  it('leaves the state untouched when the read fails', async () => {
    loadAppStateMock.mockRejectedValue(new Error('storage unavailable'));

    await expect(useAppStore.getState().hydrate()).rejects.toThrow();

    expect(useAppStore.getState().mode).toBe('cycle');
    expect(useAppStore.getState().onboardingCompleted).toBe(false);
    expect(useAppStore.getState().hydrated).toBe(false);
  });
});

describe('setMode', () => {
  it('switches from cycle to pregnancy', async () => {
    await useAppStore.getState().setMode('pregnancy');

    expect(useAppStore.getState().mode).toBe('pregnancy');
  });

  it('switches from pregnancy back to cycle', async () => {
    resetStore({ mode: 'pregnancy' });

    await useAppStore.getState().setMode('cycle');

    expect(useAppStore.getState().mode).toBe('cycle');
  });

  it('keeps onboardingCompleted as it was', async () => {
    resetStore({ onboardingCompleted: true });

    await useAppStore.getState().setMode('pregnancy');

    expect(useAppStore.getState().onboardingCompleted).toBe(true);
  });

  it('writes the full state before updating memory', async () => {
    resetStore({ onboardingCompleted: true });
    let modeAtWriteTime: string | undefined;
    saveAppStateMock.mockImplementation(async () => {
      modeAtWriteTime = useAppStore.getState().mode;
    });

    await useAppStore.getState().setMode('pregnancy');

    expect(saveAppStateMock).toHaveBeenCalledTimes(1);
    expect(saveAppStateMock).toHaveBeenCalledWith({
      mode: 'pregnancy',
      onboardingCompleted: true,
    });
    // Memory was still on the old mode while the write was in flight.
    expect(modeAtWriteTime).toBe('cycle');
  });

  it('propagates a write failure', async () => {
    saveAppStateMock.mockRejectedValue(new Error('disk full'));

    await expect(useAppStore.getState().setMode('pregnancy')).rejects.toThrow('disk full');
  });

  it('leaves memory unchanged when the write fails', async () => {
    resetStore({ onboardingCompleted: true, hydrated: true });
    saveAppStateMock.mockRejectedValue(new Error('disk full'));

    await expect(useAppStore.getState().setMode('pregnancy')).rejects.toThrow();

    expect(useAppStore.getState().mode).toBe('cycle');
    expect(useAppStore.getState().onboardingCompleted).toBe(true);
    expect(useAppStore.getState().hydrated).toBe(true);
  });
});

describe('completeOnboarding', () => {
  it('flips onboardingCompleted to true', async () => {
    await useAppStore.getState().completeOnboarding();

    expect(useAppStore.getState().onboardingCompleted).toBe(true);
  });

  it('keeps the current mode', async () => {
    resetStore({ mode: 'pregnancy' });

    await useAppStore.getState().completeOnboarding();

    expect(useAppStore.getState().mode).toBe('pregnancy');
  });

  it('writes the full state', async () => {
    resetStore({ mode: 'pregnancy' });

    await useAppStore.getState().completeOnboarding();

    expect(saveAppStateMock).toHaveBeenCalledTimes(1);
    expect(saveAppStateMock).toHaveBeenCalledWith({
      mode: 'pregnancy',
      onboardingCompleted: true,
    });
  });

  it('propagates a write failure', async () => {
    saveAppStateMock.mockRejectedValue(new Error('disk full'));

    await expect(useAppStore.getState().completeOnboarding()).rejects.toThrow('disk full');
  });

  it('leaves memory unchanged when the write fails', async () => {
    saveAppStateMock.mockRejectedValue(new Error('disk full'));

    await expect(useAppStore.getState().completeOnboarding()).rejects.toThrow();

    expect(useAppStore.getState().onboardingCompleted).toBe(false);
    expect(useAppStore.getState().mode).toBe('cycle');
  });
});

describe('resetAppState', () => {
  it('clears the stored state', async () => {
    await useAppStore.getState().resetAppState();

    expect(clearAppStateMock).toHaveBeenCalledTimes(1);
  });

  it('returns to the defaults', async () => {
    resetStore({ mode: 'pregnancy', onboardingCompleted: true, hydrated: true });

    await useAppStore.getState().resetAppState();

    expect(useAppStore.getState().mode).toBe(DEFAULT_APP_STATE.mode);
    expect(useAppStore.getState().onboardingCompleted).toBe(
      DEFAULT_APP_STATE.onboardingCompleted
    );
  });

  it('leaves the store hydrated', async () => {
    await useAppStore.getState().resetAppState();

    expect(useAppStore.getState().hydrated).toBe(true);
  });

  it('propagates a clear failure', async () => {
    clearAppStateMock.mockRejectedValue(new Error('remove failed'));

    await expect(useAppStore.getState().resetAppState()).rejects.toThrow('remove failed');
  });

  it('leaves memory unchanged when the clear fails', async () => {
    resetStore({ mode: 'pregnancy', onboardingCompleted: true, hydrated: true });
    clearAppStateMock.mockRejectedValue(new Error('remove failed'));

    await expect(useAppStore.getState().resetAppState()).rejects.toThrow();

    expect(useAppStore.getState().mode).toBe('pregnancy');
    expect(useAppStore.getState().onboardingCompleted).toBe(true);
    expect(useAppStore.getState().hydrated).toBe(true);
  });

  it('does not write a state back while clearing', async () => {
    await useAppStore.getState().resetAppState();

    expect(saveAppStateMock).not.toHaveBeenCalled();
  });
});
