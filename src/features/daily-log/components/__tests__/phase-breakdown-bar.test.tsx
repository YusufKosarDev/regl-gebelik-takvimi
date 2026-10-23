import { render } from '@testing-library/react-native';
import React from 'react';

import {
  BAR_HEIGHT,
  MIN_SEGMENT_FRACTION,
  NARROW_BAR_WIDTH,
  PhaseBreakdownBar,
  barSegments,
} from '../phase-breakdown-bar';

import { CyclePhaseColors } from '@/constants/theme';
import { CYCLE_PHASES } from '@/features/cycle/domain/phases';
import { cycleLabels, getCyclePhaseLabelIn } from '@/features/cycle/presentation/cycle-labels';
import type { PhaseTally } from '@/features/daily-log/domain/symptom-phase-correlation';

/**
 * Whether the bar can be read — at the width it gets on a small phone, in both
 * themes, and by somebody who cannot tell the four hues apart.
 *
 * The three are one question asked three ways, and none of them is answered by
 * looking at the component on a laptop.
 */

const mockScheme = jest.fn(() => 'light' as 'light' | 'dark');

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => mockScheme(),
}));

function tally(overrides: Partial<PhaseTally> = {}): PhaseTally {
  return { menstrual: 0, follicular: 0, ovulatory: 0, luteal: 0, ...overrides };
}

/** Every node in a rendered tree, flattened. */
function nodes(tree: unknown): Record<string, unknown>[] {
  if (tree === null || typeof tree !== 'object') {
    return [];
  }

  if (Array.isArray(tree)) {
    return tree.flatMap(nodes);
  }

  const node = tree as { children?: unknown };

  return [tree as Record<string, unknown>, ...nodes(node.children)];
}

function styleOf(node: Record<string, unknown>): Record<string, unknown> {
  const style = (node.props as { style?: unknown } | undefined)?.style;

  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter((rule) => typeof rule === 'object'));
  }

  return typeof style === 'object' && style !== null ? (style as Record<string, unknown>) : {};
}

/** Every string anywhere in the tree. */
function texts(tree: unknown): string[] {
  const out: string[] = [];

  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      out.push(value);

      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);

      return;
    }

    if (value !== null && typeof value === 'object') {
      walk((value as { children?: unknown }).children);
    }
  };

  walk(tree);

  return out;
}

beforeEach(() => {
  mockScheme.mockReturnValue('light');
});

describe('barSegments', () => {
  it('draws nothing when nothing was recorded', () => {
    expect(barSegments(tally())).toEqual([]);
  });

  it('leaves out the phases holding no days rather than drawing them at zero', () => {
    const segments = barSegments(tally({ luteal: 5, menstrual: 2 }));

    expect(segments.map((segment) => segment.phase)).toEqual(['menstrual', 'luteal']);
  });

  it('fills the bar exactly', () => {
    const segments = barSegments(tally({ menstrual: 3, follicular: 1, luteal: 11 }));
    const total = segments.reduce((sum, segment) => sum + segment.fraction, 0);

    expect(total).toBeCloseTo(1, 10);
  });

  it('keeps a single phase as the whole bar', () => {
    expect(barSegments(tally({ luteal: 9 }))).toEqual([
      { phase: 'luteal', count: 9, fraction: 1 },
    ]);
  });

  /**
   * The measurement the floor exists for.
   *
   * One day out of forty is 2.5% of the bar — 6px at the narrow width, under
   * half the bar's height, which reads as a line drawn on the bar rather than
   * a part of it. The floor widens it, and the segments above the floor pay
   * for the widening.
   */
  it('never draws a segment thinner than the bar is tall', () => {
    const lopsided = tally({ luteal: 37, menstrual: 1, follicular: 1, ovulatory: 1 });

    const widths = barSegments(lopsided).map(
      (segment) => segment.fraction * NARROW_BAR_WIDTH
    );

    for (const width of widths) {
      expect(width).toBeGreaterThanOrEqual(BAR_HEIGHT);
    }
  });

  it('still fills the bar exactly once the floor has been applied', () => {
    const lopsided = tally({ luteal: 37, menstrual: 1, follicular: 1, ovulatory: 1 });
    const total = barSegments(lopsided).reduce((sum, segment) => sum + segment.fraction, 0);

    expect(total).toBeCloseTo(1, 10);
  });

  it('keeps the widest phase the widest', () => {
    const segments = barSegments(tally({ luteal: 37, menstrual: 1, follicular: 1 }));
    const widest = [...segments].sort((a, b) => b.fraction - a.fraction)[0];

    expect(widest.phase).toBe('luteal');
  });
});

