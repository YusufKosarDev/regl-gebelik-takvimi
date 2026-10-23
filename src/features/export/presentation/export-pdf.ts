import type { ExportMessages } from './export-messages';
import type { ExportSummaryData } from './export-sections';
import { buildExportSections } from './export-sections';

import type { LoggedDayCounts } from '../domain/logged-day-counts';

import type { Language } from '@/i18n/language';
import { formatDisplayDate } from '@/utils/format-date';

/**
 * A4, in points, for `printToFileAsync`'s `width` and `height`.
 *
 * ## Why the paper is set here and not in the CSS
 *
 * This was written as `@page { size: 595px 842px }` first, and measured:
 * Chromium produced a MediaBox of 445.92 x 631.92pt, because a CSS pixel is a
 * 96dpi unit and the paper is specified in points. `595pt 842pt` in CSS does
 * come out right - 594.96 x 841.92 - but the documented contract puts the paper
 * in the print options ("Defaults to `612`... US Letter paper format with 72
 * PPI") and leaves `@page` for the margins, which is what the SDK's own Android
 * note says it is for. Two places naming the paper would be two opinions about
 * it, and only one of them reaches the Android PrintAttributes.
 *
 * So: the options own the paper, the CSS owns the margins, and
 * `export-pdf.test.ts` holds the CSS to having no `size` in it.
 */
export const A4_WIDTH_POINTS = 595;
export const A4_HEIGHT_POINTS = 842;

/**
 * The strip at the bottom of every page that the footer sits in.
 *
 * The footer is `position: fixed`, so it is painted at the bottom of each
 * page's content area rather than flowed after the text. Without a bottom
 * margin wide enough to hold it, a full page of text would print underneath
 * it. Measured over a six-page document: with this reserve the footer is the
 * last thing on every page and nothing runs into it.
 */
const FOOTER_RESERVE_POINTS = 52;

export type ExportPdfData = ExportSummaryData & {
  readonly loggedCounts: LoggedDayCounts;
};

/**
 * The printable document, as HTML for `printToFileAsync`.
 *
 * ## What it is, and why it is not just the summary with a typeface
 *
 * `export-text.ts` records the difference at length. The short of it: a `.txt`
 * is a readable dump and this is a document to hand to somebody. It arrives
 * without the app, nobody can tap through to context, and a typeset page reads
 * as a report where the same words in a `.txt` read as a dump - the form makes
 * a claim the content does not. Three things follow, and each of them is a
 * sentence on the page rather than a note in this file:
 *
 *   - `pdfIntro` says what the document is, at the top, where the footer comes
 *     too late to help somebody deciding how to read the first number;
 *   - each section says where its numbers came from. The CSV can leave that to
 *     its column names - `cycle_day` and `phase` are the worked-out ones - and
 *     a page has no column names, so `data-category.ts`'s split between "what
 *     a person entered" and "what this device worked out" has to be in words;
 *   - the footer is on *every* page. `threeFilesNote` exists because the share
 *     sheet takes one file at a time, and the consequence for a document is
 *     that it has to be complete on its own. A disclaimer on the last page only
 *     is a disclaimer on the page least likely to be the one photocopied.
 *
 * ## The one section the `.txt` has not got
 *
 * The counts. Aggregate, over five days or more, with `pdfCountsNote` saying
 * what they are not. Deliberately *not* the phase breakdown that the
 * records-summary screen draws: on screen a distribution has the baseline bar
 * beside it and a reader can see when it is only describing the shape of a
 * cycle, and on paper that line would sit alone beside a clinician and read as
 * a result. `records-summary-messages.ts` is where the baseline earns its
 * place; a page cannot carry it, so the page does not make the claim.
 *
 * ## Why the HTML is a template string
 *
 * It is one document with a fixed shape, built once per share. A renderer or a
 * builder API would be more machinery than a page of markup needs, and the
 * markup being readable in one piece is worth more here than the abstraction:
 * what the document says is the reviewable part.
 */
