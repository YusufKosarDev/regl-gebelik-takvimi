import type { PeriodRecord } from '../domain/types';

import type { Messages } from '@/i18n';
import type { Language } from '@/i18n/language';
import { formatDisplayDate } from '@/utils/format-date';

/**
 * Everything the history screen says.
 *
 * Moved out of `app/(app)/history.tsx` verbatim, where it was written inline
 * alongside the screen's state and its three editing panels.
 *
 * The screen says "Vazgeç" five times, once per panel. That is one constant
 * here and five uses there - the five buttons are the same button in five
 * places, and a change to the word is a change to all of them.
 *
 * ## The two sentence builders take a language as well
 *
 * Both read a date, and `formatDisplayDate` has to be told which language to
 * render the month in. Everything else they say comes from the half of the pair
 * they were handed - the same fact twice, and the caller has both.
 */

const historyMessagesTr = {
  /* ---------------------------------------------------------- the screen -- */

  historyTitle: 'Geçmiş kayıtlar',
  historyDescription: 'Kaydettiğin regl dönemlerini burada görebilirsin.',

  historyLoadFailedMessage: 'Kayıtlar yüklenemedi.',
  historyDeleteFailedMessage: 'Kayıt silinemedi.',
  historyUpdateFailedMessage: 'Kayıt güncellenemedi.',
  historyEmptyMessage: 'Henüz kayıt bulunamadı.',

  /* ------------------------------------------------------------ one record -- */

  recordStartLabel: 'Başlangıç',
  recordEndLabel: 'Bitiş',

  recordOngoingLabel: 'Devam ediyor',
  recordUnknownEndLabel: 'Bitiş tarihi bilinmiyor',

  /** The three endings a record's sentence can have. */
  recordOngoingSuffix: 'devam ediyor',
  recordUnknownEndSuffix: 'bitiş tarihi bilinmiyor',
  recordEndSuffix: (readableDate: string) => `bitiş: ${readableDate}`,

  /* ----------------------------------------------- the three row actions -- */

  editStartText: 'Başlangıcı düzenle',
  editEndText: 'Bitişi düzenle',
  deleteText: 'Sil',

  /** Each row action names the record it belongs to, so five rows are five buttons. */
  editStartLabel: (readableStartDate: string) =>
    `${readableStartDate} regl kaydının başlangıç tarihini düzenle`,
  editEndLabel: (readableStartDate: string) =>
    `${readableStartDate} regl kaydının bitiş tarihini düzenle`,
  deleteRecordLabel: (readableStartDate: string) => `${readableStartDate} regl kaydını sil`,

  /* -------------------------------------------------------- deleting one -- */

  deleteQuestion: 'Bu regl kaydını silmek istiyor musun?',
  deleteConsequence: 'Bu işlem geri alınamaz.',
  deleteConfirmLabel: 'Sil',

  /**
   * The same button while the delete is running.
   *
   * It exists because the screen used to write the pair inline as
   * `{isDeleting ? 'Siliniyor...' : 'Sil'}`. Neither word carries a
   * Turkish-specific letter, so the lint rule's letter test could not see them
   * and an English phone showed "Sil" on the button. The rule now also matches
   * the `-iyor` family for exactly this reason.
   */
  deleteBusyLabel: 'Siliniyor...',

  /* ----------------------------------------------------- editing the dates -- */

  editStartPanelTitle: 'Başlangıç tarihini düzenle',
  editEndPanelTitle: 'Bitiş tarihini düzenle',

  saveStartLabel: 'Başlangıç tarihini kaydet',
  saveEndLabel: 'Bitiş tarihini kaydet',

  previousDayLabel: 'Önceki gün',
  nextDayLabel: 'Sonraki gün',

  selectedStartDateLabel: (readableDate: string) => `Seçilen başlangıç tarihi: ${readableDate}`,
  selectedEndDateLabel: (readableDate: string) => `Seçilen bitiş tarihi: ${readableDate}`,

  /* ---------------------------------------------- clearing the end date -- */

  clearEndQuestion: 'Bitiş tarihini kaldırmak istiyor musun?',
  clearEndConsequence: 'Bu kayıt bitiş tarihi bilinmiyor olarak gösterilecek.',

  clearEndOpenLabel: 'Bitiş tarihini kaldır',
  clearEndConfirmLabel: 'Kaldır',
  clearEndBusyLabel: 'Kaldırılıyor...',

  /**
   * The other date, shown while one of them is being edited.
   *
   * A label and a value on one line. Kept as functions rather than a label
   * constant and a bare ": " in the markup, so the punctuation that joins them
   * cannot be left behind in a screen.
   */
  startDateLine: (readableDate: string) => `Başlangıç: ${readableDate}`,
  endDateLine: (value: string) => `Bitiş: ${value}`,
};

