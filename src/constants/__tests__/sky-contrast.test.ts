import { Sky } from '../sky';

import { CYCLE_PHASES } from '@/features/cycle/domain/phases';

/**
 * The ink on every sky, against every stop of it.
 *
 * ## Why this is not the same test as `theme-contrast.test.ts`
 *
 * That one holds the page colours and the phase marks on a calendar. This one
 * holds one ink against four full-bleed gradients, in two schemes - a different
 * set of pairs with a different failure mode. A field is behind the day number,
 * the phase and the sentence, and all three are drawn in the same colour, so if
 * any stop of any field fails then a sentence somewhere is unreadable.
 *
 * ## Checked at every stop, not the middle
 *
 * A gradient's text does not sit on its average. The number is centred, the
 * sentence is lower, and on a short screen either can land near the bottom stop
 * - which is always the darkest in light mode and the lightest in dark. So all
 * three stops are held to the same bar.
 *
 * ## The bar is AA for body text
 *
 * 4.5:1, not 3:1. The large-text allowance would cover the day number and would
 * not cover the sentence underneath it, and the sentence is the part that is
 * actually hard to read.
 *
 * Two of these values moved to get here, and only two: light menstrual and
 * light luteal, whose deep ends came out at 3.14:1 and 4.12:1 when the fields
 * were first picked. Everything else is where feeling put it.
 */

function channel(value: number): number {
  const v = value / 255;

  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Relative luminance of a `#rrggbb`. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');

  return (
    0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16))
  );
}

function ratio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];

  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Lays a translucent ink onto a stop and returns what the eye receives.
 *
 * A contrast ratio is between two opaque colours. `inkSoft` is `rgba(...)`, so
 * measuring it directly would measure a colour nobody ever sees.
 */
function composite(rgba: string, background: string): string {
  const parts = rgba.match(/[\d.]+/g);

  if (parts === null || parts.length < 4) {
    throw new Error('expected an rgba() ink, got ' + rgba);
  }

  const alpha = Number(parts[3]);
  const h = background.replace('#', '');
  const back = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));

  const mixed = [0, 1, 2].map((i) =>
    Math.round(alpha * Number(parts[i]) + (1 - alpha) * back[i])
  );

  return '#' + mixed.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const SCHEMES = ['light', 'dark'] as const;

describe('the ink can be read on every sky', () => {
  it.each(
    SCHEMES.flatMap((scheme) =>
      CYCLE_PHASES.flatMap((phase) =>
        Sky[scheme].fields[phase].map(
          (stop, index) => [scheme, phase, index, stop] as const
        )
      )
    )
  )('%s %s, stop %i', (scheme, _phase, _index, stop) => {
    const measured = ratio(Sky[scheme].ink, stop);

    expect([stop, measured >= 4.5]).toEqual([stop, true]);
  });
});

/**
 * The field the app comes up on, before any day has been read.
 *
 * Held to the same bar as the four phase skies and for the same reason: words
 * sit on it. It is a separate block rather than another row in the list above
 * because it is not a phase - `fields` is keyed by `CyclePhase` and adding a
 * fifth key there would have been a lie about what a phase is.
 */
describe('the waking sky carries words too', () => {
  it.each(
    SCHEMES.flatMap((scheme) =>
      Sky[scheme].waking.map((stop, index) => [scheme, index, stop] as const)
    )
  )('%s waking, stop %i', (scheme, _index, stop) => {
    const measured = ratio(Sky[scheme].ink, stop);

    expect([stop, measured >= 4.5]).toEqual([stop, true]);
  });

  it.each(SCHEMES)(
    '%s: the quietened ink is readable on it as well',
    (scheme) => {
      // The loading caption is drawn in `inkSoft`, not `ink`, so this is the
      // combination that actually reaches a screen. Checking `ink` alone here
      // would be the mistake this file's own header warns about.
      const worst = Math.min(
        ...Sky[scheme].waking.map((stop) =>
          ratio(composite(Sky[scheme].inkSoft, stop), stop)
        )
      );

      expect([scheme, worst >= 4.5]).toEqual([scheme, true]);
    }
  );
});

describe('the fields are four different skies', () => {
  it.each(SCHEMES)('%s has no two phases the same', (scheme) => {
    const middles = CYCLE_PHASES.map((phase) => Sky[scheme].fields[phase][1]);

    expect(new Set(middles).size).toBe(CYCLE_PHASES.length);
  });

  /**
   * Night is darker than dusk, dawn is lighter than night, and midday is the
   * lightest thing in the month.
   *
   * This is the concept asserted rather than the contrast: the cycle is drawn
   * as one day, so the order of the four by brightness has to be the order of
   * the four in a day. Getting this wrong would not fail any contrast check and
   * would quietly turn the metaphor into decoration.
   */
  it.each(SCHEMES)('%s runs night, dusk, dawn, midday by brightness', (scheme) => {
    const of = (phase: (typeof CYCLE_PHASES)[number]) =>
      luminance(Sky[scheme].fields[phase][1]);

    expect(of('menstrual')).toBeLessThan(of('luteal'));
    expect(of('luteal')).toBeLessThan(of('follicular'));
    expect(of('follicular')).toBeLessThan(of('ovulatory'));
  });
});
