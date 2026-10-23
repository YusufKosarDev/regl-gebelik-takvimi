import type { ExportMessages } from './export-messages';

import type { CycleLengthObservations } from '@/features/cycle/domain/observed-cycle-lengths';
import type { CycleSettings, PeriodRecord } from '@/features/cycle/domain/types';
import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import type { Language } from '@/i18n/language';
import type { ISODate } from '@/types/iso-date';
import { formatDisplayDate } from '@/utils/format-date';

/** Everything the summary is written from. */
export type ExportSummaryData = {
  readonly today: ISODate;
  readonly cycleSettings: CycleSettings | null;
  readonly observations: CycleLengthObservations;
  /** Newest first, which is the order somebody reads a history in. */
  readonly periodRecords: readonly PeriodRecord[];
  readonly dailyEntries: readonly DailyEntry[];
};

/**
 * One headed block of the summary.
 *
 * `provenance` is said on the printable page and not in the `.txt`. A page has
 * no column names, so it has to say which of its numbers a person entered and
 * which the device worked out; a reader of the `.txt` is reading a dump and the
 * question does not arise in the same way. Holding it here rather than in the
 * PDF renderer keeps it beside the lines it is about.
 */
export type ExportSection = {
  readonly heading: string;
  readonly provenance: string | null;
  readonly lines: readonly string[];
};

/**
 * The sections both documents are built from.
 *
 * ## Why this is shared and the rendering is not
 *
 * The `.txt` and the PDF say different things on purpose - the PDF adds the
 * counts section and the provenance notes, and `export-text.ts` records why.
 * What they must not do is disagree about the records themselves. Every branch
 * here is a decision about what the data says: whether a period record has an
 * end, whether there are enough gaps to measure from, whether anything was
 * logged at all. Written twice, those branches would drift, and the drift would
 * be two documents from one database describing different states - which is the
 * exact failure `build-export-files.ts` reuses the sync payload to avoid one
 * layer up.
 *
 * So the branching lives here once, and each renderer decides only how to set
 * it out.
 */
export function buildExportSections(
  messages: ExportMessages,
  data: ExportSummaryData,
  language: Language
): readonly ExportSection[] {
  return [
    {
      heading: messages.summaryCycleHeading,
      provenance: messages.pdfEnteredNote,
      lines: cycleLines(messages, data),
    },
    {
      heading: messages.summaryRecordsHeading,
      provenance: data.periodRecords.length === 0 ? null : messages.pdfRecordedNote,
      lines: recordLines(messages, data, language),
    },
    {
      heading: messages.summaryLogHeading,
      provenance: null,
      lines: [
        data.dailyEntries.length === 0
          ? messages.summaryNoLog
          : messages.summaryLogCount(data.dailyEntries.length),
      ],
    },
  ];
}

/** What was entered in the settings, then what the records measure. */
function cycleLines(messages: ExportMessages, data: ExportSummaryData): readonly string[] {
  const lines: string[] = [];

  if (data.cycleSettings !== null) {
    lines.push(
      messages.summaryCycleLengths(
        data.cycleSettings.averageCycleLengthDays,
        data.cycleSettings.averagePeriodLengthDays
      )
    );
  }

  if (data.observations.medianDays === null) {
    lines.push(messages.summaryNoObservations);

    return lines;
  }

  lines.push(
    messages.summaryObservedLength(data.observations.medianDays, data.observations.lengths.length)
  );

  if (data.observations.shortestDays !== null && data.observations.longestDays !== null) {
    lines.push(
      messages.summaryObservedRange(data.observations.shortestDays, data.observations.longestDays)
    );
  }

  return lines;
}

/** One line per recorded period, and a sentence when there are none. */
function recordLines(
  messages: ExportMessages,
  data: ExportSummaryData,
  language: Language
): readonly string[] {
  if (data.periodRecords.length === 0) {
    return [messages.summaryNoRecords];
  }

  return data.periodRecords.map((record) => {
    const start = formatDisplayDate(record.startDate, language);

    if (record.isOngoing) {
      return messages.summaryRecordOngoing(start);
    }

    if (record.endDate === undefined) {
      return messages.summaryRecordUnknownEnd(start);
    }

    return messages.summaryRecordLine(start, formatDisplayDate(record.endDate, language));
  });
}
