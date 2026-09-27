/**
 * The whole i18n surface, in one import.
 *
 * Features import from `@/i18n` rather than reaching at individual files, so
 * the internal layout can change without a rename across fifty call sites.
 */

export {
  DEFAULT_LANGUAGE_PREFERENCE,
  LANGUAGES,
  LANGUAGE_PREFERENCES,
  SOURCE_LANGUAGE,
  isLanguage,
  isLanguagePreference,
  resolveLanguage,
  validateLanguagePreference,
} from './language';
export type { Language, LanguagePreference } from './language';

export {
  getDeviceFirstWeekday,
  getDeviceLanguageCode,
  getDeviceUses24HourClock,
} from './device-locale';

export { useLanguage, useMessages } from './use-language';

export { plural } from './plural';

/**
 * A feature's two catalogues, as one value.
 *
 * Every feature exports one of these and screens pass it to `useMessages`. The
 * English side is typed against the Turkish one, so the pair cannot be built
 * with a key missing from either.
 */
export type Messages<T> = {
  readonly tr: T;
  readonly en: T;
};
