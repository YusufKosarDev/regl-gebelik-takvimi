import { act, renderHook } from '@testing-library/react-native';
import type { LayoutChangeEvent, ScrollView, View } from 'react-native';

import { useRevealInView } from '../use-reveal-in-view';

/**
 * The reveal works once per panel, not once per screen.
 *
 * The one-shot flag exists so a panel that merely changes size - a
 * validation message appearing - does not drag the screen around. Its doc
 * always promised the flag clears when the panel unmounts; nothing did, so
 * the second opening of any panel on the same screen landed off-screen under
 * the tab bar - the very defect the hook was written against.
 */

function layout(height: number): LayoutChangeEvent {
  return { nativeEvent: { layout: { x: 0, y: 0, width: 320, height } } } as LayoutChangeEvent;
}

/** A panel the hook can measure: it sits at y=500 inside the scroller. */
function panelAt(y: number): View {
  return {
    measureLayout: (
      _scroller: unknown,
      onSuccess: (x: number, y: number) => void
    ) => {
      onSuccess(0, y);
    },
  } as unknown as View;
}

async function setUp() {
  const { result } = await renderHook(() => useRevealInView({ bottomInset: 48 }));

  const scrollTo = jest.fn();

  result.current.scrollViewProps.ref.current = { scrollTo } as unknown as ScrollView;

  await act(async () => {
    result.current.scrollViewProps.onLayout(layout(600));
  });

  return { result, scrollTo };
}

describe('one panel, opened twice', () => {
  it('reveals again after the panel went away', async () => {
    const { result, scrollTo } = await setUp();

    // First opening: below the fold, so it scrolls.
    await act(async () => {
      result.current.targetProps.ref(panelAt(500));
      result.current.targetProps.onLayout(layout(200));
    });

    expect(scrollTo).toHaveBeenCalledTimes(1);

    // Cancelled: the panel unmounts, which React reports as a null ref.
    await act(async () => {
      result.current.targetProps.ref(null);
    });

    // Second opening, same place.
    await act(async () => {
      result.current.targetProps.ref(panelAt(500));
      result.current.targetProps.onLayout(layout(200));
    });

    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it('still scrolls only once while the same panel merely changes size', async () => {
    const { result, scrollTo } = await setUp();

    await act(async () => {
      result.current.targetProps.ref(panelAt(500));
      result.current.targetProps.onLayout(layout(200));
      // A validation message appears; the panel grows.
      result.current.targetProps.onLayout(layout(260));
    });

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
