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
