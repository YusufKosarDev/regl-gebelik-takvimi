import { Pressable, StyleSheet, View } from 'react-native';

import type { PhaseCorrelation } from '../domain/symptom-phase-correlation';
import { dailyLogCatalogueLabels, labelFor } from '../presentation/daily-log-catalogues';
import { dailyLogHistoryMessages } from '../presentation/daily-log-history-messages';
import { recordsSummaryMessages } from '../presentation/records-summary-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { cycleLabels, getCyclePhaseLabelIn } from '@/features/cycle/presentation/cycle-labels';
import { useMessages } from '@/i18n';

/**
 * Where the recorded symptoms and moods fell across the cycle.
 *
 * ## What it refuses to show
 *
 * Only rows the domain marked notable, which means at least five placed days
 * and a share that clearly beats the share that phase has of all the days.
 * Without the second test the list would fill with lines saying a symptom
 * happened mostly in the luteal phase, which is true of almost everything
 * because the luteal phase is almost half the cycle.
 *
 * When nothing clears that bar the component says so rather than rendering an
 * empty space, because a blank panel reads as the screen having failed.
 *
 * The disclaimer is below the list every time, including when the list is
 * empty: it is about what this panel is, not about any particular line in it.
 *
 * Stateless. The counts arrive already computed, and the only thing done here
 * is turning ids into words.
 */
export function PhaseCorrelationSummary({
  symptoms,
  moods,
  hasPlacedDays,
  hasPeriodRecords,
  onOpenSummary,
}: {
  readonly symptoms: readonly PhaseCorrelation[];
  readonly moods: readonly PhaseCorrelation[];
  readonly hasPlacedDays: boolean;
  /**
   * Whether a period record exists at all. With none, the unplaced message
   * asks for one; with one, asking again would blame a record that is right
   * there, so the message names the real cause - the days themselves.
   */
  readonly hasPeriodRecords: boolean;
  /**
   * Opens the long form of this panel, when a caller wants the link here.
   *
   * Optional so the panel can stay exactly as it was on the screen that did
   * not ask for a new control.
   */
  readonly onOpenSummary?: () => void;
}) {
  const history = useMessages(dailyLogHistoryMessages);
  const labels = useMessages(dailyLogCatalogueLabels);
  const phases = useMessages(cycleLabels);
  const summary = useMessages(recordsSummaryMessages);

  const notable = [...symptoms, ...moods].filter((correlation) => correlation.isNotable);

  const lines = notable.flatMap((correlation) => {
    // An id with no label is one that was retired and hidden; the day that
    // holds it is still real, but there is nothing to call it.
    const label =
      labelFor(labels.symptoms, correlation.id) ?? labelFor(labels.moods, correlation.id);

    if (label === null) {
      return [];
    }

    return [
      {
        id: correlation.id,
        text: history.summaryLine(
          label,
          correlation.dominantCount,
          correlation.placedCount,
          getCyclePhaseLabelIn(phases, correlation.dominantPhase)
        ),
      },
    ];
  });

  return (
    <View style={styles.summary}>
      <ThemedText accessibilityRole="header" type="smallBold">
        {history.summaryTitle}
      </ThemedText>

      {!hasPlacedDays ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hasPeriodRecords ? history.summaryUnplacedWithRecords : history.summaryUnplaced}
        </ThemedText>
      ) : lines.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {history.summaryNothingNotable}
        </ThemedText>
      ) : (
        lines.map((line) => (
          <ThemedText key={line.id} type="small">
            {line.text}
          </ThemedText>
        ))
      )}

      <ThemedText type="small" themeColor="textSecondary">
        {history.summaryDisclaimer}
      </ThemedText>

      {/* Only where a caller wired it.
          The link belongs to this panel — the summary screen is its long form —
          but this component is rendered on two screens, and adding a control to
          both would put one on a screen nobody asked to change. `cycle-arc.tsx`
          records what that costs: five tests pinned the exact list of controls
          on a screen, and a new one entered all five. So the callback is
          optional and the History tab is the only place that passes it. */}
      {onOpenSummary !== undefined && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={summary.openLabel}
          onPress={onOpenSummary}
          style={({ pressed }) => [styles.open, pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="primary">
            {summary.openLabel}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: Spacing.two,
  },
  open: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
