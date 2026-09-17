import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { addPeriodStart } from '@/features/cycle/application/add-period-start';
import { buildCycleCalendarGridForMonth } from '@/features/cycle/application/build-cycle-calendar-grid-for-month';
import type { CycleCalendarDay } from '@/features/cycle/application/build-cycle-calendar-month';
import { endCurrentPeriod } from '@/features/cycle/application/end-current-period';
import type { CycleHomeData } from '@/features/cycle/application/get-cycle-home-data';
import { getCycleHomeData } from '@/features/cycle/application/get-cycle-home-data';
import { CycleCalendar } from '@/features/cycle/components/cycle-calendar';
import { CycleCalendarLegend } from '@/features/cycle/components/cycle-calendar-legend';
import { getOpenPeriodRecord } from '@/features/cycle/domain/open-period';
import type { CycleProfile } from '@/features/cycle/domain/types';
import {
  getCyclePhaseLabel,
  getFertilityLevelLabel,
} from '@/features/cycle/presentation/cycle-labels';
import { useTheme } from '@/hooks/use-theme';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { canShiftYearMonth, getYearMonth, shiftYearMonth } from '@/utils/date';
import { formatDisplayDate, formatDisplayMonth } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';

/**
 * The selected day's rows, read straight off the day the calendar already holds.
 *
 * No domain function is called again here: `CycleCalendarDay` carries everything
 * this card shows, so the card and the square it came from cannot disagree.
 */
function selectedDayRows(day: CycleCalendarDay): { label: string; value: string }[] {
  return [
    {
      label: 'Döngü günü',
      value: day.cycleDay === null ? 'Henüz başlamadı' : `${day.cycleDay}. gün`,
    },
    { label: 'Döngü evresi', value: getCyclePhaseLabel(day.phase) },
    { label: 'Doğurganlık tahmini', value: getFertilityLevelLabel(day.fertilityLevel) },
  ];
}

/**
 * Which period action the stored data allows, if any.
 *
 * `getOpenPeriodRecord` refuses to choose between several open records rather
 * than closing one the person did not mean to close. The screen cannot act on
 * that either, so it offers nothing instead of crashing on the way past.
 */
function resolvePeriodAction(profile: CycleProfile): 'start' | 'end' | 'none' {
  try {
    return getOpenPeriodRecord(profile) === null ? 'start' : 'end';
  } catch {
    return 'none';
  }
}

