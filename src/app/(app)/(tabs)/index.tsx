import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { loadAvatarConfig } from '@/features/avatar/data/avatar-repository';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import { addPeriodStart } from '@/features/cycle/application/add-period-start';
import { buildCycleDayRing } from '@/features/cycle/application/build-cycle-day-ring';
import { buildCycleOutlook } from '@/features/cycle/application/build-cycle-outlook';
import { endCurrentPeriod } from '@/features/cycle/application/end-current-period';
import { updateCycleSettings } from '@/features/cycle/application/update-cycle-settings';
import type { CycleHomeData } from '@/features/cycle/application/get-cycle-home-data';
import { getCycleHomeData } from '@/features/cycle/application/get-cycle-home-data';
import { CycleLengthSuggestionCard } from '@/features/cycle/components/cycle-length-suggestion-card';
import { HomeModeSwitch } from '@/features/cycle/components/home-mode-switch';
import { CycleArc } from '@/features/cycle/components/cycle-arc';
import { SkyBackdrop } from '@/features/cycle/components/sky-backdrop';
import { SkyField } from '@/features/cycle/components/sky-field';
import { SkyHero } from '@/features/cycle/components/sky-hero';
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
import { cycleDailySupport } from '@/features/cycle/data/cycle-daily-support';
import { getCycleDailySupport } from '@/features/cycle/domain/daily-support';
import { useDataChangeReload } from '@/hooks/use-data-change-reload';
import { useMotionAllowed } from '@/hooks/use-motion-allowed';
import { useSky } from '@/hooks/use-theme';
import { appMessages } from '@/shared/presentation/app-messages';
import { useLanguage, useMessages } from '@/i18n';
import { useAppStore } from '@/store/app-store';

import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { PregnancySection } from '@/features/pregnancy/components/pregnancy-section';
import { resolvePeriodAction } from '@/features/cycle/domain/period-action';
import { homeMessages, summaryRowsIn } from '@/features/cycle/presentation/home-messages';
import { cycleLabels } from '@/features/cycle/presentation/cycle-labels';
import { heroHeightFor } from '@/features/cycle/presentation/hero-height';
import { formatDisplayDate } from '@/utils/format-date';
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
/**
 * The space above the first thing on the screen.
 *
 * Named rather than written twice, because `heroHeight` has to subtract
 * exactly what this adds. When the two were separate numbers they disagreed,
 * and the arc spent three stages hanging over the bottom edge.
 */
const SCROLL_TOP_INSET = Spacing.six;

