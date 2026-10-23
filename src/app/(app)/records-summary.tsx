import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { observeCycleLengths } from '@/features/cycle/domain/observed-cycle-lengths';
import type { DailyLogHistory } from '@/features/daily-log/application/get-daily-log-history';
import { getDailyLogHistory } from '@/features/daily-log/application/get-daily-log-history';
import { PhaseBreakdownBar } from '@/features/daily-log/components/phase-breakdown-bar';
import type { PhaseCorrelation } from '@/features/daily-log/domain/symptom-phase-correlation';
import { MIN_ENTRIES_FOR_CORRELATION } from '@/features/daily-log/domain/symptom-phase-correlation';
import { mostLogged } from '@/features/daily-log/domain/most-logged';
import { dailyLogCatalogueLabels, labelFor } from '@/features/daily-log/presentation/daily-log-catalogues';
import { recordsSummaryMessages } from '@/features/daily-log/presentation/records-summary-messages';
import { useTheme } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';
import { logEvent } from '@/shared/logging';
import { openAppDatabase } from '@/storage/db';
import { getTodayLocalISODate } from '@/utils/today';

/**
 * What the records add up to, and nothing more than that.
 *
 * ## Why this is a pushed screen and not a fifth tab
 *
 * `shared/presentation/tabs.ts` says it outright: "A fifth tab is not a line in
 * this file — it is a fifth question the app claims to answer, and the thing
 * that makes a four-tab bar readable at a glance is that there are four." The
 * same file says where everything else goes: pushed on top, with its back
 * button, reached from the one place it belongs to. That place is the phase
 * panel in the History tab, which is the thing this screen is the long form of.
 *
 * ## Everything here was already being computed
 *
 * No new arithmetic about anybody's body. `correlatePhases` already returns the
 * full four-phase tally per id and the baseline tally alongside it;
 * `observeCycleLengths` already returns the median, the extremes, the spread
 * and the count it discarded. Both were computed on every visit to the History
 * tab and most of it was thrown away — the panel printed one sentence about the
 * largest phase and the rest went nowhere.
 *
 * ## Why showing more of it claims less
 *
 * That sentence — "12 of your 15 entries fell in the luteal phase" — is true,
 * and it is the most flattering reading available. It picks the phase with the
 * biggest count, says nothing about the other three, and does not mention that
 * the luteal phase is about half of a typical cycle. A reader has no way to
 * tell a real concentration from the shape of the calendar.
 *
 * Four counts against the baseline is strictly less of a claim: the comparison
 * is on the screen instead of in the arithmetic, and somebody can see for
 * themselves when a distribution is only describing a cycle. `expectedShare`
 * has encoded exactly that since the domain was written; this screen stops
 * keeping it a secret.
 *
 * ## What it refuses
 *
 * No word for how regular a cycle is — `build-cycle-outlook.ts` dropped
 * `assessCycleRegularity` because "a label reading 'irregular' beside it would
 * be the app telling somebody something about their body", and a screen headed
 * "summary" is where that label would creep back. No bar under five entries,
 * for the reason the domain uses five: the length of a bar is read as a
 * measurement. The disclaimer sits under everything, every time.
 */

/** The same five the domain uses, applied to what gets drawn rather than counted. */
const MIN_ENTRIES_FOR_BAR = MIN_ENTRIES_FOR_CORRELATION;

