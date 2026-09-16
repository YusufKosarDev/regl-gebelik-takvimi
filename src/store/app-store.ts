import { create } from 'zustand';

import { clearAppState, loadAppState, saveAppState } from '@/storage/app-state-storage';
import type { AppMode, AppState } from '@/types/app-state';
import { DEFAULT_APP_STATE, validateAppState } from '@/types/app-state';

/**
 * Global app state.
 *
 * Holds only what the whole app needs and nothing that can be derived: the cycle
 * profile, the database handle, the current phase, fertility level and pregnancy
 * week all belong to their own layers and stay out of here.
 *
 * Persistence is explicit. No `persist` middleware and no direct AsyncStorage
 * access — every read and write goes through the storage module, so the store
 * never has two sources of truth for what is on disk.
 */

type AppStore = {
  readonly mode: AppMode;
  readonly onboardingCompleted: boolean;
  /** Whether the stored state has been read yet. Not persisted itself. */
  readonly hydrated: boolean;

  readonly hydrate: () => Promise<void>;
  readonly setMode: (mode: AppMode) => Promise<void>;
  readonly completeOnboarding: () => Promise<void>;
  readonly resetAppState: () => Promise<void>;
};

export const useAppStore = create<AppStore>((set, get) => ({
  mode: DEFAULT_APP_STATE.mode,
  onboardingCompleted: DEFAULT_APP_STATE.onboardingCompleted,
  hydrated: false,

  /**
   * Loads the stored state.
   *
   * A failing read rejects and leaves `hydrated` false. It is not swallowed into
   * the defaults: that would look like a fresh install and quietly send a user
   * who already finished onboarding back through it.
   */
  hydrate: async () => {
    const stored = await loadAppState();

    set({
      mode: stored.mode,
      onboardingCompleted: stored.onboardingCompleted,
      hydrated: true,
    });
  },

  /**
   * Switches mode, writing before updating memory.
   *
   * The order matters: if the write fails the in-memory state is left alone, so
   * the UI never shows a mode that did not survive to disk.
   */
  setMode: async (mode: AppMode) => {
    const next: AppState = { mode, onboardingCompleted: get().onboardingCompleted };

    validateAppState(next);
    await saveAppState(next);

    set({ mode: next.mode, onboardingCompleted: next.onboardingCompleted });
  },

  /** Marks onboarding finished, keeping the current mode. Writes before updating memory. */
  completeOnboarding: async () => {
    const next: AppState = { mode: get().mode, onboardingCompleted: true };

    validateAppState(next);
    await saveAppState(next);

    set({ mode: next.mode, onboardingCompleted: next.onboardingCompleted });
  },

  /** Clears stored state and returns to defaults. Memory is untouched if the clear fails. */
  resetAppState: async () => {
    await clearAppState();

    set({
      mode: DEFAULT_APP_STATE.mode,
      onboardingCompleted: DEFAULT_APP_STATE.onboardingCompleted,
      hydrated: true,
    });
  },
}));
