import { create } from 'zustand';

import type { LanguagePreference } from '@/i18n/language';
import { DEFAULT_LANGUAGE_PREFERENCE } from '@/i18n/language';
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
  /**
   * Which language was chosen, never absent in memory.
   *
   * `AppState` leaves it optional because a state written before the field
   * existed has no value for it. Here it is always one of the three, so nothing
   * downstream has to answer "what does undefined mean" a second time.
   */
  readonly languagePreference: LanguagePreference;
  /** Whether the stored state has been read yet. Not persisted itself. */
  readonly hydrated: boolean;

  readonly hydrate: () => Promise<void>;
  readonly setMode: (mode: AppMode) => Promise<void>;
  readonly setLanguagePreference: (preference: LanguagePreference) => Promise<void>;
  readonly completeOnboarding: () => Promise<void>;
  readonly resetAppState: () => Promise<void>;
};

/**
 * The whole state, as it would be written.
 *
 * Every writer builds its next state through this rather than naming the two
 * fields it happens to care about. Two of them used to do that, and adding a
 * third field made it a bug waiting to happen: switching to pregnancy mode
 * would have rebuilt the state from `mode` and `onboardingCompleted` and
 * dropped the language somebody had just chosen, with nothing to catch it.
 */
function currentState(store: AppStore, changes: Partial<AppState> = {}): AppState {
  return {
    mode: store.mode,
    onboardingCompleted: store.onboardingCompleted,
    languagePreference: store.languagePreference,
    ...changes,
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  mode: DEFAULT_APP_STATE.mode,
  onboardingCompleted: DEFAULT_APP_STATE.onboardingCompleted,
  languagePreference: DEFAULT_LANGUAGE_PREFERENCE,
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
      // The one place `undefined` is turned into an answer. A state written
      // before the field existed is somebody who has not chosen, which is
      // exactly what 'system' means.
      languagePreference: stored.languagePreference ?? DEFAULT_LANGUAGE_PREFERENCE,
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
    const next = currentState(get(), { mode });

    validateAppState(next);
    await saveAppState(next);

    set(next);
  },

  /**
   * Records which language to show.
   *
   * `'system'` is stored as itself rather than resolved to `'tr'` or `'en'`
   * first: "follow the phone" and "Turkish" look the same on a Turkish phone
   * and different on the next one, and collapsing them would turn somebody who
   * asked for the first into somebody who asked for the second.
   */
  setLanguagePreference: async (preference: LanguagePreference) => {
    const next = currentState(get(), { languagePreference: preference });

    validateAppState(next);
    await saveAppState(next);

    set(next);
  },

  /** Marks onboarding finished, keeping the current mode. Writes before updating memory. */
  completeOnboarding: async () => {
    const next = currentState(get(), { onboardingCompleted: true });

    validateAppState(next);
    await saveAppState(next);

    set(next);
  },

  /** Clears stored state and returns to defaults. Memory is untouched if the clear fails. */
  resetAppState: async () => {
    await clearAppState();

    set({
      mode: DEFAULT_APP_STATE.mode,
      onboardingCompleted: DEFAULT_APP_STATE.onboardingCompleted,
      languagePreference: DEFAULT_LANGUAGE_PREFERENCE,
      hydrated: true,
    });
  },
}));
