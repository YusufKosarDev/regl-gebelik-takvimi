/**
 * Where the public legal pages live.
 *
 * The base is in one place because it is the thing most likely to move: a
 * custom domain, a different host, a path change. Everything else is derived
 * from it, so a move is one edit rather than four, and there is no way for one
 * link to be left pointing at the old host.
 *
 * The pages themselves are in `docs/`, served by GitHub Pages.
 */

export const LEGAL_BASE_URL = 'https://yusufkosardev.github.io/regl-gebelik-takvimi/';

/** The address a person writes to for anything, including a deletion request. */
export const SUPPORT_EMAIL = 'regltakvimi.destek@gmail.com';

/** Which page, named the way the rest of the app refers to them. */
export type LegalPage = 'privacy' | 'kvkk' | 'deletion';

const PAGE_FILES: Readonly<Record<LegalPage, string>> = {
  privacy: 'gizlilik.html',
  kvkk: 'kvkk.html',
  deletion: 'veri-silme.html',
};

/**
 * The full address of one page.
 *
 * Joined rather than concatenated blindly: a base with no trailing slash is an
 * easy thing to paste in, and `.../regl-gebelik-takvimigizlilik.html` is the
 * kind of broken link nobody notices until somebody needs the privacy policy.
 */
export function legalPageUrl(page: LegalPage, base: string = LEGAL_BASE_URL): string {
  const trimmed = base.endsWith('/') ? base : `${base}/`;

  return `${trimmed}${PAGE_FILES[page]}`;
}

/** `mailto:` for the support address, so a press opens the mail app. */
export function supportMailtoUrl(email: string = SUPPORT_EMAIL): string {
  return `mailto:${email}`;
}
