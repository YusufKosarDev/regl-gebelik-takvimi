import { getCycleDay } from './cycle-day';
import { isFollicularCycleDay } from './follicular-phase';
import { isLutealCycleDay } from './luteal-phase';
import { isMenstrualCycleDay } from './menstrual-phase';
import { isOvulatoryCycleDay } from './ovulatory-phase';
import type { CyclePhase } from './phases';
import type { CycleProfile, CycleSettings } from './types';

import type { ISODate } from '@/types/iso-date';

/**
 * Resolves the four independent phase rules into a single phase, for a cycle
 * day that has already been worked out.
 *
 * Each rule applies without knowing about the others, so on a short cycle their
 * windows can overlap: with a 15 day cycle the estimated ovulation day falls on
 * cycle day 1, which is also an expected menstrual day. The order below breaks
 * those ties — menstrual first, so predicted bleeding is what the user sees,
 * then ovulatory as the more specific single-day signal, then the two broader
 * windows.
 *
 * ## Why this is exported
 *
 * Anything drawing a run of consecutive days — the calendar month, the home
 * screen ring — knows the cycle day of each one without asking, because they
 * are consecutive. Those callers can ask this directly and skip the record
 * lookup entirely. The order lives here either way, so the two paths cannot
 * disagree about which phase wins a tie.
 *
 * ## Why it can still answer `null`
 *
 * The four rules are in fact exhaustive for any cycle day of 1 or more - the
 * luteal window has no upper bound and the others tile everything below it -
 * so this never returns `null` in practice, and `cycle-phase.test.ts` sweeps
 * the whole settings range to say so.
 *
 * It is still written as a fall-through rather than defaulting to luteal,
 * because that exhaustiveness is a proof about four separate windows rather
 * than something any one of them states. A rule edited later could open a gap,
 * and a gap should surface as "no phase" and fail that sweep, not be quietly
 * relabelled as the longest phase.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function resolveCyclePhase(
  settings: CycleSettings,
  cycleDay: number
): CyclePhase | null {
  if (isMenstrualCycleDay(settings, cycleDay)) {
    return 'menstrual';
  }

  if (isOvulatoryCycleDay(settings, cycleDay)) {
    return 'ovulatory';
  }

  if (isFollicularCycleDay(settings, cycleDay)) {
    return 'follicular';
  }

  if (isLutealCycleDay(settings, cycleDay)) {
    return 'luteal';
  }

  return null;
}

/**
 * Which phase `targetDate` falls in, or `null` when nothing has been recorded
 * on or before it.
 *
 * ## One lookup, not four
 *
 * This used to call the four profile-shaped phase functions in turn, and each
 * of them re-derived the cycle day from the record list and re-validated the
 * whole profile on the way. Answering one phase question walked every recorded
 * period eleven times, which was invisible with a handful of records and cost
 * 1.3 ms with five years of them — on a screen that redraws a month and a ring
 * of this.
 *
 * The cycle day is worked out once here and the four rules are asked about it.
 * The rules themselves are untouched and still live beside their own phase
 * functions, so there is one statement of each rule and this is only the order
 * they are asked in.
 *
 * `null` still means what it meant: `getCycleDay` found no period start on or
 * before this date, so there is no cycle to place it in. A late cycle still
 * stays luteal past the average length rather than wrapping around, because
 * that window has no upper bound.
 *
 * Validation is unchanged: `getCycleDay` validates the profile and the target
 * date, so invalid input still throws before any phase is reported.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function getCyclePhase(profile: CycleProfile, targetDate: ISODate): CyclePhase | null {
  const cycleDay = getCycleDay(profile, targetDate);

  if (cycleDay === null) {
    return null;
  }

  return resolveCyclePhase(profile.settings, cycleDay);
}
