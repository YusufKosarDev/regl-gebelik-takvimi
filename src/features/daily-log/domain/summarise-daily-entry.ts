import type { CatalogueEntry, DailyEntry } from './catalogues';
import { FLOW_LEVELS, MOODS, labelFor } from './catalogues';

/**
 * A recorded day in a few words, for the card on the home screen.
 *
 * Parts rather than a sentence: the screen joins them, and a screen reader
 * reads them as a list. Nothing here interprets anything — the flow is named,
 * the symptoms are counted, the mood is named, and that is all. The app does
 * not say what a day means.
 *
 * An id the catalogue no longer knows is skipped rather than shown raw. A day
 * written by a newer build can name a symptom this one has never heard of, and
 * `a1b2c3` on a card would be worse than one fewer word.
 *
 * Pure: reads the entry and the catalogues, returns new strings.
 */
export function summariseDailyEntry(
  entry: DailyEntry,
  symptomCount: (count: number) => string,
  flows: readonly CatalogueEntry[] = FLOW_LEVELS,
  moods: readonly CatalogueEntry[] = MOODS
): readonly string[] {
  const parts: string[] = [];

  const flow = entry.flowId === null ? null : labelFor(flows, entry.flowId);

  if (flow !== null) {
    parts.push(flow);
  }

  if (entry.symptomIds.length > 0) {
    parts.push(symptomCount(entry.symptomIds.length));
  }

  const mood = entry.moodId === null ? null : labelFor(moods, entry.moodId);

  if (mood !== null) {
    parts.push(mood);
  }

  return parts;
}
