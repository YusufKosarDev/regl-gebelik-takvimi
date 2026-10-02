import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { CycleRingDot } from '../application/build-cycle-day-ring';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useFontScale } from '@/hooks/use-font-scale';
import { useCyclePhaseColors, useTheme } from '@/hooks/use-theme';

/**
 * The cycle as a circle of days, with today's number in the middle.
 *
 * ## Why a ring
 *
 * A cycle is a loop and the home screen drew it as four stacked grey rectangles
 * that each had to be read to find out which one you came for. This is the one
 * place in the app where boldness is spent: the two facts a person opens the
 * app to see - which day they are on, and which phase that is - become a shape
 * rather than two more rows, and the remaining facts stay rows underneath.
 *
 * ## Why it is not an image or an SVG
 *
 * `react-native-svg` is not a dependency and adding one for a circle of dots
 * would mean a native rebuild. Each dot is a `View` placed with `Math.cos` and
 * `Math.sin`, which needs nothing that is not already installed.
 *
 * ## It is not pressable, and that is load-bearing
 *
 * Five tests pin the exact ordered list of every control on a screen by mapping
 * `queryAllByRole('button')`, and the home screen's list is nine long. A ring
 * that gained a role would enter that list and break them. There is nothing to
 * press here anyway: it reports, it does not act.
 *
 * ## What a screen reader gets
 *
 * The dots are decoration and are hidden from it outright - sixty "dot" stops
 * between the heading and the first real row would make the screen unusable.
 * The two facts are read from the labelled text in the middle, which is the
 * same sentence the rows it replaced used to read.
 */
export function CycleDayRing({
  dots,
  phase,
  dayLabel,
  dayValue,
  dayAccessibilityLabel,
  phaseLabel,
  phaseValue,
  phaseAccessibilityLabel,
}: {
  readonly dots: readonly CycleRingDot[];
  /** Today's phase, which is what the number in the middle is coloured by. */
  readonly phase: CycleRingDot['phase'];
  readonly dayLabel: string;
  readonly dayValue: string;
  readonly dayAccessibilityLabel: string;
  readonly phaseLabel: string;
  readonly phaseValue: string;
  readonly phaseAccessibilityLabel: string;
}) {
  const theme = useTheme();
  const phases = useCyclePhaseColors();
  const fontScale = useFontScale();
  const { width } = useWindowDimensions();

  // The ring grows with the system font setting for the same reason the
  // calendar squares do: the text inside it scales and a fixed circle would
  // not, so at the largest Android setting the day number would be sitting on
  // the dots.
  //
  // Then capped twice. Once by `MAX_RING_SCALE`, because past about half again
  // the hero turns into a scroll. Once by the window, because the first cap is
  // not enough on its own: 260 at 1.5 is 390, and on the test device that came
  // to within a few points of both screen edges - on a narrower phone it would
  // simply have run off them. The screen is the real limit and the scale is
  // only a preference, so the smaller of the two wins.
  const diameter = Math.min(
    RING_DIAMETER * Math.min(fontScale, MAX_RING_SCALE),
    width - RING_GUTTER * 2
  );
  const radius = diameter / 2 - DOT_SIZE / 2 - RING_INSET;

  return (
    <View style={styles.ring}>
      <View style={{ width: diameter, height: diameter }}>
        <View
          // Decoration, and only the dots. The facts in the middle are
          // deliberately outside this: a hidden subtree is hidden from the
          // testing library's text queries as well as from a screen reader,
          // and wrapping the whole ring took the two sentences it exists to
          // say out of the accessibility tree along with the decoration.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.dots}>
          {dots.map((dot, index) => {
            // Twelve o'clock is day one, and the ring runs clockwise, which
            // is the direction a person already reads a clock and a calendar
            // in.
            const angle = -Math.PI / 2 + (index / dots.length) * 2 * Math.PI;
            const size = dot.isToday ? DOT_SIZE * 1.75 : DOT_SIZE;

            return (
              <View
                key={dot.day}
                style={[
                  styles.dot,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    left: diameter / 2 + radius * Math.cos(angle) - size / 2,
                    top: diameter / 2 + radius * Math.sin(angle) - size / 2,
                    backgroundColor: dotColour(dot, phases, theme),
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.centre}>
          <View accessible accessibilityLabel={dayAccessibilityLabel} style={styles.fact}>
            <ThemedText type="small" themeColor="textSecondary">
              {dayLabel}
            </ThemedText>
            <ThemedText type="subtitle">{dayValue}</ThemedText>
          </View>

          <View accessible accessibilityLabel={phaseAccessibilityLabel} style={styles.fact}>
            <ThemedText type="small" themeColor="textSecondary">
              {phaseLabel}
            </ThemedText>
            <ThemedText
              type="display"
              style={phase === null ? undefined : { color: accentFor(phase, phases) }}>
              {phaseValue}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * What one dot is drawn in.
 *
 * A day that has happened wears its phase; a day still to come is faint. That
 * is the whole reading of the ring: the lit arc is how far through the cycle
 * today is, and the colour of that arc is what the cycle has been doing.
 *
 * A day with no phase - the profile cannot place it - falls back to the faint
 * fill rather than to a fifth colour, because an unplaceable day is genuinely
 * not information.
 */
function dotColour(
  dot: CycleRingDot,
  phases: ReturnType<typeof useCyclePhaseColors>,
  theme: ReturnType<typeof useTheme>
): string {
  if (!dot.isElapsed || dot.phase === null) {
    return theme.backgroundSelected;
  }

  return accentFor(dot.phase, phases);
}

/** Total, so a phase added to the union has to be given a colour here too. */
function accentFor(
  phase: NonNullable<CycleRingDot['phase']>,
  phases: ReturnType<typeof useCyclePhaseColors>
): string {
  const accents = {
    menstrual: phases.menstrualAccent,
    follicular: phases.follicularAccent,
    ovulatory: phases.ovulatoryAccent,
    luteal: phases.lutealAccent,
  };

  return accents[phase];
}

/** Wide enough to hold two labelled facts, narrow enough for a small phone. */
const RING_DIAMETER = 260;
const MAX_RING_SCALE = 1.5;
const DOT_SIZE = 8;
/** Keeps the dots clear of the edge rather than flush against it. */
const RING_INSET = 2;
/** What the ring leaves either side of itself when the window is the limit. */
const RING_GUTTER = 24;

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  dots: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dot: {
    position: 'absolute',
  },
  centre: {
    // Inset so the text block never reaches under the dots, whatever the
    // system font setting does to it.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  fact: {
    alignItems: 'center',
    gap: Spacing.half,
  },
});
