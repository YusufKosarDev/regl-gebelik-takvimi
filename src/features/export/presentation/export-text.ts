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
    '',
    messages.summaryCycleHeading,
  ];

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
  } else {
    lines.push(
      messages.summaryObservedLength(
        data.observations.medianDays,
        data.observations.lengths.length
      )
    );

    if (data.observations.shortestDays !== null && data.observations.longestDays !== null) {
      lines.push(
        messages.summaryObservedRange(
          data.observations.shortestDays,
          data.observations.longestDays
        )
      );
    }
  }

  lines.push('', messages.summaryRecordsHeading);

  if (data.periodRecords.length === 0) {
    lines.push(messages.summaryNoRecords);
  } else {
    for (const record of data.periodRecords) {
      const start = formatDisplayDate(record.startDate, language);

      if (record.isOngoing) {
        lines.push(messages.summaryRecordOngoing(start));
      } else if (record.endDate === undefined) {
        lines.push(messages.summaryRecordUnknownEnd(start));
      } else {
        lines.push(messages.summaryRecordLine(start, formatDisplayDate(record.endDate, language)));
      }
    }
  }

  lines.push('', messages.summaryLogHeading);
  lines.push(
    data.dailyEntries.length === 0
      ? messages.summaryNoLog
      : messages.summaryLogCount(data.dailyEntries.length)
  );

  lines.push('', messages.summaryFooter);

  return `${lines.join('\n')}\n`;
}
