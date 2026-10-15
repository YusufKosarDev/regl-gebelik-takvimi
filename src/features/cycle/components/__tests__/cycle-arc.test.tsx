import { fireEvent, render } from '@testing-library/react-native';

import type { CycleRingDot } from '../../application/build-cycle-day-ring';
import { CycleArc } from '../cycle-arc';

/**
 * The arc's geometry and gesture arithmetic live in `arc-day-at.ts` and are
 * tested there. What is tested here is what the arc is to somebody who cannot
 * see it or cannot drag it: a labelled, adjustable thing whose label speaks
 * the interface's language and whose increment/decrement actions actually
 * move the day.
 */

function dotsOf(count: number, elapsed: number): CycleRingDot[] {
  return Array.from({ length: count }, (_, index) => ({
    day: index + 1,
    phase: index < elapsed ? 'luteal' : null,
    isElapsed: index < elapsed,
    isToday: index === elapsed - 1,
  }));
}

function renderArc({
  selectedDay = 14,
  onScrub = jest.fn(),
  onScrubEnd = jest.fn(),
}: {
  selectedDay?: number;
  onScrub?: jest.Mock;
  onScrubEnd?: jest.Mock;
} = {}) {
  return render(
    <CycleArc
      dots={dotsOf(28, 17)}
      selectedDay={selectedDay}
      onScrub={onScrub}
      onScrubEnd={onScrubEnd}
      tint="#102030"
      dimTint="#405060"
      testID="cycle-arc"
    />
  );
}

describe('what the arc says', () => {
  it('describes itself in the catalogue language, not hardcoded English', async () => {
    // The label used to be the literal string `Cycle day ${day}` while every
    // other word on the screen came from the catalogue - so a Turkish phone
    // heard the one interactive element on the screen in English. The words
    // are `rowCycleDay`, the same entry the summary row already uses.
    const { getByLabelText } = await renderArc({ selectedDay: 14 });

    expect(getByLabelText('Döngü günü 14')).toBeTruthy();
  });
});

describe('adjusting without a drag', () => {
  it('moves one day forward on increment', async () => {
    const onScrub = jest.fn();
    const onScrubEnd = jest.fn();
    const { getByTestId } = await renderArc({ selectedDay: 14, onScrub, onScrubEnd });

    await fireEvent(getByTestId('cycle-arc'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });

    expect(onScrub).toHaveBeenCalledWith(15);
    // `onScrubEnd` snaps the preview back to today on the home screen, so an
    // action that fired it would announce the new day and instantly undo it.
    expect(onScrubEnd).not.toHaveBeenCalled();
  });

  it('moves one day back on decrement', async () => {
    const onScrub = jest.fn();
    const { getByTestId } = await renderArc({ selectedDay: 14, onScrub });

    await fireEvent(getByTestId('cycle-arc'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });

    expect(onScrub).toHaveBeenCalledWith(13);
  });

  it('stops at the last day instead of wrapping', async () => {
    const onScrub = jest.fn();
    const { getByTestId } = await renderArc({ selectedDay: 28, onScrub });

    await fireEvent(getByTestId('cycle-arc'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });

    expect(onScrub).not.toHaveBeenCalled();
  });

  it('stops at day one instead of wrapping', async () => {
    const onScrub = jest.fn();
    const { getByTestId } = await renderArc({ selectedDay: 1, onScrub });

    await fireEvent(getByTestId('cycle-arc'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });

    expect(onScrub).not.toHaveBeenCalled();
  });

  it('ignores an action it never declared', async () => {
    const onScrub = jest.fn();
    const { getByTestId } = await renderArc({ selectedDay: 14, onScrub });

    await fireEvent(getByTestId('cycle-arc'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(onScrub).not.toHaveBeenCalled();
  });
});
