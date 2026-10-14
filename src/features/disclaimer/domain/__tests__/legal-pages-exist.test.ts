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
  /**
   * The one date claim a test can hold.
   *
   * Each English page says it is the "English translation of the Turkish text
   * of <date>", and names the Turkish as the original where the two differ.
   * That is a claim about a specific version of a specific file, so when the
   * Turkish changes and the English does not, the claim becomes false — and a
   * reader comparing the two has no way to know which one they are holding.
   *
   * Whether an edit was substantive enough to deserve a new date is a judgement
   * no test can make, so the dates themselves stay a judgement. This binds only
   * the relationship between them, which is checkable.
   *
   * It exists because four of the five pages were found carrying a date earlier
   * than their last substantive change — including two privacy policies whose
   * disclosure of stored data categories had changed that day while telling a
   * reader it had last changed three weeks earlier. `kvkk.html` was the only
   * page whose date was still true, which was the second time that day it was
   * the only page that was right.
   */
  describe('each English page names the version of the Turkish it translates', () => {
    /** The pairs, so a third translated page has to be added here as well. */
    const TRANSLATIONS = [
      ['en/privacy.html', 'gizlilik.html'],
      ['en/data-deletion.html', 'veri-silme.html'],
    ] as const;

    const TURKISH_MONTHS = [
      'Ocak',
      'Şubat',
      'Mart',
      'Nisan',
      'Mayıs',
      'Haziran',
      'Temmuz',
      'Ağustos',
      'Eylül',
      'Ekim',
      'Kasım',
      'Aralık',
    ];

    const ENGLISH_MONTHS = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    /** "14 Ekim 2026" or "14 October 2026" to a comparable [y, m, d]. */
    function partsOf(day: string, month: string, year: string, months: readonly string[]) {
      const index = months.indexOf(month);

      return [Number(year), index + 1, Number(day)] as const;
    }

    function turkishLastUpdated(relative: string) {
      const html = readFileSync(join(DOCS, relative), 'utf8').replace(/\s+/g, ' ');
      const match = /Son güncelleme: (\d{1,2}) (\p{L}+) (\d{4})/u.exec(html);

      if (match === null) {
        throw new Error(relative + ' has no "Son güncelleme" line to compare against');
      }

      return partsOf(match[1], match[2], match[3], TURKISH_MONTHS);
    }

    function translatedVersion(relative: string) {
      const html = readFileSync(join(DOCS, relative), 'utf8').replace(/\s+/g, ' ');
      const match = /Turkish text of (\d{1,2}) (\p{L}+) (\d{4})/u.exec(html);

      if (match === null) {
        throw new Error(relative + ' does not say which Turkish version it translates');
      }

      return partsOf(match[1], match[2], match[3], ENGLISH_MONTHS);
    }

    it.each(TRANSLATIONS)('%s translates the current %s', (english, turkish) => {
      expect(translatedVersion(english)).toEqual(turkishLastUpdated(turkish));
    });

    it.each(TRANSLATIONS)('%s is not dated before the %s it translates', (english, turkish) => {
      // A translation cannot be older than its source. Caught separately from
      // the equality above so a failure says which of the two is wrong.
      const html = readFileSync(join(DOCS, english), 'utf8').replace(/\s+/g, ' ');
      const match = /Last updated: (\d{1,2}) (\p{L}+) (\d{4})/u.exec(html);

      if (match === null) {
        throw new Error(english + ' has no "Last updated" line');
      }

      const updated = partsOf(match[1], match[2], match[3], ENGLISH_MONTHS);

      expect(updated >= turkishLastUpdated(turkish)).toBe(true);
    });
  });

  it.each(['en/index.html', 'en/privacy.html', 'en/data-deletion.html'])(
    'names no emergency number in %s',
    (relative) => {
      const html = readFileSync(join(DOCS, relative), 'utf8');

      expect(/\b(112|911|999)\b/.test(html)).toBe(false);
    }
  );
});
