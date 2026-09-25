import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getPregnancyProfile } from '@/features/pregnancy/application/get-pregnancy-profile';
import { stopPregnancyTracking } from '@/features/pregnancy/application/stop-pregnancy-tracking';
import { updatePregnancyDueDate } from '@/features/pregnancy/application/update-pregnancy-due-date';
import { calculateEstimatedDueDate } from '@/features/pregnancy/domain/due-date';
import type {
  PregnancyDueDateSource,
  PregnancyProfile,
} from '@/features/pregnancy/domain/types';
import { syncPregnancyWeeklyReminderQuietly } from '@/features/notifications/application/sync-pregnancy-weekly-reminder';
import {
  PREGNANCY_BACK_TO_LMP_LABEL,
  PREGNANCY_BACK_TO_LMP_TEXT,
  PREGNANCY_EDIT_DUE_DATE_LABEL,
  PREGNANCY_EDIT_DUE_DATE_TEXT,
  PREGNANCY_LMP_PREFIX,
  PREGNANCY_SAVE_DUE_DATE_LABEL,
  PREGNANCY_SETTINGS_DESCRIPTION,
  PREGNANCY_SETTINGS_EMPTY_MESSAGE,
  PREGNANCY_SETTINGS_LOAD_FAILED_MESSAGE,
  PREGNANCY_SETTINGS_NEXT_DAY_LABEL,
  PREGNANCY_SETTINGS_PREVIOUS_DAY_LABEL,
  PREGNANCY_SETTINGS_SAVE_FAILED_MESSAGE,
  PREGNANCY_SETTINGS_TITLE,
  PREGNANCY_STOPPING_LABEL,
  PREGNANCY_STOP_CONFIRM_LABEL,
  PREGNANCY_STOP_CONFIRM_TEXT,
  PREGNANCY_STOP_CONSEQUENCE,
  PREGNANCY_STOP_FAILED_MESSAGE,
  PREGNANCY_STOP_OPEN_LABEL,
  PREGNANCY_STOP_QUESTION,
  PREGNANCY_DUE_DATE_LABEL,
  dueDateSourceLabel,
  pregnancyDueDateRowLabel,
  selectedDueDateLabel,
} from '@/features/pregnancy/presentation/pregnancy-labels';
import { useDataChangeReload } from '@/hooks/use-data-change-reload';
import { useTheme } from '@/hooks/use-theme';
import type { LocalDataChangeOrigin } from '@/shared/data-change/local-data-change';
import { DATA_REFRESHED_NOTICE } from '@/features/sync/presentation/sync-messages';
import {
  BACK_LABEL,
  CANCEL_LABEL,
  LOADING_MESSAGE,
  SAVE_LABEL,
  SAVING_LABEL,
} from '@/shared/presentation/app-messages';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { addDays, daysBetween } from '@/utils/date';
import { formatDisplayDate } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';
import { logEvent } from '@/shared/logging';

/**
 * The estimated due date, and how to change it.
 *
 * Two things can be done here: replace the date with one someone measured, or
 * put it back to what the last menstrual period gives. Which of the two a stored
 * date is stays recorded rather than guessed, so a scan that happens to agree
 * with the formula is still marked as measured.
 */
