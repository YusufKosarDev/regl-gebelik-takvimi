import { render } from '@testing-library/react-native';

import { CycleCalendarSection } from '../cycle-calendar-section';

import { buildCycleCalendarMonth } from '@/features/cycle/application/build-cycle-calendar-month';
import type { CycleProfile } from '@/features/cycle/domain/types';
import { buildCycleCalendarGrid } from '@/features/cycle/presentation/build-cycle-calendar-grid';
import { homeMessages } from '@/features/cycle/presentation/home-messages';
import type { ISODate } from '@/types/iso-date';

/**
 * Why a month arrow at the edge of the calendar's range refuses.
 *
 * The screen test cannot reach this: September 2026 has a month on either side
 * of it, and the edge is years away. So the component is rendered with the flag
 * the screen computes from `canShiftYearMonth`, which is the only thing that
 * decides it.
 *
 * The rule is the one `accessibility-hints.test.ts` records: a hint is for what
 * the label cannot say, and on Android it cannot be turned off. A disabled
 * arrow announces itself as disabled and stops there, and nothing on the screen
 * says how far the calendar goes - so the hint is on the arrow that refuses and
 * on no other.
 */

jest.mock('expo-router', () => require('../../../../../jest/expo-router-mock'));

const profile: CycleProfile = {
  settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
  periodRecords: [{ id: 'r0', startDate: '2026-09-01' as ISODate, isOngoing: false }],
};

const grid = buildCycleCalendarGrid(buildCycleCalendarMonth(profile, 2026, 9));

function renderSection(bounds: { canGoBack: boolean; canGoForward: boolean }) {
  return render(
    <CycleCalendarSection
      today={'2026-09-17' as ISODate}
      monthHeading="Eylül 2026"
      canGoBack={bounds.canGoBack}
      canGoForward={bounds.canGoForward}
      setMonthOffset={() => {}}
      calendarGrid={grid}
      selectedDay={null}
      setPickedDate={() => {}}
      pickedEntry={null}
      headerField={['#000000', '#111111', '#222222']}
    />
  );
}

describe('an arrow at the edge of the range', () => {
  it('says what the edge is', async () => {
    const { getByLabelText } = await renderSection({ canGoBack: false, canGoForward: true });

    expect(
      getByLabelText(homeMessages.tr.calendarPreviousMonthLabel).props.accessibilityHint
    ).toBe(homeMessages.tr.calendarMonthLimitHint);
  });

  it('says it on the forward arrow too', async () => {
    const { getByLabelText } = await renderSection({ canGoBack: true, canGoForward: false });

    expect(getByLabelText(homeMessages.tr.calendarNextMonthLabel).props.accessibilityHint).toBe(
      homeMessages.tr.calendarMonthLimitHint
    );
  });
});

describe('an arrow that still works', () => {
  it('carries no hint, on either side', async () => {
    const { getByLabelText } = await renderSection({ canGoBack: true, canGoForward: true });

    for (const label of [
      homeMessages.tr.calendarPreviousMonthLabel,
      homeMessages.tr.calendarNextMonthLabel,
    ]) {
      expect([label, getByLabelText(label).props.accessibilityHint]).toEqual([label, undefined]);
    }
  });

  it('carries none on the one that works while the other is at the edge', async () => {
    const { getByLabelText } = await renderSection({ canGoBack: false, canGoForward: true });

    expect(
      getByLabelText(homeMessages.tr.calendarNextMonthLabel).props.accessibilityHint
    ).toBeUndefined();
  });
});