export type HistoryMessages = typeof historyMessagesTr;

const historyMessagesEn: HistoryMessages = {
  historyTitle: 'Past records',
  historyDescription: 'The periods you have recorded are here.',

  historyLoadFailedMessage: 'Those records could not be loaded.',
  historyDeleteFailedMessage: 'That record could not be deleted.',
  historyUpdateFailedMessage: 'That record could not be updated.',
  historyEmptyMessage: 'Nothing recorded yet.',

  recordStartLabel: 'Started',
  recordEndLabel: 'Ended',

  recordOngoingLabel: 'Still going',
  recordUnknownEndLabel: 'End date not known',

  recordOngoingSuffix: 'still going',
  recordUnknownEndSuffix: 'end date not known',
  recordEndSuffix: (readableDate: string) => `ended: ${readableDate}`,

  editStartText: 'Change the start',
  editEndText: 'Change the end',
  deleteText: 'Delete',

  editStartLabel: (readableStartDate: string) =>
    `Change the start date of the period recorded on ${readableStartDate}`,
  editEndLabel: (readableStartDate: string) =>
    `Change the end date of the period recorded on ${readableStartDate}`,
  deleteRecordLabel: (readableStartDate: string) =>
    `Delete the period recorded on ${readableStartDate}`,

  deleteQuestion: 'Delete this period record?',
  deleteConsequence: 'This cannot be undone.',
  deleteConfirmLabel: 'Delete',
  deleteBusyLabel: 'Deleting…',

  editStartPanelTitle: 'Change the start date',
  editEndPanelTitle: 'Change the end date',

  saveStartLabel: 'Save the start date',
  saveEndLabel: 'Save the end date',

  previousDayLabel: 'Previous day',
  nextDayLabel: 'Next day',

  selectedStartDateLabel: (readableDate: string) => `Start date chosen: ${readableDate}`,
  selectedEndDateLabel: (readableDate: string) => `End date chosen: ${readableDate}`,

  clearEndQuestion: 'Remove the end date?',
  clearEndConsequence: 'This record will show its end date as not known.',

  clearEndOpenLabel: 'Remove the end date',
  clearEndConfirmLabel: 'Remove',
  clearEndBusyLabel: 'Removing...',

  startDateLine: (readableDate: string) => `Started: ${readableDate}`,
  endDateLine: (value: string) => `Ended: ${value}`,
};

export const historyMessages: Messages<HistoryMessages> = {
  tr: historyMessagesTr,
  en: historyMessagesEn,
};

/**
 * One record, read as a sentence.
 *
 * The three endings are the three states a record can be in: still running,
 * finished on a known day, or finished on a day nobody wrote down.
 */
export function recordAccessibilityLabelIn(
  messages: HistoryMessages,
  record: PeriodRecord,
  language: Language
): string {
  const start = messages.startDateLine(formatDisplayDate(record.startDate, language));

  if (record.isOngoing) {
    return `${start}, ${messages.recordOngoingSuffix}`;
  }

  return record.endDate === undefined
    ? `${start}, ${messages.recordUnknownEndSuffix}`
    : `${start}, ${messages.recordEndSuffix(formatDisplayDate(record.endDate, language))}`;
}

