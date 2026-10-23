import { exportMessages } from '../export-messages';
import type { ExportPdfData } from '../export-pdf';
import {
  A4_HEIGHT_POINTS,
  A4_WIDTH_POINTS,
  buildExportPdfHtmlIn,
} from '../export-pdf';
import { buildExportTextIn } from '../export-text';

import type { ISODate } from '@/types/iso-date';

/**
 * The printable document.
 *
 * ## What this file is for
 *
 * Three kinds of promise, and they fail differently:
 *
 *   - the page carries everything the `.txt` carries, which is the promise that
 *     the PDF is the summary in a document rather than a second, thinner
 *     summary. Held by comparing the two outputs rather than by listing lines,
 *     so a sentence added to one and not the other is caught;
 *   - the page says what a document has to say and the `.txt` does not - what
 *     it is, which numbers were entered, what is missing;
 *   - the mechanics a renderer needs: UTF-8 declared, the footer repeated by
 *     CSS rather than by being written once, the page size left to the print
 *     options.
 */

const tr = exportMessages.tr;

function data(overrides: Partial<ExportPdfData> = {}): ExportPdfData {
  return {
    today: '2026-10-23' as ISODate,
    cycleSettings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    observations: {
      lengths: [27, 29, 31],
      medianDays: 29,
      shortestDays: 27,
      longestDays: 31,
      spreadDays: 4,
      discardedCount: 0,
    },
    periodRecords: [
      { id: 'r1', startDate: '2026-09-01' as ISODate, endDate: '2026-09-05' as ISODate },
      { id: 'r2', startDate: '2026-08-02' as ISODate, isOngoing: true },
    ],
    dailyEntries: [],
    loggedCounts: {
      listed: [
        { label: 'Kramp', days: 11 },
        { label: 'Şişkinlik', days: 6 },
      ],
      hasBelowFloor: false,
    },
    ...overrides,
  } as ExportPdfData;
}

/** The text a reader sees, with the markup taken off. */
function visibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<head[\s\S]*?<\/head>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

describe('the page carries the whole summary', () => {
  /**
   * The promise that matters most, and the one a list of `toContain`s would
   * only pretend to keep.
   *
   * Every line the `.txt` prints has to be on the page. Asserting it against
   * the other builder's own output means a sentence added to the summary and
   * forgotten here fails this test, which a hand-written list of expected
   * lines would not.
   */
  it('prints every line the .txt prints', () => {
    const subject = data();
    const page = visibleText(buildExportPdfHtmlIn(tr, subject, 'tr'));

    const lines = buildExportTextIn(tr, subject, 'tr')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

    expect(lines.length).toBeGreaterThan(5);

    for (const line of lines) {
      expect([line, page.includes(line)]).toEqual([line, true]);
    }
  });

  it('prints them in the order the summary puts them in', () => {
    const subject = data();
    const page = visibleText(buildExportPdfHtmlIn(tr, subject, 'tr'));

    const positions = [
      tr.summaryCycleHeading,
      tr.summaryRecordsHeading,
      tr.summaryLogHeading,
    ].map((heading) => page.indexOf(heading));

    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(positions.every((position) => position >= 0)).toBe(true);
  });
});

describe('what the page says that the .txt does not', () => {
  it('says what the document is, above the records rather than only below them', () => {
    const page = visibleText(buildExportPdfHtmlIn(tr, data(), 'tr'));

    expect(page).toContain(tr.pdfIntro);
    expect(page.indexOf(tr.pdfIntro)).toBeLessThan(page.indexOf(tr.summaryCycleHeading));
  });

  it('marks the entered numbers apart from the worked-out ones', () => {
    const page = visibleText(buildExportPdfHtmlIn(tr, data(), 'tr'));

    expect(page).toContain(tr.pdfEnteredNote);
    expect(page).toContain(tr.pdfRecordedNote);
  });

  /**
   * The counts section, which is the whole of the difference between the two
   * documents. `export-text.ts` records why the `.txt` has none.
   */
  it('counts what was written down', () => {
    const page = visibleText(buildExportPdfHtmlIn(tr, data(), 'tr'));

    expect(page).toContain(tr.pdfCountsHeading);
    expect(page).toContain(tr.pdfCountsNote);
    expect(page).toContain(tr.pdfCountLine('Kramp', 11));
    expect(page).toContain(tr.pdfCountLine('Şişkinlik', 6));
  });

  it('says nothing was counted, rather than printing an empty heading', () => {
    const page = visibleText(
      buildExportPdfHtmlIn(
        tr,
        data({ loggedCounts: { listed: [], hasBelowFloor: false } }),
        'tr'
      )
    );

    expect(page).toContain(tr.pdfCountsNone);
    expect(page).not.toContain(tr.pdfCountsBelowFloor);
  });

  it('says what was left under the floor when something was', () => {
    const page = visibleText(
      buildExportPdfHtmlIn(
        tr,
        data({
          loggedCounts: { listed: [{ label: 'Kramp', days: 11 }], hasBelowFloor: true },
        }),
        'tr'
      )
    );

    expect(page).toContain(tr.pdfCountsBelowFloor);
    expect(page).not.toContain(tr.pdfCountsNone);
  });
});

