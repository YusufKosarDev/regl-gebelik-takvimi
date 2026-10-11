import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { ISODate } from '@/types/iso-date';

import { WeekStrip } from '../week-strip';

/**
 * The row of days along the top of the log.
 *
 * Taken from Cycles, where the day being logged is picked here rather than in
 * a date picker reached from somewhere else: a week is small enough to show
 * whole, and logging is a thing people do a day or two late.
 *
 * 11 October 2026 is a Sunday, so its week runs Monday the 5th to Sunday the
 * 11th. The fixture is deliberately a date at the end of a week - a strip that
 * built the week from the wrong end would still look right on a Wednesday.
 */
const SUNDAY = '2026-10-11' as ISODate;

const LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as readonly string[];

function renderStrip(date: ISODate = SUNDAY, onSelect: (date: ISODate) => void = () => {}) {
  return render(
    <WeekStrip date={date} onSelect={onSelect} weekdayLabels={LABELS} dayLabelFor={(d) => d} />
  );
}

describe('WeekStrip', () => {
  it('shows the seven days of the week the date is in, Monday first', async () => {
    const { getAllByRole } = await renderStrip();

    const days = getAllByRole('button').map((node) => node.props.accessibilityLabel as string);

    expect(days).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
  });

  it('builds the week from Monday even when the date is mid-week', async () => {
    const { getAllByRole } = await renderStrip('2026-10-07' as ISODate);

    const days = getAllByRole('button').map((node) => node.props.accessibilityLabel as string);

    expect(days[0]).toBe('2026-10-05');
    expect(days[6]).toBe('2026-10-11');
  });

  it('marks the day being edited and no other', async () => {
    const { getAllByRole } = await renderStrip();

    const selected = getAllByRole('button')
      .filter((node) => node.props.accessibilityState?.selected === true)
      .map((node) => node.props.accessibilityLabel as string);

    expect(selected).toEqual(['2026-10-11']);
  });

  it('tells the caller which day was pressed', async () => {
    const onSelect = jest.fn();
    const { getByLabelText } = await renderStrip(SUNDAY, onSelect);

    await fireEvent.press(getByLabelText('2026-10-08'));

    expect(onSelect).toHaveBeenCalledWith('2026-10-08');
  });

  it('writes the weekday words it is handed rather than its own', async () => {
    // The calendar already owns these seven words. A second copy in this
    // feature is how the grid ends up saying Pzt while the strip says Pt.
    const { getByText } = await renderStrip();

    for (const label of LABELS) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('gives every day a target big enough to hit', async () => {
    const { getAllByRole } = await renderStrip();

    for (const day of getAllByRole('button')) {
      expect(StyleSheet.flatten(day.props.style)?.minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('says the whole date to a screen reader, not the number alone', async () => {
    // "8" is not a date. The spoken label is built by the caller, which is
    // what knows the reader's language.
    const { getByLabelText } = await renderStrip(SUNDAY);

    expect(getByLabelText('2026-10-08')).toBeTruthy();
  });
});
