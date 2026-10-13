import { fireEvent, render, within } from '@testing-library/react-native';
import { PixelRatio, StyleSheet } from 'react-native';
import { homeMessages } from '@/features/cycle/presentation/home-messages';

import { CycleCalendar } from '../cycle-calendar';

import { buildCycleCalendarMonth } from '@/features/cycle/application/build-cycle-calendar-month';
import type { CycleCalendarDay } from '@/features/cycle/application/build-cycle-calendar-month';
import { buildCycleCalendarGrid } from '@/features/cycle/presentation/build-cycle-calendar-grid';
import type { CycleCalendarGrid } from '@/features/cycle/presentation/build-cycle-calendar-grid';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

/** Cycle 28, period 5 -> ovulation on day 14, fertile window days 9-15. */
const profile: CycleProfile = {
  settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
  periodRecords: [{ id: 'record-0', startDate: '2026-09-01' as ISODate , isOngoing: false }],
};

const september = buildCycleCalendarMonth(profile, 2026, 9);
const septemberGrid = buildCycleCalendarGrid(september);

function dayOn(date: string): CycleCalendarDay {
  const found = september.days.find((day) => day.date === date);
  if (found === undefined) {
    throw new Error(`September 2026 has no ${date}`);
  }
  return found;
}

async function renderCalendar(grid: CycleCalendarGrid = septemberGrid) {
  return render(<CycleCalendar grid={grid} />);
}

/** Reads the short glyphs rendered under a day number. */
function markersOn(screen: Awaited<ReturnType<typeof renderCalendar>>, date: string): string[] {
  const cell = screen.getByTestId(`calendar-day-${date}`);

  return within(cell)
    .queryAllByText(/^[RY●○≈]$/)
    .map((node) => node.props.children as string);
}

