import { StyleSheet, View } from 'react-native';

import type { PhaseTally } from '../domain/symptom-phase-correlation';
import { recordsSummaryMessages } from '../presentation/records-summary-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { CyclePhase } from '@/features/cycle/domain/phases';
import { CYCLE_PHASES } from '@/features/cycle/domain/phases';
import { cycleLabels, getCyclePhaseLabelIn } from '@/features/cycle/presentation/cycle-labels';
import { useCyclePhaseColors } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';

/**
 * One tally of days, drawn as a stacked bar with every count written out.
 *
 * ## Plain `View`s, like everything else that draws here
 *
 * No SVG and no chart library, because the app has neither and this does not
 * need one. The avatar is rectangles with corner radii and the cycle arc is
 * dots placed along a parabola; a stacked bar is four rectangles in a row, so
 * it is the one chart shape the house technique draws natively. A line chart
 * would need `react-native-svg` — a native module, in the prebuild and in the
 * Android build — and there is nothing here a line would say better.
 *
 * ## Why every count is also written down
 *
 * `phase-palette-distinctness.test.ts` measured the four phase accents: the
 * closest pair sits at a contrast ratio of 1.17, so the four are told apart by
 * hue far more than by lightness. Somebody who cannot separate those hues sees
 * one bar. `sky.ts` reached the same conclusion about the calendar and said
 * what to do — "the calendar also keeps its letters and shapes" — so the bar is
 * never the only carrier: each phase's count is in the legend beneath it.
 *
 * All four phases are listed, including the ones at zero. A phase that holds
 * none of the days is information, and leaving it out would make the reader
 * work out which of the four is missing.
 *
 * ## The legend is drawn for the eye and hidden from a screen reader
 *
 * That argument is entirely about *seeing*: the legend exists because four
 * hues are not a reliable channel. A screen reader is not reading hues — it is
 * reading the bar's own label, which already carries all four counts.
 *
 * With both in the tree every count was announced twice, once from the bar's
 * sentence and once from the legend's text: six stops per bar where two do,
 * and on the records summary that is the baseline plus one per symptom. So the
 * legend stays exactly as drawn and is marked hidden, leaving one spoken stop
 * per bar with the four counts together — which is the form that matches what
 * the screen is for. A reader is here to compare a distribution against the
 * baseline, and four numbers in one breath are comparable in a way four
 * separate stops are not.
 *
 * The bar takes `image` for its role. Without one it was an `accessible` View
 * with a label, which TalkBack reads out as though it were a line of the page;
 * `image` is what `AvatarPreview` uses for the other drawn graphic with a
 * spoken description, and it tells the listener that what they are hearing
 * describes a picture.
 */

/**
 * How tall the bar is, and therefore how narrow a segment may be.
 *
 * The two are one decision: a segment thinner than the bar is tall stops
 * reading as a block of the bar and starts reading as a line drawn on it.
 */
export const BAR_HEIGHT = 14;

/**
 * The narrowest this bar gets, used to turn that rule into a fraction.
 *
 * A 320dp phone, less the screen's own padding on both sides and the card's.
 * Measured against this rather than against a comfortable width, because the
 * small screen is the one where a sliver disappears.
 */
export const NARROW_BAR_WIDTH = 240;

/** A segment is never thinner than the bar is tall. */
export const MIN_SEGMENT_FRACTION = BAR_HEIGHT / NARROW_BAR_WIDTH;

export type BarSegment = {
  readonly phase: CyclePhase;
  readonly count: number;
  /** Of the bar's width, already floored and renormalised. Sums to 1. */
  readonly fraction: number;
};

/**
 * The widths to draw, with the thin ones widened and the wide ones paying for
 * it.
 *
 * Presentation arithmetic, not a statistic: it turns counts into widths and
 * knows nothing about cycles. The honest cost of the floor is that a segment
 * at the floor is wider than its share — which is why the count is written out
 * beside it, and why the reader is never asked to measure a bar by eye.
 *
 * Phases holding no days get no segment at all rather than a zero-width one,
 * so nothing invisible is in the tree pretending to be drawn.
 */
export function barSegments(tally: PhaseTally): readonly BarSegment[] {
  const total = CYCLE_PHASES.reduce((sum, phase) => sum + tally[phase], 0);

  if (total === 0) {
    return [];
  }

  const drawn = CYCLE_PHASES.filter((phase) => tally[phase] > 0).map((phase) => ({
    phase,
    count: tally[phase],
    share: tally[phase] / total,
  }));

  const deficit = drawn.reduce(
    (sum, segment) => sum + Math.max(0, MIN_SEGMENT_FRACTION - segment.share),
    0
  );
  const surplus = drawn.reduce(
    (sum, segment) => sum + Math.max(0, segment.share - MIN_SEGMENT_FRACTION),
    0
  );

  return drawn.map(({ phase, count, share }) => {
    if (share <= MIN_SEGMENT_FRACTION || surplus === 0) {
      return { phase, count, fraction: MIN_SEGMENT_FRACTION };
    }

    const excess = share - MIN_SEGMENT_FRACTION;

    return {
      phase,
      count,
      fraction: MIN_SEGMENT_FRACTION + excess - deficit * (excess / surplus),
    };
  });
}

export function PhaseBreakdownBar({
  tally,
  testID,
}: {
  readonly tally: PhaseTally;
  readonly testID?: string;
}) {
  const colours = useCyclePhaseColors();
  const phases = useMessages(cycleLabels);
  const summary = useMessages(recordsSummaryMessages);

  const segments = barSegments(tally);

  const spoken = CYCLE_PHASES.map((phase) =>
    summary.phaseCount(getCyclePhaseLabelIn(phases, phase), tally[phase])
  ).join(', ');

  return (
    <View testID={testID}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={spoken}
        style={styles.bar}>
        {segments.map((segment) => (
          <View
            key={segment.phase}
            testID={testID === undefined ? undefined : `${testID}-${segment.phase}`}
            style={{
              width: `${segment.fraction * 100}%`,
              backgroundColor: colours[`${segment.phase}Accent`],
            }}
          />
        ))}
      </View>

      {/* Every phase, including the empty ones: the text is the channel that
          does not depend on telling four hues apart — which is a channel for
          the eye. The bar above already speaks all four counts, so repeating
          them here would announce every number twice. */}
      <View
        testID={testID === undefined ? undefined : `${testID}-legend`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.legend}>
        {CYCLE_PHASES.map((phase) => (
          <View key={phase} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: colours[`${phase}Accent`] }]} />
            <ThemedText type="small" themeColor="textSecondary">
              {summary.phaseCount(getCyclePhaseLabelIn(phases, phase), tally[phase])}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
