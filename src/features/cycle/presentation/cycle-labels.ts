import type { CycleCalendarDay } from '../application/build-cycle-calendar-month';
import type { FertilityLevel } from '../domain/fertility-level';
import type { CyclePhase } from '../domain/phases';

import { formatDisplayDate } from '@/utils/format-date';

/**
 * Turkish labels for the domain's phase and fertility values.
 *
 * Presentation only. The domain keeps its own vocabulary; this is the single
 * place those values become words a person reads.
 *
 * Fertility is deliberately ordinal — no percentage, no chance of conceiving —
 * because the estimate does not support that kind of claim.
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
  options: { readonly isToday?: boolean; readonly isSelected?: boolean } = {}
): string {
  const parts: string[] = [formatDisplayDate(day.date)];

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
