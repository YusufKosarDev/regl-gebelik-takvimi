import type { PeriodRecord } from '../domain/types';

import { formatDisplayDate } from '@/utils/format-date';

/**
 * Everything the history screen says, in Turkish.
 *
 * Moved out of `app/(app)/history.tsx` verbatim, where it was written inline
 * alongside the screen's state and its three editing panels.
 *
 * The screen says "Vazgeç" five times, once per panel. That is one constant
 * here and five uses there - the five buttons are the same button in five
 * places, and a change to the word is a change to all of them.
 */

/* ------------------------------------------------------------ the screen -- */

export const HISTORY_TITLE = 'Geçmiş kayıtlar';
export const HISTORY_DESCRIPTION = 'Kaydettiğin regl dönemlerini burada görebilirsin.';

export const HISTORY_LOAD_FAILED_MESSAGE = 'Kayıtlar yüklenemedi.';
export const HISTORY_DELETE_FAILED_MESSAGE = 'Kayıt silinemedi.';
export const HISTORY_UPDATE_FAILED_MESSAGE = 'Kayıt güncellenemedi.';
export const HISTORY_EMPTY_MESSAGE = 'Henüz kayıt bulunamadı.';

/* -------------------------------------------------------------- one record -- */

export const RECORD_START_LABEL = 'Başlangıç';
export const RECORD_END_LABEL = 'Bitiş';

export const RECORD_ONGOING_LABEL = 'Devam ediyor';
export const RECORD_UNKNOWN_END_LABEL = 'Bitiş tarihi bilinmiyor';

/**
 * One record, read as a sentence.
 *
 * The three endings are the three states a record can be in: still running,
 * finished on a known day, or finished on a day nobody wrote down.
 */
export function recordAccessibilityLabel(record: PeriodRecord): string {
  const start = `Başlangıç: ${formatDisplayDate(record.startDate)}`;

  if (record.isOngoing) {
    return `${start}, devam ediyor`;
  }

  return record.endDate === undefined
    ? `${start}, bitiş tarihi bilinmiyor`
    : `${start}, bitiş: ${formatDisplayDate(record.endDate)}`;
}

/* ------------------------------------------------- the three row actions -- */

export const EDIT_START_TEXT = 'Başlangıcı düzenle';
export const EDIT_END_TEXT = 'Bitişi düzenle';
export const DELETE_TEXT = 'Sil';

/** Each row action names the record it belongs to, so five rows are five buttons. */
export function editStartLabel(readableStartDate: string): string {
  return `${readableStartDate} regl kaydının başlangıç tarihini düzenle`;
}

export function editEndLabel(readableStartDate: string): string {
  return `${readableStartDate} regl kaydının bitiş tarihini düzenle`;
}

export function deleteRecordLabel(readableStartDate: string): string {
  return `${readableStartDate} regl kaydını sil`;
}

/* ---------------------------------------------------------- deleting one -- */

export const DELETE_QUESTION = 'Bu regl kaydını silmek istiyor musun?';
export const DELETE_CONSEQUENCE = 'Bu işlem geri alınamaz.';
export const DELETE_CONFIRM_LABEL = 'Sil';

/* ------------------------------------------------------- editing the dates -- */

export const EDIT_START_PANEL_TITLE = 'Başlangıç tarihini düzenle';
export const EDIT_END_PANEL_TITLE = 'Bitiş tarihini düzenle';

export const SAVE_START_LABEL = 'Başlangıç tarihini kaydet';
export const SAVE_END_LABEL = 'Bitiş tarihini kaydet';

export const PREVIOUS_DAY_LABEL = 'Önceki gün';
export const NEXT_DAY_LABEL = 'Sonraki gün';

export function selectedStartDateLabel(readableDate: string): string {
  return `Seçilen başlangıç tarihi: ${readableDate}`;
}

export function selectedEndDateLabel(readableDate: string): string {
  return `Seçilen bitiş tarihi: ${readableDate}`;
}

/* ------------------------------------------------ clearing the end date -- */

export const CLEAR_END_QUESTION = 'Bitiş tarihini kaldırmak istiyor musun?';
export const CLEAR_END_CONSEQUENCE = 'Bu kayıt bitiş tarihi bilinmiyor olarak gösterilecek.';

export const CLEAR_END_OPEN_LABEL = 'Bitiş tarihini kaldır';
export const CLEAR_END_CONFIRM_LABEL = 'Kaldır';
export const CLEAR_END_BUSY_LABEL = 'Kaldırılıyor...';

/**
 * The other date, shown while one of them is being edited.
 *
 * A label and a value on one line. Kept as functions rather than a label
 * constant and a bare ": " in the markup, so the punctuation that joins them
 * cannot be left behind in a screen.
 */
export function startDateLine(readableDate: string): string {
  return `Başlangıç: ${readableDate}`;
}

export function endDateLine(value: string): string {
  return `Bitiş: ${value}`;
}
