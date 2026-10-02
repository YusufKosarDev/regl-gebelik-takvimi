import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { buildCycleCalendarGridForMonth } from '@/features/cycle/application/build-cycle-calendar-grid-for-month';
import type { DailyLogHistory } from '@/features/daily-log/application/get-daily-log-history';
import { getDailyLogHistory } from '@/features/daily-log/application/get-daily-log-history';
import { EntryMonthGrid } from '@/features/daily-log/components/entry-month-grid';
import { PhaseCorrelationSummary } from '@/features/daily-log/components/phase-correlation-summary';
import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import { dailyLogHistoryMessages } from '@/features/daily-log/presentation/daily-log-history-messages';
import { useDataChangeReload } from '@/hooks/use-data-change-reload';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useMessages } from '@/i18n';
import { appMessages } from '@/shared/presentation/app-messages';
import { logEvent } from '@/shared/logging';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { canShiftYearMonth, getYearMonth, shiftYearMonth } from '@/utils/date';
import { formatDisplayMonth } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';

/**
 * Everything that has been written down, month by month.
 *
 * ## Why this screen exists
 *
 * The app has been collecting flow, ten symptoms and a mood every day since the
 * daily log shipped, and showing none of it back. The entries were read by the
 * backup and the sync and by nothing a person could look at. This is the other
 * direction.
 *
 * ## What it is careful about
 *
 * The summary under the calendar is the only place in the app that looks at
 * several days at once and says something about the pattern, and it is built to
 * understate. The counting rules are in
 * `daily-log/domain/symptom-phase-correlation.ts` and the wording rules are in
 * the catalogue; between them, nothing is shown below five days, nothing is
 * shown that only describes how long a phase is, and no sentence names a cause.
 *
 * The month on screen is session state and starts on the month containing
 * today, like the home screen's calendar - an offset rather than an absolute
 * month, so it needs no second initialisation once the data arrives.
 */
export default function DailyLogHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const history = useMessages(dailyLogHistoryMessages);
  const common = useMessages(appMessages);
  const language = useLanguage();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DailyLogHistory | null>(null);
  const [hasError, setHasError] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);

  const [today] = useState<ISODate>(() => getTodayLocalISODate());

  const readHistory = useCallback(async () => {
    const db = await openAppDatabase();

    return getDailyLogHistory(db, today);
  }, [today]);

  const load = useCallback(() => {
    let cancelled = false;

    void (async () => {
      try {
        const read = await readHistory();

        if (cancelled) {
          return;
        }

        setData(read);
        setHasError(false);
      } catch (error) {
        logEvent('daily log history load failed', error);

        if (!cancelled) {
          setHasError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [readHistory]);

  useDataChangeReload(load);

  const backButton = <BackButton />;

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ActivityIndicator testID="daily-log-history-loading" color={theme.text} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            {common.loadingMessage}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const todayMonth = getYearMonth(today);
  const { year, month } = shiftYearMonth(todayMonth.year, todayMonth.month, monthOffset);

  // Keyed by date so the grid can ask about one day without scanning the log.
  const entriesByDate = new Map<ISODate, DailyEntry>(
    (data?.entries ?? []).map((entry) => [entry.date, entry])
  );

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {backButton}

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle">
                {history.historyTitle}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {history.historyDescription}
              </ThemedText>
            </View>

            {hasError ? (
              <ThemedText accessibilityRole="alert" themeColor="textSecondary">
                {history.loadFailedMessage}
              </ThemedText>
            ) : data === null || data.entries.length === 0 ? (
              <ThemedText themeColor="textSecondary">{history.emptyMessage}</ThemedText>
            ) : (
              <>
                <View style={styles.monthBar}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={history.previousMonthLabel}
                    accessibilityState={{ disabled: !canShiftYearMonth(year, month, -1) }}
                    disabled={!canShiftYearMonth(year, month, -1)}
                    onPress={() => setMonthOffset((offset) => offset - 1)}
                    style={({ pressed }) => [
                      styles.monthButton,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">‹</ThemedText>
                  </Pressable>

                  <ThemedText type="smallBold">
                    {formatDisplayMonth(year, month, language)}
                  </ThemedText>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={history.nextMonthLabel}
                    accessibilityState={{ disabled: !canShiftYearMonth(year, month, 1) }}
                    disabled={!canShiftYearMonth(year, month, 1)}
                    onPress={() => setMonthOffset((offset) => offset + 1)}
                    style={({ pressed }) => [
                      styles.monthButton,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">›</ThemedText>
                  </Pressable>
                </View>

                {/* The grid needs a profile to lay a month out. Without one -
                    onboarding unfinished - the entries are still listed by the
                    summary, which says why they cannot be placed. */}
                {data.profile !== null && (
                  <EntryMonthGrid
                    grid={buildCycleCalendarGridForMonth(data.profile, year, month)}
                    entriesByDate={entriesByDate}
                    onSelectDay={(date) => {
                      router.push({ pathname: '/daily-entry', params: { date } });
                    }}
                  />
                )}

                <PhaseCorrelationSummary
                  symptoms={data.symptomCorrelations}
                  moods={data.moodCorrelations}
                  hasPlacedDays={data.phased.some((entry) => entry.phase !== null)}
                />
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centeredArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  centeredText: {
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
