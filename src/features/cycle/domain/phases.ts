/**
 * The four menstrual cycle phases, as a closed domain model.
 *
 * This module deliberately carries no day ranges, no user-facing copy, no
 * colours and no icons: it only names the phases and points at translation keys,
 * so wording stays in the localisation layer and phase boundaries stay in
 * whichever calculation needs them.
 *
 * It has no dependencies at all — no other domain module, no date API, no React,
 * Expo or storage.
 */

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

/** The phases in the order they occur within a cycle. */
export const CYCLE_PHASES = [
  'menstrual',
  'follicular',
  'ovulatory',
  'luteal',
] as const satisfies readonly CyclePhase[];

export type CyclePhaseMetadata = {
  readonly key: CyclePhase;
  readonly labelKey: string;
  readonly descriptionKey: string;
};

/**
 * Translation keys per phase. Typed as a full `Record`, so adding a phase to
 * `CyclePhase` fails to compile until its metadata is added here too.
 */
export const CYCLE_PHASE_METADATA: Readonly<Record<CyclePhase, CyclePhaseMetadata>> = {
  menstrual: {
    key: 'menstrual',
    labelKey: 'cycle.phase.menstrual.label',
    descriptionKey: 'cycle.phase.menstrual.description',
  },
  follicular: {
    key: 'follicular',
    labelKey: 'cycle.phase.follicular.label',
    descriptionKey: 'cycle.phase.follicular.description',
  },
  ovulatory: {
    key: 'ovulatory',
    labelKey: 'cycle.phase.ovulatory.label',
    descriptionKey: 'cycle.phase.ovulatory.description',
  },
  luteal: {
    key: 'luteal',
    labelKey: 'cycle.phase.luteal.label',
    descriptionKey: 'cycle.phase.luteal.description',
  },
} as const;

export function isCyclePhase(value: string): value is CyclePhase {
  return (CYCLE_PHASES as readonly string[]).includes(value);
}