/**
 * How a record's end reads.
 *
 * A period with no end date is not the same as one still running, so the two
 * get different words. Nothing is estimated from the average period length:
 * what was never recorded stays unrecorded.
 */
export function recordEndLabelIn(
  messages: HistoryMessages,
  record: PeriodRecord,
  language: Language
): string {
  if (record.isOngoing) {
    return messages.recordOngoingLabel;
  }

  return record.endDate === undefined
    ? messages.recordUnknownEndLabel
    : formatDisplayDate(record.endDate, language);
}

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const HISTORY_TITLE = historyMessagesTr.historyTitle;
export const HISTORY_DESCRIPTION = historyMessagesTr.historyDescription;
export const HISTORY_LOAD_FAILED_MESSAGE = historyMessagesTr.historyLoadFailedMessage;
export const HISTORY_DELETE_FAILED_MESSAGE = historyMessagesTr.historyDeleteFailedMessage;
export const HISTORY_UPDATE_FAILED_MESSAGE = historyMessagesTr.historyUpdateFailedMessage;
export const HISTORY_EMPTY_MESSAGE = historyMessagesTr.historyEmptyMessage;
export const RECORD_START_LABEL = historyMessagesTr.recordStartLabel;
export const RECORD_END_LABEL = historyMessagesTr.recordEndLabel;
export const RECORD_ONGOING_LABEL = historyMessagesTr.recordOngoingLabel;
export const RECORD_UNKNOWN_END_LABEL = historyMessagesTr.recordUnknownEndLabel;
export const EDIT_START_TEXT = historyMessagesTr.editStartText;
export const EDIT_END_TEXT = historyMessagesTr.editEndText;
export const DELETE_TEXT = historyMessagesTr.deleteText;
export const DELETE_QUESTION = historyMessagesTr.deleteQuestion;
export const DELETE_CONSEQUENCE = historyMessagesTr.deleteConsequence;
export const DELETE_CONFIRM_LABEL = historyMessagesTr.deleteConfirmLabel;
export const EDIT_START_PANEL_TITLE = historyMessagesTr.editStartPanelTitle;
export const EDIT_END_PANEL_TITLE = historyMessagesTr.editEndPanelTitle;
export const SAVE_START_LABEL = historyMessagesTr.saveStartLabel;
export const SAVE_END_LABEL = historyMessagesTr.saveEndLabel;
export const PREVIOUS_DAY_LABEL = historyMessagesTr.previousDayLabel;
export const NEXT_DAY_LABEL = historyMessagesTr.nextDayLabel;
export const CLEAR_END_QUESTION = historyMessagesTr.clearEndQuestion;
export const CLEAR_END_CONSEQUENCE = historyMessagesTr.clearEndConsequence;
export const CLEAR_END_OPEN_LABEL = historyMessagesTr.clearEndOpenLabel;
export const CLEAR_END_CONFIRM_LABEL = historyMessagesTr.clearEndConfirmLabel;
export const CLEAR_END_BUSY_LABEL = historyMessagesTr.clearEndBusyLabel;

export const editStartLabel = historyMessagesTr.editStartLabel;
export const editEndLabel = historyMessagesTr.editEndLabel;
export const deleteRecordLabel = historyMessagesTr.deleteRecordLabel;
export const selectedStartDateLabel = historyMessagesTr.selectedStartDateLabel;
export const selectedEndDateLabel = historyMessagesTr.selectedEndDateLabel;
export const startDateLine = historyMessagesTr.startDateLine;
export const endDateLine = historyMessagesTr.endDateLine;

export function recordAccessibilityLabel(record: PeriodRecord, language: Language): string {
  return recordAccessibilityLabelIn(historyMessagesTr, record, language);
}

export function recordEndLabel(record: PeriodRecord, language: Language): string {
  return recordEndLabelIn(historyMessagesTr, record, language);
}
