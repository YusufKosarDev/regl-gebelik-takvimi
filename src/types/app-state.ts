import type { LanguagePreference } from '@/i18n/language';
import { validateLanguagePreference } from '@/i18n/language';
import { describeValue } from '@/shared/logging';

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
  /**
   * Which language to show, or absent.
   *
   * Optional because it arrived after people had already stored a state
   * without it. Absent is not a value somebody chose and is not written back:
   * it is read as `DEFAULT_LANGUAGE_PREFERENCE` at the one place that resolves
   * it, and the stored object stays a two-key object until somebody actually
   * picks a language.
   *
   * That is forward compatibility, not the silent repair `loadAppState`
   * refuses to do. A field this build predates is a different thing from a
   * field that is there and wrong - an unknown `mode` still throws.
   */
  readonly languagePreference?: LanguagePreference;
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
    throw new Error(`Invalid AppState mode: ${describeValue(state.mode)}.`);
  }

  if (typeof state.onboardingCompleted !== 'boolean') {
    throw new Error(
      `AppState onboardingCompleted must be a boolean, received ` +
        `${describeValue(state.onboardingCompleted)}.`
    );
  }

  // Only when it is there. Absent means a state written before the field
  // existed; present and wrong means somebody or something put a language in
  // that this app does not have, and that is worth a loud failure.
  if (state.languagePreference !== undefined) {
    validateLanguagePreference(state.languagePreference);
  }
}
