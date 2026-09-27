import type { DailyEntry } from './catalogues';

/**
 * A recorded day in a few words, for the card on the home screen.
 *
 * Parts rather than a sentence: the screen joins them, and a screen reader
 * reads them as a list. Nothing here interprets anything — the flow is named,
 * the symptoms are counted, the mood is named, and that is all. The app does
 * not say what a day means.
 *
 * An id nothing has a word for is skipped rather than shown raw. A day written
 * by a newer build can name a symptom this one has never heard of, and
 * `a1b2c3` on a card would be worse than one fewer word.
 *
 * ## Why every word arrives as an argument
 *
 * This is `domain/`, so it may not know a language. The flow and mood words
 * come in as lookups and the symptom count as a function, which is how the same
 * function produces "Yoğun · 3 belirti · İyi" and "Heavy · 3 symptoms · Good"
 * without a branch in it. It also keeps the ordering rule — flow, symptoms,
 * mood — in one place, which is the part that is genuinely domain.
 *
 * Pure: reads the entry and the lookups, returns new strings.
 */
export function summariseDailyEntry(
  entry: DailyEntry,
  symptomCount: (count: number) => string,
  flowLabels: Readonly<Record<string, string>>,
  moodLabels: Readonly<Record<string, string>>
): readonly string[] {
  const parts: string[] = [];

  const flow = entry.flowId === null ? undefined : flowLabels[entry.flowId];

  if (flow !== undefined) {
    parts.push(flow);
  }

  if (entry.symptomIds.length > 0) {
    parts.push(symptomCount(entry.symptomIds.length));
  }

  const mood = entry.moodId === null ? undefined : moodLabels[entry.moodId];

  if (mood !== undefined) {
    parts.push(mood);
  }

  return parts;
}
