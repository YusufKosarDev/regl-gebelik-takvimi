import { CyclePhaseColors } from '../theme';

import { CYCLE_PHASES } from '@/features/cycle/domain/phases';

/**
 * Whether the four phase accents are four colours, not two and a half.
 *
 * ## Why this was missing, and why it matters now
 *
 * `theme-contrast.test.ts` holds every accent against the *page* it is drawn
 * on, and every soft fill against the *text* that sits on it. Neither of those
 * asks the question a chart asks: are the four tellable apart **from each
 * other** when they sit side by side?
 *
 * The palette's own doc already worried about exactly this — it records that
 * `Brand.main` "is light enough that it lands within 0.011 of the teal above,
 * so two of the four phases stop being tellable apart by lightness", and that
 * the lavender was pulled down to leave the teal room. That reasoning was
 * prose. Until a chart drew the four as adjacent bars, nothing needed it to be
 * true; now something does.
 *
 * ## Redmean rather than a contrast ratio, and what the measurement actually
 * showed
 *
 * The obvious guard is WCAG's 3:1 for non-text. It is not the one to use here,
 * and the reason is worth stating carefully, because `sky.ts` records a rule
 * that sounds like the opposite: "`CyclePhaseColors` has a rule that the four
 * must differ in lightness as well as hue, so they survive colour blindness."
 *
 * That rule is real and was acted on — the palette's doc describes pulling the
 * lavender down to leave the teal room. What the measurement adds is how much
 * room that left. Across the four accents the weakest pair by contrast ratio
 * is ovulatory/luteal at **1.17** in light and **1.26** in dark, and every
 * pair is under 3:1. So the four do differ in lightness, and the margin at the
 * closest pair is thin: four accents that each clear 3:1 against the page
 * *and* 3:1 against each other do not fit in the lightness band a readable
 * page leaves.
 *
 * The separation that is comfortable is in hue, which redmean approximates and
 * a luminance ratio cannot see: that same ovulatory/luteal pair is 126 apart
 * there, where the avatar's categories are held to 45. So this file holds the
 * hue distance, and makes no claim about lightness that the ratios would not
 * support.
 *
 * ## The consequence this test does not cover, and where it is covered
 *
 * A thin lightness margin means colour is not a channel a chart may lean on by
 * itself. `sky.ts` reaches the same conclusion from the other direction and
 * says what to do about it: "the calendar also keeps its letters and shapes."
 * A chart has to do the equivalent — each segment's count written beside it —
 * and `phase-breakdown-bar.test.tsx` pins that. This file is only about the
 * palette; that one is about not depending on it alone.
 */

/** Redmean: the short, well-known approximation of perceived distance. */
function colourDistance(left: string, right: string): number {
  const channels = (hex: string) =>
    [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));

  const [r1, g1, b1] = channels(left);
  const [r2, g2, b2] = channels(right);
  const mean = (r1 + r2) / 2;
  const [dr, dg, db] = [r1 - r2, g1 - g2, b1 - b2];

  return Math.round(
    Math.sqrt((2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db)
  );
}

/**
 * The floor, measured from the palette rather than chosen for it.
 *
 * The closest pair in either theme is follicular/luteal: 89 in light, 104 in
 * dark. So 89 is what the shipped palette achieves, and a fifth phase colour —
 * or a nudge to one of these four — has to be at least as separable as the
 * four already are.
 */
const MIN_DISTANCE = 89;

const THEMES = [
  ['light', CyclePhaseColors.light],
  ['dark', CyclePhaseColors.dark],
] as const;

describe('the four phase accents are four distinguishable colours', () => {
  const pairs = CYCLE_PHASES.flatMap((left, index) =>
    CYCLE_PHASES.slice(index + 1).map((right) => [left, right] as const)
  );

  it('has every pair to compare', () => {
    // Four phases make six pairs; a loop over fewer would be passing by
    // having nothing in it.
    expect(pairs.length).toBe(6);
  });

  describe.each(THEMES)('in %s', (_name, palette) => {
    it.each(pairs)('%s and %s are apart', (left, right) => {
      const apart = colourDistance(palette[`${left}Accent`], palette[`${right}Accent`]);

      expect([`${left}/${right}`, apart >= MIN_DISTANCE, apart]).toEqual([
        `${left}/${right}`,
        true,
        apart,
      ]);
    });

    it('gives each phase its own accent rather than repeating one', () => {
      const accents = CYCLE_PHASES.map((phase) => palette[`${phase}Accent`]);

      expect(new Set(accents).size).toBe(CYCLE_PHASES.length);
    });

    it('gives each phase its own soft fill too', () => {
      const softs = CYCLE_PHASES.map((phase) => palette[`${phase}Soft`]);

      expect(new Set(softs).size).toBe(CYCLE_PHASES.length);
    });
  });
});
