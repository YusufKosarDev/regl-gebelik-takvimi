import { act } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, Text } from 'react-native';

import { useMotionAllowed } from '../use-motion-allowed';

import { renderSettled } from '../../../jest/render-settled';

/**
 * The home screen's field drifts continuously, and for somebody with
 * vestibular sensitivity a background that never stops moving can make the
 * screen unusable. Android has a system setting that says so, and this is the
 * thing that reads it.
 *
 * Tested rather than trusted because the failure is invisible to everybody who
 * does not have the setting on: the app looks right in every review, on every
 * device in the room, and is unusable for the person who turned it on.
 *
 * Read through a one-line component rather than `renderHook`, which in this
 * version of the testing library returns a promise and a result shape that did
 * not report the hook's value.
 *
 * ## Everything here is awaited, and that is not decoration
 *
 * Eight of these nine tests failed while `emit` used a synchronous
 * `act(() => ...)`: the listener ran, `setReduceMotion` was called, and the
 * text did not change. The renderer is concurrent, so a synchronous `act` does
 * not flush the work it scheduled - the assertion reads the tree one render
 * too early and sees the value it started with. The same is true of
 * `unmount()`, which reported no listeners removed until it was awaited inside
 * `act` as well.
 *
 * The failure is worth naming because of how it reads: a test that asserts the
 * old value looks exactly like a hook that ignored the setting.
 */

function MotionProbe() {
  return <Text testID="motion">{useMotionAllowed() ? 'moving' : 'still'}</Text>;
}

const isReduceMotionEnabled = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
const addAccessibilityListener = AccessibilityInfo.addEventListener as jest.Mock;
const addAppStateListener = AppState.addEventListener as jest.Mock;

/**
 * Fires the listener the hook registered.
 *
 * Inside `act`, because the listener sets state and this stands in for the
 * system calling back into the app - which is exactly the case
 * `fail-on-act-warning` exists to make visible when it is unaccounted for.
 */
async function emit(mock: jest.Mock, event: string, value: unknown): Promise<void> {
  await act(async () => {
    for (const [name, listener] of mock.mock.calls) {
      if (name === event) {
        listener(value);
      }
    }
  });
}

function setForeground(state: string): void {
  (AppState as unknown as { currentState: string }).currentState = state;
}

beforeEach(() => {
  jest.clearAllMocks();

  isReduceMotionEnabled.mockResolvedValue(false);
  addAccessibilityListener.mockReturnValue({ remove: jest.fn() });
  addAppStateListener.mockReturnValue({ remove: jest.fn() });
  setForeground('active');
});

describe('when the system asks for less motion', () => {
  it('holds the field still', async () => {
    isReduceMotionEnabled.mockResolvedValue(true);

    const view = await renderSettled(<MotionProbe />);

    expect(view.getByTestId('motion')).toHaveTextContent('still');
  });

  it('stops as soon as the setting is turned on, without a restart', async () => {
    // Somebody turning this on is usually doing it *because* something on
    // screen is making them feel unwell. Waiting for the next launch is not an
    // answer.
    const view = await renderSettled(<MotionProbe />);
    expect(view.getByTestId('motion')).toHaveTextContent('moving');

    await emit(addAccessibilityListener, 'reduceMotionChanged', true);

    expect(view.getByTestId('motion')).toHaveTextContent('still');
  });

  it('starts again when it is turned back off', async () => {
    const view = await renderSettled(<MotionProbe />);

    await emit(addAccessibilityListener, 'reduceMotionChanged', true);
    expect(view.getByTestId('motion')).toHaveTextContent('still');

    await emit(addAccessibilityListener, 'reduceMotionChanged', false);
    expect(view.getByTestId('motion')).toHaveTextContent('moving');
  });
});

describe('when the setting cannot be read', () => {
  it('moves rather than guessing the other way', async () => {
    // The drift is the documented behaviour and the fallback either way. A
    // read that failed is not somebody asking for stillness.
    isReduceMotionEnabled.mockRejectedValue(new Error('unavailable'));

    const view = await renderSettled(<MotionProbe />);

    expect(view.getByTestId('motion')).toHaveTextContent('moving');
  });
});

describe('when the app is not in front', () => {
  it('holds still in the background', async () => {
    const view = await renderSettled(<MotionProbe />);
    expect(view.getByTestId('motion')).toHaveTextContent('moving');

    await emit(addAppStateListener, 'change', 'background');

    expect(view.getByTestId('motion')).toHaveTextContent('still');
  });

  it('moves again on the way back', async () => {
    const view = await renderSettled(<MotionProbe />);

    await emit(addAppStateListener, 'change', 'background');
    expect(view.getByTestId('motion')).toHaveTextContent('still');

    await emit(addAppStateListener, 'change', 'active');
    expect(view.getByTestId('motion')).toHaveTextContent('moving');
  });

  it('starts still when the app is launched into the background', async () => {
    setForeground('background');

    const view = await renderSettled(<MotionProbe />);

    expect(view.getByTestId('motion')).toHaveTextContent('still');
  });
});

describe('the two reasons together', () => {
  it('needs both before anything moves', async () => {
    // Coming back to the foreground must not restart a drift the accessibility
    // setting has asked to stop.
    isReduceMotionEnabled.mockResolvedValue(true);

    const view = await renderSettled(<MotionProbe />);
    expect(view.getByTestId('motion')).toHaveTextContent('still');

    await emit(addAppStateListener, 'change', 'background');
    await emit(addAppStateListener, 'change', 'active');

    expect(view.getByTestId('motion')).toHaveTextContent('still');
  });
});

describe('leaving the screen', () => {
  it('removes both listeners', async () => {
    const removeAccessibility = jest.fn();
    const removeAppState = jest.fn();

    addAccessibilityListener.mockReturnValue({ remove: removeAccessibility });
    addAppStateListener.mockReturnValue({ remove: removeAppState });

    const view = await renderSettled(<MotionProbe />);

    await act(async () => {
      view.unmount();
    });

    expect(removeAccessibility).toHaveBeenCalled();
    expect(removeAppState).toHaveBeenCalled();
  });
});
