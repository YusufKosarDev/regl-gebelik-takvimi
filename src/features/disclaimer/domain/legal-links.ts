import type { Language } from '@/i18n/language';

/**
 * Where the public legal pages live.
 *
 * The base is in one place because it is the thing most likely to move: a
 * custom domain, a different host, a path change. Everything else is derived
 * from it, so a move is one edit rather than four, and there is no way for one
 * link to be left pointing at the old host.
 *
 * The pages themselves are in `docs/`, served by GitHub Pages. The Turkish set
 * is at the root and the English set is under `en/`.
 */

export const LEGAL_BASE_URL = 'https://yusufkosardev.github.io/regl-gebelik-takvimi/';

/** The address a person writes to for anything, including a deletion request. */
export const SUPPORT_EMAIL = 'regltakvimi.destek@gmail.com';

/** Which page, named the way the rest of the app refers to them. */
export type LegalPage = 'privacy' | 'kvkk' | 'deletion';

/**
 * Which file each page is, per language.
 *
 * ## KVKK is the same file in both
 *
 * It is the notice required by Turkish Law No. 6698, addressed to a Turkish
 * regulator, and translating it would produce a document that reads like the
 * instrument without being it. So the English UI links to the Turkish page and
 * says so in the label - see `aboutKvkkLabel`, which carries "(Turkish)".
 *
 * Sending an English reader to a Turkish page unannounced would be worse than
 * either option; sending them to a translation that is not the legal text would
 * be worse still.
 */
const PAGE_FILES: Readonly<Record<Language, Readonly<Record<LegalPage, string>>>> = {
  tr: {
    privacy: 'gizlilik.html',
    kvkk: 'kvkk.html',
    deletion: 'veri-silme.html',
  },
  en: {
    privacy: 'en/privacy.html',
    kvkk: 'kvkk.html',
    deletion: 'en/data-deletion.html',
  },
};

/**
 * The full address of one page, in one language.
 *
 * ## Why the language is a required argument
 *
 * The same reason `formatDisplayDate` has the `require-language-argument` lint
 * rule behind it: a default would be Turkish, and a screen that forgot to pass
 * the language would show an English label over a Turkish document. That is a
 * bug no test pinned to one language can see, and the person who finds it is
 * somebody who opened the privacy policy because something worried them.
 *
 * Joined rather than concatenated blindly: a base with no trailing slash is an
 * easy thing to paste in, and `.../regl-gebelik-takvimigizlilik.html` is the
 * kind of broken link nobody notices until somebody needs the privacy policy.
 */
export function legalPageUrl(
  page: LegalPage,
  language: Language,
  base: string = LEGAL_BASE_URL
): string {
  const trimmed = base.endsWith('/') ? base : `${base}/`;

  return `${trimmed}${PAGE_FILES[language][page]}`;
}

/** `mailto:` for the support address, so a press opens the mail app. */
export function supportMailtoUrl(email: string = SUPPORT_EMAIL): string {
  return `mailto:${email}`;
}
