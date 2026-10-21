import type { CycleLabels } from '@/features/cycle/presentation/cycle-labels';
import type { CyclePhase } from '@/features/cycle/domain/phases';
import type { Messages } from '@/i18n';

/**
 * The words a home screen widget shows.
 *
 * ## Why these live here and not in Kotlin
 *
 * They used to be in Kotlin — `widgetPhaseLabel` and `widgetCycleDayLabel`
 * returned "Regl" and "Döngünün 14. günü" from a `when` and a string template.
 * That was Turkish on every device, whatever the app was set to, while
 * `supportMessage` and `moodLabels` in the same snapshot arrived in the
 * person's own language because they come from `getCycleHomeData`. So the card
 * read half in one language and half in the other.
 *
 * It also went against what `widget-snapshot-v1.ts` says the snapshot is for:
 * *"it is handed a flat, finished snapshot with no functions, no dates to
 * compute and nothing to look up. Everything it shows is already decided
 * here."* A label looked up in Kotlin was the one thing the widget still had to
 * decide for itself.
 *
 * ## The phase words are the cycle feature's, not a second copy
 *
 * `cycleLabels.phaseLabels` already has all four in both languages, and its
 * Turkish half is character-for-character what the Kotlin returned. A second
 * copy here would be a second thing to keep true, and the first time they
 * disagreed the widget and the home screen would be naming the same day
 * differently.
 */

const widgetMessagesTr = {
  /**
   * The cycle day as a sentence, because a widget has no row to label.
   *
   * The home screen says "Döngü günü" in one column and "14. gün" in the next.
   * A card has no columns, so it says the whole thing.
   */
  cycleDayLabel: (day: number) => `Döngünün ${day}. günü`,
};

export type WidgetMessages = typeof widgetMessagesTr;

const widgetMessagesEn: WidgetMessages = {
  cycleDayLabel: (day: number) => `Cycle day ${day}`,
};

export const widgetMessages: Messages<WidgetMessages> = {
  tr: widgetMessagesTr,
  en: widgetMessagesEn,
};

/**
 * The phase as a word, or `null` for a day with no phase.
 *
 * `null` rather than the cycle feature's "Bilinmiyor" / "Not known", and the
 * difference matters: the widget **hides** the line it has nothing to put on,
 * where a screen with a labelled row has to fill it. Printing "Not known" on a
 * card would be the widget using a line to say it has nothing to say.
 *
 * So this cannot simply call `getCyclePhaseLabelIn`, which answers with the
 * unknown label by design. It reads the same table and keeps the absence.
 */
export function widgetPhaseLabelIn(
  labels: CycleLabels,
  phase: CyclePhase | null
): string | null {
  return phase === null ? null : labels.phaseLabels[phase];
}

/**
 * The cycle day as a sentence, or `null` when there is no day to name.
 *
 * Same shape and same reason as the phase: no day means no line, not a line
 * saying there is no day.
 */
export function widgetCycleDayLabelIn(
  messages: WidgetMessages,
  cycleDay: number | null
): string | null {
  return cycleDay === null ? null : messages.cycleDayLabel(cycleDay);
}