const LOAD_ERROR_MESSAGE = 'Bilgiler yüklenemedi.';
const SAVE_ERROR_MESSAGE = 'Regl başlangıcı kaydedilemedi.';
const END_SAVE_ERROR_MESSAGE = 'Regl bitişi kaydedilemedi.';
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
  const router = useRouter();
  const theme = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [homeData, setHomeData] = useState<CycleHomeData | null>(null);
  const [hasError, setHasError] = useState(false);

  // Months away from the month containing today, rather than an absolute month,
  // so it needs no second initialisation once the data arrives. Session-only:
  // a restart opens on the current month again.
  const [monthOffset, setMonthOffset] = useState(0);

  // The date the person tapped, not the day object: the object belongs to one
  // month's grid, so keeping the date lets the selection be resolved against
  // whichever month is on screen and fall away by itself when it is not there.
  const [pickedDate, setPickedDate] = useState<ISODate | null>(null);

  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  // A ref as well as the disabled prop: state updates are async, so two quick
  // taps could both read `isSaving` as false before the re-render lands.
  const saveInFlight = useRef(false);

  /**
   * Reads everything the screen shows. Stable, so the mount effect can depend on
   * it without re-running, and the save path can reuse it.
   */
  const readCycleData = useCallback(async (today?: ISODate) => {
    const forDate = today ?? getTodayLocalISODate();
    const db = await openAppDatabase();

    return getCycleHomeData(db, forDate);
  }, []);

  // On focus rather than on mount, so coming back from a screen that changed the
  // data shows the change instead of what was read before leaving. The callback
  // is stable, so this is one read per focus: once on arrival, once on return,
  // never on a re-render.
  useFocusEffect(
    useCallback(() => {
      // Guards against setting state after the screen is gone, e.g. when the
      // routing gate swaps groups while this read is still in flight.
      let isActive = true;

      const load = async () => {
        try {
          // No argument, so the clock is read again: a day that turned over
          // while the app sat on another screen is picked up here.
          const data = await readCycleData();

          if (!isActive) {
            return;
          }

          setHomeData(data);
          setHasError(false);
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
    }, [readCycleData])
  );

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

  const { dashboard, profile } = homeData;

  const todayMonth = getYearMonth(dashboard.today);
  const { year, month } = shiftYearMonth(todayMonth.year, todayMonth.month, monthOffset);

  // Cheap enough to redo on render: at most 31 days of integer arithmetic, and
  // the profile is already in memory, so no database read is involved.
  const calendarGrid = buildCycleCalendarGridForMonth(profile, year, month);
  const monthHeading = formatDisplayMonth(year, month);

  const canGoBack = canShiftYearMonth(year, month, -1);
  const canGoForward = canShiftYearMonth(year, month, 1);

  const findDay = (date: ISODate | null): CycleCalendarDay | null => {
    if (date === null) {
      return null;
    }

    for (const cell of calendarGrid.cells) {
      if (cell.kind === 'day' && cell.day.date === date) {
        return cell.day;
      }
    }

    return null;
  };

  // A pick only stands while its month is on screen; otherwise the month falls
  // back to today when it holds today, and to nothing when it does not. That is
  // what clears a stale selection on a month change, with no reset to forget.
  const selectedDay = findDay(pickedDate) ?? findDay(dashboard.today);

  const periodAction = resolvePeriodAction(profile);
  const isEnding = periodAction === 'end';

  const handleSavePeriod = async () => {
    if (saveInFlight.current) {
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    setHasSaveError(false);

    try {
      const db = await openAppDatabase();

      if (isEnding) {
        await endCurrentPeriod(db, { endDate: dashboard.today, today: dashboard.today });
      } else {
        await addPeriodStart(db, { startDate: dashboard.today, today: dashboard.today });
      }

      // Both halves of the screen come from one fresh read, so the summary and
      // the calendar cannot end up describing different profiles.
      const data = await readCycleData(dashboard.today);

      setHomeData(data);
      setIsConfirming(false);
    } catch (error) {
      if (__DEV__) {
        console.error('[home] could not record the period', error);
      }

      // The confirmation stays open with the error, so a rejected save is
      // visible next to the thing that was rejected.
      setHasSaveError(true);
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  };

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

            {periodAction === 'none' ? null : isConfirming ? (
              <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {isEnding
                    ? 'Bugünü regl bitişi olarak kaydetmek istiyor musun?'
                    : 'Bugünü regl başlangıcı olarak kaydetmek istiyor musun?'}
                </ThemedText>

                <ThemedText style={styles.rowValue}>
                  {formatDisplayDate(dashboard.today)}
                </ThemedText>

                {hasSaveError && (
                  <ThemedText
                    accessibilityRole="alert"
                    type="small"
                    themeColor="textSecondary"
                    style={styles.rowNote}>
                    {isEnding ? END_SAVE_ERROR_MESSAGE : SAVE_ERROR_MESSAGE}
                  </ThemedText>
                )}

                <View style={styles.confirmActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Vazgeç"
                    accessibilityState={{ disabled: isSaving }}
                    disabled={isSaving}
                    onPress={() => {
                      setIsConfirming(false);
                      setHasSaveError(false);
                    }}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      isSaving && styles.disabled,
                      pressed && !isSaving && styles.pressed,
                    ]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Vazgeç
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Kaydet"
                    accessibilityState={{ disabled: isSaving }}
                    disabled={isSaving}
                    onPress={handleSavePeriod}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { backgroundColor: theme.text },
                      isSaving && styles.disabled,
                      pressed && !isSaving && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold" style={{ color: theme.background }}>
                      {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isEnding ? 'Regl bitişini kaydet' : 'Regl başlangıcını kaydet'}
                onPress={() => setIsConfirming(true)}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.text },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {isEnding ? 'Regl bitti' : 'Regl başladı'}
                </ThemedText>
              </Pressable>
            )}

            <View style={styles.calendarSection}>
              <ThemedText
                accessibilityRole="header"
                type="small"
                themeColor="textSecondary">
                Takvim
              </ThemedText>

              <View style={styles.monthBar}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Önceki ay"
                  accessibilityState={{ disabled: !canGoBack }}
                  disabled={!canGoBack}
                  onPress={() => setMonthOffset((current) => current - 1)}
                  style={({ pressed }) => [
                    styles.monthButton,
                    !canGoBack && styles.monthButtonDisabled,
                    pressed && canGoBack && styles.pressed,
                  ]}>
                  <ThemedText style={styles.monthButtonLabel}>‹</ThemedText>
                </Pressable>

                <ThemedText
                  accessibilityLabel={`${monthHeading} takvimi`}
                  style={styles.monthHeading}>
                  {monthHeading}
                </ThemedText>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sonraki ay"
                  accessibilityState={{ disabled: !canGoForward }}
                  disabled={!canGoForward}
                  onPress={() => setMonthOffset((current) => current + 1)}
                  style={({ pressed }) => [
                    styles.monthButton,
                    !canGoForward && styles.monthButtonDisabled,
                    pressed && canGoForward && styles.pressed,
                  ]}>
                  <ThemedText style={styles.monthButtonLabel}>›</ThemedText>
                </Pressable>
              </View>

              <CycleCalendar
                grid={calendarGrid}
                today={dashboard.today}
                selectedDate={selectedDay?.date ?? null}
                onSelectDay={(day) => setPickedDate(day.date)}
              />

              <View style={styles.selectedSection}>
                <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
                  Seçilen gün
                </ThemedText>

                {selectedDay === null ? (
                  <ThemedText themeColor="textSecondary">Bir gün seç.</ThemedText>
                ) : (
                  <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText accessibilityRole="header" style={styles.selectedDate}>
                      {formatDisplayDate(selectedDay.date)}
                    </ThemedText>

                    {/* The visible text already reads "label: value", so it
                        needs no separate accessibility label. */}
                    {selectedDayRows(selectedDay).map((row) => (
                      <ThemedText key={row.label} type="small">
                        {row.label}: {row.value}
                      </ThemedText>
                    ))}

                    {selectedDay.isPredictedPeriodStart && (
                      <ThemedText type="small" themeColor="textSecondary">
                        Sonraki regl başlangıcı tahmini
                      </ThemedText>
                    )}
                  </View>
                )}
              </View>

              <CycleCalendarLegend />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geçmiş regl kayıtlarını görüntüle"
              onPress={() => router.push('/(app)/history')}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="textSecondary">
                Geçmiş kayıtlar
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Döngü ayarlarını düzenle"
              onPress={() => router.push('/(app)/settings')}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="textSecondary">
                Ayarlar
              </ThemedText>
            </Pressable>
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
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  disabled: {
    opacity: 0.5,
  },
  selectedSection: {
    gap: Spacing.two,
  },
  selectedDate: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  monthHeading: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  monthButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  monthButtonDisabled: {
    opacity: 0.3,
  },
  monthButtonLabel: {
    fontSize: 24,
    lineHeight: 28,
  },
  pressed: {
    opacity: 0.6,
  },
});