export default function HomeScreen() {
  const router = useRouter();
  const sky = useSky();
  const motionAllowed = useMotionAllowed();

  /**
   * The height of the scroll viewport, measured rather than derived.
   *
   * `useSafeAreaInsets` would be the obvious way to subtract the status and
   * navigation bars, and it throws without a `SafeAreaProvider` - which the
   * screen tests do not render. Measuring the scroll view is both
   * provider-free and more honest: it is the actual space the hero has,
   * whatever is taking up the rest.
   *
   * It settles on the second layout, not the first. The first fires before
   * the safe area has applied its insets and reports the whole window;
   * instrumented on a device, 914.29 then 838.48, where 838.48 is the window
   * less a 51.81 status bar and a 24 point gesture bar. Both values pass
   * through this state, so anything derived from it has to be correct for
   * the settled one and merely harmless for the first. A note here used to
   * claim the measurement "comes out as the full window height in practice"
   * - that was the first value mistaken for the only one, and it sent a
   * real defect to the wrong place for three stages.
   */
  const [viewport, setViewport] = useState(0);

  const home = useMessages(homeMessages);
  const labels = useMessages(cycleLabels);
  const common = useMessages(appMessages);
  const language = useLanguage();

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

  /**
   * The day the arc is showing, or `null` for today.
   *
   * Session-only and deliberately not stored: a scrub is a look, not a
   * setting, and a screen that opened on whatever day you last dragged to
   * would be lying about what day it is.
   */
  const [scrubbedDay, setScrubbedDay] = useState<number | null>(null);

  /** Bumped to ask the sky for a bloom. See `SkyField`. */
  const [bloomKey, setBloomKey] = useState(0);

  /**
   * The acknowledgement, which this app had none of.
   *
   * Every one of its 118 pressables either faded slightly or did nothing at
   * all. Recording a period - the single thing this app exists to be told -
   * produced a re-render and silence.
   *
   * Haptics first so the tap lands with the press rather than after the write,
   * and `notificationAsync(Success)` rather than an impact because this is a
   * thing that worked, not a thing that was touched.
   */
  const celebrate = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined
    );

    setBloomKey((current) => current + 1);
  }, []);


  // Whether the cycle-length suggestion has been waved away this session.
  // Deliberately not persisted: a dismissal that outlived the records it was
  // about would silence a suggestion that had since become more right, and the
  // records it is about change every time a period is recorded.
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [isAcceptingSuggestion, setIsAcceptingSuggestion] = useState(false);
  const [suggestionFailed, setSuggestionFailed] = useState(false);

  /** What was recorded today, for the card. An unvisited day reads as empty. */
  const [todayEntry, setTodayEntry] = useState<DailyEntry | null>(null);

  /** What was recorded on the day picked in the calendar, for its row. */

  /**
   * Bumped by every reload, so the picked day is re-read on the same two
   * triggers as the rest of the screen.
   *
   * Without it, saving a past day and coming back left its row still
   * offering to add one - the screen reloaded, and the only thing that had
   * not was the one day the person had just edited.
   */
  // Bumped after a reload so effects that depended on it re-ran. The last of
  // those left with the calendar; the counter is kept because the daily-entry
  // read below still needs a reason to run again after a write.
  const [, setReloadKey] = useState(0);

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
      getCycleHomeData(db, forDate, language),
      getPregnancyDashboard(db, forDate, language),
      loadAvatarConfig(db),
      loadDailyEntry(db, forDate),
    ]);

    return { db, cycle, pregnancy: pregnancyDashboard, avatar: avatarConfig, daily };
  }, [language]);

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
  const shownContent = shownWeek === null ? null : getWeeklyContentForWeek(shownWeek, language);

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

  /**
   * Everything on this screen that walks the recorded periods.
   *
   * ## Why it is memoised
   *
   * The month grid and the ring between them used to ask the domain about
   * every day they draw on every render - a tap on a calendar square, a toggle,
   * any `setState` at all. With a year of records that was 4 ms of arithmetic
   * per render; with five years, 19 ms; with ten, 53 ms. Recomputed for a
   * screen that had not changed.
   *
   * Keyed on `homeData` and `monthOffset`, which is the whole of what these
   * depend on: a fresh read replaces `homeData` and the work is redone once,
   * and browsing months redoes the grid. Nothing else can change the answer.
   *
   * ## Why it is above the early returns
   *
   * Hooks cannot be called conditionally, and three of them stand between here
   * and the point where `homeData` is known to exist. So this handles the null
   * itself and the guard below narrows it, rather than the other way round.
   *
   * ## Why one memo rather than four
   *
   * The grid depends on the outlook - a stale prediction is stripped out of it -
   * and the month the grid is built for comes from the same dashboard the ring
   * reads. Split apart they would need each other as dependencies, which is the
   * same memo written three times with more ways to get the list wrong.
   */
  const derived = useMemo(() => {
    if (homeData === null) {
      return null;
    }

    const { profile, dashboard } = homeData;

    // Read beside the dashboard rather than inside it, for the reason written in
    // `build-cycle-outlook.ts`: it is pure arithmetic over a profile already in
    // memory, and putting it on `CycleDashboard` would have changed a type six
    // existing test files build by hand.
    const outlook = buildCycleOutlook(profile, dashboard.today);

    return {
      outlook,
      ring: buildCycleDayRing(profile, dashboard.today),
    };
  }, [homeData]);

  // The three screens that have no day to show yet all come up as sky rather
  // than as a blank page - see `SkyBackdrop`. The words on them take the sky's
  // own ink: `textSecondary` reads 4.24:1 on the pale end of this field, which
  // is under AA, and this is a new surface rather than one being inherited.
  if (isLoading) {
    return (
      <SkyBackdrop colors={sky.waking} testID="sky-waking">
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ActivityIndicator testID="cycle-dashboard-loading" color={sky.ink} />
          <ThemedText type="small" style={[styles.centeredText, { color: sky.ink }]}>
            {common.loadingMessage}
          </ThemedText>
        </SafeAreaView>
      </SkyBackdrop>
    );
  }

  if (hasError) {
    return (
      <SkyBackdrop colors={sky.waking} testID="sky-waking">
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ThemedText
            accessibilityRole="alert"
            type="subtitle"
            style={[styles.messageText, { color: sky.ink }]}>
            {home.loadErrorMessage}
          </ThemedText>
        </SafeAreaView>
      </SkyBackdrop>
    );
  }

  // Null together, by construction: `derived` returns null for exactly this
  // case. Narrowed together so neither needs an assertion below.
  if (homeData === null || derived === null) {
    return (
      <SkyBackdrop colors={sky.waking} testID="sky-waking">
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ThemedText type="subtitle" style={[styles.messageText, { color: sky.ink }]}>
            {home.emptyMessage}
          </ThemedText>
        </SafeAreaView>
      </SkyBackdrop>
    );
  }

  const { dashboard, profile, dailySupport } = homeData;

  const { outlook, ring } = derived;

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

      // After the read, so the sky blooms over the day it just learned about
      // rather than over the one being replaced.
      celebrate();
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

  /**
   * Takes the observed cycle length as the stored setting.
   *
   * Goes through `updateCycleSettings` like the settings screen does, so there
   * is one write path and `saveCycleProfile` announces the change the way
   * everything else expects. The period length is carried over untouched - this
   * card is about one number and must not quietly change the other.
   */
  const handleAcceptSuggestion = async () => {
    if (saveInFlight.current) {
      return;
    }

    saveInFlight.current = true;
    setIsAcceptingSuggestion(true);
    setSuggestionFailed(false);

    try {
      const db = await openAppDatabase();

      await updateCycleSettings(db, {
        averageCycleLengthDays: outlook.cycleLengthSuggestion?.observedMedianDays ?? 0,
        averagePeriodLengthDays: profile.settings.averagePeriodLengthDays,
      });

      // The write is durable; the widget and the reminder only hold copies of
      // what it changed, so a failure here must not undo it.
      await syncWidgetSnapshotQuietly(db, dashboard.today);
      await syncPeriodReminderQuietly(db, dashboard.today);

      const data = await readCycleData(dashboard.today);

      setHomeData(data.cycle);
      setPregnancy(data.pregnancy);
      setAvatar(data.avatar);
    } catch (error: unknown) {
      logEvent('cycle length suggestion failed', error);
      setSuggestionFailed(true);
    } finally {
      saveInFlight.current = false;
      setIsAcceptingSuggestion(false);
    }
  };

  const rows = summaryRowsIn(home, labels, dashboard, language, outlook);

  // The first two rows are the ring's, the rest stay rows. Split here rather
  // than inside either component so the wording still comes from one builder
  // and the two cannot start describing different days.
  const [dayRow, phaseRow, ...remainingRows] = rows;

  /**
   * The day the screen is describing, which is today unless a finger says
   * otherwise, and everything that follows from it.
   *
   * Read off the ring's own dots rather than recomputed, so the arc and the
   * words above it cannot disagree about which phase a day belongs to.
   */
  const shownDot =
    scrubbedDay === null
      ? ring.dots.find((dot) => dot.isToday) ?? null
      : ring.dots.find((dot) => dot.day === scrubbedDay) ?? null;

  const shownPhase = shownDot?.phase ?? dashboard.phase;
  const shownDay = shownDot?.day ?? ring.cycleDay;
  const isScrubbing = scrubbedDay !== null && shownDot?.isToday !== true;

  const skyField = sky.fields[shownPhase ?? 'luteal'];

  // One viewport, less the padding the scroll content puts above it. The
  // arithmetic and the reason it is worth its own file are in `hero-height.ts`.
  const heroHeight = heroHeightFor({
    viewport,
    topInset: SCROLL_TOP_INSET,
    isPregnancyView,
  });

  // The sentence under the number follows the phase being shown, so dragging
  // into another phase changes the words as well as the colour.
  const shownSupport =
    shownPhase === null ? null : getCycleDailySupport(cycleDailySupport[language], shownPhase);


  // Absent until the records have something to say, and gone once it has been
  // acted on or waved away. The suggestion itself is null whenever there is
  // nothing worth asking about, so this is only the session's half of it.
  const suggestion = suggestionDismissed ? null : outlook.cycleLengthSuggestion;

  return (
    <GestureHandlerRootView style={styles.screen}>
      <SkyField
        colors={skyField}
        bloomKey={bloomKey}
        motionAllowed={motionAllowed}
        driftColor={sky.drift}
        bloomColor={sky.bloom}
        testID="sky-field">
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
            showsVerticalScrollIndicator={false}>
            {/* The hero is exactly one viewport tall, so what is underneath is
                reachable by scrolling and invisible until somebody does. That
                is the whole of the layout change: nothing was deleted, the
                screen just stopped showing all of it at once. */}
            <View style={[styles.hero, { height: heroHeight }]}>
              <HomeModeSwitch
                isPregnancyView={isPregnancyView}
                pregnancy={pregnancy}
                chooseMode={chooseMode}
              />

              {/* The pregnancy view has no cycle day and no phase, so it has
                  no hero - but it still has a today, and losing the date when
                  the mode switched was a regression rather than a simplification. */}
              {isPregnancyView ? (
                <View style={styles.pregnancyHeader}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {home.todayHeading}
                  </ThemedText>

                  <ThemedText type="subtitle">
                    {formatDisplayDate(dashboard.today, language)}
                  </ThemedText>
                </View>
              ) : null}

              {isPregnancyView ? null : (
                <SkyHero
                  dayNumber={shownDay === null ? null : String(shownDay)}
                  noDayMessage={dayRow.value}
                  dayCaption={dayRow.label}
                  phaseName={
                    shownPhase === null ? null : labels.phaseLabels[shownPhase]
                  }
                  dayAccessibilityLabel={home.labelledValue(
                    dayRow.label,
                    shownDay === null ? dayRow.value : home.cycleDayValue(shownDay)
                  )}
                  phaseAccessibilityLabel={home.labelledValue(
                    phaseRow.label,
                    shownPhase === null ? phaseRow.value : labels.phaseLabels[shownPhase]
                  )}
                  sentence={shownSupport?.supportMessage ?? null}
                  dateLine={formatDisplayDate(dashboard.today, language)}
                  todayHeading={home.todayHeading}
                  avatar={avatar}
                  onOpenAvatar={() => router.push('/(app)/avatar')}
                  openAvatarLabel={
                    avatar === null ? home.avatarCreateLabel : home.avatarEditLabel
                  }
                  ink={sky.ink}
                  glass={sky.glass}
                  glassEdge={sky.glassEdge}
                  isScrubbing={isScrubbing}
                  scrubHint={home.scrubHeading}
                />
              )}

              {isPregnancyView || ring.dots.length === 0 ? null : (
                <CycleArc
                  dots={ring.dots}
                  selectedDay={shownDay ?? ring.dots[0].day}
                  onScrub={setScrubbedDay}
                  onScrubEnd={() => setScrubbedDay(null)}
                  tint={sky.ink}
                  dimTint={sky.inkMark}
                  testID="cycle-arc"
                />
              )}
            </View>

            <View style={styles.content}>
            {isPregnancyView ? null : (
              <>
              <CycleSummary rows={remainingRows} />

              {suggestion === null ? null : (
                <CycleLengthSuggestionCard
                  suggestion={suggestion}
                  isBusy={isAcceptingSuggestion}
                  hasFailed={suggestionFailed}
                  onAccept={() => {
                    void handleAcceptSuggestion();
                  }}
                  onDismiss={() => setSuggestionDismissed(true)}
                />
              )}

              <DailyEntryCard
                entry={todayEntry ?? emptyDailyEntry(dashboard.today)}
                onOpen={() => {
                  router.push({
                    pathname: '/daily-entry',
                    params: { date: dashboard.today },
                  });
                }}
              />

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
      </SkyField>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  pregnancyHeader: {
    paddingHorizontal: Spacing.three,
  },
  hero: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    /**
     * Breathing room under the arc, and nothing more than that.
     *
     * It used to be forty-eight points and it was not breathing room - it was
     * compensation for the hero being a whole viewport tall inside a container
     * that had already spent `SCROLL_TOP_INSET` of it. That is fixed where it
     * was caused, in `heroHeight`, so this is free to be a design value again.
     *
     * The safe-area inset is not this number's job either: `SafeAreaView`
     * already holds the gesture bar off, measured at twenty-four points on the
     * device this was checked on.
     */
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
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
    paddingTop: SCROLL_TOP_INSET,
    paddingBottom: Spacing.five,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.five,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerText: {
    // Shrinks rather than pushing the avatar off the edge when the date is
    // long and the system font setting is turned up.
    flexShrink: 1,
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