describe('the bar as drawn', () => {
  it('draws one segment per phase that holds days', async () => {
    const view = await render(
      <PhaseBreakdownBar tally={tally({ luteal: 9, menstrual: 3 })} testID="bar" />
    );

    expect(view.getByTestId('bar-luteal')).toBeTruthy();
    expect(view.getByTestId('bar-menstrual')).toBeTruthy();
    expect(view.queryByTestId('bar-ovulatory')).toBeNull();
  });

  /**
   * The point of the legend, and the reason it lists all four.
   *
   * The accents are 1.17 apart at the closest pair by contrast ratio, so the
   * bar alone asks the reader to separate four hues. Every count is therefore
   * also a number on screen — including the zeroes, so nobody has to work out
   * which phase is missing.
   */
  it('writes every phase count out, including the empty ones', async () => {
    const view = await render(
      <PhaseBreakdownBar tally={tally({ luteal: 9, menstrual: 3 })} testID="bar" />
    );

    const written = texts(view.toJSON()).join(' | ');

    expect(written).toContain('9');
    expect(written).toContain('3');
    // The two phases at zero are named with their zero rather than omitted.
    expect(written.match(/: 0 /g)?.length ?? 0).toBe(2);
  });

  it('gives a screen reader one sentence for the whole bar', async () => {
    const view = await render(
      <PhaseBreakdownBar tally={tally({ luteal: 9, menstrual: 3 })} testID="bar" />
    );

    const spoken = view.getByLabelText(/Luteal/);

    expect(spoken).toBeTruthy();
  });
});

/**
 * What a screen reader hears, and how many times it hears it.
 *
 * The bar carried the four counts as one sentence and the legend carried the
 * same four as four separate text nodes, so every count was announced twice:
 * six stops per bar where two would do, and on the records summary that is the
 * baseline plus one per symptom.
 *
 * The legend is the channel that does not depend on telling four hues apart -
 * `phase-palette-distinctness.test.ts` measured the closest pair at a contrast
 * ratio of 1.17 - and that argument is about **seeing**. A screen reader is
 * already getting the numbers from the bar's own label. So the drawn legend
 * stays exactly as it is and is hidden from assistive technology, which leaves
 * one spoken stop per bar carrying all four counts together. Together matters:
 * the screen exists so a reader can compare a distribution against the
 * baseline, and four numbers delivered in one breath are comparable in a way
 * four separate stops are not.
 */
