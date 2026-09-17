import type { FertilityLevel } from '../domain/fertility-level';
import type { CyclePhase } from '../domain/phases';

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
