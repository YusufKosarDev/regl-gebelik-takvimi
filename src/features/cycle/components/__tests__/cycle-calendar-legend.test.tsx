import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';

import { CycleCalendarLegend } from '../cycle-calendar-legend';

const ESTIMATE_NOTICE = 'Takvimdeki doğurganlık ve yumurtlama bilgileri tahminidir.';

describe('CycleCalendarLegend markers', () => {
  it('shows the period marker', async () => {
    const { getByText } = await render(<CycleCalendarLegend />);

    expect(getByText('R')).toBeTruthy();
  });

  it('shows the ovulation marker', async () => {
    const { getByText } = await render(<CycleCalendarLegend />);

    expect(getByText('Y')).toBeTruthy();
  });

  it('shows the raised fertility marker', async () => {
    const { getByText } = await render(<CycleCalendarLegend />);

    expect(getByText('○')).toBeTruthy();
  });

  it('shows the predicted period marker', async () => {
    const { getByText } = await render(<CycleCalendarLegend />);

    expect(getByText('≈')).toBeTruthy();
  });
});

describe('CycleCalendarLegend labels', () => {
  it.each([
    'Regl günü',
    'Tahmini yumurtlama günü',
    'Doğurganlığın yüksek olduğu tahmini gün',
    'Tahmini regl günleri',
  ])('explains %s', async (label) => {
    const { getByText } = await render(<CycleCalendarLegend />);

    expect(getByText(label)).toBeTruthy();
  });

  it('says the information is an estimate', async () => {
    const { getByText } = await render(<CycleCalendarLegend />);

    expect(getByText(ESTIMATE_NOTICE)).toBeTruthy();
  });

  it('lists exactly four marks', async () => {
    const { queryAllByText } = await render(<CycleCalendarLegend />);

    expect(queryAllByText(/^[RY○●≈]$/)).toHaveLength(4);
  });
});

describe('CycleCalendarLegend omits the peak mark', () => {
  it('does not show a filled circle', async () => {
    const { queryByText } = await render(<CycleCalendarLegend />);

    // The peak day is the estimated ovulation day, which the calendar renders
    // as Y, so a filled circle never appears in a month.
    expect(queryByText('●')).toBeNull();
  });

  it('does not describe a highest fertility mark', async () => {
    const { queryByText } = await render(<CycleCalendarLegend />);

    expect(queryByText(/en yüksek/i)).toBeNull();
  });
});

describe('CycleCalendarLegend accessibility', () => {
  it.each([
    ['R: Regl günü'],
    ['Y: Tahmini yumurtlama günü'],
    ['Daire: Doğurganlığın yüksek olduğu tahmini gün'],
    ['Yaklaşık işareti: Tahmini regl günleri'],
  ])('reads %s as one element', async (label) => {
    const { getByLabelText } = await render(<CycleCalendarLegend />);

    expect(getByLabelText(label)).toBeTruthy();
  });

  it('does not leave the meaning to the symbol alone', async () => {
    const { getByLabelText } = await render(<CycleCalendarLegend />);

    // "○" read aloud is noise, so the label names the shape in words.
    expect(getByLabelText(/^Daire:/)).toBeTruthy();
    expect(getByLabelText(/^Yaklaşık işareti:/)).toBeTruthy();
  });
});

describe('CycleCalendarLegend scope', () => {
  it('offers nothing to press', async () => {
    const { queryAllByRole } = await render(<CycleCalendarLegend />);

    expect(queryAllByRole('button')).toHaveLength(0);
  });

  it('makes no probability or pregnancy claim', async () => {
    const { toJSON } = await render(<CycleCalendarLegend />);

    const visibleText = JSON.stringify(toJSON());

    for (const forbidden of ['yüzde', 'olasılık', 'hamile kal', 'garanti']) {
      expect(visibleText).not.toContain(forbidden);
    }
  });
});

/**
 * The key is drawn the way the thing it explains is drawn.
 *
 * This file's component already carries a note about the one time they drifted
 * - the grid showing R and Y under a legend explaining P and O. The squares
 * are bands under a letter now, so the swatches are too; a legend still
 * showing filled and outlined boxes would be explaining a calendar that no
 * longer exists.
 */
