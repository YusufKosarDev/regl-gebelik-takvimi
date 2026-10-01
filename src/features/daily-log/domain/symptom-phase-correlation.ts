import type { DailyEntry } from './catalogues';

import type { CyclePhase } from '@/features/cycle/domain/phases';
import { CYCLE_PHASES } from '@/features/cycle/domain/phases';

/**
 * How many days holding a symptom before a share is worth showing.
 *
 * "100% of your 2 cramp entries" is a statistical claim drawn from two
 * observations, printed next to a medical disclaimer, in a health app. Below
 * this the count is still reported - somebody is entitled to see what they
 * recorded - but no share and nothing called notable.
 */
export const MIN_ENTRIES_FOR_CORRELATION = 5;

/**
 * How far above chance a share has to sit before it means anything.
 *
 * The luteal phase is the longest phase in a typical profile - roughly half the
 * days of a 28-day cycle. A symptom scattered at random therefore lands in it
 * about half the time, so "50% of your cramps were luteal" is a statement about
 * the calendar rather than about the person. A row only counts as notable when
 * its share beats the share that phase has of all the days the cycle can place.
 */
export const NOTABLE_SHARE_MARGIN = 0.15;

/** A day's record with the phase the cycle puts it in, if it can place it. */
export type PhasedDailyEntry = {
  readonly entry: DailyEntry;
  readonly phase: CyclePhase | null;
};

export type PhaseTally = Readonly<Record<CyclePhase, number>>;

/** What one symptom or mood looks like across the phases. */
export type PhaseCorrelation = {
  /** The catalogue id. Turning it into words is the presentation layer's job. */
  readonly id: string;
  /** Days holding it that the cycle can place. Never the raw number recorded. */
  readonly placedCount: number;
  readonly byPhase: PhaseTally;
  readonly dominantPhase: CyclePhase;
  readonly dominantCount: number;
  /** `dominantCount / placedCount`, as a fraction. Never a formatted string. */
  readonly dominantShare: number;
  /** That phase's share of every placed day, which is the share to beat. */
  readonly expectedShare: number;
  /** Enough days, and far enough above chance, to be worth a sentence. */
  readonly isNotable: boolean;
};

function emptyTally(): Record<CyclePhase, number> {
  return { menstrual: 0, follicular: 0, ovulatory: 0, luteal: 0 };
}

/** How many placed days fall in each phase, which is the baseline. */
export function tallyPlacedDays(phased: readonly PhasedDailyEntry[]): PhaseTally {
  const tally = emptyTally();

  for (const { phase } of phased) {
    if (phase !== null) {
      tally[phase] += 1;
    }
  }

  return tally;
}

/**
 * Where the recorded days holding each id fell across the cycle.
 *
 * `idsOf` says what is being counted, so symptoms and moods go through one
 * function: `(entry) => entry.symptomIds` for the first, and the mood as a list
 * of none or one for the second. Same injection as `summariseDailyEntry`, and
 * for the same reason - the domain stays free of both the catalogue and the
 * language.
 *
 * ## Only days the cycle can place are counted, on both sides of the fraction
 *
 * Days before the first recorded period have no phase. Leaving them out of the
 * numerator but keeping them in the denominator would understate every share;
 * keeping them in both would mean dividing by days the app has no opinion
 * about. They are excluded from both, and `placedCount` is named so that a
 * caller cannot mistake it for how many days were recorded.
 *
 * ## It describes, it does not explain
 *
 * Nothing here is a correlation in the statistical sense and nothing downstream
 * may call it one. "Twelve of your fifteen cramp entries fell in the luteal
 * phase" is a count and is true. "Your cramps are caused by your luteal phase"
 * is a claim this app cannot make, and `expectedShare` exists so that even the
 * count is only shown when it is not simply describing the shape of a cycle.
 *
 * Sorted by how much there is to say about each id, then by id, so the output is
 * stable and a screen can take the first few.
 */
export function correlatePhases(
  phased: readonly PhasedDailyEntry[],
  idsOf: (entry: DailyEntry) => readonly string[],
  options: { readonly minimumCount?: number } = {}
): readonly PhaseCorrelation[] {
  const minimumCount = options.minimumCount ?? MIN_ENTRIES_FOR_CORRELATION;

  const baseline = tallyPlacedDays(phased);
  const placedTotal = CYCLE_PHASES.reduce((total, phase) => total + baseline[phase], 0);

  const byId = new Map<string, Record<CyclePhase, number>>();

  for (const { entry, phase } of phased) {
    if (phase === null) {
      continue;
    }

    for (const id of idsOf(entry)) {
      const tally = byId.get(id) ?? emptyTally();

      tally[phase] += 1;
      byId.set(id, tally);
    }
  }

  const correlations: PhaseCorrelation[] = [];

  for (const [id, tally] of byId) {
    const placedCount = CYCLE_PHASES.reduce((total, phase) => total + tally[phase], 0);

    if (placedCount === 0) {
      continue;
    }

    // Ties go to the earlier phase in the cycle's own order, so the answer is
    // the same every time rather than depending on insertion order.
    let dominantPhase: CyclePhase = CYCLE_PHASES[0];

    for (const phase of CYCLE_PHASES) {
      if (tally[phase] > tally[dominantPhase]) {
        dominantPhase = phase;
      }
    }

    const dominantCount = tally[dominantPhase];
    const dominantShare = dominantCount / placedCount;
    const expectedShare = placedTotal === 0 ? 0 : baseline[dominantPhase] / placedTotal;

    correlations.push({
      id,
      placedCount,
      byPhase: tally,
      dominantPhase,
      dominantCount,
      dominantShare,
      expectedShare,
      isNotable:
        placedCount >= minimumCount && dominantShare - expectedShare >= NOTABLE_SHARE_MARGIN,
    });
  }

  return correlations.sort((a, b) =>
    b.placedCount === a.placedCount ? a.id.localeCompare(b.id) : b.placedCount - a.placedCount
  );
}
