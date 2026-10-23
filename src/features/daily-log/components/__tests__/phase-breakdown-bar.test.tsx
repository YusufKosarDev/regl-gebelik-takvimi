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
