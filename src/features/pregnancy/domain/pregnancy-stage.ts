import type { PregnancyWeek } from './types';
import { MAX_PREGNANCY_WEEK } from './weekly-content';

/**
 * How far a tracked pregnancy has got, as far as the app can honestly tell.
 *
 * ## Why `past-due` and not `finished`
 *
 * The app does not know whether a birth happened, whether the pregnancy ended
 * earlier, or how. All it has is a date somebody entered and a count of days
 * since. Calling that `finished` or `completed` would be calendar arithmetic
 * making a claim about somebody's body, and for some people it would be the
 * cruellest possible way to be wrong.
 *
 * `past-due` says only what is true: the count has gone past the last week
 * there is anything written for.
 */
export type PregnancyStage = 'not-started' | 'following' | 'past-due';

/**
 * Reads the stage off the week the dashboard already carries.
 *
 * ## Why it takes the week rather than the dates
 *
 * Two reasons, and both are about not creating a second source of truth.
 *
 * `PregnancyDashboard` already holds `pregnancyWeek`, so taking it means
 * nothing new has to be stored, passed or added to a type that six existing
 * test files build by hand.
 *
 * And the obvious alternative - comparing `estimatedDueDate` with today - gives
 * a different answer. The due date can be `'adjusted'`, moved by a scan, while
 * the week count always comes from the LMP. On an adjusted pregnancy the two
 * would disagree about when week 40 ended, and the weekly content lookup counts
 * from the LMP, so the section would run out of content at one moment and call
 * itself past due at another.
 *
 * ## Why there is no stored field
 *
 * A `pregnancy_outcome` column would mean a schema migration, a cloud sync
 * payload field and the version question that comes with it, a backup path, a
 * restore path, a merge path, a deletion path and an entry in the
 * exactly-pinned data inventory - five files of plumbing for a boolean that
 * `week > 40` already answers. A stored outcome would also invite the medical
 * content this was deliberately scoped to leave out.
 */
export function stageFromWeek(week: PregnancyWeek | null): PregnancyStage {
  if (week === null) {
    return 'not-started';
  }

  return week.week > MAX_PREGNANCY_WEEK ? 'past-due' : 'following';
}
