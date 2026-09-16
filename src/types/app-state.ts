/**
 * Minimum global application state.
 *
 * Only what cannot be derived from anything else lives here. The active cycle
 * phase, fertility level, pregnancy week, theme, avatar and the database handle
 * are all either computed from stored data or owned by another layer, so none of
 * them belong in this model.
 *
 * No store, no reducer and no update helpers: this module describes the shape
 * and checks it, nothing more.
 */

export type AppMode = 'cycle' | 'pregnancy';

/** Every valid mode, used by the type guard. */
const APP_MODES = ['cycle', 'pregnancy'] as const satisfies readonly AppMode[];

export type AppState = {
  readonly mode: AppMode;
  readonly onboardingCompleted: boolean;
};

/** What a first launch starts from, before anything has been stored. */
export const DEFAULT_APP_STATE: AppState = {
  mode: 'cycle',
  onboardingCompleted: false,
} as const;

export function isAppMode(value: string): value is AppMode {
  return (APP_MODES as readonly string[]).includes(value);
}

/**
 * Checks a state object at runtime.
 *
 * The type says the shape is right, but state read back from storage or a
 * serialised payload has only been asserted, not verified — this is where that
 * assertion is actually tested.
 */
export function validateAppState(state: AppState): void {
  if (typeof state.mode !== 'string' || !isAppMode(state.mode)) {
    throw new Error(`Invalid AppState mode: ${JSON.stringify(state.mode)}.`);
  }

  if (typeof state.onboardingCompleted !== 'boolean') {
    throw new Error(
      `AppState onboardingCompleted must be a boolean, received ` +
        `${JSON.stringify(state.onboardingCompleted)}.`
    );
  }
}
