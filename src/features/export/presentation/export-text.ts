import type { ExportMessages } from './export-messages';
import type { ExportSummaryData } from './export-sections';
import { buildExportSections } from './export-sections';

import type { Language } from '@/i18n/language';
import { formatDisplayDate } from '@/utils/format-date';

export type { ExportSummaryData } from './export-sections';

/**
 * The readable summary, as plain text.
 *
 * ## What is in it and what is not
 *
 * What somebody would be asked at an appointment: how long their cycles are
 * both as entered and as measured, when their recent periods were, and how many
 * days they have logged. Not the symptoms day by day - that is what the CSV is
 * for, and a doctor handed four hundred lines of it reads none of them.
 *
 * It says plainly at the end that it came out of an app and is not an
 * assessment. The app is careful about that everywhere else; a document that
 * leaves the phone and might be read by somebody who has never seen the app
 * needs it most.
 *
 * ## Why its PDF sibling says more than this does
 *
 * `export-pdf.ts` builds a third file from the same sections and adds a count
 * of what was written down - "Kramp - 11 gün" - which this file deliberately
 * has none of. That is not an inconsistency to be tidied up later. The two
 * files are different kinds of thing:
 *
 * This one is a readable dump. It is the format that depends on no renderer, it
 * opens anywhere, and it is what is left when `printToFileAsync` fails. Someone
 * reading it is reading their own records in the plainest form the app can
 * produce them in.
 *
 * The PDF is a document to hand to a clinician. It is typeset, it arrives
 * without the app, and the third thing a clinician actually looks at - after
 * cycle lengths and period dates - is symptoms. Day by day is still refused
 * there for the reason above, but an aggregate count over five days or more is
 * a count rather than four hundred lines, and on a page that somebody is going
 * to be asked questions about it earns its place.
 *
 * So the sections are shared and the difference is deliberate: a dump says
 * everything plainly, a document says the few things its reader will use. What
 * neither may do is disagree about the records, which is why the branching
 * lives in `export-sections.ts` rather than in each of them.
 *
 * ## Shape
 *
 * `*In(messages, …)` like every other multi-key sentence builder here, so the
 * catalogue half arrives already chosen and this stays a pure function of its
 * arguments. `language` is separate because `formatDisplayDate` needs it.
 */
export function buildExportTextIn(
  messages: ExportMessages,
  data: ExportSummaryData,
  language: Language
): string {
  const lines: string[] = [
    messages.summaryHeading,
    messages.summaryGeneratedOn(formatDisplayDate(data.today, language)),
  ];

  for (const section of buildExportSections(messages, data, language)) {
    // The provenance notes are the page's, not this file's: they answer a
    // question a document with no column names raises, and a dump does not.
    lines.push('', section.heading, ...section.lines);
  }

  lines.push('', messages.summaryFooter);

  return `${lines.join('\n')}\n`;
}