describe('CycleCalendar weekday header', () => {
  it('renders all seven labels in order', async () => {
    const { getByText } = await renderCalendar();

    for (const label of ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('renders the labels the catalogue supplies', async () => {
    // They used to travel on the grid. The suite renders a Turkish device, so
    // this is the Turkish half either way - what changed is where it comes
    // from, not what it says.
    const { getByText } = await renderCalendar();

    for (const label of homeMessages.tr.weekdayLabels) {
      expect(getByText(label)).toBeTruthy();
    }
  });
});

describe('CycleCalendar day cells', () => {
  it('renders every real day of the month', async () => {
    const screen = await renderCalendar();

    for (const day of september.days) {
      expect(screen.getByTestId(`calendar-day-${day.date}`)).toBeTruthy();
    }
  });

  it('renders exactly as many day cells as the month has days', async () => {
    const { queryAllByTestId } = await renderCalendar();

    expect(queryAllByTestId(/^calendar-day-/)).toHaveLength(30);
  });

  it('shows the first and last day of the month', async () => {
    const screen = await renderCalendar();

    expect(within(screen.getByTestId('calendar-day-2026-09-01')).getByText('1')).toBeTruthy();
    expect(within(screen.getByTestId('calendar-day-2026-09-30')).getByText('30')).toBeTruthy();
  });

  it('does not invent a 31st of September', async () => {
    const { queryByTestId, queryByText } = await renderCalendar();

    expect(queryByTestId('calendar-day-2026-09-31')).toBeNull();
    expect(queryByText('31')).toBeNull();
  });

  it('shows the day number without a leading zero', async () => {
    const screen = await renderCalendar();

    expect(within(screen.getByTestId('calendar-day-2026-09-09')).getByText('9')).toBeTruthy();
    expect(within(screen.getByTestId('calendar-day-2026-09-17')).getByText('17')).toBeTruthy();
  });
});

describe('CycleCalendar empty cells', () => {
  it('renders one leading empty cell for a Tuesday start', async () => {
    const { getByTestId, queryByTestId } = await renderCalendar();

    // 2026-09-01 is a Tuesday, so column 0 is padding.
    expect(getByTestId('calendar-empty-0')).toBeTruthy();
    expect(queryByTestId('calendar-empty-1')).toBeNull();
  });

  it('renders the trailing empty cells the grid asks for', async () => {
    const { queryAllByTestId } = await renderCalendar();

    const expected = septemberGrid.cells.filter((cell) => cell.kind === 'empty').length;

    expect(queryAllByTestId(/^calendar-empty-/)).toHaveLength(expected);
  });

  it('renders no day number in an empty cell', async () => {
    const screen = await renderCalendar();

    expect(within(screen.getByTestId('calendar-empty-0')).queryByText(/\d/)).toBeNull();
  });

  it('renders no marker in an empty cell', async () => {
    const screen = await renderCalendar();

    expect(within(screen.getByTestId('calendar-empty-0')).queryByText(/[RY●○≈]/)).toBeNull();
  });

  it('is not read as a day by assistive technology', async () => {
    const { getByTestId } = await renderCalendar();

    const empty = getByTestId('calendar-empty-0');

    expect(empty.props.accessible).toBeFalsy();
    expect(empty.props.accessibilityLabel).toBeUndefined();
  });

  it('accounts for every cell the grid holds', async () => {
    const { queryAllByTestId } = await renderCalendar();

    const rendered =
      queryAllByTestId(/^calendar-day-/).length + queryAllByTestId(/^calendar-empty-/).length;

    expect(rendered).toBe(septemberGrid.cells.length);
  });
});

describe('CycleCalendar day states', () => {
  it('marks a menstrual day', async () => {
    // Taken from the domain, not assumed.
    expect(dayOn('2026-09-03').phase).toBe('menstrual');

    const screen = await renderCalendar();

    expect(markersOn(screen, '2026-09-03')).toEqual(['R']);
  });

  it('marks the ovulation day', async () => {
    expect(dayOn('2026-09-14').phase).toBe('ovulatory');

    const screen = await renderCalendar();

    expect(markersOn(screen, '2026-09-14')).toEqual(['Y']);
  });

  it('gives the ovulation day one marker although it is also the peak day', async () => {
    expect(dayOn('2026-09-14').fertilityLevel).toBe('peak');

    const screen = await renderCalendar();

    // Priority is fixed, so the two treatments do not stack.
    expect(markersOn(screen, '2026-09-14')).toHaveLength(1);
  });

  it('marks a raised fertility day', async () => {
    const day = dayOn('2026-09-11');

    expect(day.phase).toBe('follicular');
    expect(day.fertilityLevel).toBe('elevated');

    const screen = await renderCalendar();

    expect(markersOn(screen, '2026-09-11')).toEqual(['○']);
  });

  it('marks a raised fertility day after ovulation too', async () => {
    const day = dayOn('2026-09-15');

    expect(day.phase).toBe('luteal');
    expect(day.fertilityLevel).toBe('elevated');

    const screen = await renderCalendar();

    expect(markersOn(screen, '2026-09-15')).toEqual(['○']);
  });

  it('leaves an ordinary day unmarked', async () => {
    const day = dayOn('2026-09-20');

    expect(day.phase).toBe('luteal');
    expect(day.fertilityLevel).toBe('low');

    const screen = await renderCalendar();

    expect(markersOn(screen, '2026-09-20')).toEqual([]);
  });

  it('leaves a low fertility follicular day unmarked', async () => {
    const day = dayOn('2026-09-07');

    expect(day.phase).toBe('follicular');
    expect(day.fertilityLevel).toBe('low');

    const screen = await renderCalendar();

    expect(markersOn(screen, '2026-09-07')).toEqual([]);
  });

  it('falls back to the peak marker when a peak day is not the ovulation day', async () => {
    // The domain never produces this pairing today, since peak is by definition
    // the ovulation day. The branch exists so the priority order stays complete.
    const day = dayOn('2026-09-20');
    const synthetic: CycleCalendarDay = { ...day, fertilityLevel: 'peak' };
    const grid: CycleCalendarGrid = {
      ...septemberGrid,
      cells: [{ kind: 'day', day: synthetic }],
    };

    const screen = await renderCalendar(grid);

    expect(markersOn(screen, synthetic.date)).toEqual(['●']);
  });
});

describe('CycleCalendar predicted period start', () => {
  it('marks the predicted day', async () => {
    expect(dayOn('2026-09-29').isPredictedPeriodStart).toBe(true);

    const screen = await renderCalendar();

    expect(markersOn(screen, '2026-09-29')).toContain('≈');
  });

  it('marks the rest of the predicted period too', async () => {
    // The calendar used to mark the start and stop, which drew a period one
    // day long. The days after it were not unmarked for want of a prediction:
    // `getCycleDay` never rolls over at a predicted start, so they came out as
    // day 30 and later of the recorded cycle and resolved to luteal.
    const screen = await renderCalendar();
    const predicted = september.days.filter((day) => day.isPredictedPeriodDay);

    expect(predicted.length).toBeGreaterThan(1);

    for (const day of predicted) {
      expect(markersOn(screen, day.date)).toContain('≈');
    }
  });

  it('marks nothing outside the predicted period with the prediction glyph', async () => {
    const screen = await renderCalendar();

    for (const day of september.days) {
      if (day.isPredictedPeriodDay) continue;

      expect(markersOn(screen, day.date)).not.toContain('≈');
    }
  });

  it('uses a different glyph from a recorded period day', async () => {
    const screen = await renderCalendar();

    expect(markersOn(screen, '2026-09-01')).toEqual(['R']);
    expect(markersOn(screen, '2026-09-29')).toEqual(['≈']);
  });
});

describe('CycleCalendar accessibility', () => {
  it('exposes each day as one element', async () => {
    const { getByTestId } = await renderCalendar();

    expect(getByTestId('calendar-day-2026-09-17').props.accessible).toBe(true);
  });

  it('reads an ordinary day as just its date', async () => {
    const { getByTestId } = await renderCalendar();

    expect(getByTestId('calendar-day-2026-09-20').props.accessibilityLabel).toBe('20 Eylül 2026');
  });

  it('names the phase on a menstrual day', async () => {
    const { getByTestId } = await renderCalendar();

    expect(getByTestId('calendar-day-2026-09-03').props.accessibilityLabel).toBe(
      '3 Eylül 2026, Regl'
    );
  });

  it('names the phase and the estimate on the ovulation day', async () => {
    const { getByTestId } = await renderCalendar();

    expect(getByTestId('calendar-day-2026-09-14').props.accessibilityLabel).toBe(
      '14 Eylül 2026, Yumurtlama, doğurganlık en yüksek'
    );
  });

  it('names a raised estimate without naming the phase', async () => {
    const { getByTestId } = await renderCalendar();

    expect(getByTestId('calendar-day-2026-09-11').props.accessibilityLabel).toBe(
      '11 Eylül 2026, doğurganlık yüksek'
    );
  });

  it('says the next period start is an estimate', async () => {
    const { getByTestId } = await renderCalendar();

    expect(getByTestId('calendar-day-2026-09-29').props.accessibilityLabel).toBe(
      '29 Eylül 2026, sonraki regl başlangıcı tahmini'
    );
  });

  it('makes no probability or pregnancy claim', async () => {
    const { getByTestId } = await renderCalendar();

    for (const day of september.days) {
      const label = getByTestId(`calendar-day-${day.date}`).props.accessibilityLabel as string;

      expect(label).not.toMatch(/%|yüzde|olasılık|şans|gebe|hamile|kesin|garanti/i);
    }
  });
});

describe('CycleCalendar scope', () => {
  it('offers nothing to press', async () => {
    const { queryAllByRole } = await renderCalendar();

    expect(queryAllByRole('button')).toHaveLength(0);
  });

  it('does not mutate the grid', async () => {
    const grid = buildCycleCalendarGrid(buildCycleCalendarMonth(profile, 2026, 9));
    const snapshot = JSON.parse(JSON.stringify(grid));

    await renderCalendar(grid);

    expect(grid).toEqual(snapshot);
  });

  it('renders a different month from the same component', async () => {
    const february = buildCycleCalendarGrid(buildCycleCalendarMonth(profile, 2026, 2));
    const { queryAllByTestId, getByTestId } = await renderCalendar(february);

    expect(queryAllByTestId(/^calendar-day-/)).toHaveLength(28);
    expect(getByTestId('calendar-day-2026-02-28')).toBeTruthy();
    // February 2026 starts on a Sunday: six leading empties.
    expect(getByTestId('calendar-empty-5')).toBeTruthy();
  });
});

/** Reads the small label rendered inside today's square. */
function todayLabelsIn(screen: Awaited<ReturnType<typeof renderCalendar>>): unknown[] {
  return screen.queryAllByText('Bugün');
}

describe('CycleCalendar without a today prop', () => {
  it('marks nothing as today', async () => {
    const screen = await renderCalendar();

    expect(todayLabelsIn(screen)).toHaveLength(0);
    expect(screen.queryAllByTestId(/^calendar-today-/)).toHaveLength(0);
  });

  it('leaves every accessibility label unchanged', async () => {
    const screen = await renderCalendar();

    for (const day of september.days) {
      const label = screen.getByTestId(`calendar-day-${day.date}`).props
        .accessibilityLabel as string;

      expect(label).not.toMatch(/bugün/);
    }
  });

  it('keeps the markers it had before', async () => {
    const screen = await renderCalendar();

    expect(markersOn(screen, '2026-09-03')).toEqual(['R']);
    expect(markersOn(screen, '2026-09-14')).toEqual(['Y']);
    expect(markersOn(screen, '2026-09-11')).toEqual(['○']);
  });
});

describe('CycleCalendar with today inside the month', () => {
  async function renderWithToday(today = '2026-09-17') {
    return render(<CycleCalendar grid={septemberGrid} today={today as ISODate} />);
  }

  it('marks exactly one cell', async () => {
    const screen = await renderWithToday();

    expect(todayLabelsIn(screen)).toHaveLength(1);
    expect(screen.queryAllByTestId(/^calendar-today-/)).toHaveLength(1);
  });

  it('marks the right cell', async () => {
    const screen = await renderWithToday();

    expect(screen.getByTestId('calendar-today-2026-09-17')).toBeTruthy();
  });

  it('says so in the accessibility label', async () => {
    const screen = await renderWithToday();

    expect(
      screen.getByTestId('calendar-day-2026-09-17').props.accessibilityLabel as string
    ).toMatch(/, bugün$/);
  });

  it('leaves the neighbouring days alone', async () => {
    const screen = await renderWithToday();

    for (const date of ['2026-09-16', '2026-09-18']) {
      expect(screen.queryByTestId(`calendar-today-${date}`)).toBeNull();
      expect(screen.getByTestId(`calendar-day-${date}`).props.accessibilityLabel).not.toMatch(
        /bugün/
      );
    }
  });

  it('marks no empty cell', async () => {
    const screen = await renderWithToday();

    expect(screen.getByTestId('calendar-empty-0').props.accessibilityLabel).toBeUndefined();
    expect(screen.queryAllByTestId(/^calendar-today-/)).toHaveLength(1);
  });
});

describe('CycleCalendar with today outside the month', () => {
  it('marks nothing when today is in the next month', async () => {
    const screen = await render(
      <CycleCalendar grid={septemberGrid} today={'2026-10-01' as ISODate} />
    );

    expect(todayLabelsIn(screen)).toHaveLength(0);
    expect(screen.queryAllByTestId(/^calendar-today-/)).toHaveLength(0);
  });

  it('marks nothing when today is in the previous month', async () => {
    const screen = await render(
      <CycleCalendar grid={septemberGrid} today={'2026-08-31' as ISODate} />
    );

    expect(todayLabelsIn(screen)).toHaveLength(0);
  });

  it('marks nothing when today is in another year', async () => {
    const screen = await render(
      <CycleCalendar grid={septemberGrid} today={'2027-09-17' as ISODate} />
    );

    expect(todayLabelsIn(screen)).toHaveLength(0);
  });
});

describe('CycleCalendar today does not replace the cycle state', () => {
  it('keeps the period marker', async () => {
    expect(dayOn('2026-09-03').phase).toBe('menstrual');

    const screen = await render(
      <CycleCalendar grid={septemberGrid} today={'2026-09-03' as ISODate} />
    );

    expect(markersOn(screen, '2026-09-03')).toEqual(['R']);
    expect(screen.getByTestId('calendar-today-2026-09-03')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-09-03').props.accessibilityLabel).toBe(
      '3 Eylül 2026, Regl, bugün'
    );
  });

  it('keeps the ovulation marker', async () => {
    expect(dayOn('2026-09-14').phase).toBe('ovulatory');

    const screen = await render(
      <CycleCalendar grid={septemberGrid} today={'2026-09-14' as ISODate} />
    );

    expect(markersOn(screen, '2026-09-14')).toEqual(['Y']);
    expect(screen.getByTestId('calendar-today-2026-09-14')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-09-14').props.accessibilityLabel).toBe(
      '14 Eylül 2026, Yumurtlama, doğurganlık en yüksek, bugün'
    );
  });

  it('keeps the raised fertility marker', async () => {
    expect(dayOn('2026-09-11').fertilityLevel).toBe('elevated');

    const screen = await render(
      <CycleCalendar grid={septemberGrid} today={'2026-09-11' as ISODate} />
    );

    expect(markersOn(screen, '2026-09-11')).toEqual(['○']);
    expect(screen.getByTestId('calendar-today-2026-09-11')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-09-11').props.accessibilityLabel).toBe(
      '11 Eylül 2026, doğurganlık yüksek, bugün'
    );
  });

  it('keeps the predicted period marker', async () => {
    expect(dayOn('2026-09-29').isPredictedPeriodStart).toBe(true);

    const screen = await render(
      <CycleCalendar grid={septemberGrid} today={'2026-09-29' as ISODate} />
    );

    expect(markersOn(screen, '2026-09-29')).toEqual(['≈']);
    expect(screen.getByTestId('calendar-today-2026-09-29')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-09-29').props.accessibilityLabel).toBe(
      '29 Eylül 2026, sonraki regl başlangıcı tahmini, bugün'
    );
  });

  it('still shows the day number', async () => {
    const screen = await render(
      <CycleCalendar grid={septemberGrid} today={'2026-09-17' as ISODate} />
    );

    expect(within(screen.getByTestId('calendar-day-2026-09-17')).getByText('17')).toBeTruthy();
  });

  it('adds nothing to press', async () => {
    const screen = await render(
      <CycleCalendar grid={septemberGrid} today={'2026-09-17' as ISODate} />
    );

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('CycleCalendar without onSelectDay', () => {
  it('makes no day pressable', async () => {
    const screen = await renderCalendar();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps the day accessible as before', async () => {
    const screen = await renderCalendar();

    const cell = screen.getByTestId('calendar-day-2026-09-17');

    expect(cell.props.accessible).toBe(true);
    expect(cell.props.accessibilityLabel).toBe('17 Eylül 2026');
    expect(cell.props.accessibilityRole).toBeUndefined();
  });

  it('marks nothing as selected even with a selectedDate', async () => {
    const screen = await render(
      <CycleCalendar grid={septemberGrid} selectedDate={'2026-09-17' as ISODate} />
    );

    // Still not a button, but the label and state do reflect the selection.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('calendar-day-2026-09-17').props.accessibilityLabel).toBe(
      '17 Eylül 2026, seçili'
    );
  });
});

describe('CycleCalendar with onSelectDay', () => {
  function renderSelectable(selectedDate: ISODate | null = null) {
    const onSelectDay = jest.fn();
    const screen = render(
      <CycleCalendar
        grid={septemberGrid}
        today={'2026-09-17' as ISODate}
        selectedDate={selectedDate}
        onSelectDay={onSelectDay}
      />
    );

    return { screen, onSelectDay };
  }

  it('makes every real day a button', async () => {
    const { screen } = renderSelectable();
    const rendered = await screen;

    expect(rendered.queryAllByRole('button')).toHaveLength(30);
  });

  it('leaves the padding cells alone', async () => {
    const { screen } = renderSelectable();
    const rendered = await screen;

    for (const empty of rendered.queryAllByTestId(/^calendar-empty-/)) {
      expect(empty.props.accessibilityRole).toBeUndefined();
      expect(empty.props.onClick).toBeUndefined();
      expect(empty.props.accessibilityLabel).toBeUndefined();
    }
  });

  it('hands back the day that was pressed', async () => {
    const { screen, onSelectDay } = renderSelectable();
    const rendered = await screen;

    await fireEvent.press(rendered.getByTestId('calendar-day-2026-09-17'));

    expect(onSelectDay).toHaveBeenCalledTimes(1);
    expect(onSelectDay).toHaveBeenCalledWith(dayOn('2026-09-17'));
  });

  it('hands back a different day', async () => {
    const { screen, onSelectDay } = renderSelectable();
    const rendered = await screen;

    await fireEvent.press(rendered.getByTestId('calendar-day-2026-09-03'));

    expect(onSelectDay).toHaveBeenCalledWith(dayOn('2026-09-03'));
  });

  it('reports which day is selected', async () => {
    const { screen } = renderSelectable('2026-09-17' as ISODate);
    const rendered = await screen;

    expect(rendered.getByTestId('calendar-day-2026-09-17').props.accessibilityState.selected).toBe(
      true
    );
    expect(rendered.getByTestId('calendar-day-2026-09-16').props.accessibilityState.selected).toBe(
      false
    );
  });

  it('says so in the accessibility label', async () => {
    const { screen } = renderSelectable('2026-09-03' as ISODate);
    const rendered = await screen;

    expect(rendered.getByTestId('calendar-day-2026-09-03').props.accessibilityLabel).toBe(
      '3 Eylül 2026, Regl, seçili'
    );
  });

  it('reads today and selected together', async () => {
    const { screen } = renderSelectable('2026-09-17' as ISODate);
    const rendered = await screen;

    expect(rendered.getByTestId('calendar-day-2026-09-17').props.accessibilityLabel).toBe(
      '17 Eylül 2026, bugün, seçili'
    );
    expect(rendered.getByTestId('calendar-today-2026-09-17')).toBeTruthy();
  });

  it('keeps the today label when another day is selected', async () => {
    const { screen } = renderSelectable('2026-09-03' as ISODate);
    const rendered = await screen;

    // Today keeps its own mark and label; only "seçili" moves.
    expect(rendered.getByTestId('calendar-today-2026-09-17')).toBeTruthy();
    expect(rendered.getByTestId('calendar-day-2026-09-17').props.accessibilityLabel).toBe(
      '17 Eylül 2026, bugün'
    );
    expect(
      rendered.getByTestId('calendar-day-2026-09-17').props.accessibilityState.selected
    ).toBe(false);
  });
});

describe('CycleCalendar selection keeps the cycle markers', () => {
  async function renderSelected(date: string) {
    return render(
      <CycleCalendar
        grid={septemberGrid}
        today={'2026-09-17' as ISODate}
        selectedDate={date as ISODate}
        onSelectDay={jest.fn()}
      />
    );
  }

  it('keeps the period marker', async () => {
    const screen = await renderSelected('2026-09-03');

    expect(markersOn(screen, '2026-09-03')).toEqual(['R']);
  });

  it('keeps the ovulation marker', async () => {
    const screen = await renderSelected('2026-09-14');

    expect(markersOn(screen, '2026-09-14')).toEqual(['Y']);
  });

  it('keeps the raised fertility marker', async () => {
    const screen = await renderSelected('2026-09-11');

    expect(markersOn(screen, '2026-09-11')).toEqual(['○']);
  });

  it('keeps the predicted period marker', async () => {
    const screen = await renderSelected('2026-09-29');

    expect(markersOn(screen, '2026-09-29')).toEqual(['≈']);
    expect(screen.getByTestId('calendar-day-2026-09-29').props.accessibilityLabel).toBe(
      '29 Eylül 2026, sonraki regl başlangıcı tahmini, seçili'
    );
  });

  it('still shows the day number', async () => {
    const screen = await renderSelected('2026-09-17');

    expect(within(screen.getByTestId('calendar-day-2026-09-17')).getByText('17')).toBeTruthy();
  });
});

describe('CycleCalendar selection purity', () => {
  it('does not mutate the grid', async () => {
    const grid = buildCycleCalendarGrid(buildCycleCalendarMonth(profile, 2026, 9));
    const snapshot = JSON.parse(JSON.stringify(grid));

    const screen = await render(
      <CycleCalendar
        grid={grid}
        selectedDate={'2026-09-17' as ISODate}
        onSelectDay={jest.fn()}
      />
    );

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-03'));

    expect(grid).toEqual(snapshot);
  });

  it('does not select anything by itself', async () => {
    const screen = await render(
      <CycleCalendar grid={septemberGrid} onSelectDay={jest.fn()} />
    );

    for (const day of september.days) {
      expect(
        screen.getByTestId(`calendar-day-${day.date}`).props.accessibilityState.selected
      ).toBe(false);
    }
  });
});

/**
 * The band under the number.
 *
 * The square used to be told apart by a fill behind the number or a border
 * around it, which meant a run of period days read as five separate boxes
 * rather than as one period. A band along the foot of each square runs into
 * its neighbours, so a run reads as a run - which is the thing the calendar is
 * for and the one part of Cycles' grid worth taking.
 *
 * The letters stay. The band is the colour channel and the letter is the other
 * one, and nobody has to tell four phases apart by hue.
 */
describe('CycleCalendar bands', () => {
  const PHASES = {
    menstrualAccent: '#8E2F4E',
    follicularAccent: '#4F64A3',
    ovulatoryAccent: '#4E938B',
  };

  function bandOn(screen: Awaited<ReturnType<typeof renderCalendar>>, date: string) {
    return screen.queryByTestId(`calendar-band-${date}`);
  }

  it('draws a period day its own band', async () => {
    const screen = await renderCalendar();

    const band = bandOn(screen, '2026-09-02');

    expect(StyleSheet.flatten(band?.props.style)?.backgroundColor).toBe(PHASES.menstrualAccent);
  });

  it('draws the fertile days a band of their own', async () => {
    const screen = await renderCalendar();

    expect(StyleSheet.flatten(bandOn(screen, '2026-09-10')?.props.style)?.backgroundColor).toBe(
      PHASES.follicularAccent
    );
  });

  it('draws the ovulation day apart from the window around it', async () => {
    // Cycles marks the one day differently from the run it sits inside, and
    // that is the whole value of the day: a band in the same colour as its
    // neighbours would say nothing.
    const screen = await renderCalendar();

    expect(StyleSheet.flatten(bandOn(screen, '2026-09-14')?.props.style)?.backgroundColor).toBe(
      PHASES.ovulatoryAccent
    );
  });

  it('draws no band on a day with nothing to say', async () => {
    const screen = await renderCalendar();

    expect(bandOn(screen, '2026-09-20')).toBeNull();
  });

  it('runs the band the full width of the square so neighbours touch', async () => {
    // The square has padding, and a band inside it would leave a gap at every
    // boundary - five period days drawn as five dashes. It is laid on the
    // square's own edge instead.
    const screen = await renderCalendar();

    const style = StyleSheet.flatten(bandOn(screen, '2026-09-02')?.props.style);

    expect(style?.position).toBe('absolute');
    expect(style?.left).toBe(0);
    expect(style?.right).toBe(0);
    expect(style?.bottom).toBe(0);
  });

  it('no longer fills the square or draws a border round it', async () => {
    // The treatment this replaces. Both are gone rather than kept alongside:
    // a fill and a band saying the same thing is the square shouting it twice.
    const screen = await renderCalendar();

    for (const date of ['2026-09-02', '2026-09-10', '2026-09-14']) {
      const cell = screen.getByTestId(`calendar-day-${date}`);

      // The whole subtree, not the outer node: the fill this replaces was on
      // the box *inside* the cell, so reading the cell's own style alone was
      // an assertion that passed while the fill was still there.
      const fills: unknown[] = [];

      const walk = (node: any): void => {
        if (node === null || typeof node !== 'object') return;

        if (node.props?.testID !== `calendar-band-${date}`) {
          const flat = StyleSheet.flatten(node.props?.style);

          if (flat?.backgroundColor !== undefined) fills.push(flat.backgroundColor);
          if (flat?.borderColor !== undefined) fills.push(flat.borderColor);
        }

        (node.children ?? []).forEach(walk);
      };

      walk(cell);

      for (const colour of Object.values(PHASES)) {
        expect([date, fills.includes(colour)]).toEqual([date, false]);
      }

      for (const soft of ['#F7E4EA', '#E6EAF5', '#E0F0EE']) {
        expect([date, fills.includes(soft)]).toEqual([date, false]);
      }
    }
  });

  it('still says the phase in a letter as well as in the band', async () => {
    const screen = await renderCalendar();

    expect(markersOn(screen, '2026-09-02')).toEqual(['R']);
    expect(markersOn(screen, '2026-09-14')).toEqual(['Y']);
  });
});

/**
 * What a square does when the system font setting is turned up.
 *
 * Three claims, found on a device at 1.3 through 2.0 and each one its own
 * defect: the ring must contain its own date, the squares in a row must agree
 * on where the number sits, and neither may depend on whether the square
 * happens to be today.
 */
describe('CycleCalendar at a large font setting', () => {
  const getFontScale = jest.spyOn(PixelRatio, 'getFontScale');

  afterEach(() => {
    getFontScale.mockReset();
  });

  /**
   * The cell has no definite height, so its content can push it.
   *
   * `aspectRatio: 1` derived the height from the width, which makes it a size
   * rather than a preference: three scaled lines did not grow the square, they
   * spilled out of it, and the ring - which is the box inside the cell - was
   * left behind at the old height with the date drawn above it.
   */
  it('lets a square grow past its floor rather than fixing its height', async () => {
    getFontScale.mockReturnValue(2);

    const screen = await renderCalendar();

    const cell = StyleSheet.flatten(
      screen.getByTestId('calendar-day-2026-09-17').props.style
    );

    expect(cell.aspectRatio).toBeUndefined();
    expect(cell.height).toBeUndefined();
    // The floor still scales with the setting, which is what keeps the grid's
    // rhythm when the text is small enough not to need the room.
    expect(cell.minHeight).toBe(48 * 2 + 6);
  });

  /**
   * The ring asks for the height its own text needs.
   *
   * `flex: 1` is `flexBasis: 0`, so the box takes what is left rather than
   * asking for anything - with the cell's height no longer fixed that
   * collapses it to the floor and puts the text back outside the ring.
   */
  it('sizes the ring from its contents, not from what is left over', async () => {
    getFontScale.mockReturnValue(2);

    const screen = await renderCalendar();

    const box = ringStyleIn(screen.toJSON(), '2026-09-17');

    expect(box.flexBasis).toBe('auto');
    expect(box.flexGrow).toBe(1);
  });

  /**
   * Every square reserves the same lines, today's included.
   *
   * The numbers sit level across a row because each square centres the same
   * amount of content, not because the squares are the same height - they are
   * that too, but a square centring two lines where its neighbour centres
   * three puts its number somewhere else regardless. Measured on a device at
   * 1.5 before this: the 13 sat 24 points above the 14 beside it.
   *
   * Both reservations scale. A fixed one is the same bug the other way round:
   * at 2.0 a real marker is 24 points tall and a square without one was
   * holding 12, which put its number 32 points low.
   */
  it('reserves the same lines in every square, whether or not it is today', async () => {
    getFontScale.mockReturnValue(2);

    const screen = await render(
      <CycleCalendar grid={septemberGrid} today={'2026-09-17' as ISODate} />
    );

    const reserved = (date: string): number[] =>
      reservedLineHeightsIn(screen.toJSON(), date);

    // Today's square and one that is neither today nor carrying a marker.
    expect(reserved('2026-09-17')).toEqual(reserved('2026-09-22'));
    // And they scale: 12 and 11 at the default setting, doubled here.
    expect(reserved('2026-09-17')).toEqual([24, 22]);
  });
});

/**
 * The ring's own style, read off the rendered tree.
 *
 * The ring is the one box inside a cell with a corner radius, which is how it
 * is found here rather than by giving it a testID that exists only for a test.
 */
function ringStyleIn(tree: unknown, date: string): Record<string, unknown> {
  const findCell = (node: any): any => {
    if (node === null || typeof node !== 'object') return null;
    if (node.props?.testID === `calendar-day-${date}`) return node;

    for (const child of node.children ?? []) {
      const hit = findCell(child);

      if (hit !== null) return hit;
    }

    return null;
  };

  const findRing = (node: any): any => {
    if (node === null || typeof node !== 'object') return null;

    const flat = StyleSheet.flatten(node.props?.style);

    if (flat?.borderRadius !== undefined) return flat;

    for (const child of node.children ?? []) {
      const hit = findRing(child);

      if (hit !== null) return hit;
    }

    return null;
  };

  const cell = findCell(tree);

  if (cell === null) throw new Error(`no cell for ${date}`);

  const ring = findRing(cell);

  if (ring === null) throw new Error(`no ring inside ${date}`);

  return ring;
}

/**
 * The reserved line heights inside one square, in order.
 *
 * The marker row and the "today" line are the two boxes in a cell that exist
 * to hold space open, so they are the two with a `minHeight` and nothing else
 * deciding their size.
 */
function reservedLineHeightsIn(tree: unknown, date: string): number[] {
  const found: number[] = [];

  const walk = (node: any): void => {
    if (node === null || typeof node !== 'object') return;

    const flat = StyleSheet.flatten(node.props?.style);

    if (flat?.minHeight !== undefined) found.push(flat.minHeight as number);

    (node.children ?? []).forEach(walk);
  };

  const findCell = (node: any): any => {
    if (node === null || typeof node !== 'object') return null;
    if (node.props?.testID === `calendar-day-${date}`) return node;

    for (const child of node.children ?? []) {
      const hit = findCell(child);

      if (hit !== null) return hit;
    }

    return null;
  };

  const cell = findCell(tree);

  if (cell === null) throw new Error(`no cell for ${date}`);

  // The cell's own floor is first and is not a reserved line.
  (cell.children ?? []).forEach(walk);

  return found;
}