export function buildExportPdfHtmlIn(
  messages: ExportMessages,
  data: ExportPdfData,
  language: Language
): string {
  const sections = buildExportSections(messages, data, language)
    .map((section) => renderSection(section.heading, section.provenance, section.lines))
    .join('\n');

  return [
    '<!DOCTYPE html>',
    `<html lang="${language}">`,
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(messages.summaryHeading)}</title>`,
    `<style>${styles()}</style>`,
    '</head>',
    '<body>',
    `<h1>${escapeHtml(messages.summaryHeading)}</h1>`,
    `<p class="taken">${escapeHtml(
      messages.summaryGeneratedOn(formatDisplayDate(data.today, language))
    )}</p>`,
    `<p class="intro">${escapeHtml(messages.pdfIntro)}</p>`,
    sections,
    renderCounts(messages, data.loggedCounts),
    // Written once. The repeat is the renderer's, which is what makes it
    // impossible for one page to be missing it.
    `<div class="footer">${escapeHtml(messages.summaryFooter)}</div>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

/** One headed block: its lines, and where they came from. */
function renderSection(
  heading: string,
  provenance: string | null,
  lines: readonly string[]
): string {
  const note =
    provenance === null ? '' : `\n<p class="note">${escapeHtml(provenance)}</p>`;

  const body = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('\n');

  return `<section>\n<h2>${escapeHtml(heading)}</h2>${note}\n<ul>\n${body}\n</ul>\n</section>`;
}

/**
 * The counts, or a sentence saying there are none.
 *
 * Both absences are named rather than left as a gap, which is
 * `build-export-rows.ts`'s "an empty cell means the app has nothing to say,
 * everywhere" carried into a format with no cells: `pdfCountsNone` when nothing
 * reached the floor at all, `pdfCountsBelowFloor` when something was written
 * down but on too few days to list. A heading over white space would be the
 * document failing to account for itself.
 */
function renderCounts(messages: ExportMessages, counts: LoggedDayCounts): string {
  const rows =
    counts.listed.length === 0
      ? `<p class="note">${escapeHtml(messages.pdfCountsNone)}</p>`
      : `<ul>\n${counts.listed
          .map((row) => `<li>${escapeHtml(messages.pdfCountLine(row.label, row.days))}</li>`)
          .join('\n')}\n</ul>`;

  const belowFloor = counts.hasBelowFloor
    ? `\n<p class="note">${escapeHtml(messages.pdfCountsBelowFloor)}</p>`
    : '';

  return [
    '<section>',
    `<h2>${escapeHtml(messages.pdfCountsHeading)}</h2>`,
    `<p class="note">${escapeHtml(messages.pdfCountsNote)}</p>`,
    rows + belowFloor,
    '</section>',
  ].join('\n');
}

/**
 * The page's own styles, in points.
 *
 * Points rather than pixels throughout, because the paper is given to the
 * renderer in points and a CSS pixel is a 96dpi unit - mixing them is what made
 * the first attempt's paper come out three quarters of the size it asked for.
 *
 * No web font and no image: `printToFileAsync` cannot reach a local asset on
 * iOS, and a document that has to be complete on its own is the wrong place to
 * depend on a network. The stack is whatever the platform has.
 */
function styles(): string {
  return [
    `@page { margin: 36pt 40pt ${FOOTER_RESERVE_POINTS}pt; }`,
    'body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, sans-serif;',
    '  font-size: 10.5pt; line-height: 1.45; color: #1a1a1a; }',
    'h1 { font-size: 16pt; margin: 0; }',
    'h2 { font-size: 11.5pt; margin: 0 0 3pt; }',
    '.taken { margin: 2pt 0 0; font-size: 9.5pt; color: #555; }',
    '.intro { margin: 10pt 0 0; font-size: 9.5pt; color: #333;',
    '  border-top: 0.5pt solid #ccc; padding-top: 8pt; }',
    'section { margin-top: 14pt; }',
    '.note { margin: 0 0 4pt; font-size: 9pt; color: #555; }',
    'ul { margin: 0; padding-left: 14pt; }',
    'li { margin: 0 0 1pt; }',
    // Painted on every page by the renderer; the bottom page margin above
    // reserves the strip it sits in.
    '.footer { position: fixed; left: 0; right: 0; bottom: 0; font-size: 8.5pt;',
    '  color: #555; border-top: 0.5pt solid #ccc; padding-top: 5pt; background: #fff; }',
  ].join('\n');
}

/**
 * Nothing in the summary is free text today, and this runs anyway.
 *
 * Every value on the page is a catalogue sentence, a formatted date or a
 * number, so there is nothing to escape. A later section carrying somebody's
 * own note would put their text into markup, and this is far cheaper to keep
 * true than to discover afterwards on a document that has already been shared.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
