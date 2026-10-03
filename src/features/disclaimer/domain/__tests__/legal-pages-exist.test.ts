import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { LEGAL_BASE_URL, legalPageUrl } from '../legal-links';

import { LANGUAGES } from '@/i18n/language';

/**
 * Every link the About screen offers opens a file that exists.
 *
 * ## Why this is a test rather than a careful rename
 *
 * `legal-links.ts` names files that live in `docs/` and are served by GitHub
 * Pages. Nothing else connects the two: the app has no way to follow its own
 * link at build time, and the suite mocks `Linking` everywhere, so a page
 * renamed in `docs/` and not in `legal-links` typechecks, lints and passes 6,000
 * tests while shipping a 404 behind "Privacy policy".
 *
 * That is the worst failure this feature can have. The one row somebody taps
 * because something worried them is the row that must not be broken, and a
 * store review that opens the privacy policy link is where it would be found.
 *
 * It reads the repository rather than the network on purpose: a test that
 * fetched the live site would fail on a plane and pass with a stale cache, and
 * what needs checking is that the app and the published directory agree.
 */

const DOCS = join(__dirname, '..', '..', '..', '..', '..', 'docs');

/** The path part of a page URL, which is its path inside `docs/`. */
function publishedPath(url: string): string {
  return url.slice(LEGAL_BASE_URL.length);
}

describe('every page the app links to', () => {
  it.each(
    LANGUAGES.flatMap((language) =>
      (['privacy', 'kvkk', 'deletion'] as const).map(
        (page) => [language, page, legalPageUrl(page, language)] as const
      )
    )
  )('exists in docs/ for %s %s', (_language, _page, url) => {
    const relative = publishedPath(url);

    expect([relative, existsSync(join(DOCS, relative))]).toEqual([relative, true]);
  });

  /**
   * The stylesheet is one level up for the English pages.
   *
   * `docs/en/` is a directory, so `href="style.css"` resolves to
   * `docs/en/style.css`, which does not exist - the page then renders as
   * unstyled black-on-white text and still returns 200, so nothing else here
   * would catch it.
   */
  it.each(['en/privacy.html', 'en/data-deletion.html'])(
    'reaches the stylesheet from %s',
    (relative) => {
      const html = readFileSync(join(DOCS, relative), 'utf8');

      expect(html).toContain('href="../style.css"');
    }
  );

  /** A page that claims the wrong language is a page a screen reader mispronounces. */
  it.each([
    ['gizlilik.html', 'tr'],
    ['kvkk.html', 'tr'],
    ['veri-silme.html', 'tr'],
    ['index.html', 'tr'],
    ['en/privacy.html', 'en'],
    ['en/data-deletion.html', 'en'],
    ['en/index.html', 'en'],
  ])('declares %s as %s', (relative, lang) => {
    const html = readFileSync(join(DOCS, relative), 'utf8');

    expect(html).toContain(`<html lang="${lang}">`);
  });

  /**
   * The English pages say nothing about an emergency number.
   *
   * The same rule as the disclaimer catalogue, for the same reason, applied to
   * the one other place the app publishes this sentence. The Turkish landing
   * page keeps 112.
   */
  it.each(['en/index.html', 'en/privacy.html', 'en/data-deletion.html'])(
    'names no emergency number in %s',
    (relative) => {
      const html = readFileSync(join(DOCS, relative), 'utf8');

      expect(/\b(112|911|999)\b/.test(html)).toBe(false);
    }
  );
});
