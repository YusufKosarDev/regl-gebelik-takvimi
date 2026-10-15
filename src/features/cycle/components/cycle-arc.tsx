import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { CycleRingDot } from '../application/build-cycle-day-ring';
import { arcDayAt, arcPoints } from '../presentation/arc-day-at';
import { homeMessages } from '../presentation/home-messages';

import { useFontScale } from '@/hooks/use-font-scale';
import { useMessages } from '@/i18n';

/**
 * The month as an arc you can drag through.
 *
 * ## This is the primary interaction, and that is the point
 *
 * The ring it replaces was deliberately not pressable, and the reason written
 * in its own source was that five tests pinned the exact list of controls on a
 * screen and a pressable ring would have entered all five. That is a test
 * fixture deciding what the product does. Every serious app in this category
 * makes the circle the thing you touch; ours forbade it to protect an
 * assertion.
 *
 * ## Why it did nothing on a phone, and what fixed it
 *
 * The first version rendered, looked roughly right, and ignored every touch.
 * Nothing appeared in logcat. Two faults, and only the second is interesting:
 *
 * **The geometry put most of the arc outside its own box.** A circle wide
 * enough for 28 days reached 310dp either side of a 393dp screen and 166dp down
 * a 72dp container with `overflow: 'hidden'`, so about a third of the dots were
 * clipped and the visible ones were not where the hit-test thought. That is now
 * a parabola sized by the box - see `arc-day-at.ts`.
 *
 * **The callbacks ran on the wrong thread.** `GestureDetector` turns its
 * callbacks into worklets, so `.onUpdate` runs on the UI thread. It was calling
 * `dayAt`, an ordinary JavaScript closure, which cannot be called from there.
 * The failure is silent: no red box, no warning, the gesture simply never
 * reports anything.
 *
 * `.runOnJS(true)` is the fix rather than workletising the arithmetic, and it
 * is the right one here rather than the easy one: every one of these callbacks
 * exists to set React state. Scrubbing changes the day, which changes the
 * field, the number, the phase and the sentence - all React renders. There is
 * nothing for the UI thread to do that it would not immediately have to hand
 * back.
 *
 * ## Why no SVG
 *
 * `react-native-svg` is still not a dependency. Each dot is a `View` placed
 * from the parabola, which needs nothing new.
 */

/** How far the ends of the arc hang below its middle. */
const SAG = 34;

/** The biggest dot, which the box has to leave room for. */
const SELECTED_DOT = 16;

export function CycleArc({
  dots,
  selectedDay,
  onScrub,
  onScrubEnd,
  tint,
  dimTint,
  testID,
}: {
  readonly dots: readonly CycleRingDot[];
  /** The day the thumb sits on, which is today until somebody drags. */
  readonly selectedDay: number;
  readonly onScrub: (day: number) => void;
  /** Fired once when the finger lifts, so a caller can settle or snap back. */
  readonly onScrubEnd: () => void;
  readonly tint: string;
  readonly dimTint: string;
  readonly testID?: string;
}) {
  const scale = useFontScale();
  const home = useMessages(homeMessages);

  /**
   * The arc box's own width, measured.
   *
   * It used to take the window width, and the box is narrower than the window
   * - the hero pads it by sixteen points each side. So the dots were laid out
   * for a box wider than the one they were drawn in, which pushed the right
   * end past the edge and left the selected dot at the left end half off the
   * screen.
   *
   * Worse and less visible: a gesture reports `event.x` relative to the
   * component, so the hit-test was reading a component-space x against a
   * window-space track. Near the ends that is about a day out. Measuring the
   * box puts the drawing and the hit-test back in one coordinate space.
   */
  const [width, setWidth] = useState(0);

  // Tall enough for the curve, the biggest dot and a margin, and capped so a
  // large font setting does not give the arc half the screen.
  const sag = SAG * Math.min(scale, 1.3);
  const height = Math.round(sag + SELECTED_DOT * 2);

  const points = useMemo(
    () => arcPoints({ width, dayCount: dots.length, sag }),
    [width, dots.length, sag]
  );

  const dayAt = useCallback(
    (x: number) => {
      const index = arcDayAt({ x, width, dayCount: dots.length });

      return index === null ? selectedDay : dots[index].day;
    },
    [dots, width, selectedDay]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Every callback here sets React state, so there is nothing to gain
        // from the UI thread - and calling `dayAt` from a worklet is what made
        // the first version do nothing at all.
        .runOnJS(true)
        // Claims the drag before the scroll view does, so a sideways pull on
        // the arc scrubs instead of fighting the page. Small, because the arc
        // is short and a scrub is a deliberate sideways movement.
        .activeOffsetX([-4, 4])
        // And gives the page back a clearly vertical drag, so the screen still
        // scrolls when somebody swipes up over the arc.
        .failOffsetY([-12, 12])
        .onBegin((event) => {
          onScrub(dayAt(event.x));
        })
        .onUpdate((event) => {
          onScrub(dayAt(event.x));
        })
        .onFinalize(() => {
          onScrubEnd();
        }),
    [dayAt, onScrub, onScrubEnd]
  );

  return (
    <GestureDetector gesture={pan}>
      <View
        testID={testID}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        // Reaches above and below the drawn curve. A scrubber wants more than
        // the 48 points a button needs, and the dots themselves are 6 points
        // across - nobody is expected to hit one.
        hitSlop={{ top: 16, bottom: 16, left: 0, right: 0 }}
        style={[styles.root, { height }]}
        accessibilityRole="adjustable"
        // The same words the summary row uses, so the screen reader does not
        // switch language on the one element that was hardcoded English.
        accessibilityLabel={`${home.rowCycleDay} ${selectedDay}`}
        accessibilityValue={{ min: 1, max: dots.length, now: selectedDay }}
        // An "adjustable" promises these two to TalkBack/VoiceOver; without
        // them the role announces a slider that no swipe can move. Stepping
        // walks the dots array rather than adding one to the day, so it stays
        // right even if days ever stop being 1..n. `onScrubEnd` is deliberately
        // not fired: on the home screen it snaps the preview back to today,
        // which would undo the step the moment it was announced.
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const step =
            event.nativeEvent.actionName === 'increment'
              ? 1
              : event.nativeEvent.actionName === 'decrement'
                ? -1
                : 0;

          if (step === 0) {
            return;
          }

          const index = dots.findIndex((dot) => dot.day === selectedDay);
          const neighbour = index === -1 ? undefined : dots[index + step];

          if (neighbour !== undefined) {
            onScrub(neighbour.day);
          }
        }}>
        {points.map((point, index) => {
          const dot = dots[index];
          const isSelected = dot.day === selectedDay;
          const size = isSelected ? SELECTED_DOT : dot.isToday ? 10 : 6;

          return (
            <View
              key={dot.day}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.dot,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  left: point.left - size / 2,
                  top: SELECTED_DOT + point.top - size / 2,
                  backgroundColor: dot.isElapsed || isSelected ? tint : dimTint,
                  opacity: isSelected ? 1 : dot.isElapsed ? 0.85 : 0.4,
                },
              ]}
            />
          );
        })}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    // Never squeezed. The hero is a fixed-height box and the sentence above can
    // run to four lines; without this the arc is what gives way, and it gave
    // way to fourteen points of its sixty-six - a touch target too small to
    // hit, which is why the first fix to the gesture changed nothing.
    flexShrink: 0,
    // Not hidden. The parabola is sized to the box, so there is nothing to clip
    // - and clipping is what hid two thirds of the first version.
    overflow: 'visible',
  },
  dot: {
    position: 'absolute',
  },
});
