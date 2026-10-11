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
 * ## This file measured the wrong thing once, and shipped green
 *
 * The version before this one compared the ink to the bare field, and both
 * halves of that were wrong.
 *
 * It assumed the screen draws its words in `ink`. Two of them were drawn in
 * `textSecondary`, a page colour, which measured **1.97:1** on light night.
 * It assumed the field is what is behind them. Two translucent drift sheets
 * are laid over every field and can overlap, which took dark midday from
 * 4.90:1 to **3.00:1**.
 *
 * Both passed. A green test is a reason not to look, so a test that measures
 * something adjacent to the truth is worse than no test at all.
 *
 * So this file now composites the whole stack a pixel actually receives -
 * field, then drift, then glass - and it is paired with
 * `home-screen-ink.test.tsx`, which renders the screen and fails if a word
 * comes out in anything but the ink. Arithmetic cannot tell you which colour
 * the screen chose; only rendering it can.
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
 * Lays a translucent colour onto an opaque one and returns what the eye gets.
 *
 * A contrast ratio is between two opaque colours, and every layer above a
 * field is `rgba(...)`, so measuring any of them directly would measure a
 * colour nobody ever sees.
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
 * Everything that is laid over a field before a word reaches the eye.
 *
 * Both drift sheets, because they are separately positioned and nothing
 * stops them crossing - and where they cross the alpha compounds. That case
 * is rare to look at and trivial to produce, which is the worst combination
 * for something only ever checked by eye.
 *
 * Then the glass, because a block of content on a field is made of the ink
 * at a few percent and the words inside it sit on the result.
 */
function stack(scheme: (typeof SCHEMES)[number], stop: string) {
  const { drift, glass } = Sky[scheme];

  const oneSheet = composite(drift, stop);
  const bothSheets = composite(drift, oneSheet);

  return {
    bare: stop,
    'one drift sheet': oneSheet,
    'both drift sheets': bothSheets,
    'both sheets, under glass': composite(glass, bothSheets),
  };
}

/** Every surface a word can land on, named so a failure says which one. */
const SURFACES = SCHEMES.flatMap((scheme) =>
  [...CYCLE_PHASES, "waking" as const].flatMap((field) => {
    const stops =
      field === 'waking' ? Sky[scheme].waking : Sky[scheme].fields[field];

    return stops.flatMap((stop, index) =>
      Object.entries(stack(scheme, stop)).map(
        ([layer, surface]) =>
          [`${scheme} ${field}, stop ${index}, ${layer}`, scheme, surface] as const
      )
    );
  })
);

describe('the ink can be read on every surface a word can land on', () => {
  it.each(SURFACES)('%s', (_name, scheme, surface) => {
    const measured = ratio(Sky[scheme].ink, surface);

    expect([surface, measured >= 4.5]).toEqual([surface, true]);
  });

  /**
   * In the dark scheme the bare field is not the constraint - the drift is.
   *
   * Pale light laid on a dark field moves it towards the pale ink, so every
   * point the drift brightens is a point where the words get harder to read.
   * That is the pairing the old version of this file could not see, and it is
   * asserted here because raising the drift alpha is the obvious thing to
   * reach for when the sky looks too still. It must not quietly spend the
   * margin the words need.
   *
   * The light scheme is the other way round and deliberately not asserted:
   * white light moves a light field *away* from dark ink, so there the drift
   * adds margin rather than spending it and the bare field is the worst case.
   * One assertion for both would have been one that is true of neither.
   */
  it('dark: the drift costs more margin than the field itself', () => {
    const worst = (layer: keyof ReturnType<typeof stack>) =>
      Math.min(
        ...CYCLE_PHASES.flatMap((phase) =>
          Sky.dark.fields[phase].map((stop) =>
            ratio(Sky.dark.ink, stack('dark', stop)[layer])
          )
        )
      );

    expect(worst('both drift sheets')).toBeLessThan(worst('bare'));
  });
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
