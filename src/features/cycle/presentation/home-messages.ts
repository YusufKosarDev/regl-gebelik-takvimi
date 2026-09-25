import type { CycleCalendarDay } from '../application/build-cycle-calendar-month';
import type { CycleDashboard } from '../application/get-cycle-dashboard';
import { getCyclePhaseLabel, getFertilityLevelLabel } from './cycle-labels';

import { formatDisplayDate } from '@/utils/format-date';

/**
 * What the home screen says about a cycle, in Turkish.
 *
 * Lifted out of the screen unchanged. These were declared beside the component
 * that used them, which was fine while it was the only one; the screen is being
 * split into sections and a string every section can reach is better than the
 * same sentence typed twice.
 */

export const LOAD_ERROR_MESSAGE = 'Bilgiler yüklenemedi.';
export const SAVE_ERROR_MESSAGE = 'Regl başlangıcı kaydedilemedi.';
export const END_SAVE_ERROR_MESSAGE = 'Regl bitişi kaydedilemedi.';
export const EMPTY_MESSAGE = 'Döngü bilgisi bulunamadı.';
export const SOURCE_ERROR_MESSAGE = 'Kaynak açılamadı.';
export const SUPPORT_DISCLAIMER =
  'Bu bilgiler geneldir; kişiden kişiye ve aydan aya değişebilir.';
export const FERTILITY_DISCLAIMER =
  'Doğurganlık bilgileri tahminidir ve gebelikten korunma yöntemi olarak kullanılmamalıdır.';

/**
 * The selected day's rows, read straight off the day the calendar already holds.
 *
 * No domain function is called again here: `CycleCalendarDay` carries everything
 * this card shows, so the card and the square it came from cannot disagree.
 */
export function selectedDayRows(day: CycleCalendarDay): { label: string; value: string }[] {
  return [
    {
      label: 'Döngü günü',
      value: day.cycleDay === null ? 'Henüz başlamadı' : `${day.cycleDay}. gün`,
    },
    { label: 'Döngü evresi', value: getCyclePhaseLabel(day.phase) },
    { label: 'Doğurganlık tahmini', value: getFertilityLevelLabel(day.fertilityLevel) },
  ];
}

/**
 * The four facts at the top of the home screen, read off today's summary.
 *
 * The same shape as {@link selectedDayRows} and built the same way, with one
 * addition: the fertility row carries the note that says the estimate is not a
 * method of contraception. It travels with the row rather than being placed
 * near it, so the number and the warning about it cannot be separated.
 */
export function summaryRows(
  dashboard: CycleDashboard
): { label: string; value: string; note?: string }[] {
  return [
    {
      label: 'Döngü günü',
      value: dashboard.cycleDay === null ? 'Henüz başlamadı' : `${dashboard.cycleDay}. gün`,
    },
    {
      label: 'Döngü evresi',
      value: getCyclePhaseLabel(dashboard.phase),
    },
    {
      label: 'Doğurganlık tahmini',
      value: getFertilityLevelLabel(dashboard.fertilityLevel),
      note: FERTILITY_DISCLAIMER,
    },
    {
      label: 'Sonraki regl tahmini',
      value:
        dashboard.nextPeriodStart === null
          ? 'Henüz hesaplanamıyor'
          : formatDisplayDate(dashboard.nextPeriodStart),
    },
  ];
}

/* --------------------------------------------------- the mode switch -- */

export const CYCLE_TAB_LABEL = 'Döngü';
export const PREGNANCY_TAB_LABEL = 'Gebelik';

/* ------------------------------------------------ the support section -- */

export const SUPPORT_MOOD_TITLE = 'Olası ruh hali';
export const SUPPORT_MESSAGE_TITLE = 'Bugünün mesajı';
export const SUPPORT_SOURCES_TITLE = 'Kaynaklar';

/** A source, as something to open. */
export function openSourceLabel(name: string): string {
  return `${name} kaynağını aç`;
}

/* ---------------------------------------------------- the period card -- */

export const PERIOD_END_QUESTION = 'Bugünü regl bitişi olarak kaydetmek istiyor musun?';
export const PERIOD_START_QUESTION = 'Bugünü regl başlangıcı olarak kaydetmek istiyor musun?';

