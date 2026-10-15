import { useCallback, useRef } from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
} from 'react-native';

import { useMotionAllowed } from './use-motion-allowed';

import { scrollOffsetToReveal } from '@/shared/presentation/reveal-in-view';

/**
 * Brings a panel that has just opened far enough up the screen to be used.
 *
 * ## What it is for
 *
 * Six confirmations in this app open in place rather than in a modal. Nothing
 * scrolled, so one opening near the bottom of a screen opened off it. On the
 * two destructive ones that meant a heading saying a deletion was under way,
 * with the confirm, the cancel and - on the account screen - the password
 * field all below the fold.
 *
 * ## Why a hook rather than a component
 *
 * The six share nothing: two are written inline in a screen and four are
 * components, and merging them is a larger change than the defect warrants.
 * What they can all take is two prop spreads, one on the scroll view and one
 * on the panel, which is what this returns.
 *
 * ## Reduced motion
 *
 * The scroll jumps instead of animating when the system setting is on, and
 * still happens. `use-motion-allowed.ts` sets the precedent in as many words:
 * the setting "makes every transition instant. Nothing is lost except the
 * motion." Not scrolling at all would lose the thing itself - somebody who
 * turned off animations still has to be able to reach a cancel button.
 *
 * ## The measurement, which is the part only a device can confirm
 *
 * `measureLayout` against the scroll view reports the panel's position in the
 * scroll view's own coordinate space - that is, relative to what is on screen
 * rather than to the top of the content - so the current offset is added back
 * to get a content coordinate for `scrollOffsetToReveal`. That conversion is
 * the one assumption here that Jest cannot check, and it is why the outcome of
 * this is on the device-check list rather than pinned by a test asserting
 * `scrollTo` was called.
 *
 * A measurement that fails scrolls nothing. Guessing an offset would move the
 * screen for no reason, which is the defect this exists to avoid creating.
 */
export type RevealInView = {
  readonly scrollViewProps: {
    readonly ref: React.RefObject<ScrollView | null>;
    readonly onLayout: (event: LayoutChangeEvent) => void;
    readonly onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    readonly scrollEventThrottle: number;
  };
  /** Spread onto the panel, or onto a `View` wrapping the component that is one. */
  readonly targetProps: {
    /**
     * A callback rather than a ref object, because the unmount matters:
     * React calls it with `null` when the panel goes away, and that is the
     * moment the one-shot flag below has always promised to clear.
     */
    readonly ref: (node: View | null) => void;
    readonly onLayout: (event: LayoutChangeEvent) => void;
  };
};

export function useRevealInView(options: { readonly bottomInset: number }): RevealInView {
  const { bottomInset } = options;

  const scrollRef = useRef<ScrollView | null>(null);
  const targetRef = useRef<View | null>(null);
  const viewportHeight = useRef(0);
  const scrollOffset = useRef(0);

  /**
   * Whether this panel has already been brought into view.
   *
   * `onLayout` fires again whenever the panel changes size - a validation
   * message appearing, a field growing at a large font setting - and scrolling
   * on each of those would drag the screen out from under somebody who is
   * typing. The ref is cleared when the panel unmounts, so the next time one
   * opens it reveals again.
   */
  const hasRevealed = useRef(false);

  /**
   * Holds the panel and, on `null`, clears the one-shot flag.
   *
   * This is the half the doc above promised and the code never had: without
   * it, the flag survived the panel, and the second opening of any panel on
   * the same screen landed off-screen under the tab bar — the very defect
   * the hook was written against.
   */
  const setTargetRef = useCallback((node: View | null) => {
    targetRef.current = node;

    if (node === null) {
      hasRevealed.current = false;
    }
  }, []);

  const motionAllowed = useMotionAllowed();

  const onScrollViewLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
  }, []);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  const onTargetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;

      if (hasRevealed.current) return;

      const scroller = scrollRef.current;
      const target = targetRef.current;

      if (scroller === null || target === null || viewportHeight.current === 0) return;

      hasRevealed.current = true;

      target.measureLayout(
        scroller as unknown as View,
        (_x, y) => {
          const offset = scrollOffsetToReveal({
            panelTop: y + scrollOffset.current,
            panelHeight: height,
            viewportHeight: viewportHeight.current,
            scrollOffset: scrollOffset.current,
            bottomInset,
          });

          if (offset === null) return;

          scrollRef.current?.scrollTo({ y: offset, animated: motionAllowed });
        },
        () => {
          // Measuring failed, so there is no destination. Letting it try again
          // on the next layout is better than scrolling somewhere invented.
          hasRevealed.current = false;
        }
      );
    },
    [bottomInset, motionAllowed]
  );

  return {
    scrollViewProps: {
      ref: scrollRef,
      onLayout: onScrollViewLayout,
      onScroll,
      scrollEventThrottle: 16,
    },
    targetProps: { ref: setTargetRef, onLayout: onTargetLayout },
  };
}
