import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { AvatarPreview } from '@/features/avatar/components/AvatarPreview';
import { loadAvatarConfig } from '@/features/avatar/data/avatar-repository';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
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
import type { PregnancyDashboard } from '@/features/pregnancy/application/get-pregnancy-dashboard';
import {
  getPregnancyDashboard,
  getWeeklyContentForWeek,
} from '@/features/pregnancy/application/get-pregnancy-dashboard';
import type {
  PregnancyDueDateSource,
  PregnancyWeeklyContent,
} from '@/features/pregnancy/domain/types';
import {
  MAX_PREGNANCY_WEEK,
  MIN_PREGNANCY_WEEK,
} from '@/features/pregnancy/domain/weekly-content';
import { syncPeriodReminderQuietly } from '@/features/notifications/application/sync-period-reminder';
import { syncWidgetSnapshotQuietly } from '@/features/widget/application/sync-widget-snapshot';
import { syncPregnancyWeeklyReminderQuietly } from '@/features/notifications/application/sync-pregnancy-weekly-reminder';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { canShiftYearMonth, getYearMonth, shiftYearMonth } from '@/utils/date';
import { formatDisplayDate, formatDisplayMonth } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';
import { logEvent } from '@/shared/logging';

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

/**
 * How far along the pregnancy is, in words.
 *
 * A stored pregnancy whose last menstrual period has not arrived yet has no
 * progress to report. It says so rather than showing week 0 or a negative day,
 * and the due date beside it is still shown because that much is known.
 */
function pregnancyProgressLabel(pregnancy: PregnancyDashboard): string {
  if (pregnancy.pregnancyWeek === null) {
    return NOT_STARTED_MESSAGE;
  }

  return `${pregnancy.pregnancyWeek.week}. hafta ${pregnancy.pregnancyWeek.day}. gün`;
}

/**
 * The week's content in one line, for assistive technology.
 *
 * The size leads when there is one, because that is the part a screen reader
 * would otherwise have to reach the summary to get any sense of.
 */
function weeklyHighlight(content: PregnancyWeeklyContent): string {
  if (content.size === undefined) {
    return content.developmentSummary;
  }

  return `${content.size.label} — ${content.size.comparison}. ${content.developmentSummary}`;
}

/** Where the due date came from, so an adjusted one is not read as calculated. */
function dueDateSourceLabel(source: PregnancyDueDateSource): string {
  return source === 'adjusted' ? 'Düzeltilmiş tarih' : 'Son regl tarihine göre';
}

