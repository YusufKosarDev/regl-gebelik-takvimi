import { getCalendars, getLocales } from 'expo-localization';

/**
 * What the phone says about itself.
 *
 * The only module that talks to `expo-localization`. Three facts are read and
 * nothing else: which language the person set, whether their clock is 24-hour,
 * and which day their week starts on. All three are device facts this app has
 * no business guessing from the language — an English phone in Britain starts
 * the week on Monday, the same phone in the United States starts it on Sunday,
 * and neither of those is a property of English.
 *
 * ## Every read can say "I do not know"
 *
 * `expo-localization` types `languageCode`, `uses24hourClock` and `firstWeekday`
 * as nullable, and on some Android builds they are. Each function here returns
 * `null` in that case rather than inventing an answer, and the decision of what
 * `null` means belongs to the caller: `resolveLanguage` reads it as "show the
 * source language", not as "show English".
 *
 * Wrapped in try/catch because this is a native call on a path that runs during
 * the first render. A module that cannot be reached must not stop the app from
 * starting in Turkish.
 */

/**
 * The device's language as a bare ISO 639 code, or `null`.
 *
 * `languageCode` rather than `languageTag`: this app makes one distinction —
 * Turkish or not — and a tag would mean parsing a region off the front of it
 * for no gain.
 */
export function getDeviceLanguageCode(): string | null {
  try {
    return getLocales()[0]?.languageCode ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether the person's clock is 24-hour, or `null` when the device will not say.
 *
 * Read from the calendar rather than inferred from the language, because it is
 * a setting somebody can change without changing anything else.
 */
export function getDeviceUses24HourClock(): boolean | null {
  try {
    return getCalendars()[0]?.uses24hourClock ?? null;
  } catch {
    return null;
  }
}

/**
 * Which weekday the device starts its week on, as expo-localization's `Weekday`
 * (Sunday = 1 … Saturday = 7), or `null`.
 *
 * Read but not yet acted on: the calendar grid ships Monday-first in both
 * languages for now, and making it follow this is deliberately deferred so the
 * grid's padding arithmetic is not rewritten in the same pass as the strings.
 */
export function getDeviceFirstWeekday(): number | null {
  try {
    return getCalendars()[0]?.firstWeekday ?? null;
  } catch {
    return null;
  }
}
