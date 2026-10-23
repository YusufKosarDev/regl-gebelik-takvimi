import type { SQLiteDatabase } from 'expo-sqlite';

import { buildExportRows, EXPORT_COLUMNS } from '../domain/build-export-rows';
import { toCsv } from '../domain/csv';
import { countLoggedDaysForDocument } from '../domain/logged-day-counts';
import type { ExportMessages } from '../presentation/export-messages';
import { buildExportPdfHtmlIn } from '../presentation/export-pdf';
import { buildExportTextIn } from '../presentation/export-text';

import { buildCycleCalendarMonth } from '@/features/cycle/application/build-cycle-calendar-month';
import { buildCyclePhaseIndex } from '@/features/cycle/application/build-cycle-phase-index';
import { observeCycleLengths } from '@/features/cycle/domain/observed-cycle-lengths';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { DailyLogCatalogueLabels } from '@/features/daily-log/presentation/daily-log-catalogues';
import { labelFor } from '@/features/daily-log/presentation/daily-log-catalogues';
import { buildCloudSyncPayloadV1 } from '@/features/privacy/application/build-cloud-sync-payload-v1';
import type { Language } from '@/i18n/language';
import type { ISODate } from '@/types/iso-date';
import {
  canShiftYearMonth,
  daysBetween,
  getYearMonth,
  shiftYearMonth,
} from '@/utils/date';

/** A file ready to hand to the system share sheet. */
export type ExportFile = {
  readonly fileName: string;
  readonly mimeType: string;
  readonly contents: string;
};

/**
 * The printable document, which is markup rather than the file itself.
 *
 * `printToFileAsync` renders it on the device, so what this layer can build is
 * the input to that - and no `mimeType`, because the type of the thing the
 * share sheet eventually receives is decided where it is printed.
 * `share-pdf-file.ts` owns that half.
 */
export type ExportPdfDocument = {
  readonly fileName: string;
  readonly html: string;
};

export type ExportFiles = {
  readonly summary: ExportFile;
  readonly csv: ExportFile;
  readonly pdf: ExportPdfDocument;
  /** `true` when there is nothing recorded, so the screen can say so. */
  readonly isEmpty: boolean;
};

export type BuildExportFilesInput = {
  readonly today: ISODate;
  readonly language: Language;
  /** The already-chosen catalogue half, like `today` and for the same reason. */
  readonly messages: ExportMessages;
  /**
   * The daily-log words, also already narrowed to one language.
   *
   * The printable document is the only one of the three that names a symptom:
   * the CSV writes stored ids on purpose - "raw means stable" - and the `.txt`
   * does not mention them at all. So this arrives here rather than being
   * reached for from inside the renderer, which keeps the catalogue a thing the
   * caller chose like everything else in this input.
   */
  readonly labels: DailyLogCatalogueLabels;
};

/**
 * All three export files, from one read of the database.
 *
 * ## It reuses the sync payload rather than reading anything itself
 *
 * `buildCloudSyncPayloadV1` already gathers the cycle settings, the period
 * records, the pregnancy profile, the avatar, the notification preferences and
 * every daily entry in one `Promise.all`, and validates the result. Exporting
 * needs exactly that set, so this feature adds no repository code at all - and
 * more usefully, the file somebody takes away and the data the app would back
 * up are built from the same gather, so they cannot describe different states.
 *
 * ## Why the catalogue is an argument
 *
 * The same reason `today` is. This layer picks neither the language nor the
 * moment; the screen passes `useMessages(exportMessages)` in, and the summary
 * is assembled here rather than in a component because it is a multi-section
 * document and that is not a rendering job.
 */
