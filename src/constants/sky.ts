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
 * ## Read this before you add a colour
 *
 * The palette this replaced "passed every test and said nothing" - that is
 * written two paragraphs up, and it is still true. What is also true is that
 * the replacement did the same thing one level along, and it took a device to
 * find it.
 *
 * The table above is real: the ink clears AA on every field. The screen did
 * not draw its secondary text in that ink. It drew it in `textSecondary`,
 * a page colour, which measured **1.97:1** on light night and failed six of
 * the eight phase-and-scheme combinations. The test was green the whole time,
 * because it measured the colour the palette *offers* rather than the colour
 * the screen *uses* - and a green test is a reason not to look.
 *
 * Nor did the arithmetic include the drift. Two translucent sheets are laid
 * over every field and can overlap, and at the dark scheme's old alpha that
 * took midday from 4.90:1 to 3.00:1. Again: measured, green, wrong.
 *
 * Both are the same mistake, which is the one worth carrying: **measuring the
 * part that is easy to measure rather than the part that matters.** A colour
 * in this file is not a guarantee. The guarantee is what reaches a pixel, so
 * the test now composites the whole stack - field, drift, glass - and a second
 * test walks the rendered home screen and fails if any word is drawn in
 * anything but the ink.
 *
 * ## Why there is only one ink
 *
 * There used to be an `inkSoft` as well, for the lines meant to sit back. It
 * failed AA on four of the eight combinations, which is the same trap in
 * miniature: a token designed for this job and never checked at it.
 *
 * It is gone rather than corrected. On a coloured field, lightening the text
 * is the one de-emphasis move that cannot be made safe at every stop of every
 * phase, so emphasis here is carried by size and weight and the colour never
 * moves. That is a constraint on the typography, deliberately.
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
  /**
   * The one colour every word on a field is drawn in. There is no second,
   * quieter one - see "Why there is only one ink" above.
   */
  readonly ink: string;
  /**
   * For marks that are not words: the unlit dots of the arc.
   *
   * Softer than the ink, which words are never allowed to be. The difference
   * is not a loophole - a dot carries no meaning a screen reader needs, and
   * the arc states its day through `accessibilityValue` rather than through
   * which dot looks brighter. The name says what it is for, and the render
   * test fails if a word is ever drawn in it.
   */
  readonly inkMark: string;
  /**
   * The label on a control that is filled with the ink.
   *
   * It is the other scheme's ink, which is not a flourish: the two were
   * chosen as the darkest and lightest things in the app, so each is already
   * the other's best partner. 14.98:1 either way.
   *
   * The filled control used to be the brand violet with `onPrimary` on it.
   * That is a colour from another system, and on a full-bleed field it read
   * as a button someone had pasted on - the one object on the screen that
   * belonged to a different app. The violet goes back to being the dusk in
   * the palette, which is what the header above already says it is.
   */
  readonly onInk: string;
  /**
   * A line that carries meaning: the outline of a secondary control, the
   * rule under the selected tab. Not a divider - see `glass` for those.
   *
   * The ink at 0.8, and the alpha is measured rather than chosen. An outline
   * is the only thing telling a secondary button apart from a sentence, so
   * it is information and needs 3:1 against everything behind it. At 0.45 it
   * reaches 2.10:1 and at 0.65 the dark scheme still misses; 0.8 clears both
   * with room (3.95:1 light, 3.58:1 dark) over field, drift and glass.
   */
  readonly inkLine: string;
  /**
   * What a block of content is made of when it sits on a field.
   *
   * The ink again, at a few percent, so the sky shows through and the card
   * moves when the field moves. Always *deepens* the field, in both schemes:
   * a card that lightened a dark sky would walk straight into the ceiling in
   * the note above, and one rule for both modes is one thing to check.
   */
  readonly glass: string;
  /** A single lit edge along the top of a glass block, so it has a thickness. */
  readonly glassEdge: string;
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
    inkMark: 'rgba(36, 27, 51, 0.45)',
    onInk: '#F7F3FB',
    inkLine: 'rgba(36, 27, 51, 0.8)',
    glass: 'rgba(36, 27, 51, 0.06)',
    glassEdge: 'rgba(255, 255, 255, 0.45)',
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
      // Deepened by a quarter, hue untouched. The old values measured 4.90:1
      // bare - which passed the old test - and had no room left for anything
      // laid over them: the drift alone took midday to 3.00:1.
      ovulatory: ['#2A171C', '#502A20', '#724222'],
      luteal: ['#1A1038', '#2C1C55', '#442C72'],
    },
    ink: '#F7F3FB',
    inkMark: 'rgba(247, 243, 251, 0.45)',
    onInk: '#241B33',
    inkLine: 'rgba(247, 243, 251, 0.8)',
    glass: 'rgba(10, 7, 20, 0.22)',
    glassEdge: 'rgba(247, 243, 251, 0.10)',
    // Lower than the light scheme's, and that is a ceiling rather than a
    // preference. Pale light over a dark field moves it *towards* the pale
    // ink, so every point the drift brightens is a point where the words get
    // harder to read - and the two sheets can overlap, which is the case the
    // arithmetic has to assume. At 0.20 that took dark midday to 3.00:1.
    //
    // 0.14, with midday deepened to match, is the pair that holds 4.6:1
    // everywhere. The dark sky therefore drifts less than the light one, which
    // is a real cost and the honest price of reading the words.
    drift: 'rgba(214, 205, 239, 0.14)',
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
