import type { CyclePhase } from '@/features/cycle/domain/phases';

/**
 * The cycle as one day, drawn as a sky.
 *
 * ## The idea
 *
 * A cycle is a loop and a day is a loop, so the four phases are the four parts
 * of a day:
 *
 * | Phase | Sky | Feeling |
 * | --- | --- | --- |
 * | menstrual | night | deep, inward, close |
 * | follicular | dawn | rose warming, opening |
 * | ovulatory | midday | the brightest point of the month |
 * | luteal | dusk | violet cooling, drawing in |
 *
 * The loop closes because dusk runs into night. That is also what finally gives
 * the brand lavender somewhere to live: it is the colour of dusk and of the
 * hour before dawn, so it stops competing with the phase colours and starts
 * being where they end up.
 *
 * ## These were chosen for feeling first and checked second
 *
 * The palette this replaces was derived the other way round - every value in
 * `CyclePhaseColors` is justified by a contrast ratio, and the comments say so:
 * one tone is "darker than it looks like it wants to be" because the lighter
 * one missed 3:1. That is how a palette ends up passing every test and saying
 * nothing.
 *
 * So: the four skies were picked, then `scripts`-side arithmetic checked the
 * ink that actually sits on them, then two were moved - light menstrual and
 * light luteal, whose deep ends landed at 3.14:1 and 4.12:1 and could not carry
 * a sentence. Nothing was moved for any other reason.
 *
 * Measured against the ink below, worst stop of each field:
 *
 * ```
 *              light          dark
 * menstrual    5.44  AA       13.12  AAA
 * follicular   7.35  AAA       8.41  AAA
 * ovulatory    9.33  AAA       4.90  AA
 * luteal       6.30  AA       10.37  AAA
 * ```
 *
 * ## Why these are not held apart by lightness, and the old ones were
 *
 * `CyclePhaseColors` has a rule that the four must differ in lightness as well
 * as hue, so they survive colour blindness. That rule is right **there** and
 * does not apply **here**, because the two are doing different jobs.
 *
 * A calendar square is data: the colour is the only thing saying which phase a
 * day belongs to, so it must be readable without colour vision - which is why
 * the calendar also keeps its letters and shapes. The field is atmosphere. The
 * phase is written on it, in words, in the middle of the screen. Nobody has to
 * identify a phase from the sky, and a person who cannot tell dusk from night
 * loses nothing but the mood.
 *
 * So `CyclePhaseColors` stays exactly as it is and keeps its own test. This is
 * a second palette with a different job, not a replacement.
 */

/** Three stops, top to bottom. */
export type SkyField = readonly [string, string, string];

export type SkyScheme = {
  readonly fields: Readonly<Record<CyclePhase, SkyField>>;
  /** The one colour every word on a field is drawn in. */
  readonly ink: string;
  /** The same ink, quietened, for the line under the day number. */
  readonly inkSoft: string;
  /** Drifting light, laid over the field. White by day, moonlight by night. */
  readonly drift: string;
  /** What a logged period blooms in. */
  readonly bloom: string;
  /**
   * The sky before the day is known.
   *
   * The launch sequence used to run lilac splash, **white page**, sky. The
   * white is the frame where the screen says it is loading, and a sky app
   * that flashes a blank page on the way to the sky looks unfinished for the
   * exact length of time somebody is deciding what it is.
   *
   * It claims no phase, because nothing has been read yet, and it is built
   * around the splash colour so the splash resolves into it rather than
   * cutting to it.
   */
  readonly waking: SkyField;
};

export const Sky: Readonly<Record<'light' | 'dark', SkyScheme>> = {
  light: {
    fields: {
      menstrual: ['#CFD3EE', '#A5ABDA', '#8A91C8'],
      follicular: ['#FBDCD3', '#F6B3AE', '#EC95A4'],
      ovulatory: ['#FFEDC4', '#FFD0A4', '#FBB38E'],
      luteal: ['#E6D3F0', '#C9A9DF', '#B294D2'],
    },
    ink: '#241B33',
    inkSoft: 'rgba(36, 27, 51, 0.72)',
    // Raised from 0.38 once the drift was measured and found invisible. Safe
    // in this direction: white over a light field moves it *away* from the
    // dark ink, so every phase gained contrast rather than losing it (worst
    // stop 11.27:1 before, 12.93:1 after, both sheets overlapping).
    //
    // The dark drift below cannot follow it up, and that is not symmetry for
    // its own sake - see the note there.
    drift: 'rgba(255, 255, 255, 0.50)',
    bloom: 'rgba(255, 255, 255, 0.55)',
    // Middle stop is the splash background exactly.
    waking: ['#F4F0FD', '#EDE8FA', '#DED6F2'],
  },
  dark: {
    fields: {
      menstrual: ['#0E1030', '#171A40', '#232553'],
      follicular: ['#2C1430', '#4E2142', '#73314E'],
      ovulatory: ['#3A1F26', '#6E3A2C', '#9C5A2E'],
      luteal: ['#1A1038', '#2C1C55', '#442C72'],
    },
    ink: '#F7F3FB',
    inkSoft: 'rgba(247, 243, 251, 0.74)',
    // Left where it is, and it is already too high rather than too low. Pale
    // light over a dark field moves it *towards* the pale ink: with two sheets
    // overlapping, dark ovulatory measures 3.00:1 against the ink at this
    // alpha, where the bare field gives 4.90:1. So the dark sky drifts less
    // than the light one does, and fixing that properly is a palette decision
    // rather than a number to nudge here.
    drift: 'rgba(214, 205, 239, 0.20)',
    bloom: 'rgba(247, 243, 251, 0.30)',
    // Middle stop is the dark splash background exactly.
    waking: ['#1C1533', '#241C3D', '#2E2550'],
  },
};

/**
 * How long the sky takes to drift once, in milliseconds.
 *
 * Twenty seconds each way. Slow enough that it reads as the screen being alive
 * rather than as something happening, which is the line this has to stay on: a
 * person opens this app half-asleep, and a background that moves at a speed
 * worth watching is a background that cannot be ignored.
 */
export const DRIFT_MS = 20000;

/** How long a field takes to become another field when the day changes. */
export const FIELD_FADE_MS = 600;

/** How long the bloom takes to open and fade after a period is logged. */
export const BLOOM_MS = 900;