export default function PregnancySettingsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<PregnancyProfile | null>(null);

  // Set only when a sync moved the due date out from under an open editor.
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  // The date being picked, held only while the editor is open.
  const [selectedDueDate, setSelectedDueDate] = useState<ISODate | null>(null);

  // Whether a due-date editor is open. A ref, so the reload callback stays
  // stable while it opens and closes. Kept in an effect rather than written
  // during render: the compiler forbids the latter, and a reload only reads it
  // after an await, by which time the effect has run.
  const editorOpenRef = useRef(false);

  useEffect(() => {
    editorOpenRef.current = selectedDueDate !== null;
  }, [selectedDueDate]);

  // Whether the person has asked to stop, held only while they confirm it.
  const [isConfirmingStop, setIsConfirmingStop] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [hasStopError, setHasStopError] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  // A ref as well as the disabled prop: state updates are async, so two quick
  // taps could both read `isSaving` as false before the re-render lands.
  const saveInFlight = useRef(false);

  // Read once for the screen, so every save is measured against the same day.
  const [today] = useState<ISODate>(() => getTodayLocalISODate());

  /** Stable, so the mount effect can depend on it. */
  const readProfile = useCallback(async () => {
    const db = await openAppDatabase();

    return getPregnancyProfile(db);
  }, []);

  /**
   * Re-reads the profile, and drops a due-date edit a sync has invalidated.
   *
   * The date picker is seeded from the stored due date. After a pull that date
   * may have moved, or the pregnancy may have been stopped on another phone, so
   * an open picker would be about to save an adjustment measured against a
   * profile that no longer exists.
   */
  const load = useCallback(
    (origin: LocalDataChangeOrigin | null) => {
      let cancelled = false;

      void (async () => {
        try {
          const stored = await readProfile();

          if (cancelled) {
            return;
          }

          // An open editor is the unsaved edit here: the picker is seeded from
          // the stored due date, so a pull moves the ground under it.
          const editorOpen = editorOpenRef.current;

          setProfile(stored);
          setHasError(false);

          if (origin === 'remote' && editorOpen) {
            setSelectedDueDate(null);
            setRefreshNotice(DATA_REFRESHED_NOTICE);
          }
        } catch (error) {
          logEvent('pregnancy load failed', error);

          if (cancelled) {
            return;
          }

          setHasError(true);
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    },
    [readProfile]
  );

  useDataChangeReload(load);

  const closeEditor = () => {
    setSelectedDueDate(null);
    setHasSaveError(false);
  };

  const openEditor = () => {
    if (profile === null) {
      return;
    }

    // Only one panel at a time, so a pending stop gives way rather than both
    // being open at once.
    setIsConfirmingStop(false);
    setHasStopError(false);

    setSelectedDueDate(profile.estimatedDueDate);
    setHasSaveError(false);
  };

  const askToStop = () => {
    closeEditor();

    setIsConfirmingStop(true);
    setHasStopError(false);
  };

  const dismissStop = () => {
    setIsConfirmingStop(false);
    setHasStopError(false);
  };

  /**
   * Removes the pregnancy and leaves.
   *
   * Shares the screen's one lock with the due-date writes, so stopping cannot
   * race a save that is still in flight.
   */
  const handleStop = async () => {
    if (saveInFlight.current) {
      return;
    }

    saveInFlight.current = true;
    setIsStopping(true);
    setHasStopError(false);

    try {
      const db = await openAppDatabase();

      await stopPregnancyTracking(db);

      // The write is already durable; a reminder that could not be queued must
      // not undo what was just saved.
      await syncPregnancyWeeklyReminderQuietly(db);

      router.back();
    } catch (error) {
      logEvent('pregnancy stop failed', error);

      // The confirmation stays open with the error, so a refused stop is visible
      // where it was asked for and can be tried again.
      setHasStopError(true);
    } finally {
      saveInFlight.current = false;
      setIsStopping(false);
    }
  };

  /**
   * Writes a due date and leaves.
   *
   * Both actions on this screen end the same way, so they share the path: Home
   * reads again when it regains focus, and going back is enough for the change
   * to show there.
   */
  const applyDueDate = async (estimatedDueDate: ISODate, source: PregnancyDueDateSource) => {
    if (saveInFlight.current) {
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    setHasSaveError(false);

    // They have looked and decided. The interruption is dealt with.
    setRefreshNotice(null);

    try {
      const db = await openAppDatabase();

      await updatePregnancyDueDate(db, { estimatedDueDate, source, today });

      router.back();
    } catch (error) {
      logEvent('pregnancy due date update failed', error);

      // The screen stays as it is with the error, so the date that was picked is
      // still there to correct or try again.
      setHasSaveError(true);
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  };

  // The stack hides its header, so back has to be offered here.
  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={BACK_LABEL}
      onPress={() => router.back()}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <ThemedText type="small" themeColor="textSecondary">
        {BACK_LABEL}
      </ThemedText>
    </Pressable>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ActivityIndicator testID="pregnancy-settings-loading" color={theme.text} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            {LOADING_MESSAGE}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // A due date can never sit before the pregnancy began.
  const earliestDueDate = profile?.lastMenstrualPeriodStartDate ?? null;
  const canGoBack =
    !isSaving &&
    selectedDueDate !== null &&
    earliestDueDate !== null &&
    daysBetween(earliestDueDate, selectedDueDate) > 0;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {backButton}

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
                {PREGNANCY_SETTINGS_TITLE}
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                {PREGNANCY_SETTINGS_DESCRIPTION}
              </ThemedText>

              {/* Only after a sync moved the date out from under an editor. */}
              {refreshNotice !== null && (
                <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                  {refreshNotice}
                </ThemedText>
              )}
            </View>

            {hasError ? (
              <ThemedText accessibilityRole="alert" themeColor="textSecondary">
                {PREGNANCY_SETTINGS_LOAD_FAILED_MESSAGE}
              </ThemedText>
            ) : profile === null ? (
              <ThemedText themeColor="textSecondary">{PREGNANCY_SETTINGS_EMPTY_MESSAGE}</ThemedText>
            ) : (
              <View style={styles.fields}>
                <View
                  accessible
                  accessibilityLabel={pregnancyDueDateRowLabel(
                    formatDisplayDate(profile.estimatedDueDate),
                    dueDateSourceLabel(profile.dueDateSource)
                  )}
                  style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {PREGNANCY_DUE_DATE_LABEL}
                  </ThemedText>
                  <ThemedText style={styles.rowValue}>
                    {formatDisplayDate(profile.estimatedDueDate)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
                    {dueDateSourceLabel(profile.dueDateSource)}
                  </ThemedText>
                </View>

                {isConfirmingStop ? (
                  <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small">
                      {PREGNANCY_STOP_QUESTION}
                    </ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      {PREGNANCY_STOP_CONSEQUENCE}
                    </ThemedText>

                    {hasStopError && (
                      <ThemedText
                        accessibilityRole="alert"
                        type="small"
                        themeColor="textSecondary">
                        {PREGNANCY_STOP_FAILED_MESSAGE}
                      </ThemedText>
                    )}

                    <View style={styles.confirmActions}>
                      <Pressable
                        accessibilityRole="button"
                      accessibilityLabel={CANCEL_LABEL}
                        accessibilityState={{ disabled: isStopping }}
                        disabled={isStopping}
                        onPress={dismissStop}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          isStopping && styles.disabled,
                          pressed && !isStopping && styles.pressed,
                        ]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {CANCEL_LABEL}
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                      accessibilityLabel={PREGNANCY_STOP_CONFIRM_LABEL}
                        accessibilityState={{ disabled: isStopping }}
                        disabled={isStopping}
                        onPress={handleStop}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          { backgroundColor: theme.primary },
                          isStopping && styles.disabled,
                          pressed && !isStopping && styles.pressed,
                        ]}>
                        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                          {isStopping ? PREGNANCY_STOPPING_LABEL : PREGNANCY_STOP_CONFIRM_TEXT}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ) : selectedDueDate === null ? (
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                    accessibilityLabel={PREGNANCY_EDIT_DUE_DATE_LABEL}
                      accessibilityState={{ disabled: isSaving }}
                      disabled={isSaving}
                      onPress={openEditor}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        { backgroundColor: theme.primary },
                        isSaving && styles.disabled,
                        pressed && !isSaving && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                        {PREGNANCY_EDIT_DUE_DATE_TEXT}
                      </ThemedText>
                    </Pressable>

                    {/* Only worth offering when the date is not already the
                        calculated one. */}
                    {profile.dueDateSource === 'adjusted' && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={PREGNANCY_BACK_TO_LMP_LABEL}
                        accessibilityState={{ disabled: isSaving }}
                        disabled={isSaving}
                        onPress={() =>
                          applyDueDate(
                            calculateEstimatedDueDate(profile.lastMenstrualPeriodStartDate),
                            'lmp'
                          )
                        }
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          isSaving && styles.disabled,
                          pressed && !isSaving && styles.pressed,
                        ]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {isSaving ? SAVING_LABEL : PREGNANCY_BACK_TO_LMP_TEXT}
                        </ThemedText>
                      </Pressable>
                    )}

                    {hasSaveError && (
                      <ThemedText
                        accessibilityRole="alert"
                        type="small"
                        themeColor="textSecondary">
                        {PREGNANCY_SETTINGS_SAVE_FAILED_MESSAGE}
                      </ThemedText>
                    )}

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={PREGNANCY_STOP_OPEN_LABEL}
                      accessibilityState={{ disabled: isSaving }}
                      disabled={isSaving}
                      onPress={askToStop}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.stopButton,
                        isSaving && styles.disabled,
                        pressed && !isSaving && styles.pressed,
                      ]}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {PREGNANCY_STOP_CONFIRM_LABEL}
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="smallBold">{PREGNANCY_EDIT_DUE_DATE_LABEL}</ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      {PREGNANCY_LMP_PREFIX}{' '}
                      {formatDisplayDate(profile.lastMenstrualPeriodStartDate)}
                    </ThemedText>

                    <View style={styles.dateBar}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={PREGNANCY_SETTINGS_PREVIOUS_DAY_LABEL}
                        accessibilityState={{ disabled: !canGoBack }}
                        disabled={!canGoBack}
                        onPress={() => setSelectedDueDate(addDays(selectedDueDate, -1))}
                        style={({ pressed }) => [
                          styles.dayButton,
                          !canGoBack && styles.disabled,
                          pressed && canGoBack && styles.pressed,
                        ]}>
                        <ThemedText style={styles.dayButtonLabel}>‹</ThemedText>
                      </Pressable>

                      <ThemedText
                        accessibilityLabel={selectedDueDateLabel(formatDisplayDate(selectedDueDate))}
                        type="smallBold"
                        style={styles.selectedDate}>
                        {formatDisplayDate(selectedDueDate)}
                      </ThemedText>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={PREGNANCY_SETTINGS_NEXT_DAY_LABEL}
                        accessibilityState={{ disabled: isSaving }}
                        disabled={isSaving}
                        onPress={() => setSelectedDueDate(addDays(selectedDueDate, 1))}
                        style={({ pressed }) => [
                          styles.dayButton,
                          isSaving && styles.disabled,
                          pressed && !isSaving && styles.pressed,
                        ]}>
                        <ThemedText style={styles.dayButtonLabel}>›</ThemedText>
                      </Pressable>
                    </View>

                    {hasSaveError && (
                      <ThemedText
                        accessibilityRole="alert"
                        type="small"
                        themeColor="textSecondary">
                        {PREGNANCY_SETTINGS_SAVE_FAILED_MESSAGE}
                      </ThemedText>
                    )}

                    <View style={styles.confirmActions}>
                      <Pressable
                        accessibilityRole="button"
                      accessibilityLabel={CANCEL_LABEL}
                        accessibilityState={{ disabled: isSaving }}
                        disabled={isSaving}
                        onPress={closeEditor}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          isSaving && styles.disabled,
                          pressed && !isSaving && styles.pressed,
                        ]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {CANCEL_LABEL}
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={PREGNANCY_SAVE_DUE_DATE_LABEL}
                        accessibilityState={{ disabled: isSaving }}
                        disabled={isSaving}
                        onPress={() => applyDueDate(selectedDueDate, 'adjusted')}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          { backgroundColor: theme.primary },
                          isSaving && styles.disabled,
                          pressed && !isSaving && styles.pressed,
                        ]}>
                        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                          {isSaving ? SAVING_LABEL : SAVE_LABEL}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingRight: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  fields: {
    gap: Spacing.three,
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
  actions: {
    gap: Spacing.two,
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  dayButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  dayButtonLabel: {
    fontSize: 24,
    lineHeight: 28,
  },
  selectedDate: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  stopButton: {
    marginTop: Spacing.two,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
