import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { CycleHomeData } from '@/features/cycle/application/get-cycle-home-data';
import { getCycleHomeData } from '@/features/cycle/application/get-cycle-home-data';
import { CycleCalendar } from '@/features/cycle/components/cycle-calendar';
import { CycleCalendarLegend } from '@/features/cycle/components/cycle-calendar-legend';
import {
  getCyclePhaseLabel,
  getFertilityLevelLabel,
} from '@/features/cycle/presentation/cycle-labels';
import { useTheme } from '@/hooks/use-theme';
import { openAppDatabase } from '@/storage/db';
import { formatDisplayDate, formatDisplayMonth } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';

const LOAD_ERROR_MESSAGE = 'Bilgiler yüklenemedi.';
const EMPTY_MESSAGE = 'Döngü bilgisi bulunamadı.';
const FERTILITY_DISCLAIMER =
  'Doğurganlık bilgileri tahminidir ve gebelikten korunma yöntemi olarak kullanılmamalıdır.';

/**
 * Today's cycle summary.
 *
 * The screen owns no cycle rules and no SQL. It reads the clock once, asks the
 * use case for the day's numbers, and turns them into words. Every value shown
 * comes from a domain function, so the screen and the rest of the app can never
 * disagree about which day it is.
 *
 * State is local on purpose: the dashboard is derived from the stored profile
 * and today's date, so keeping a copy in the global store would only create a
 * second thing to keep in sync.
 */
export default function HomeScreen() {
  const theme = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [homeData, setHomeData] = useState<CycleHomeData | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Guards against setting state after the screen is gone, e.g. when the
    // routing gate swaps groups while this read is still in flight.
    let isActive = true;

    const load = async () => {
      try {
        const today = getTodayLocalISODate();
        const db = await openAppDatabase();
        const result = await getCycleHomeData(db, today);

        if (!isActive) {
          return;
        }

        setHomeData(result);
      } catch (error) {
        if (__DEV__) {
          console.error('[home] could not load the cycle data', error);
        }

        if (!isActive) {
          return;
        }

        setHasError(true);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, []);

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ActivityIndicator testID="cycle-dashboard-loading" color={theme.text} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            Veriler yükleniyor
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (hasError) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ThemedText accessibilityRole="alert" type="subtitle" style={styles.messageText}>
            {LOAD_ERROR_MESSAGE}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (homeData === null) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ThemedText type="subtitle" style={styles.messageText}>
            {EMPTY_MESSAGE}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const { dashboard, calendarGrid } = homeData;

  const rows: { label: string; value: string; note?: string }[] = [
    {
      label: 'Döngü günü',
      value: dashboard.cycleDay === null ? 'Henüz başlamadı' : `${dashboard.cycleDay}. gün`,
    },
    {
      label: 'Döngü evresi',
      value: getCyclePhaseLabel(dashboard.phase),
    },
    {
      label: 'Doğurganlık tahmini',
      value: getFertilityLevelLabel(dashboard.fertilityLevel),
      note: FERTILITY_DISCLAIMER,
    },
    {
      label: 'Sonraki regl tahmini',
      value:
        dashboard.nextPeriodStart === null
          ? 'Henüz hesaplanamıyor'
          : formatDisplayDate(dashboard.nextPeriodStart),
    },
  ];

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.header}>
              <ThemedText type="small" themeColor="textSecondary">
                Bugün
              </ThemedText>

              <ThemedText type="subtitle" style={styles.date}>
                {formatDisplayDate(dashboard.today)}
              </ThemedText>
            </View>

            <View style={styles.summary}>
              {rows.map((row) => (
                <View
                  key={row.label}
                  accessible
                  accessibilityLabel={`${row.label}: ${row.value}`}
                  style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {row.label}
                  </ThemedText>
                  <ThemedText style={styles.rowValue}>{row.value}</ThemedText>
                  {row.note !== undefined && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
                      {row.note}
                    </ThemedText>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.calendarSection}>
              <ThemedText
                accessibilityRole="header"
                type="small"
                themeColor="textSecondary">
                Takvim
              </ThemedText>

              <ThemedText
                accessibilityLabel={`${formatDisplayMonth(calendarGrid.year, calendarGrid.month)} takvimi`}
                style={styles.monthHeading}>
                {formatDisplayMonth(calendarGrid.year, calendarGrid.month)}
              </ThemedText>

              <CycleCalendar grid={calendarGrid} today={dashboard.today} />

              <CycleCalendarLegend />
            </View>
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
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  centeredText: {
    textAlign: 'center',
  },
  messageText: {
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.five,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.five,
  },
  header: {
    gap: Spacing.half,
  },
  date: {
    fontSize: 30,
    lineHeight: 38,
  },
  summary: {
    gap: Spacing.two,
  },
  row: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  rowValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  rowNote: {
    marginTop: Spacing.one,
  },
  calendarSection: {
    gap: Spacing.two,
  },
  monthHeading: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
});
