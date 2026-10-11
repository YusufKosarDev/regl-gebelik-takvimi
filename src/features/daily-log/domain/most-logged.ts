import type { DailyEntry } from './catalogues';

/** One thing and how many days hold it. */
export type LoggedCount = {
  readonly id: string;
  readonly count: number;
};

/**
 * What gets written down most.
 *
 * ## Why this is not `PhaseCorrelation.placedCount`
 *
 * That number is already computed, already sorted and sitting one import away,
 * and using it here would be wrong. It counts only the days the cycle can
 * place: days before the first recorded period have no phase and are left out
 * of it deliberately, so that the shares it reports divide by days the app has
 * an opinion about. `symptom-phase-correlation.ts` says so in as many words -
 * "`placedCount` is named so that a caller cannot mistake it for how many days
 * were recorded".
 *
 * A list headed "what you write down most" is exactly that mistake if it uses
 * it. Somebody in their first month, before a period has been recorded, would
 * see every count as zero while their days sat in the database.
 *
 * So this counts days, and knows nothing about phases.
 *
 * ## It describes, it does not explain
 *
 * The same rule the correlation carries, and it matters more here because the
 * number is so plain. "Cramps, eleven days" is a count of what somebody wrote
 * down. It is not a measure of how often they had cramps, and nothing
 * downstream may dress it as one.
 *
 * ## The order is total
 *
 * Count first, then the id. Without the second key two things written down the
 * same number of times would come out in whatever order the map happened to
 * hold them, and the list would reshuffle itself between visits to the screen.
 */
export function mostLogged(
  entries: readonly DailyEntry[],
  idsOf: (entry: DailyEntry) => readonly string[],
  limit: number
): readonly LoggedCount[] {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    for (const id of idsOf(entry)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return [...counts]
    .map(([id, count]) => ({ id, count }))
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id))
    .slice(0, limit);
}