export async function buildExportFiles(
  db: SQLiteDatabase,
  input: BuildExportFilesInput
): Promise<ExportFiles> {
  const { today, language, messages, labels } = input;
  const payload = await buildCloudSyncPayloadV1(db);

  const profile: CycleProfile | null =
    payload.cycleSettings === null
      ? null
      : { settings: payload.cycleSettings, periodRecords: payload.periodRecords };

  const observations =
    profile === null
      ? { lengths: [], medianDays: null, shortestDays: null, longestDays: null, spreadDays: null, discardedCount: 0 }
      : observeCycleLengths(profile);

  // Newest first, which is the order a history is read in. Sorted on a copy:
  // the payload is the same object the backup would send.
  const newestFirst = [...payload.periodRecords].sort((a, b) =>
    daysBetween(a.startDate, b.startDate)
  );

  const summaryData = {
    today,
    cycleSettings: payload.cycleSettings,
    observations,
    periodRecords: newestFirst,
    dailyEntries: payload.dailyEntries,
  };

  const summary = buildExportTextIn(messages, summaryData, language);

  // One lookup across both catalogues, which is the same thing the
  // records-summary screen does and for the same reason: the two id spaces do
  // not overlap, and a reader of a page has no use for the boundary.
  const pdfHtml = buildExportPdfHtmlIn(
    messages,
    {
      ...summaryData,
      loggedCounts: countLoggedDaysForDocument(
        payload.dailyEntries,
        (id) => labelFor(labels.symptoms, id) ?? labelFor(labels.moods, id)
      ),
    },
    language
  );

  const fromDate = earliestRecordedDate(payload.periodRecords, payload.dailyEntries, today);

  const rows =
    profile === null
      ? []
      : buildExportRows({
          periodRecords: payload.periodRecords,
          dailyEntries: payload.dailyEntries,
          phases: buildCyclePhaseIndex(profile, fromDate, today),
          cycleDays: buildCycleDayIndex(profile, fromDate, today),
          fromDate,
          toDate: today,
        });

  return {
    summary: {
      fileName: messages.summaryFileName(today),
      mimeType: 'text/plain',
      contents: summary,
    },
    csv: {
      fileName: messages.csvFileName(today),
      mimeType: 'text/csv',
      contents: toCsv([...EXPORT_COLUMNS], rows),
    },
    pdf: {
      fileName: messages.pdfFileName(today),
      html: pdfHtml,
    },
    isEmpty: payload.periodRecords.length === 0 && payload.dailyEntries.length === 0,
  };
}

/** The first day anything was written down, or today when nothing was. */
function earliestRecordedDate(
  periodRecords: readonly { readonly startDate: ISODate }[],
  dailyEntries: readonly { readonly date: ISODate }[],
  today: ISODate
): ISODate {
  let earliest = today;

  for (const record of periodRecords) {
    if (daysBetween(record.startDate, earliest) > 0) {
      earliest = record.startDate;
    }
  }

  for (const entry of dailyEntries) {
    if (daysBetween(entry.date, earliest) > 0) {
      earliest = entry.date;
    }
  }

  return earliest;
}

/**
 * Which cycle day each date falls on, built the same way the phases are.
 *
 * `buildCyclePhaseIndex` answers the neighbouring question and the two walk the
 * same months, so this follows its shape rather than calling `getCycleDay` once
 * per day - which would validate the whole profile on every call.
 */
function buildCycleDayIndex(
  profile: CycleProfile,
  fromDate: ISODate,
  toDate: ISODate
): ReadonlyMap<ISODate, number | null> {
  const index = new Map<ISODate, number | null>();

  if (daysBetween(fromDate, toDate) < 0) {
    return index;
  }

  const last = getYearMonth(toDate);
  let { year, month } = getYearMonth(fromDate);

  for (;;) {
    for (const day of buildCycleCalendarMonth(profile, year, month).days) {
      if (daysBetween(fromDate, day.date) >= 0 && daysBetween(day.date, toDate) >= 0) {
        index.set(day.date, day.cycleDay);
      }
    }

    if ((year === last.year && month === last.month) || !canShiftYearMonth(year, month, 1)) {
      return index;
    }

    ({ year, month } = shiftYearMonth(year, month, 1));
  }
}