describe('the footer', () => {
  /**
   * On every page, because the file is shared on its own.
   *
   * `threeFilesNote` exists because the share sheet takes one file at a time,
   * and the consequence for a document is that whatever it says has to be
   * complete without the other two. A disclaimer on the last page only is a
   * disclaimer on the page least likely to be the one photocopied.
   *
   * The repeat is the renderer's job - a fixed element is painted on every page
   * - so what this pins is that the markup asks for it. That it actually lands
   * on page two was measured with Chromium, which is the engine the Android
   * WebView prints with; `RELEASE.md` carries the on-device check.
   */
  it('is written once and asked to repeat, not pasted per section', () => {
    const html = buildExportPdfHtmlIn(tr, data(), 'tr');

    expect(html.split(tr.summaryFooter).length - 1).toBe(1);
    expect(html).toMatch(/position:\s*fixed/);
  });

  it('is there even when there is nothing above it', () => {
    const page = visibleText(
      buildExportPdfHtmlIn(
        tr,
        data({
          cycleSettings: null,
          periodRecords: [],
          dailyEntries: [],
          loggedCounts: { listed: [], hasBelowFloor: false },
        }),
        'tr'
      )
    );

    // The same rule the records-summary screen keeps: the disclaimer is about
    // what the document is, not about any line on it.
    expect(page).toContain(tr.summaryFooter);
  });

  it('leaves room for itself in the bottom page margin', () => {
    // A fixed footer over a full page of text would print on top of the last
    // line. The margin is the only thing that reserves the strip.
    expect(buildExportPdfHtmlIn(tr, data(), 'tr')).toMatch(/@page\s*\{[^}]*margin/);
  });
});

describe('the mechanics a renderer needs', () => {
  it('declares UTF-8, so the Turkish is not guessed at', () => {
    const html = buildExportPdfHtmlIn(tr, data(), 'tr');

    expect(html.toLowerCase()).toContain('<meta charset="utf-8">');
    expect(html).toContain('Şişkinlik');
  });

  it('declares the language it is written in', () => {
    expect(buildExportPdfHtmlIn(tr, data(), 'tr')).toContain('<html lang="tr">');
    expect(buildExportPdfHtmlIn(exportMessages.en, data(), 'en')).toContain('<html lang="en">');
  });

  /**
   * A4 through the print options, not through CSS.
   *
   * Measured: `@page { size: 595px 842px }` came out of Chromium as a MediaBox
   * of 445.92 x 631.92pt, because CSS pixels are 96dpi units and the page is
   * specified in points. The documented contract puts the page size in
   * `printToFileAsync`'s `width`/`height` - "Defaults to `612`... US Letter
   * paper format with 72 PPI" - and leaves `@page` for the margins, which is
   * what the Android note in the same document says it is for. A `size` here
   * would be a second opinion about the paper, fighting the first.
   */
  it('states A4 in points for the print options', () => {
    expect([A4_WIDTH_POINTS, A4_HEIGHT_POINTS]).toEqual([595, 842]);
  });

  it('leaves the paper size out of the CSS, so only the options set it', () => {
    const html = buildExportPdfHtmlIn(tr, data(), 'tr');
    const atPage = /@page\s*\{([^}]*)\}/.exec(html);

    expect(atPage).not.toBeNull();
    expect(atPage?.[1]).not.toMatch(/\bsize\s*:/);
  });

  it('escapes what it interpolates', () => {
    // Nothing in the summary is free text today. A later section that carried
    // a note would otherwise put markup straight into the document, and this
    // is cheaper to keep true than to discover.
    const page = buildExportPdfHtmlIn(
      tr,
      data({
        loggedCounts: {
          listed: [{ label: '<script>x</script>', days: 7 }],
          hasBelowFloor: false,
        },
      }),
      'tr'
    );

    expect(page).not.toContain('<script>');
    expect(page).toContain('&lt;script&gt;');
  });
});
