import { getDeviceLanguageCode } from './device-locale';
import type { Language } from './language';
import { resolveLanguage } from './language';

import { useAppStore } from '@/store/app-store';

/**
 * The language the interface is in right now.
 *
 * A bare hook with no provider, mirroring `useTheme()`: a screen asks, gets an
 * answer, and re-renders when the answer changes. There is no context to forget
 * to wrap a tree in, and no way for one subtree to disagree with another.
 *
 * ## Why the device is read on every render rather than once
 *
 * It is a synchronous `getLocales()[0]`, which expo-localization documents as
 * reading a cached value. Caching it again here would mean a module-level
 * variable that is wrong for the rest of the session if somebody changes their
 * phone's language while the app is backgrounded — which Android does not
 * restart the process for.
 *
 * ## Where the preference comes from
 *
 * The app store, which is the same place `mode` and `onboardingCompleted` live
 * and which `_layout.tsx` already holds the first frame for. Before hydration
 * the store holds `'system'`, so a render that somehow beat the read follows
 * the phone rather than guessing a language.
 *
 * The store is subscribed to by field, so choosing a language re-renders every
 * screen reading this and nothing else re-renders at all.
 */
export function useLanguage(): Language {
  const preference = useAppStore((state) => state.languagePreference);

  return resolveLanguage(preference, getDeviceLanguageCode());
}

/**
 * Picks the catalogue for the active language.
 *
 * Generic over the catalogue rather than tied to one global bundle, because the
 * strings live in their features and nothing moves. A screen asks for the pair
 * its own feature exports:
 *
 * ```ts
 * const strings = useMessages(homeMessages);
 * ```
 *
 * `T` is inferred from the Turkish catalogue and the English one is typed
 * against it, so a key that exists in one and not the other is a compile error
 * at the point the pair is declared — not a fallback string discovered by
 * somebody using the app.
 */
export function useMessages<T>(catalogue: { readonly tr: T; readonly en: T }): T {
  return catalogue[useLanguage()];
}