describe('CycleCalendarLegend swatches match the squares', () => {
  const ACCENTS = ['#8E2F4E', '#4E938B', '#4F64A3'];
  const SOFT_FILLS = ['#F7E4EA', '#E6EAF5', '#E0F0EE'];

  function stylesIn(tree: unknown): Record<string, unknown>[] {
    const found: Record<string, unknown>[] = [];

    const walk = (node: any): void => {
      if (node === null || typeof node !== 'object') return;

      const flat = StyleSheet.flatten(node.props?.style);

      if (flat !== undefined) found.push(flat as Record<string, unknown>);

      (node.children ?? []).forEach(walk);
    };

    walk(tree);

    return found;
  }

  it('draws a band under each mark, in the colour the square uses', async () => {
    const { toJSON } = await render(<CycleCalendarLegend />);

    const bands = stylesIn(toJSON()).filter(
      (style) => typeof style.backgroundColor === 'string'
    );

    expect(bands.map((style) => style.backgroundColor).sort()).toEqual([...ACCENTS].sort());
  });

  it('fills nothing', async () => {
    // The soft fills were the swatch's whole body. Nothing wears them now.
    const { toJSON } = await render(<CycleCalendarLegend />);

    const drawn = stylesIn(toJSON()).map((style) => style.backgroundColor);

    for (const fill of SOFT_FILLS) {
      expect([fill, drawn.includes(fill)]).toEqual([fill, false]);
    }
  });

  it('draws no band for the predicted start, which is a guess', async () => {
    const { toJSON } = await render(<CycleCalendarLegend />);

    // Four items, three of them a phase. The predicted start keeps its muted
    // glyph and gets no band, on the calendar and here alike.
    expect(
      stylesIn(toJSON()).filter((style) => typeof style.backgroundColor === 'string')
    ).toHaveLength(3);
  });
});

/**
 * The predicted-period row is drawn in an ink, not in whatever is left.
 *
 * `swatchMarkerColour` has no colour for this row - the mark is a guess and a
 * phase colour would dress it as a recorded fact - and it used to say so by
 * returning `undefined`, which the caller spread into the style array.
 * `StyleSheet.flatten` keeps a key whose value is `undefined`, so the theme's
 * colour was overwritten with nothing and React Native drew the platform
 * default. Black. On a dark page the mark was invisible, and nothing in this
 * file noticed because the mark was present and correct in every other way.
 *
 * `ThemedText` now refuses an undefined colour, so this would be right even if
 * the legend went back to its old shape - which is why that is tested over
 * there, on the component that makes it impossible. What is asserted here is
 * the thing a person looks at: the ink this row is actually drawn in.
 */
describe('CycleCalendarLegend colours', () => {
  function markerColour(tree: unknown, marker: string): string | undefined {
    let found: string | undefined;

    const walk = (current: any) => {
      if (found !== undefined) return;
      if (Array.isArray(current)) return current.forEach(walk);
      if (current === null || typeof current !== 'object') return;

      if (current.type === 'Text' && current.children?.[0] === marker) {
        const flat = StyleSheet.flatten(current.props?.style);

        if (typeof flat?.color === 'string') {
          found = flat.color;

          return;
        }
      }

      walk(current.children);
    };

    walk(tree);

    return found;
  }

  it('draws the predicted mark in the muted ink, not in black', async () => {
    const screen = await render(<CycleCalendarLegend />);

    const colour = markerColour(screen.toJSON(), '≈');

    expect(colour).toBe(Colors.light.textSecondary);
    expect(colour).not.toBe('#000000');
    expect(colour).not.toBe('black');
  });

  it('still gives the phase marks their own colours', async () => {
    // The fix must not have flattened every row to the same ink.
    const screen = await render(<CycleCalendarLegend />);
    const tree = screen.toJSON();

    const period = markerColour(tree, 'R');
    const ovulation = markerColour(tree, 'Y');

    expect(period).toBeDefined();
    expect(ovulation).toBeDefined();
    expect(new Set([period, ovulation, markerColour(tree, '≈')]).size).toBe(3);
  });
});
