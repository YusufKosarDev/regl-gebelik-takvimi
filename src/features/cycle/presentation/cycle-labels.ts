import type { CycleCalendarDay } from '../application/build-cycle-calendar-month';
import type { FertilityLevel } from '../domain/fertility-level';
import type { CyclePhase } from '../domain/phases';

import type { Messages } from '@/i18n';
import type { Language } from '@/i18n/language';
import { formatDisplayDate } from '@/utils/format-date';

/**
 * The domain's phase and fertility values, as words a person reads.
 *
 * Presentation only. The domain keeps its own vocabulary; this is the single
 * place those values become words.
 *
 * Fertility is deliberately ordinal — no percentage, no chance of conceiving —
 * because the estimate does not support that kind of claim. That holds in both
 * languages: "En yüksek" and "Highest" are positions in an order, not numbers.
 *
 * ## Why the calendar label takes a language as well as a catalogue
 *
 * It reads a date, and `formatDisplayDate` needs to be told which language to
 * render the month in. Everything else it says comes from the half of the pair
 * it was handed, so the two arguments are the same fact twice - and the caller
 * has both, because a component that picked a catalogue picked a language to
 * pick it with.
 */

const cycleLabelsTr = {
  unknownLabel: 'Bilinmiyor',

  phaseLabels: {
    menstrual: 'Regl',
    follicular: 'Foliküler',
    ovulatory: 'Yumurtlama',
    luteal: 'Luteal',
  } as Readonly<Record<CyclePhase, string>>,

  fertilityLabels: {
    low: 'Düşük',
    elevated: 'Yüksek',
    peak: 'En yüksek',
  } as Readonly<Record<FertilityLevel, string>>,

  /**
   * The fertility estimate, as it reads inside the calendar day's sentence.
   *
   * Lower case in Turkish, which is why it is a message rather than the label
   * above lower-cased at the call site: `toLocaleLowerCase('tr')` on an English
   * word is a trap - Turkish's dotted and dotless I make locale-sensitive
   * casing wrong in a way that is hard to see. Both languages write the form
   * they need out in full.
   */
  fertilityInSentence: {
    low: 'doğurganlık düşük',
    elevated: 'doğurganlık yüksek',
    peak: 'doğurganlık en yüksek',
  } as Readonly<Record<FertilityLevel, string>>,

  predictedPeriodStart: 'sonraki regl başlangıcı tahmini',
  today: 'bugün',
  selected: 'seçili',
};

export type CycleLabels = typeof cycleLabelsTr;

const cycleLabelsEn: CycleLabels = {
  unknownLabel: 'Not known',

  phaseLabels: {
    menstrual: 'Period',
    follicular: 'Follicular',
    ovulatory: 'Ovulation',
    luteal: 'Luteal',
  },

  fertilityLabels: {
    low: 'Low',
    elevated: 'Raised',
    peak: 'Highest',
  },

  fertilityInSentence: {
    low: 'fertility low',
    elevated: 'fertility raised',
    peak: 'fertility highest',
  },

  predictedPeriodStart: 'next period expected to start',
  today: 'today',
  selected: 'selected',
};

export const cycleLabels: Messages<CycleLabels> = { tr: cycleLabelsTr, en: cycleLabelsEn };

export function getCyclePhaseLabelIn(labels: CycleLabels, phase: CyclePhase | null): string {
  return phase === null ? labels.unknownLabel : labels.phaseLabels[phase];
}

export function getFertilityLevelLabelIn(
  labels: CycleLabels,
  level: FertilityLevel | null
): string {
  return level === null ? labels.unknownLabel : labels.fertilityLabels[level];
}

/**
 * What a screen reader says for one calendar square.
 *
 * Reads the date first, then only what makes that day different: the phase when
 * it is one a person is looking for, and the fertility estimate when it is
 * raised. Naming every day's phase would turn a month into thirty near-identical
 * sentences to listen through.
 */
export function getCalendarDayAccessibilityLabelIn(
  labels: CycleLabels,
  language: Language,
  day: CycleCalendarDay,
  options: { readonly isToday?: boolean; readonly isSelected?: boolean } = {}
): string {
  const parts: string[] = [formatDisplayDate(day.date, language)];

  if (day.phase === 'menstrual' || day.phase === 'ovulatory') {
    parts.push(getCyclePhaseLabelIn(labels, day.phase));
  }

  if (day.fertilityLevel === 'elevated' || day.fertilityLevel === 'peak') {
    parts.push(labels.fertilityInSentence[day.fertilityLevel]);
  }

  if (day.isPredictedPeriodStart) {
    parts.push(labels.predictedPeriodStart);
  }

  // Last, so the date and what the domain says about it are heard first.
  if (options.isToday === true) {
    parts.push(labels.today);
  }

  if (options.isSelected === true) {
    parts.push(labels.selected);
  }

  return parts.join(', ');
}

/* ------------------------------------------------------------------------- */
/* The Turkish behaviour under the original names, for the assertions that    */
/* already call them. Not for screens - they pass the half they are showing.  */
/* ------------------------------------------------------------------------- */

export function getCyclePhaseLabel(phase: CyclePhase | null): string {
  return getCyclePhaseLabelIn(cycleLabelsTr, phase);
}

export function getFertilityLevelLabel(level: FertilityLevel | null): string {
  return getFertilityLevelLabelIn(cycleLabelsTr, level);
}

export function getCalendarDayAccessibilityLabel(
  day: CycleCalendarDay,
  language: Language,
  options: { readonly isToday?: boolean; readonly isSelected?: boolean } = {}
): string {
  return getCalendarDayAccessibilityLabelIn(cycleLabelsTr, language, day, options);
}