export default function RecordsSummaryScreen() {
  const theme = useTheme();
  const summary = useMessages(recordsSummaryMessages);
  const labels = useMessages(dailyLogCatalogueLabels);

  const [log, setLog] = useState<DailyLogHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const db = await openAppDatabase();
        const history = await getDailyLogHistory(db, getTodayLocalISODate());

        if (active) {
          setLog(history);
        }
      } catch (error: unknown) {
        logEvent('daily log history load failed', error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ActivityIndicator testID="records-summary-loading" color={theme.text} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const entries = log?.entries ?? [];
  const observations = log?.profile === null || log === null ? null : observeCycleLengths(log.profile);
  const hasPlacedDays = (log?.phased ?? []).some((day) => day.phase !== null);

  /** Rows worth a bar, and rows that are only a number. */
  const split = (correlations: readonly PhaseCorrelation[], kind: 'symptoms' | 'moods') => {
    const named = correlations
      .map((correlation) => ({
        correlation,
        label: labelFor(labels[kind], correlation.id),
      }))
      .filter(
        (row): row is { correlation: PhaseCorrelation; label: string } => row.label !== null
      );

    return {
      drawn: named.filter((row) => row.correlation.placedCount >= MIN_ENTRIES_FOR_BAR),
      counted: named.filter((row) => row.correlation.placedCount < MIN_ENTRIES_FOR_BAR),
    };
  };

  const symptoms = split(log?.symptomCorrelations ?? [], 'symptoms');
  const moods = split(log?.moodCorrelations ?? [], 'moods');

  const drawn = [...symptoms.drawn, ...moods.drawn];
  const counted = [...symptoms.counted, ...moods.counted];

  const flows = mostLogged(entries, (entry) => (entry.flowId === null ? [] : [entry.flowId]), 4);
  const topSymptoms = mostLogged(entries, (entry) => entry.symptomIds, 5);
  const topMoods = mostLogged(entries, (entry) => (entry.moodId === null ? [] : [entry.moodId]), 5);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <BackButton />

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle">
                {summary.screenTitle}
              </ThemedText>

              <ThemedText themeColor="textSecondary">{summary.screenDescription}</ThemedText>
            </View>

            {entries.length === 0 ? (
              <View style={styles.section}>
                <ThemedText accessibilityRole="header" type="smallBold">
                  {summary.emptyTitle}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  {summary.emptyNote}
                </ThemedText>
              </View>
            ) : (
              <>
                {/* The ground for everything below it, so it comes first. */}
                <View style={styles.section}>
                  <ThemedText accessibilityRole="header" type="smallBold">
                    {summary.baselineTitle}
                  </ThemedText>

                  {hasPlacedDays && log !== null ? (
                    <>
                      <PhaseBreakdownBar tally={log.placedDayTally} testID="baseline-bar" />

                      <ThemedText type="small" themeColor="textSecondary">
                        {summary.baselineNote}
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {summary.unplacedNote}
                    </ThemedText>
                  )}
                </View>

                {hasPlacedDays && (
                  <View style={styles.section}>
                    <ThemedText accessibilityRole="header" type="smallBold">
                    {summary.phaseBreakdownTitle}
                  </ThemedText>

                    {drawn.map((row) => (
                      <View key={row.correlation.id} style={styles.bar}>
                        {/* A heading, so the bars are something a screen
                            reader can jump between. Without it the screen is
                            one flat run and the only way to reach the fourth
                            symptom is to hear the first three. */}
                        <ThemedText accessibilityRole="header" type="small">
                          {summary.barHeading(row.label, row.correlation.placedCount)}
                        </ThemedText>

                        <PhaseBreakdownBar
                          tally={row.correlation.byPhase}
                          testID={`bar-${row.correlation.id}`}
                        />
                      </View>
                    ))}

                    {counted.length > 0 && (
                      <>
                        <ThemedText type="small" themeColor="textSecondary">
                          {summary.belowThresholdNote}
                        </ThemedText>

                        {counted.map((row) => (
                          <ThemedText key={row.correlation.id} type="small">
                            {summary.countOnly(row.label, row.correlation.placedCount)}
                          </ThemedText>
                        ))}
                      </>
                    )}
                  </View>
                )}

                <View style={styles.section}>
                  <ThemedText accessibilityRole="header" type="smallBold">
                    {summary.cycleLengthTitle}
                  </ThemedText>

                  {observations !== null &&
                  observations.medianDays !== null &&
                  observations.shortestDays !== null &&
                  observations.longestDays !== null &&
                  observations.spreadDays !== null ? (
                    <>
                      <ThemedText type="small">
                        {summary.cycleLengthMedian(observations.medianDays)}
                      </ThemedText>
                      <ThemedText type="small">
                        {summary.cycleLengthShortest(observations.shortestDays)}
                      </ThemedText>
                      <ThemedText type="small">
                        {summary.cycleLengthLongest(observations.longestDays)}
                      </ThemedText>
                      <ThemedText type="small">
                        {summary.cycleLengthSpread(observations.spreadDays)}
                      </ThemedText>

                      <ThemedText type="small" themeColor="textSecondary">
                        {summary.cycleLengthFrom(observations.lengths.length)}
                      </ThemedText>

                      {observations.discardedCount > 0 && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {summary.cycleLengthDiscarded(observations.discardedCount)}
                        </ThemedText>
                      )}
                    </>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {summary.cycleLengthNotEnough}
                    </ThemedText>
                  )}
                </View>

                {flows.length > 0 && (
                  <View style={styles.section}>
                    <ThemedText accessibilityRole="header" type="smallBold">
                    {summary.flowTitle}
                  </ThemedText>

                    {flows.map((flow) => {
                      const label = labelFor(labels.flows, flow.id);

                      return label === null ? null : (
                        <ThemedText key={flow.id} type="small">
                          {summary.countOnly(label, flow.count)}
                        </ThemedText>
                      );
                    })}
                  </View>
                )}

                <View style={styles.section}>
                  <ThemedText accessibilityRole="header" type="smallBold">
                    {summary.mostLoggedTitle}
                  </ThemedText>

                  {[...topSymptoms, ...topMoods].map((logged) => {
                    const label =
                      labelFor(labels.symptoms, logged.id) ?? labelFor(labels.moods, logged.id);

                    return label === null ? null : (
                      <ThemedText key={logged.id} type="small">
                        {summary.countOnly(label, logged.count)}
                      </ThemedText>
                    );
                  })}
                </View>
              </>
            )}

            {/* Under everything, whether or not anything above it had content:
                it is about what the screen is, not about any line on it. */}
            <ThemedText type="small" themeColor="textSecondary">
              {summary.disclaimer}
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  centeredArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.four },
  header: { gap: Spacing.two },
  section: { gap: Spacing.two },
  bar: { gap: Spacing.one },
});