describe('the bar is announced once', () => {
  /**
   * The stops a screen reader would make, in tree order.
   *
   * Counting `accessibilityLabel`s alone is what the first version of this test
   * did, and it passed against the duplicated tree: the legend's counts are
   * rendered text rather than labels, so the two channels were never compared.
   * This walks the way the platform does instead - a hidden subtree is skipped,
   * a node with a label is one stop and swallows its children, and anything
   * else contributes the text it renders.
   */
  function spokenStops(tree: unknown): string[] {
    const out: string[] = [];

    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);

        return;
      }

      if (typeof node === 'string') {
        out.push(node);

        return;
      }

      if (node === null || typeof node !== 'object') {
        return;
      }

      const typed = node as { props?: Record<string, unknown>; children?: unknown };
      const props = typed.props ?? {};

      if (
        props.accessibilityElementsHidden === true
        || props.importantForAccessibility === 'no-hide-descendants'
      ) {
        return;
      }

      if (typeof props.accessibilityLabel === 'string') {
        out.push(props.accessibilityLabel);

        return;
      }

      walk(typed.children);
    };

    walk(tree);

    return out;
  }

  it('says the counts once rather than once per channel', async () => {
    const view = await render(
      <PhaseBreakdownBar tally={tally({ luteal: 9, menstrual: 3 })} testID="bar" />
    );

    const heard = spokenStops(view.toJSON()).filter((stop) => stop.includes('Luteal'));

    expect(heard).toHaveLength(1);

    // And that one stop carries all four, so nothing was deduplicated by
    // dropping it. The phase words come from the catalogue rather than being
    // typed here: the Turkish for `menstrual` is "Regl", not "Menstrual".
    for (const phase of CYCLE_PHASES) {
      const word = getCyclePhaseLabelIn(cycleLabels.tr, phase);

      expect([word, heard[0].includes(word)]).toEqual([word, true]);
    }
  });

  it('hides the legend from assistive technology without removing it', async () => {
    const view = await render(
      <PhaseBreakdownBar tally={tally({ luteal: 9, menstrual: 3 })} testID="bar" />
    );

    // `includeHiddenElements` because the thing being asserted is that this
    // element is hidden: the default queries skip anything hidden from
    // assistive technology, so without it a passing fix looks like a missing
    // element.
    const legend = view.getByTestId('bar-legend', { includeHiddenElements: true });

    // Both attributes, like `icon.tsx` and the arc's decorations: one is the
    // iOS half and one is the Android half, and this app ships Android.
    expect(legend.props.accessibilityElementsHidden).toBe(true);
    expect(legend.props.importantForAccessibility).toBe('no-hide-descendants');

    // Still drawn, because hiding it from a screen reader is not the same as
    // taking away the channel that does not need four hues told apart.
    expect(texts(view.toJSON()).join(' | ')).toContain('9');
  });

  /**
   * A role, so the sentence is not mistaken for body text.
   *
   * Without one it is an `accessible` View with a label: TalkBack reads the
   * words and says nothing about what they describe. `image` is what
   * `AvatarPreview` uses for the other thing in this app that is a drawn
   * graphic with a spoken description, and it tells the listener that what
   * they are hearing is a description of a picture rather than a line of the
   * page.
   */
  it('says it is a graphic', async () => {
    const view = await render(
      <PhaseBreakdownBar tally={tally({ luteal: 9, menstrual: 3 })} testID="bar" />
    );

    expect(view.getByLabelText(/Luteal/).props.accessibilityRole).toBe('image');
  });
});

describe('the bar in each theme', () => {
  const drawnColours = async (): Promise<readonly string[]> => {
    const view = await render(
      <PhaseBreakdownBar tally={tally({ luteal: 9, menstrual: 3 })} testID="bar" />
    );

    return nodes(view.toJSON())
      .map(styleOf)
      .map((style) => style.backgroundColor)
      .filter((colour): colour is string => typeof colour === 'string');
  };

  it('uses the light accents in light', async () => {
    mockScheme.mockReturnValue('light');

    const colours = await drawnColours();

    expect(colours).toContain(CyclePhaseColors.light.lutealAccent);
    expect(colours).not.toContain(CyclePhaseColors.dark.lutealAccent);
  });

  /**
   * Measured rather than assumed.
   *
   * A component that reads the palette once at module scope, or that imports
   * `CyclePhaseColors.light` directly, looks right in every screenshot taken
   * on a light phone and is wrong on a dark one. There is no type error for
   * it, and the four colours are close enough in name that a reviewer scrolls
   * past.
   */
  it('uses the dark accents in dark', async () => {
    mockScheme.mockReturnValue('dark');

    const colours = await drawnColours();

    expect(colours).toContain(CyclePhaseColors.dark.lutealAccent);
    expect(colours).not.toContain(CyclePhaseColors.light.lutealAccent);
  });

  it('draws the same shape in both themes', async () => {
    mockScheme.mockReturnValue('light');
    const light = barSegments(tally({ luteal: 9, menstrual: 3 }));

    mockScheme.mockReturnValue('dark');
    const dark = barSegments(tally({ luteal: 9, menstrual: 3 }));

    // The geometry is the theme's business nowhere: only the colours change.
    expect(dark).toEqual(light);
  });
});

describe('the floor itself', () => {
  it('is the bar height over the narrow width, not a number somebody liked', () => {
    expect(MIN_SEGMENT_FRACTION).toBeCloseTo(BAR_HEIGHT / NARROW_BAR_WIDTH, 10);
  });

  it('leaves room for four segments at the floor', () => {
    // Four phases at the floor must not already overflow the bar, or the
    // renormalisation above would be dividing by a negative surplus.
    expect(MIN_SEGMENT_FRACTION * 4).toBeLessThan(1);
  });
});
