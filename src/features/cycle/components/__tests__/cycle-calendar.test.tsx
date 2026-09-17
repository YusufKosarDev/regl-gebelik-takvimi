import { render, within } from '@testing-library/react-native';

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
  periodRecords: [{ id: 'record-0', startDate: '2026-09-01' as ISODate }],
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

  it('renders the labels the grid supplies', async () => {
    const { getByText } = await renderCalendar();

    for (const label of septemberGrid.weekdayLabels) {
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

  it('marks nothing else with the prediction glyph', async () => {
    const screen = await renderCalendar();

    for (const day of september.days) {
      if (day.date === '2026-09-29') continue;

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
