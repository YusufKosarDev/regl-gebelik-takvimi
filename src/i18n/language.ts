import { describeValue } from '@/shared/logging';

/**
 * Which language the interface is in, and how that is decided.
 *
 * Pure: nothing here reads a device, a store or a clock. What the phone says and
 * what the person chose both arrive as arguments, so the rule itself can be
 * tested without either.
 */

/** The two languages this app is written in. */
export const LANGUAGES = ['tr', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

/**
 * What is stored, which is one value wider than what is shown.
 *
 * `'system'` is deliberately not the same stored value as `'tr'`. "Follow the
 * phone" and "Turkish" produce the same interface on a Turkish phone and
 * different interfaces on the next one, and collapsing them would silently
 * turn somebody who wanted the first into somebody who asked for the second.
 */
export const LANGUAGE_PREFERENCES = ['system', 'tr', 'en'] as const;

export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

/** What somebody has before they have chosen. */
export const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = 'system';

/**
 * The language the app is written in, and the answer when nothing else is known.
 *
 * Turkish is the source language: every string exists in it first, and the
 * English catalogue is checked against it by the compiler.
 */
export const SOURCE_LANGUAGE: Language = 'tr';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return (
    typeof value === 'string' && (LANGUAGE_PREFERENCES as readonly string[]).includes(value)
  );
}

/**
 * Checks a stored preference, throwing rather than guessing.
 *
 * The same reason the rest of the stored state is validated: a value read back
 * from storage has been outside this app's memory, and a language nobody wrote
 * should be a loud failure rather than a quiet fallback to whichever branch an
 * `if` happens to take.
 */
export function validateLanguagePreference(
  value: unknown
): asserts value is LanguagePreference {
  if (!isLanguagePreference(value)) {
    throw new Error(`Stored language preference is not one this app knows: ${describeValue(value)}.`);
  }
}

/**
 * Which language to show.
 *
 * ## The three cases, and why the third is not English
 *
 *   - A stored `'tr'` or `'en'` wins over everything. Somebody who chose is not
 *     asked again by a phone that disagrees.
 *   - `'system'` follows the phone: a device asking for Turkish gets Turkish,
 *     and **anything else gets English**. Not Turkish — a Turkish speaker with
 *     an English phone can find the setting, while somebody handed a language
 *     they cannot read has no idea what they are looking for.
 *   - A device that will not say gets **Turkish**, the source language.
 *
 * That last case is a third answer rather than part of "anything else", and it
 * is deliberate. `null` from `getLocales()` is not a device asking for English;
 * it is a device that did not answer. Under Jest there is no device at all, and
 * showing the language the app was written in is the conservative reading of
 * silence.
 *
 * `deviceLanguageCode` is the bare code — `'tr'`, `'en'`, `'de'` — never a tag
 * like `'tr-TR'`. Matching is exact and case-sensitive, because the one caller
 * that produces it reads `Locale.languageCode`, which expo-localization
 * documents as lowercase ISO 639.
 */
export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguageCode: string | null
): Language {
  if (preference !== 'system') {
    return preference;
  }

  if (deviceLanguageCode === null) {
    return SOURCE_LANGUAGE;
  }

  return deviceLanguageCode === 'tr' ? 'tr' : 'en';
}
