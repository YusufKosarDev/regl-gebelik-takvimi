import type { CyclePhase } from './phases';
import { isCyclePhase } from './phases';

/**
 * What there is to say alongside a cycle phase.
 *
 * `moodLabels` are things some people notice in a phase, not a reading of how
 * anyone actually feels. Nothing here is measured, tracked or inferred from the
 * person using the app: it is general information about a phase, and two people
 * in the same phase on the same day may recognise none of the same words.
 *
 * Whatever shows this has to say so. The wording it is written for is "olası"
 * and "kişiden kişiye değişebilir" — possible, and varying from person to
 * person. A screen that prints these as a statement about the reader would be
 * claiming something this model does not know and cannot know.
 *
 * They are optional for the same reason. Requiring every phase to name moods
 * would mean listing some wherever the evidence is thin, which is a claim
 * dressed up as a field being filled in. A phase with nothing well supported to
 * say about mood says nothing, and the support message stands on its own.
 *
 * `supportMessage` is required and offered in the same spirit: something that
 * may help, not advice and not a diagnosis.
 */
export type CycleDailySupport = {
  readonly phase: CyclePhase;
  readonly moodLabels?: readonly string[];
  readonly supportMessage: string;
};

function assertPhase(caller: string, phase: CyclePhase): void {
  if (typeof phase !== 'string' || !isCyclePhase(phase)) {
    throw new Error(`${caller} received an invalid phase: ${JSON.stringify(phase)}.`);
  }
}

function assertText(phase: CyclePhase, field: string, value: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `CycleDailySupport for the ${phase} phase has a blank ${field}: ${JSON.stringify(value)}.`
    );
  }
}

/**
 * Checks a phase's moods, when it names any.
 *
 * A phase with no moods is valid and skipped: saying nothing about mood is the
 * honest answer where there is nothing well supported to say. A list that is
 * there has to be usable, because an empty one is a card promising moods and
 * showing none.
 */
function assertMoodLabels(phase: CyclePhase, moodLabels: readonly string[] | undefined): void {
  if (moodLabels === undefined) {
    return;
  }

  if (!Array.isArray(moodLabels)) {
    throw new Error(
      `CycleDailySupport for the ${phase} phase has a non-array moodLabels: ` +
        `${JSON.stringify(moodLabels)}.`
    );
  }

  if (moodLabels.length === 0) {
    throw new Error(`CycleDailySupport for the ${phase} phase lists no moods.`);
  }

  const seen = new Set<string>();

  moodLabels.forEach((label, index) => {
    assertText(phase, `moodLabels[${index}]`, label);

    const mood = label.trim();

    // The same mood twice reads as two separate observations when it is one.
    if (seen.has(mood)) {
      throw new Error(
        `CycleDailySupport for the ${phase} phase lists ${JSON.stringify(mood)} more than once.`
      );
    }

    seen.add(mood);
  });
}

/**
 * Checks one phase's content, throwing on the first rule it breaks.
 *
 * Blank text is refused rather than tolerated: a mood that renders as an empty
 * line is worse than one that was never listed, and a phase with nothing to say
 * should not be carrying a card that says nothing.
 *
 * Pure: nothing is mutated and the content is read exactly as given.
 */
export function validateCycleDailySupport(support: CycleDailySupport): void {
  assertPhase('CycleDailySupport', support.phase);

  assertMoodLabels(support.phase, support.moodLabels);

  assertText(support.phase, 'supportMessage', support.supportMessage);
}

/**
 * The content written for `phase`, or `null` when none is.
 *
 * An exact match only: a phase is not answered with a neighbouring one, because
 * what someone might notice in the luteal phase is not what they might notice
 * while menstruating.
 *
 * Two entries for the same phase is corruption rather than a choice to make —
 * picking one silently would show words nobody could account for — so it throws.
 * A phase that is not a phase throws as well, since that is a caller asking the
 * wrong question rather than one that happens to be unwritten.
 *
 * Pure: the list is read, never sorted or mutated.
 */
export function getCycleDailySupport(
  contents: readonly CycleDailySupport[],
  phase: CyclePhase
): CycleDailySupport | null {
  assertPhase('getCycleDailySupport', phase);

  const matches = contents.filter((support) => support.phase === phase);

  if (matches.length > 1) {
    throw new Error(
      `getCycleDailySupport found ${matches.length} entries for the ${phase} phase; ` +
        'at most 1 is valid.'
    );
  }

  return matches.length === 0 ? null : matches[0];
}
