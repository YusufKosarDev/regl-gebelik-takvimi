import { getCycleDay } from '../domain/cycle-day';
import { getCyclePhase } from '../domain/cycle-phase';
import type { CyclePhase } from '../domain/phases';
import type { CycleProfile } from '../domain/types';

import type { ISODate } from '@/types/iso-date';
import { addDays } from '@/utils/date';

/** One day of the cycle, as the ring needs to draw it. */
export type CycleRingDot = {
  /** 1-based, so `day` 1 is the first day of the period. */
  readonly day: number;
  /** `null` when the profile cannot place this day in a phase. */
  readonly phase: CyclePhase | null;
  /** Today and everything before it. What separates the lit arc from the rest. */
  readonly isElapsed: boolean;
  readonly isToday: boolean;
};

export type CycleDayRing = {
  readonly dots: readonly CycleRingDot[];
  readonly cycleDay: number | null;
};

/**
 * The current cycle as a ring of days.
 *
 * ## Why this is not in the component
 *
 * The ring has to know which phase each day of the cycle falls in, not only
 * which phase today is in, and that is `getCyclePhase` once per day - domain
 * arithmetic over a profile. Doing it inside the view would put a loop over
 * `CycleProfile` in a file whose job is placing dots on a circle, and would
 * leave the one interesting part of the ring untestable without rendering it.
 *
 * Pure, like everything else in this layer: the profile is read and never
 * mutated, and `today` is passed in rather than read from a clock.
 *
 * ## What it does when there is nothing to show
 *
 * Returns a full ring of unlit dots with `cycleDay: null`. A person who has
 * recorded nothing yet still sees the shape of what the app is for, rather than
 * a hole where it will be - and the caller does not have to branch.
 *
 * ## What it does when the period is late
 *
 * The ring is as long as the cycle the settings describe, so a cycle that runs
 * past that length has a `cycleDay` with no dot to sit on. Every dot is lit
 * and none is marked as today, which is the honest picture: the ring is full
 * and the cycle has gone past it. The number in the middle still says which
 * day it is, so nothing is hidden - it is the ring that has run out, not the
 * count. Stretching the ring instead would have made it quietly disagree with
 * the setting it is drawn from.
 */
export function buildCycleDayRing(profile: CycleProfile, today: ISODate): CycleDayRing {
  // First, because it validates the profile. A clamp on the dot count used to
  // stand above this line to defend against a corrupt `averageCycleLengthDays`
  // restored from a sync, and it was both dead and wrong: dead because
  // `validateCycleSettings` has already held the setting to 15..90 by the time
  // this returns, and wrong because clamping a legitimate 75-day cycle down to
  // 60 dots would have put today past the end of its own ring.
  const cycleDay = getCycleDay(profile, today);

  const count = profile.settings.averageCycleLengthDays;

  if (cycleDay === null) {
    return {
      cycleDay: null,
      dots: Array.from({ length: count }, (_, index) => ({
        day: index + 1,
        phase: null,
        isElapsed: false,
        isToday: false,
      })),
    };
  }

  return {
    cycleDay,
    dots: Array.from({ length: count }, (_, index) => {
      const day = index + 1;

      // Day `cycleDay` is `today`, so day N is that many days either side of it.
      // A cycle running longer than the setting pushes the later dots past
      // today into dates that have not happened; `getCyclePhase` answers for
      // them exactly as the calendar does when it draws the rest of the month.
      const date = addDays(today, day - cycleDay);

      return {
        day,
        phase: getCyclePhase(profile, date),
        isElapsed: day <= cycleDay,
        isToday: day === cycleDay,
      };
    }),
  };
}
