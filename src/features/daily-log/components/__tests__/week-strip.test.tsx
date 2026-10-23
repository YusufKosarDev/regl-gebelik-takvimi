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

    const days = getAllByRole('radio').map((node) => node.props.accessibilityLabel as string);

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

    const days = getAllByRole('radio').map((node) => node.props.accessibilityLabel as string);

    expect(days[0]).toBe('2026-10-05');
    expect(days[6]).toBe('2026-10-11');
  });

  it('marks the day being edited and no other', async () => {
    const { getAllByRole } = await renderStrip();

    const selected = getAllByRole('radio')
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

    for (const day of getAllByRole('radio')) {
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

/**
 * One of seven, which is what `radio` says and `button` did not.
 *
 * The strip picks one day out of seven, which is the shape `choice-grid.tsx`
 * already has a pattern for: `radio` inside a `radiogroup`, with `selected` on
 * the chosen one. As seven buttons, TalkBack said "button, selected" and could
 * not say of how many - the same gap the avatar grid had, in the other
 * direction.
 */
describe('the strip as one choice out of seven', () => {
  it('offers its days as radios rather than as buttons', async () => {
    const { getAllByRole, queryAllByRole } = await renderStrip();

    expect(getAllByRole('radio')).toHaveLength(7);
    expect(queryAllByRole('button')).toHaveLength(0);
  });

  it('wraps them in a group, so the seven can be counted', async () => {
    const { getByTestId } = await renderStrip();

    expect(getByTestId('week-strip').props.accessibilityRole).toBe('radiogroup');
  });
});

describe('a day that has not arrived yet', () => {
  const HINT = 'Henüz gelmemiş bir güne kayıt eklenemez.';

  function renderWithToday(today: ISODate) {
    return render(
      <WeekStrip
        date={SUNDAY}
        onSelect={() => {}}
        weekdayLabels={LABELS}
        dayLabelFor={(d) => d}
        lastSelectableDate={today}
        unavailableHint={HINT}
      />
    );
  }

  /**
   * The week always shows seven, so up to six of them can be days that refuse
   * the tap. Announced as "disabled" and nothing else, they are up to six stops
   * that say a control exists and will not work, with no reason given - and the
   * reason is not guessable from a strip that looks like six identical days.
   */
  it('says why it cannot be chosen', async () => {
    // Thursday the 8th is the last selectable day, so Friday on are not.
    const { getByLabelText } = await renderWithToday('2026-10-08' as ISODate);

    expect(getByLabelText('2026-10-09').props.accessibilityHint).toBe(HINT);
  });

  it('puts no hint on a day that can be chosen', async () => {
    const { getByLabelText } = await renderWithToday('2026-10-08' as ISODate);

    expect(getByLabelText('2026-10-07').props.accessibilityHint).toBeUndefined();
    expect(getByLabelText('2026-10-08').props.accessibilityHint).toBeUndefined();
  });

  it('still says it is disabled, so the hint explains rather than replaces', async () => {
    const { getByLabelText } = await renderWithToday('2026-10-08' as ISODate);

    expect(getByLabelText('2026-10-09').props.accessibilityState?.disabled).toBe(true);
  });

  it('adds no hint at all when the caller gave none', async () => {
    // The component is handed its words; it does not invent them. A caller
    // with no last-selectable date has no unavailable days to explain.
    const { getByLabelText } = await renderStrip();

    expect(getByLabelText('2026-10-09').props.accessibilityHint).toBeUndefined();
  });
});
