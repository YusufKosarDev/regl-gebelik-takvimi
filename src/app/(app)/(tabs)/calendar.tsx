import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { buildCycleCalendarGridForMonth } from '@/features/cycle/application/build-cycle-calendar-grid-for-month';
import type { CycleCalendarDay } from '@/features/cycle/application/build-cycle-calendar-month';
import { buildCycleOutlook } from '@/features/cycle/application/build-cycle-outlook';
import { withoutPrediction } from '@/features/cycle/application/without-prediction';
import type { CycleHomeData } from '@/features/cycle/application/get-cycle-home-data';
import { getCycleHomeData } from '@/features/cycle/application/get-cycle-home-data';
import { CycleCalendarSection } from '@/features/cycle/components/cycle-calendar-section';
import { homeMessages } from '@/features/cycle/presentation/home-messages';
import { loadDailyEntry } from '@/features/daily-log/data/daily-log-repository';
import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import { useDataChangeReload } from '@/hooks/use-data-change-reload';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useMessages } from '@/i18n';
import { logEvent } from '@/shared/logging';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { canShiftYearMonth, getYearMonth, shiftYearMonth } from '@/utils/date';
import { formatDisplayMonth } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';
import { TAB_BAR_HEIGHT } from '@/components/tab-bar';

/**
 * The month calendar, on its own screen.
 *
 * ## Why it left the home screen
 *
 * It was underneath the ring, which meant the home screen drew the same cycle
 * twice - once as a shape and once as a grid - and the grid's cells were about
 * thirty-five of the forty pressable controls on that screen. Two pictures of
 * one thing, competing, and the one that could be read at a glance was on top
 * of the one that could not.
 *
 * Nothing about the calendar itself was wrong, so nothing about it changed. It
 * reads its own data here rather than being handed it, which costs one more
 * database read on a screen somebody opens deliberately.
 */
export default function CalendarScreen() {
  const theme = useTheme();
  const language = useLanguage();
  const home = useMessages(homeMessages);

  const [data, setData] = useState<CycleHomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [pickedDate, setPickedDate] = useState<ISODate | null>(null);
  const [pickedEntry, setPickedEntry] = useState<DailyEntry | null>(null);
  const [todayEntry, setTodayEntry] = useState<DailyEntry | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * One read, on focus.
   *
   * `useDataChangeReload` is built on `useFocusEffect`, which runs on mount as
   * well as on every return - so a separate mount effect beside it would read
   * the profile and the clock twice. Three assertions pin exactly that count,
   * and they are right to.
   */
  const load = useCallback(() => {
    let active = true;

    const run = async () => {
      try {
        const today = getTodayLocalISODate();
        const db = await openAppDatabase();
        const [next, entry] = await Promise.all([
          getCycleHomeData(db, today, language),
          loadDailyEntry(db, today),
        ]);

        if (active) {
          setData(next);
          setTodayEntry(entry);
          setFailed(false);
          setReloadKey((current) => current + 1);
        }
      } catch (error: unknown) {
        logEvent('cycle data load failed', error);

        if (active) {
          setFailed(true);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [language]);

  useDataChangeReload(load);

  useEffect(() => {
    let active = true;

    if (pickedDate === null) {
      // Cleared asynchronously like every other branch of this effect. Doing it
      // synchronously here is a setState during the effect itself, which React
      // treats as a cascading render.
      void Promise.resolve().then(() => {
        if (active) {
          setPickedEntry(null);
        }
      });

      return () => {
        active = false;
      };
    }

    openAppDatabase()
      .then((db) => loadDailyEntry(db, pickedDate))
      .then((entry) => {
        if (active) {
          setPickedEntry(entry);
        }
      })
      .catch((error: unknown) => {
        logEvent('daily entry load failed', error);
      });

    return () => {
      active = false;
    };
  }, [pickedDate, reloadKey]);

  const derived = useMemo(() => {
    if (data === null) {
      return null;
    }

    const todayMonth = getYearMonth(data.dashboard.today);
    const { year, month } = shiftYearMonth(todayMonth.year, todayMonth.month, monthOffset);
    const outlook = buildCycleOutlook(data.profile, data.dashboard.today);
    const grid = buildCycleCalendarGridForMonth(data.profile, year, month);

    return {
      year,
      month,
      grid: outlook.predictionConfidence === 'stale' ? withoutPrediction(grid) : grid,
    };
  }, [data, monthOffset]);

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centred} edges={['top', 'bottom']}>
          <ActivityIndicator testID="calendar-loading" color={theme.text} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (failed) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centred} edges={['top', 'bottom']}>
          <ThemedText accessibilityRole="alert" type="subtitle" style={styles.message}>
            {home.loadErrorMessage}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Null means nothing has been recorded, not that nothing has been read.
  if (data === null || derived === null) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centred} edges={['top', 'bottom']}>
          <ThemedText type="subtitle" style={styles.message}>
            {home.emptyMessage}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const findDay = (date: ISODate | null): CycleCalendarDay | null => {
    if (date === null) {
      return null;
    }

    for (const cell of derived.grid.cells) {
      if (cell.kind === 'day' && cell.day.date === date) {
        return cell.day;
      }
    }

    return null;
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>

            <CycleCalendarSection
              today={data.dashboard.today}
              monthHeading={formatDisplayMonth(derived.year, derived.month, language)}
              canGoBack={canShiftYearMonth(derived.year, derived.month, -1)}
              canGoForward={canShiftYearMonth(derived.year, derived.month, 1)}
              setMonthOffset={setMonthOffset}
              calendarGrid={derived.grid}
              selectedDay={findDay(pickedDate) ?? findDay(data.dashboard.today)}
              setPickedDate={setPickedDate}
              pickedEntry={pickedDate === null ? todayEntry : pickedEntry}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  message: { textAlign: 'center' },
  scrollContent: { paddingBottom: Spacing.five + TAB_BAR_HEIGHT },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
});
