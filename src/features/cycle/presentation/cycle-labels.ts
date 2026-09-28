import type { CycleCalendarDay } from '../application/build-cycle-calendar-month';
import type { FertilityLevel } from '../domain/fertility-level';
import type { CyclePhase } from '../domain/phases';

import type { Language } from '@/i18n/language';
import { formatDisplayDate } from '@/utils/format-date';

/**
 * Turkish labels for the domain's phase and fertility values.
 *
 * Presentation only. The domain keeps its own vocabulary; this is the single
 * place those values become words a person reads.
 *
 * Fertility is deliberately ordinal — no percentage, no chance of conceiving —
 * because the estimate does not support that kind of claim.
 *
 * ## Why one function here takes a language and the words around it do not
 *
 * The labels are still Turkish-only; this file becomes a `Messages` pair in
 * its own stage, and at that point the language stops being an argument and
 * becomes which half of the pair you are reading.
 *
 * Until then the one function that formats a *date* has to be told, because
 * the date is already bilingual. It is a required parameter rather than one
 * defaulting to Turkish: there is a single caller, so there is nothing to
 * spare, and a default here would be a second silent way to render a Turkish
 * date to an English reader.
 */

const UNKNOWN_LABEL = 'Bilinmiyor';

const PHASE_LABELS: Readonly<Record<CyclePhase, string>> = {
  menstrual: 'Regl',
  follicular: 'Foliküler',
  ovulatory: 'Yumurtlama',
  luteal: 'Luteal',
};

const FERTILITY_LABELS: Readonly<Record<FertilityLevel, string>> = {
  low: 'Düşük',
  elevated: 'Yüksek',
  peak: 'En yüksek',
};

export function getCyclePhaseLabel(phase: CyclePhase | null): string {
  return phase === null ? UNKNOWN_LABEL : PHASE_LABELS[phase];
}

export function getFertilityLevelLabel(level: FertilityLevel | null): string {
  return level === null ? UNKNOWN_LABEL : FERTILITY_LABELS[level];
}

/**
 * What a screen reader says for one calendar square.
 *
 * Reads the date first, then only what makes that day different: the phase when
 * it is one a person is looking for, and the fertility estimate when it is
 * raised. Naming every day's phase would turn a month into thirty near-identical
 * sentences to listen through.
 */
export function getCalendarDayAccessibilityLabel(
  day: CycleCalendarDay,
  language: Language,
  options: { readonly isToday?: boolean; readonly isSelected?: boolean } = {}
): string {
  const parts: string[] = [formatDisplayDate(day.date, language)];

  if (day.phase === 'menstrual' || day.phase === 'ovulatory') {
    parts.push(getCyclePhaseLabel(day.phase));
  }

  if (day.fertilityLevel === 'elevated' || day.fertilityLevel === 'peak') {
    parts.push(`doğurganlık ${getFertilityLevelLabel(day.fertilityLevel).toLocaleLowerCase('tr')}`);
  }

  if (day.isPredictedPeriodStart) {
    parts.push('sonraki regl başlangıcı tahmini');
  }

  // Last, so the date and what the domain says about it are heard first.
  if (options.isToday === true) {
    parts.push('bugün');
  }

  if (options.isSelected === true) {
    parts.push('seçili');
  }

  return parts.join(', ');
}