export const PERIOD_CANCEL_LABEL = 'Vazgeç';
export const PERIOD_SAVE_LABEL = 'Kaydet';
export const PERIOD_SAVING_LABEL = 'Kaydediliyor...';

export const PERIOD_END_BUTTON_LABEL = 'Regl bitişini kaydet';
export const PERIOD_START_BUTTON_LABEL = 'Regl başlangıcını kaydet';
export const PERIOD_END_BUTTON_TEXT = 'Regl bitti';
export const PERIOD_START_BUTTON_TEXT = 'Regl başladı';

/* ------------------------------------------------------- the calendar -- */

export const CALENDAR_SECTION_TITLE = 'Takvim';
export const CALENDAR_PREVIOUS_MONTH_LABEL = 'Önceki ay';
export const CALENDAR_NEXT_MONTH_LABEL = 'Sonraki ay';
export const CALENDAR_TODAY_LABEL = 'Bugün';

export const SELECTED_DAY_TITLE = 'Seçilen gün';
export const SELECTED_DAY_EMPTY_MESSAGE = 'Bir gün seç.';
export const PREDICTED_PERIOD_START_NOTE = 'Sonraki regl başlangıcı tahmini';

/** The month on screen, as something to read aloud. */
export function calendarMonthLabel(monthHeading: string): string {
  return `${monthHeading} takvimi`;
}

/* ------------------------------------------------------ the four links -- */

export const HISTORY_LINK_LABEL = 'Geçmiş regl kayıtlarını görüntüle';
export const HISTORY_LINK_TEXT = 'Geçmiş kayıtlar';

export const AVATAR_CREATE_LABEL = 'Avatar oluştur';
export const AVATAR_EDIT_LABEL = 'Avatarı düzenle';
export const AVATAR_LINK_TEXT = 'Avatarım';

export const SETTINGS_LINK_LABEL = 'Döngü ayarlarını düzenle';
export const SETTINGS_LINK_TEXT = 'Ayarlar';

export const PREGNANCY_START_LINK_LABEL = 'Gebelik takibini başlat';

/* ---------------------------------------------------- the legend -- */

export const CALENDAR_ESTIMATE_NOTICE =
  'Takvimdeki doğurganlık ve yumurtlama bilgileri tahminidir.';

/**
 * `style` names the treatment the calendar gives the same day, so the swatch
 * beside it can look like the square it explains. `spokenMarker` exists because
 * "○" read aloud is either nothing or noise.
 */
export type LegendItem = {
  readonly marker: string;
  readonly spokenMarker: string;
  readonly label: string;
  readonly style: 'filled' | 'outlined' | 'soft' | 'plain';
};

/**
 * Only the marks a person can actually find on the calendar.
 *
 * The peak mark is left out on purpose. The peak day is by definition the
 * estimated ovulation day, and the calendar gives that day one treatment, so a
 * filled circle never appears in a month. Explaining a symbol that is not there
 * would send people looking for it.
 */
export const LEGEND_ITEMS: readonly LegendItem[] = [
  { marker: 'R', spokenMarker: 'R', label: 'Regl günü', style: 'filled' },
  { marker: 'Y', spokenMarker: 'Y', label: 'Tahmini yumurtlama günü', style: 'outlined' },
  {
    marker: '○',
    spokenMarker: 'Daire',
    label: 'Doğurganlığın yüksek olduğu tahmini gün',
    style: 'soft',
  },
  {
    marker: '≈',
    spokenMarker: 'Yaklaşık işareti',
    label: 'Sonraki regl başlangıcı tahmini',
    style: 'plain',
  },
];

/** One legend row, read as one thing. */
export function legendItemLabel(item: LegendItem): string {
  return `${item.spokenMarker}: ${item.label}`;
}

/** A label and its value, as one line. Printed under the calendar, spoken in
 * the summary - the same words either way, so they are written once. */
export function labelledValue(label: string, value: string): string {
  return `${label}: ${value}`;
}

/** The heading over today's date, at the top of the screen. */
export const TODAY_HEADING = 'Bugün';
