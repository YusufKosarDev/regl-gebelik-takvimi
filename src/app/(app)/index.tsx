import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { loadAvatarConfig } from '@/features/avatar/data/avatar-repository';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import { addPeriodStart } from '@/features/cycle/application/add-period-start';
import { buildCycleCalendarGridForMonth } from '@/features/cycle/application/build-cycle-calendar-grid-for-month';
import type { CycleCalendarDay } from '@/features/cycle/application/build-cycle-calendar-month';
import { endCurrentPeriod } from '@/features/cycle/application/end-current-period';
import type { CycleHomeData } from '@/features/cycle/application/get-cycle-home-data';
import { getCycleHomeData } from '@/features/cycle/application/get-cycle-home-data';
import { CycleCalendarSection } from '@/features/cycle/components/cycle-calendar-section';
import { HomeModeSwitch } from '@/features/cycle/components/home-mode-switch';
import { CycleSummary } from '@/features/cycle/components/cycle-summary';
import { HomeLinks } from '@/features/cycle/components/home-links';
import { PeriodActionCard } from '@/features/cycle/components/period-action-card';
import { DailySupportSection } from '@/features/cycle/components/daily-support-section';
import type { PregnancyDashboard } from '@/features/pregnancy/application/get-pregnancy-dashboard';
import {
  getPregnancyDashboard,
  getWeeklyContentForWeek,
} from '@/features/pregnancy/application/get-pregnancy-dashboard';
import {
  MAX_PREGNANCY_WEEK,
  MIN_PREGNANCY_WEEK,
} from '@/features/pregnancy/domain/weekly-content';
import { syncPeriodReminderQuietly } from '@/features/notifications/application/sync-period-reminder';
import { syncWidgetSnapshotQuietly } from '@/features/widget/application/sync-widget-snapshot';
import { syncPregnancyWeeklyReminderQuietly } from '@/features/notifications/application/sync-pregnancy-weekly-reminder';
import { DailyEntryCard } from '@/features/daily-log/components/daily-entry-card';
import { loadDailyEntry } from '@/features/daily-log/data/daily-log-repository';
import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import { emptyDailyEntry } from '@/features/daily-log/domain/catalogues';
import { useDataChangeReload } from '@/hooks/use-data-change-reload';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { canShiftYearMonth, getYearMonth, shiftYearMonth } from '@/utils/date';
import { PregnancySection } from '@/features/pregnancy/components/pregnancy-section';
import { resolvePeriodAction } from '@/features/cycle/domain/period-action';
import {
  EMPTY_MESSAGE,
  LOAD_ERROR_MESSAGE,
  summaryRows,
} from '@/features/cycle/presentation/home-messages';
import { formatDisplayDate, formatDisplayMonth } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';
import { logEvent } from '@/shared/logging';

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

  /** What was recorded today, for the card. An unvisited day reads as empty. */
  const [todayEntry, setTodayEntry] = useState<DailyEntry | null>(null);

  /** What was recorded on the day picked in the calendar, for its row. */
  const [pickedEntry, setPickedEntry] = useState<DailyEntry | null>(null);

  /**
   * Bumped by every reload, so the picked day is re-read on the same two
   * triggers as the rest of the screen.
   *
   * Without it, saving a past day and coming back left its row still
   * offering to add one - the screen reloaded, and the only thing that had
   * not was the one day the person had just edited.
   */
  const [reloadKey, setReloadKey] = useState(0);

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

    const [cycle, pregnancyDashboard, avatarConfig, daily] = await Promise.all([
      getCycleHomeData(db, forDate),
      getPregnancyDashboard(db, forDate),
      loadAvatarConfig(db),
      loadDailyEntry(db, forDate),
    ]);

    return { db, cycle, pregnancy: pregnancyDashboard, avatar: avatarConfig, daily };
  }, []);

  // On focus rather than on mount, so coming back from a screen that changed
  // the data shows the change instead of what was read before leaving — and
  // again whenever a change is announced while this screen is the one being
  // looked at, which is how a sync's pull reaches it. The callback is stable,
  // so this is one read per focus and one per announcement, never per render.
  const load = useCallback(() => {
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
          setTodayEntry(data.daily);
          setReloadKey((key) => key + 1);
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
  }, [readCycleData]);

  useDataChangeReload(load);

  /**
   * What is recorded on the picked day.
   *
   * Only the picked one: reading every day to label one row would grow with
   * the history. Re-runs when the picked day changes and when the screen
   * reloads, which is what makes the row right after editing that day.
   */
  useEffect(() => {
    if (pickedDate === null) {
      return;
    }

    let isActive = true;

    void (async () => {
      try {
        const db = await openAppDatabase();
        const stored = await loadDailyEntry(db, pickedDate);

        if (isActive) {
          setPickedEntry(stored);
        }
      } catch (error) {
        logEvent('daily entry load failed', error);

        if (isActive) {
          setPickedEntry(null);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [pickedDate, reloadKey]);

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
      // Not derivable during render: `shownWeek` below already ignores the
      // preview while there is nothing to browse, so what this is for is the
      // week *after* — the data going away and coming back should start from
      // the current week, not the one someone was looking at before. That
      // reset has to outlast the gap, which means it has to be stored.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // What is recorded on the day the card is actually showing.
  //
  // Before anything is tapped that day is today, and today has already been
  // read for the card above - so it is reused rather than read again. Reading
  // only the tapped day left the card offering to add an entry to a day that
  // already had one, until somebody tapped it.
  const selectedEntry = pickedDate === null ? todayEntry : pickedEntry;

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

  const rows = summaryRows(dashboard);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <HomeModeSwitch
              isPregnancyView={isPregnancyView}
              pregnancy={pregnancy}
              chooseMode={chooseMode}
            />

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
              <CycleSummary rows={rows} />

              {/* Today, above the general content and below the four facts
                  about it. Recording is a thing to do; everything under it is
                  a thing to read. */}
              {!isPregnancyView && (
                <DailyEntryCard
                  entry={todayEntry ?? emptyDailyEntry(dashboard.today)}
                  onOpen={() => {
                    router.push({
                      pathname: '/daily-entry',
                      params: { date: dashboard.today },
                    });
                  }}
                />
              )}

              {/* Only in the cycle view, and only for a day that has a phase:
                  without one there is nothing to look words up by, and a heading
                  over an empty card would read as content that failed to load. */}
              {dailySupport !== null && (
                <DailySupportSection
                  dailySupport={dailySupport}
                  openSource={openSource}
                  hasSourceError={hasSourceError}
                />
              )}

              {periodAction === 'none' ? null : (
                <PeriodActionCard
                  today={dashboard.today}
                  isEnding={isEnding}
                  isConfirming={isConfirming}
                  setIsConfirming={setIsConfirming}
                  isSaving={isSaving}
                  hasSaveError={hasSaveError}
                  setHasSaveError={setHasSaveError}
                  handleSavePeriod={handleSavePeriod}
                />
              )}

              <CycleCalendarSection
                today={dashboard.today}
                monthHeading={monthHeading}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                setMonthOffset={setMonthOffset}
                calendarGrid={calendarGrid}
                selectedDay={selectedDay}
                setPickedDate={setPickedDate}
                pickedEntry={selectedEntry}
              />
              </>
            )}

            {isPregnancyView && pregnancy !== null && (
              <PregnancySection
                pregnancy={pregnancy}
                shownWeek={shownWeek}
                shownContent={shownContent}
                currentWeek={currentWeek}
                stepWeek={stepWeek}
                openSource={openSource}
                hasSourceError={hasSourceError}
                setPreviewWeek={setPreviewWeek}
                setHasSourceError={setHasSourceError}
              />
            )}

            {isPregnancyView ? null : <HomeLinks avatar={avatar} pregnancy={pregnancy} />}
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
  pregnancySection: {
    gap: Spacing.two,
  },
});