const LOAD_ERROR_MESSAGE = 'Bilgiler yüklenemedi.';
const NOT_STARTED_MESSAGE = 'Gebelik başlangıç tarihi henüz gelmedi.';
const SOURCE_ERROR_MESSAGE = 'Kaynak açılamadı.';
const SAVE_ERROR_MESSAGE = 'Regl başlangıcı kaydedilemedi.';
const END_SAVE_ERROR_MESSAGE = 'Regl bitişi kaydedilemedi.';
const EMPTY_MESSAGE = 'Döngü bilgisi bulunamadı.';
const SUPPORT_DISCLAIMER =
  'Bu bilgiler geneldir; kişiden kişiye ve aydan aya değişebilir.';
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

  // The pregnancy summary, or null when none is being tracked. Both the section
  // and the link that offers to start one are decided by this.
  const [pregnancy, setPregnancy] = useState<PregnancyDashboard | null>(null);

  // The saved avatar, or null when none has been built. Only the cycle view
  // shows it, and only once there is one: an empty frame would be making the
  // invitation twice, and the link already makes it in words.
  const [avatar, setAvatar] = useState<AvatarConfig | null>(null);

  // Which view the person chose, and how to record a change. Both come from the
  // app store, which already persists the mode; nothing new is kept here.
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);

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

  // The widget snapshot is brought up to date once, when the app opens. Every
  // change to cycle or avatar data syncs itself, so returning to this screen
  // has nothing new to copy and syncing again on each focus would be writing
  // the same bytes over and over.
  const hasSyncedWidget = useRef(false);

  // Set when a source link could not be handed to the browser. Cleared on the
  // next attempt, so a failure does not linger over a link that works.
  const [hasSourceError, setHasSourceError] = useState(false);

  // The week being read about, or null while that is simply the current one.
  // Local and unsaved on purpose: browsing ahead is a look, not a setting, and
  // should not still be where it was left days later.
  const [previewWeek, setPreviewWeek] = useState<number | null>(null);

  /**
   * Reads everything the screen shows. Stable, so the mount effect can depend on
   * it without re-running, and the save path can reuse it.
   */
  const readCycleData = useCallback(async (today?: ISODate) => {
    const forDate = today ?? getTodayLocalISODate();
    const db = await openAppDatabase();

    const [cycle, pregnancyDashboard, avatarConfig] = await Promise.all([
      getCycleHomeData(db, forDate),
      getPregnancyDashboard(db, forDate),
      loadAvatarConfig(db),
    ]);

    return { db, cycle, pregnancy: pregnancyDashboard, avatar: avatarConfig };
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

          setHomeData(data.cycle);
          setPregnancy(data.pregnancy);
          setAvatar(data.avatar);
          setHasError(false);

          // Best effort, and only once: this catches changes made while the app
          // was closed, such as the day rolling over. It is deliberately not
          // awaited into the screen's own state — a widget that could not be
          // updated is not something to tell the person about here, and it must
          // not stop the screen it is riding along with.
          if (!hasSyncedWidget.current) {
            hasSyncedWidget.current = true;

            // Caught as well as quiet: this promise is not awaited, so a
            // rejection would have nowhere to go but an unhandled one, and the
            // screen must not depend on the sync keeping its own promise.
            const syncDate = data.cycle?.dashboard.today ?? getTodayLocalISODate();

            syncWidgetSnapshotQuietly(data.db, syncDate).catch((syncError: unknown) => {
              logEvent('widget sync failed', syncError);
            });

            // The estimate moves on its own as days pass, so the queued reminder
            // is reconsidered on the way in as well as after every change.
            syncPeriodReminderQuietly(data.db, syncDate).catch((syncError: unknown) => {
              logEvent('notification sync failed', syncError);
            });

            // A weekly reminder the system dropped — on a restore, or after the
            // app was told to stop — is put back here, whichever half of the app
            // this screen is showing.
            syncPregnancyWeeklyReminderQuietly(data.db).catch((syncError: unknown) => {
              logEvent('notification sync failed', syncError);
            });
          }
        } catch (error) {
          logEvent('cycle data load failed', error);

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

  // Derived rather than trusted: a stored 'pregnancy' mode outlives the
  // pregnancy it was chosen for, so the view falls back on its own instead of
  // waiting for a write to land.
  const isPregnancyView = mode === 'pregnancy' && pregnancy !== null;

  // Tidy the stored mode once the pregnancy it pointed at is gone. Rendering
  // already ignores it, so a failed write changes nothing on screen.
  useEffect(() => {
    if (!isLoading && mode === 'pregnancy' && pregnancy === null) {
      void setMode('cycle').catch((error: unknown) => {
        logEvent('app mode change failed', error);
      });
    }
  }, [isLoading, mode, pregnancy, setMode]);

  // A preview outlives nothing: when there is no week to browse, it goes.
  const canBrowseWeeks = pregnancy?.weeklyContent != null;

  useEffect(() => {
    if (!canBrowseWeeks && previewWeek !== null) {
      setPreviewWeek(null);
    }
  }, [canBrowseWeeks, previewWeek]);

  const chooseMode = (next: 'cycle' | 'pregnancy') => {
    if (next === mode) {
      return;
    }

    void setMode(next).catch((error: unknown) => {
      logEvent('app mode change failed', error);
    });
  };

  /**
   * Opens a source in whatever the device uses for links.
   *
   * A refusal is shown next to the links rather than thrown: failing to open a
   * citation is a disappointment, not a reason to lose the screen.
   */
  const openSource = async (url: string) => {
    setHasSourceError(false);

    try {
      await Linking.openURL(url);
    } catch (error) {
      logEvent('source link open failed', error);

      setHasSourceError(true);
    }
  };

  // The week on screen, and what is written for it. The dashboard's own week and
  // due date are untouched by this — only the reading below them changes.
  const currentWeek = canBrowseWeeks ? (pregnancy?.pregnancyWeek?.week ?? null) : null;
  const shownWeek = canBrowseWeeks ? (previewWeek ?? currentWeek) : null;
  const shownContent = shownWeek === null ? null : getWeeklyContentForWeek(shownWeek);

  const stepWeek = (delta: number) => {
    if (shownWeek === null) {
      return;
    }

    const next = shownWeek + delta;

    if (next < MIN_PREGNANCY_WEEK || next > MAX_PREGNANCY_WEEK) {
      return;
    }

    setPreviewWeek(next);
    setHasSourceError(false);
  };

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

  const { dashboard, profile, dailySupport } = homeData;

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

      // The write is already durable, and the widget only holds a copy of it,
      // so a failed update here must not undo what was just saved.
      await syncWidgetSnapshotQuietly(db, dashboard.today);
      await syncPeriodReminderQuietly(db, dashboard.today);

      // Both halves of the screen come from one fresh read, so the summary and
      // the calendar cannot end up describing different profiles.
      const data = await readCycleData(dashboard.today);

      setHomeData(data.cycle);
      setPregnancy(data.pregnancy);
      setAvatar(data.avatar);
      setIsConfirming(false);
    } catch (error) {
      logEvent('period record save failed', error);

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
            {/* Two views over the same day. Gebelik is unreachable until there
                is a pregnancy to show, which is what the disabled state says. */}
            <View accessibilityRole="tablist" style={styles.modeSwitch}>
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel="Döngü"
                accessibilityState={{ selected: !isPregnancyView }}
                onPress={() => chooseMode('cycle')}
                style={({ pressed }) => [
                  styles.modeOption,
                  !isPregnancyView && { backgroundColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type={isPregnancyView ? 'small' : 'smallBold'}>Döngü</ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="tab"
                accessibilityLabel="Gebelik"
                accessibilityState={{ selected: isPregnancyView, disabled: pregnancy === null }}
                disabled={pregnancy === null}
                onPress={() => chooseMode('pregnancy')}
                style={({ pressed }) => [
                  styles.modeOption,
                  isPregnancyView && { backgroundColor: theme.backgroundSelected },
                  pregnancy === null && styles.disabled,
                  pressed && pregnancy !== null && styles.pressed,
                ]}>
                <ThemedText type={isPregnancyView ? 'smallBold' : 'small'}>Gebelik</ThemedText>
              </Pressable>
            </View>

            <View style={styles.header}>
              <ThemedText type="small" themeColor="textSecondary">
                Bugün
              </ThemedText>

              <ThemedText type="subtitle" style={styles.date}>
                {formatDisplayDate(dashboard.today)}
              </ThemedText>
            </View>

            {isPregnancyView ? null : (
              <>
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

            {/* Only in the cycle view, and only for a day that has a phase:
                without one there is nothing to look words up by, and a heading
                over an empty card would read as content that failed to load. */}
            {dailySupport !== null && (
              <View style={styles.supportSection}>
                {/* Absent where the sources do not support any, which is the
                    ovulatory phase today. The heading goes with the list, so
                    neither appears without the other. */}
                {dailySupport.moodLabels !== undefined && (
                  <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
                      Olası ruh hali
                    </ThemedText>

                    {dailySupport.moodLabels.map((mood) => (
                      <ThemedText key={mood} type="small" style={styles.weeklyFeature}>
                        • {mood}
                      </ThemedText>
                    ))}
                  </View>
                )}

                <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
                    Bugünün mesajı
                  </ThemedText>

                  <ThemedText style={styles.weeklySummary}>
                    {dailySupport.supportMessage}
                  </ThemedText>

                  <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
                    {SUPPORT_DISCLAIMER}
                  </ThemedText>
                </View>

                {/* The domain requires at least one source, but the section is
                    still conditional: an empty heading would be worse than no
                    heading. */}
                {dailySupport.sources.length > 0 && (
                  <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
                      Kaynaklar
                    </ThemedText>

                    {hasSourceError && (
                      <ThemedText
                        accessibilityRole="alert"
                        type="small"
                        themeColor="textSecondary"
                        style={styles.weeklyFeature}>
                        {SOURCE_ERROR_MESSAGE}
                      </ThemedText>
                    )}

                    {dailySupport.sources.map((source) => (
                      <Pressable
                        key={source.url}
                        accessibilityRole="link"
                        accessibilityLabel={`${source.name} kaynağını aç`}
                        onPress={() => openSource(source.url)}
                        style={({ pressed }) => [styles.sourceLink, pressed && styles.pressed]}>
                        <ThemedText type="small">{source.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {source.url}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

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
              </>
            )}

            {isPregnancyView && pregnancy !== null && (
              <View style={styles.pregnancySection}>
                <ThemedText accessibilityRole="header" type="smallBold">
                  Gebelik takibi
                </ThemedText>

                <View
                  accessible
                  accessibilityLabel={`Gebelik haftası: ${pregnancyProgressLabel(pregnancy)}`}
                  style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Gebelik haftası
                  </ThemedText>
                  <ThemedText style={styles.rowValue}>
                    {pregnancyProgressLabel(pregnancy)}
                  </ThemedText>
                </View>

                <View
                  accessible
                  accessibilityLabel={
                    `Tahmini doğum tarihi: ${formatDisplayDate(pregnancy.estimatedDueDate)}, ` +
                    dueDateSourceLabel(pregnancy.dueDateSource)
                  }
                  style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Tahmini doğum tarihi
                  </ThemedText>
                  <ThemedText style={styles.rowValue}>
                    {formatDisplayDate(pregnancy.estimatedDueDate)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
                    {dueDateSourceLabel(pregnancy.dueDateSource)}
                  </ThemedText>
                </View>

                {/* Absent before the pregnancy starts and past week 40, where
                    there is nothing written to show. */}
                {shownContent !== null && shownWeek !== null && (
                  <>
                    <View style={styles.weekBar}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Önceki hafta"
                        accessibilityState={{ disabled: shownWeek <= MIN_PREGNANCY_WEEK }}
                        disabled={shownWeek <= MIN_PREGNANCY_WEEK}
                        onPress={() => stepWeek(-1)}
                        style={({ pressed }) => [
                          styles.weekButton,
                          shownWeek <= MIN_PREGNANCY_WEEK && styles.disabled,
                          pressed && shownWeek > MIN_PREGNANCY_WEEK && styles.pressed,
                        ]}>
                        <ThemedText style={styles.weekButtonLabel}>‹</ThemedText>
                      </Pressable>

                      <ThemedText
                        accessibilityLabel={`Gösterilen hafta: ${shownWeek}. hafta`}
                        type="smallBold"
                        style={styles.selectedWeek}>
                        {shownWeek}. hafta
                      </ThemedText>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Sonraki hafta"
                        accessibilityState={{ disabled: shownWeek >= MAX_PREGNANCY_WEEK }}
                        disabled={shownWeek >= MAX_PREGNANCY_WEEK}
                        onPress={() => stepWeek(1)}
                        style={({ pressed }) => [
                          styles.weekButton,
                          shownWeek >= MAX_PREGNANCY_WEEK && styles.disabled,
                          pressed && shownWeek < MAX_PREGNANCY_WEEK && styles.pressed,
                        ]}>
                        <ThemedText style={styles.weekButtonLabel}>›</ThemedText>
                      </Pressable>
                    </View>

                    {/* Only worth offering once the reading has wandered off the
                        week the pregnancy is actually in. */}
                    {shownWeek !== currentWeek && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Bugünkü haftaya dön"
                        onPress={() => {
                          setPreviewWeek(null);
                          setHasSourceError(false);
                        }}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Bugünkü haftaya dön
                        </ThemedText>
                      </Pressable>
                    )}

                    <View
                      accessible
                      accessibilityLabel={`Bu hafta: ${weeklyHighlight(shownContent)}`}
                      style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Bu hafta
                      </ThemedText>

                      {/* Only the weeks that have a size show one. */}
                      {shownContent.size !== undefined && (
                        <ThemedText style={styles.rowValue}>
                          {shownContent.size.label} —{' '}
                          {shownContent.size.comparison}
                        </ThemedText>
                      )}

                      <ThemedText type="small" style={styles.weeklySummary}>
                        {shownContent.developmentSummary}
                      </ThemedText>
                    </View>

                    <View
                      accessible
                      accessibilityLabel={`Bu hafta gelişenler: ${shownContent.developingFeatures.join(', ')}`}
                      style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Bu hafta gelişenler
                      </ThemedText>

                      {shownContent.developingFeatures.map((feature) => (
                        <ThemedText key={feature} type="small" style={styles.weeklyFeature}>
                          • {feature}
                        </ThemedText>
                      ))}
                    </View>

                    {/* The domain requires at least one source, but the section
                        is still conditional: an empty heading would be worse
                        than no heading. */}
                    {shownContent.sources.length > 0 && (
                      <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Kaynaklar
                        </ThemedText>

                        {hasSourceError && (
                          <ThemedText
                            accessibilityRole="alert"
                            type="small"
                            themeColor="textSecondary"
                            style={styles.weeklyFeature}>
                            {SOURCE_ERROR_MESSAGE}
                          </ThemedText>
                        )}

                        {shownContent.sources.map((source) => (
                          <Pressable
                            key={source.url}
                            accessibilityRole="link"
                            accessibilityLabel={`${source.name} kaynağını aç`}
                            onPress={() => openSource(source.url)}
                            style={({ pressed }) => [
                              styles.sourceLink,
                              pressed && styles.pressed,
                            ]}>
                            <ThemedText type="small">{source.name}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {source.url}
                            </ThemedText>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Gebelik ayarlarını düzenle"
                  onPress={() => router.push('/(app)/pregnancy-settings')}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Gebelik ayarları
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {isPregnancyView ? null : (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Geçmiş regl kayıtlarını görüntüle"
                  onPress={() => router.push('/(app)/history')}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Geçmiş kayıtlar
                  </ThemedText>
                </Pressable>

                {/* The preview only once there is an avatar, and the label
                    says which of the two errands the link is on. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={avatar === null ? 'Avatar oluştur' : 'Avatarı düzenle'}
                  onPress={() => router.push('/(app)/avatar')}
                  style={({ pressed }) => [styles.avatarLink, pressed && styles.pressed]}>
                  {avatar !== null && (
                    <AvatarPreview config={avatar} size="small" testID="home-avatar-preview" />
                  )}

                  <ThemedText type="small" themeColor="textSecondary">
                    {avatar === null ? 'Avatarım' : 'Avatarı düzenle'}
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

                {/* The way in to pregnancy tracking, and the only way to enable
                    the view that shows it. */}
                {pregnancy === null && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Gebelik takibini başlat"
                    onPress={() => router.push('/(app)/pregnancy-start')}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Gebelik takibini başlat
                    </ThemedText>
                  </Pressable>
                )}
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
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  weekButtonLabel: {
    fontSize: 24,
    lineHeight: 28,
  },
  weekButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  selectedWeek: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
  modeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  modeOption: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  pregnancySection: {
    gap: Spacing.two,
  },
  weeklySummary: {
    marginTop: Spacing.one,
    lineHeight: 22,
  },
  weeklyFeature: {
    marginTop: Spacing.half,
    lineHeight: 22,
  },
  sourceLink: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  supportSection: {
    gap: Spacing.two,
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
  avatarLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
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
