import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

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
    'Sonraki regl başlangıcı tahmini',
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
    ['Yaklaşık işareti: Sonraki regl başlangıcı tahmini'],
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
