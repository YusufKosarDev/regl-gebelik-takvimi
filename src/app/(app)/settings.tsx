import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getCycleSettings } from '@/features/cycle/application/get-cycle-settings';
import { updateCycleSettings } from '@/features/cycle/application/update-cycle-settings';
import {
  MAX_CYCLE_LENGTH_DAYS,
  MAX_PERIOD_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
  MIN_PERIOD_LENGTH_DAYS,
} from '@/features/cycle/domain/limits';
import type { CycleSettings } from '@/features/cycle/domain/types';
import {
  ACCOUNT_OPEN_LABEL,
  ACCOUNT_SECTION_DESCRIPTION,
  ACCOUNT_SECTION_TITLE,
  CYCLE_LENGTH_DECREASE_LABEL,
  CYCLE_LENGTH_FIELD_LABEL,
  CYCLE_LENGTH_FIELD_NOTE,
  CYCLE_LENGTH_INCREASE_LABEL,
  DAYS_UNIT,
  NOTIFICATIONS_SECTION_TITLE,
  PERIOD_LENGTH_DECREASE_LABEL,
  PERIOD_LENGTH_FIELD_LABEL,
  PERIOD_LENGTH_FIELD_NOTE,
  PERIOD_LENGTH_INCREASE_LABEL,
  SETTINGS_DESCRIPTION,
  SETTINGS_EMPTY_MESSAGE,
  SETTINGS_LOAD_FAILED_MESSAGE,
  SETTINGS_SAVE_FAILED_MESSAGE,
  SETTINGS_SAVE_LABEL,
  SETTINGS_TITLE,
  lengthValueLabel,
} from '@/features/cycle/presentation/settings-messages';
import { syncPeriodReminderQuietly } from '@/features/notifications/application/sync-period-reminder';
import { syncWidgetSnapshotQuietly } from '@/features/widget/application/sync-widget-snapshot';
import { setDiscreetNotifications } from '@/features/notifications/application/set-discreet-notifications';
import {
  loadDiscreetNotifications,
  loadNotificationPreferences,
} from '@/features/notifications/data/notification-preferences-repository';
import { DEFAULT_DISCREET_NOTIFICATIONS } from '@/features/notifications/domain/discreet-notifications';
import type { NotificationPreferences } from '@/features/notifications/domain/notification-preferences';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/features/notifications/domain/notification-preferences';
import { setReminderEnabled } from '@/features/notifications/application/set-reminder-enabled';
import { syncPregnancyWeeklyReminderQuietly } from '@/features/notifications/application/sync-pregnancy-weekly-reminder';
import type { NotificationPermissionStatus } from '@/features/notifications/infrastructure/notification-permission';
import { getNotificationPermissionStatus } from '@/features/notifications/infrastructure/notification-permission';
import {
  DISCREET_NOTIFICATIONS_DESCRIPTION,
  DISCREET_NOTIFICATIONS_TOGGLE_LABEL,
  NOTIFICATIONS_BLOCKED_NOTICE,
  OPEN_SYSTEM_SETTINGS_FAILED_MESSAGE,
  OPEN_SYSTEM_SETTINGS_LABEL,
  PERIOD_REMINDER_TOGGLE_LABEL,
  PERMISSION_REFUSED_MESSAGE,
  PREGNANCY_WEEKLY_REMINDER_TOGGLE_LABEL,
  REMINDERS_INTRO,
  REMINDER_SAVE_FAILED_MESSAGE,
} from '@/features/notifications/presentation/reminder-messages';
import { wipeLocalData } from '@/features/deletion/application/wipe-local-data';
import {
  LOCAL_WIPE_BUSY_LABEL,
  LOCAL_WIPE_CANCEL_LABEL,
  LOCAL_WIPE_CLOUD_DISCLAIMER,
  LOCAL_WIPE_CONFIRM_LABEL,
  LOCAL_WIPE_OPEN_LABEL,
  LOCAL_WIPE_PANEL_BODY,
  LOCAL_WIPE_PANEL_TITLE,
  LOCAL_WIPE_SECTION_DESCRIPTION,
  LOCAL_WIPE_SECTION_TITLE,
  LOCAL_WIPE_SIGNED_IN_NOTE,
  localWipeMessage,
} from '@/features/deletion/presentation/deletion-messages';
import {
  APP_LOCK_MANAGE_LABEL,
  APP_LOCK_SECTION_DESCRIPTION,
  APP_LOCK_SECTION_TITLE,
  APP_LOCK_SET_LABEL,
  APP_LOCK_STATUS_OFF,
  APP_LOCK_STATUS_ON,
} from '@/features/app-lock/presentation/app-lock-messages';
import { useAuthState } from '@/features/auth/application/use-auth-state';
import { ABOUT_OPEN_LABEL } from '@/features/disclaimer/presentation/disclaimer-messages';
import { useDataChangeReload } from '@/hooks/use-data-change-reload';
import { useTheme } from '@/hooks/use-theme';
import type { LocalDataChangeOrigin } from '@/shared/data-change/local-data-change';
import { DATA_REFRESHED_NOTICE } from '@/features/sync/presentation/sync-messages';
import {
  BACK_LABEL,
  LOADING_MESSAGE,
  SAVE_LABEL,
  SAVING_LABEL,
} from '@/shared/presentation/app-messages';
import { openAppDatabase } from '@/storage/db';
import { useAppLockStore } from '@/store/app-lock-store';
import { useAppStore } from '@/store/app-store';
import { getTodayLocalISODate } from '@/utils/today';
import { logEvent } from '@/shared/logging';

/**
 * The longest period length that makes sense alongside a given cycle length.
 *
 * A period cannot outlast the cycle it sits in, so the cycle length caps it as
 * well as the domain's own maximum. Both bounds are imported rather than
 * restated, so the stepper cannot offer a pair `validateCycleSettings` would
 * reject.
 */
function maxPeriodLengthFor(cycleLength: number): number {
  return Math.min(MAX_PERIOD_LENGTH_DAYS, cycleLength);
}

/**
 * The two averages the predictions are built from.
 *
 * Steppers rather than text entry: every value between the domain's bounds is
 * one tap away, and there is no way to type something that would have to be
 * rejected. Nothing here recalculates the averages from the recorded periods —
 * these are what the person says their cycle is like.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<CycleSettings | null>(null);
  const [hasError, setHasError] = useState(false);

  const [cycleLength, setCycleLength] = useState(MIN_CYCLE_LENGTH_DAYS);
  const [periodLength, setPeriodLength] = useState(MIN_PERIOD_LENGTH_DAYS);

  // What the form holds, and what was stored the last time it was read. The
  // reload compares the two to tell an unsaved edit from a form that simply
  // matches storage. Refs rather than state, so the reload callback stays
  // stable across every keystroke.
  const cycleLengthRef = useRef(cycleLength);
  const periodLengthRef = useRef(periodLength);
  const storedRef = useRef<CycleSettings | null>(null);

  // Kept in an effect rather than written during render: the compiler
  // forbids the latter, and a reload only reads these after an await, by which
  // time the effect has run.
  useEffect(() => {
    cycleLengthRef.current = cycleLength;
    periodLengthRef.current = periodLength;
    storedRef.current = settings;
  }, [cycleLength, periodLength, settings]);

  // Set only when a sync replaced what was on screen, and cleared on the next
  // save: a notice about an interruption that has been dealt with is clutter.
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  // A ref as well as the disabled prop: state updates are async, so two quick
  // taps could both read `isSaving` as false before the re-render lands.
  const saveInFlight = useRef(false);

  // Deleting everything on this phone. Confirmed inline rather than in a system
  // dialog, the same way restoring a backup is: the warning needs more than one
  // line, and the cloud disclaimer has to be readable before the button is.
  const auth = useAuthState();
  const appLockEnabled = useAppLockStore((state) => state.enabled);
  const resetAppState = useAppStore((state) => state.resetAppState);

  const [isConfirmingWipe, setIsConfirmingWipe] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeNotice, setWipeNotice] = useState<string | null>(null);
  const wipeInFlight = useRef(false);

  /**
   * Empties this device.
   *
   * Nothing is shown on success. A finished wipe turns the onboarding flag off,
   * which swaps the route group out from under this screen — a message set here
   * would either never be read or would be set on a component that has already
   * gone. Only the two outcomes that leave the person here say anything.
   */
  const handleConfirmWipe = async () => {
    if (wipeInFlight.current) {
      return;
    }

    wipeInFlight.current = true;
    setIsWiping(true);
    setWipeNotice(null);

    try {
      const db = await openAppDatabase();
      const outcome = await wipeLocalData({ db, resetAppState });

      const message = localWipeMessage(outcome);

      if (message === null) {
        // Gone. `RootLayout` is already unmounting this.
        return;
      }

      setWipeNotice(message);
      setIsConfirmingWipe(false);
    } catch (error: unknown) {
      logEvent('local data wipe failed', error);
      setWipeNotice(localWipeMessage({ kind: 'failed', reason: 'unknown' }));
    } finally {
      wipeInFlight.current = false;
      setIsWiping(false);
    }
  };

  // Read on the way in, so the switches show what is stored. No permission is
  // asked for until someone switches one on.
  const [reminders, setReminders] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [reminderField, setReminderField] = useState<keyof NotificationPreferences | null>(null);
  const [reminderNotice, setReminderNotice] = useState<string | null>(null);

  /**
   * Held apart from `reminders` because it is not one of them: it decides what
   * a reminder says rather than whether one happens, and cloud sync carries the
   * other two and not this.
   *
   * `discreetBusy` is its own flag rather than another value of `reminderField`
   * for the same reason — and because switching it rebuilds both queues, which
   * takes visibly longer than writing a preference.
   */
  const [discreet, setDiscreet] = useState(DEFAULT_DISCREET_NOTIFICATIONS);
  const [discreetBusy, setDiscreetBusy] = useState(false);

  // What the system says about delivering anything at all. Held apart from the
  // switches: a reminder can be switched on and still never arrive, and that is
  // the case worth a standing notice rather than a message after a press.
  const [permission, setPermission] = useState<NotificationPermissionStatus>('undetermined');
  const [settingsLinkNotice, setSettingsLinkNotice] = useState<string | null>(null);
  const reminderInFlight = useRef(false);

  /**
   * Stable, so the mount effect can depend on it.
   *
   * Reads the reminders too, and only reads them: asking the system for
   * permission while a screen is opening would be a dialog nobody asked for.
   */
  const readSettings = useCallback(async () => {
    const db = await openAppDatabase();

    // The permission is read here too, on every load and every refocus, so
    // coming back from system settings shows the new answer without anybody
    // having to press a switch to find out. It reads; it never prompts.
    const [stored, storedReminders, storedDiscreet, permission] = await Promise.all([
      getCycleSettings(db),
      loadNotificationPreferences(db),
      loadDiscreetNotifications(db),
      getNotificationPermissionStatus().catch(
        (): NotificationPermissionStatus => 'undetermined'
      ),
    ]);

    return {
      settings: stored,
      reminders: storedReminders,
      discreet: storedDiscreet,
      permission,
    };
  }, []);

  /**
   * Reads what is stored and puts the form back on top of it.
   *
   * The form is always replaced, including when it holds unsaved edits. The
   * alternative is keeping them, and keeping them means the next "Kaydet"
   * writes a number the person chose against data that no longer exists —
   * which is how a pulled value gets silently undone. Losing an unsaved edit
   * is recoverable by retyping it; losing a saved record from another phone is
   * not.
   *
   * `origin` is `null` when the screen was simply opened. Only an arrival that
   * interrupted something gets a notice.
   */
  const load = useCallback(
    (origin: LocalDataChangeOrigin | null) => {
      let cancelled = false;

      void (async () => {
        try {
          const data = await readSettings();

          if (cancelled) {
            return;
          }

          setSettings(data.settings);
          setReminders(data.reminders);
          setDiscreet(data.discreet);
          setPermission(data.permission);

          if (data.settings !== null) {
            // Against what was stored, not against what has just arrived: a
            // form that matched storage had nothing to interrupt, however far
            // the stored value moved.
            const hadUnsavedEdit =
              storedRef.current !== null &&
              (storedRef.current.averageCycleLengthDays !== cycleLengthRef.current ||
                storedRef.current.averagePeriodLengthDays !== periodLengthRef.current);

            setCycleLength(data.settings.averageCycleLengthDays);
            setPeriodLength(data.settings.averagePeriodLengthDays);

            if (origin === 'remote' && hadUnsavedEdit) {
              setRefreshNotice(DATA_REFRESHED_NOTICE);
            }
          }

          setHasError(false);
        } catch (error) {
          logEvent('cycle settings load failed', error);

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
    [readSettings]
  );

  useDataChangeReload(load);

  const maxPeriodLength = maxPeriodLengthFor(cycleLength);

  const changeCycleLength = (delta: number) => {
    const next = cycleLength + delta;

    setCycleLength(next);
    setHasSaveError(false);

    // Shortening the cycle can leave the period longer than the cycle it sits
    // in. Rather than let the person save a pair the domain would reject, the
    // period follows the cycle down.
    if (periodLength > maxPeriodLengthFor(next)) {
      setPeriodLength(maxPeriodLengthFor(next));
    }
  };

  const changePeriodLength = (delta: number) => {
    setPeriodLength(periodLength + delta);
    setHasSaveError(false);
  };

  /**
   * Switches one reminder.
   *
   * Turning one on can be refused by the system, and a refusal leaves the switch
   * where it was with a line saying why — springing back with no explanation
   * would look like the app losing the tap. Turning one off asks for nothing.
   */
  const handleReminder = async (field: keyof NotificationPreferences, enabled: boolean) => {
    if (reminderInFlight.current) {
      return;
    }

    reminderInFlight.current = true;
    setReminderField(field);
    setReminderNotice(null);

    try {
      const db = await openAppDatabase();
      const result = await setReminderEnabled(db, field, enabled);

      setReminders(result.preferences);

      // Switching a reminder is the most direct reason for its queue to change:
      // on schedules it, off takes it back out. Each one syncs only its own type.
      if (field === 'periodReminderEnabled') {
        await syncPeriodReminderQuietly(db, getTodayLocalISODate());
      }

      if (field === 'pregnancyWeeklyReminderEnabled') {
        await syncPregnancyWeeklyReminderQuietly(db);
      }

      if (result.permission !== null) {
        setPermission(result.permission);
      }

      if (enabled && result.permission !== 'granted') {
        setReminderNotice(PERMISSION_REFUSED_MESSAGE);
      }
    } catch (error) {
      logEvent('notification preference change failed', error);

      setReminderNotice(REMINDER_SAVE_FAILED_MESSAGE);
    } finally {
      reminderInFlight.current = false;
      setReminderField(null);
    }
  };

  /**
   * Switches how much a reminder says.
   *
   * Nothing is asked of the system and nothing can refuse it, so unlike the
   * reminders there is no permission branch — only the write and the rebuild of
   * anything already queued, which the use case does together.
   *
   * On a failure the switch goes back to what is stored rather than to what was
   * tapped. This is the one setting where showing the optimistic answer would
   * be worse than showing none: somebody who believes their lock screen is
   * quiet behaves differently from somebody who knows it is not.
   */
  const handleDiscreet = async (enabled: boolean) => {
    if (discreetBusy) {
      return;
    }

    setDiscreetBusy(true);
    setReminderNotice(null);

    try {
      const db = await openAppDatabase();

      setDiscreet(await setDiscreetNotifications(db, enabled, getTodayLocalISODate()));
    } catch (error) {
      logEvent('notification preference change failed', error);

      setReminderNotice(REMINDER_SAVE_FAILED_MESSAGE);

      try {
        setDiscreet(await loadDiscreetNotifications(await openAppDatabase()));
      } catch {
        // The stored answer could not be read either. Leaving the switch where
        // it is beats guessing: the notice above already says the change did
        // not happen.
      }
    } finally {
      setDiscreetBusy(false);
    }
  };

  /**
   * Sends somebody to the one screen that can undo a refusal.
   *
   * Android shows the permission dialog once. After that the app cannot ask
   * again — `ensureNotificationPermission` says as much — so a button that
   * tried would do nothing at all, twice as confusingly. This opens the app's
   * own page in system settings instead, which is where the switch actually is.
   *
   * `Linking.openSettings` is React Native's own, so nothing new is installed
   * for it. A failure is reported rather than swallowed: somebody who pressed a
   * button and saw nothing happen would reasonably press it again.
   */
  const handleOpenSystemSettings = async () => {
    setSettingsLinkNotice(null);

    try {
      await Linking.openSettings();
    } catch (error) {
      logEvent('notification settings open failed', error);

      setSettingsLinkNotice(OPEN_SYSTEM_SETTINGS_FAILED_MESSAGE);
    }
  };

  const handleSave = async () => {
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

      await updateCycleSettings(db, {
        averageCycleLengthDays: cycleLength,
        averagePeriodLengthDays: periodLength,
      });

      // The write is already durable, and the widget only holds a copy of it,
      // so a failed update here must not undo what was just saved.
      const today = getTodayLocalISODate();

      await syncWidgetSnapshotQuietly(db, today);
      await syncPeriodReminderQuietly(db, today);

      // Home reads again when it regains focus, so going back is enough to show
      // the predictions the new settings produce.
      router.back();
    } catch (error) {
      logEvent('cycle settings save failed', error);

      // The screen stays as it is with the error, so the values that were
      // rejected are still there to correct or try again.
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
          <ActivityIndicator testID="cycle-settings-loading" color={theme.text} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            {LOADING_MESSAGE}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

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
                {SETTINGS_TITLE}
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                {SETTINGS_DESCRIPTION}
              </ThemedText>
            </View>

            {hasError ? (
              <ThemedText accessibilityRole="alert" themeColor="textSecondary">
                {SETTINGS_LOAD_FAILED_MESSAGE}
              </ThemedText>
            ) : settings === null ? (
              <ThemedText themeColor="textSecondary">{SETTINGS_EMPTY_MESSAGE}</ThemedText>
            ) : (
              <View style={styles.fields}>
                <LengthStepper
                  label={CYCLE_LENGTH_FIELD_LABEL}
                  note={CYCLE_LENGTH_FIELD_NOTE}
                  value={cycleLength}
                  min={MIN_CYCLE_LENGTH_DAYS}
                  max={MAX_CYCLE_LENGTH_DAYS}
                  decreaseLabel={CYCLE_LENGTH_DECREASE_LABEL}
                  increaseLabel={CYCLE_LENGTH_INCREASE_LABEL}
                  onChange={changeCycleLength}
                  disabled={isSaving}
                  theme={theme}
                />

                <LengthStepper
                  label={PERIOD_LENGTH_FIELD_LABEL}
                  note={PERIOD_LENGTH_FIELD_NOTE}
                  value={periodLength}
                  min={MIN_PERIOD_LENGTH_DAYS}
                  max={maxPeriodLength}
                  decreaseLabel={PERIOD_LENGTH_DECREASE_LABEL}
                  increaseLabel={PERIOD_LENGTH_INCREASE_LABEL}
                  onChange={changePeriodLength}
                  disabled={isSaving}
                  theme={theme}
                />

                {/* Above the save button, because it is about what that
                    button is now going to write. */}
                {refreshNotice !== null && (
                  <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                    {refreshNotice}
                  </ThemedText>
                )}

                {hasSaveError && (
                  <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                    {SETTINGS_SAVE_FAILED_MESSAGE}
                  </ThemedText>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={SETTINGS_SAVE_LABEL}
                  accessibilityState={{ disabled: isSaving }}
                  disabled={isSaving}
                  onPress={handleSave}
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
            )}

            {/* Outside the cycle branch: what someone wants to be reminded
                about does not depend on what their cycle looks like. */}
            {hasError ? null : (
              <View style={styles.fields}>
                <ThemedText accessibilityRole="header" type="smallBold">
                  {NOTIFICATIONS_SECTION_TITLE}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  {REMINDERS_INTRO}
                </ThemedText>

                {/* Standing, not transient: while this is true every switch in
                    this section is a promise the phone will not keep, and that
                    is worth saying before somebody flips one rather than after.
                    Only for 'denied' — the one state the app cannot ask its way
                    out of. 'undetermined' is the ordinary starting point and
                    would be a warning about nothing. */}
                {permission === 'denied' && (
                  <View style={[styles.blockedPanel, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                      {NOTIFICATIONS_BLOCKED_NOTICE}
                    </ThemedText>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={OPEN_SYSTEM_SETTINGS_LABEL}
                      onPress={() => {
                        void handleOpenSystemSettings();
                      }}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: theme.backgroundSelected },
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold">{OPEN_SYSTEM_SETTINGS_LABEL}</ThemedText>
                    </Pressable>

                    {settingsLinkNotice !== null && (
                      <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                        {settingsLinkNotice}
                      </ThemedText>
                    )}
                  </View>
                )}

                <ReminderToggle
                  label={PERIOD_REMINDER_TOGGLE_LABEL}
                  value={reminders.periodReminderEnabled}
                  busy={reminderField === 'periodReminderEnabled'}
                  disabled={reminderField !== null}
                  onChange={(next) => handleReminder('periodReminderEnabled', next)}
                  theme={theme}
                />

                <ReminderToggle
                  label={PREGNANCY_WEEKLY_REMINDER_TOGGLE_LABEL}
                  value={reminders.pregnancyWeeklyReminderEnabled}
                  busy={reminderField === 'pregnancyWeeklyReminderEnabled'}
                  disabled={reminderField !== null}
                  onChange={(next) => handleReminder('pregnancyWeeklyReminderEnabled', next)}
                  theme={theme}
                />

                {/* Below the two reminders, because it is about what they say
                    and reads as nonsense above them. Its description sits
                    under the switch rather than above: the label is the thing
                    being decided, and the reason it exists is what somebody
                    reads next. */}
                <ReminderToggle
                  label={DISCREET_NOTIFICATIONS_TOGGLE_LABEL}
                  value={discreet}
                  busy={discreetBusy}
                  disabled={discreetBusy}
                  onChange={(next) => handleDiscreet(next)}
                  theme={theme}
                />

                <ThemedText type="small" themeColor="textSecondary">
                  {DISCREET_NOTIFICATIONS_DESCRIPTION}
                </ThemedText>

                {reminderNotice !== null && (
                  <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                    {reminderNotice}
                  </ThemedText>
                )}
              </View>
            )}

            {/* Outside every branch: an account is optional, it carries nothing
                yet, and the rest of the app works the same without one. */}
            <View style={styles.fields}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {ACCOUNT_SECTION_TITLE}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {ACCOUNT_SECTION_DESCRIPTION}
              </ThemedText>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ACCOUNT_OPEN_LABEL}
                onPress={() => router.push('/(app)/account')}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold">{ACCOUNT_OPEN_LABEL}</ThemedText>
              </Pressable>
            </View>

            {/* After the account, because whether there is one decides whether a
                forgotten PIN can be recovered at all - and somebody who has
                just read "Hesap açmak isteğe bağlı" is in the right frame of
                mind for that warning. */}
            <View style={styles.fields}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {APP_LOCK_SECTION_TITLE}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {APP_LOCK_SECTION_DESCRIPTION}
              </ThemedText>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={appLockEnabled ? APP_LOCK_MANAGE_LABEL : APP_LOCK_SET_LABEL}
                onPress={() => router.push('/(app)/app-lock')}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold">
                  {appLockEnabled ? APP_LOCK_MANAGE_LABEL : APP_LOCK_SET_LABEL}
                </ThemedText>
              </Pressable>

              <ThemedText type="small" themeColor="textSecondary">
                {appLockEnabled ? APP_LOCK_STATUS_ON : APP_LOCK_STATUS_OFF}
              </ThemedText>
            </View>

            {/* Above the destructive section, because somebody looking for what
                this app claims about itself should find it before they find the
                button that empties their phone. */}
            <View style={styles.fields}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ABOUT_OPEN_LABEL}
                onPress={() => router.push('/(app)/about')}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold">{ABOUT_OPEN_LABEL}</ThemedText>
              </Pressable>
            </View>

            {/* Last on the screen, and available whether or not there is an
                account: this is about the phone, not about a session. */}
            <View style={styles.fields}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {LOCAL_WIPE_SECTION_TITLE}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {LOCAL_WIPE_SECTION_DESCRIPTION}
              </ThemedText>

              {wipeNotice !== null && (
                <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                  {wipeNotice}
                </ThemedText>
              )}

              {!isConfirmingWipe && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={LOCAL_WIPE_OPEN_LABEL}
                  onPress={() => {
                    setWipeNotice(null);
                    setIsConfirmingWipe(true);
                  }}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold">{LOCAL_WIPE_OPEN_LABEL}</ThemedText>
                </Pressable>
              )}

              {isConfirmingWipe && (
                <View style={styles.fields}>
                  <ThemedText accessibilityRole="header" type="smallBold">
                    {LOCAL_WIPE_PANEL_TITLE}
                  </ThemedText>

                  <ThemedText type="small" themeColor="textSecondary">
                    {LOCAL_WIPE_PANEL_BODY}
                  </ThemedText>

                  {/* The line that keeps this apart from "Hesabı sil". */}
                  <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                    {LOCAL_WIPE_CLOUD_DISCLAIMER}
                  </ThemedText>

                  {auth.status === 'signed-in' && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {LOCAL_WIPE_SIGNED_IN_NOTE}
                    </ThemedText>
                  )}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={LOCAL_WIPE_CONFIRM_LABEL}
                    accessibilityState={{ disabled: isWiping }}
                    disabled={isWiping}
                    onPress={() => {
                      void handleConfirmWipe();
                    }}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { backgroundColor: theme.primary },
                      isWiping && styles.disabled,
                      pressed && !isWiping && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                      {isWiping ? LOCAL_WIPE_BUSY_LABEL : LOCAL_WIPE_CONFIRM_LABEL}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={LOCAL_WIPE_CANCEL_LABEL}
                    accessibilityState={{ disabled: isWiping }}
                    disabled={isWiping}
                    onPress={() => {
                      setIsConfirmingWipe(false);
                    }}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      { borderColor: theme.backgroundSelected },
                      isWiping && styles.disabled,
                      pressed && !isWiping && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">{LOCAL_WIPE_CANCEL_LABEL}</ThemedText>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * One reminder, as a labelled switch.
 *
 * A real `Switch` rather than a button: it is a two-state setting, and it should
 * look and read like one. The label is the accessibility label as well, so a
 * screen reader announces the setting and its state together.
 */
function ReminderToggle({
  label,
  value,
  busy,
  disabled,
  onChange,
  theme,
}: {
  label: string;
  value: boolean;
  busy: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.reminderRow, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={styles.reminderLabel}>{label}</ThemedText>

      <Switch
        trackColor={{ false: theme.backgroundSelected, true: theme.switchTrackOn }}
        thumbColor={value ? theme.switchThumbOn : undefined}
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        testID={busy ? 'reminder-busy' : undefined}
      />
    </View>
  );
}

/**
 * One whole-number setting, in days.
 *
 * The bounds are passed in rather than read here, because the period length's
 * maximum depends on the cycle length as well as on the domain's own limit.
 */
function LengthStepper({
  label,
  note,
  value,
  min,
  max,
  decreaseLabel,
  increaseLabel,
  onChange,
  disabled,
  theme,
}: {
  label: string;
  note: string;
  value: number;
  min: number;
  max: number;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (delta: number) => void;
  disabled: boolean;
  theme: { text: string; backgroundSelected: string };
}) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {note}
      </ThemedText>

      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={decreaseLabel}
          accessibilityState={{ disabled: !canDecrease }}
          disabled={!canDecrease}
          onPress={() => onChange(-1)}
          style={({ pressed }) => [
            styles.stepButton,
            { borderColor: theme.backgroundSelected },
            !canDecrease && styles.stepButtonDisabled,
            pressed && canDecrease && styles.pressed,
          ]}>
          <ThemedText style={styles.stepButtonLabel}>−</ThemedText>
        </Pressable>

        <View
          accessible
          accessibilityLabel={lengthValueLabel(label, value)}
          accessibilityValue={{ min, max, now: value }}
          style={styles.valueBlock}>
          <ThemedText style={styles.value}>{value}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {DAYS_UNIT}
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}
          accessibilityState={{ disabled: !canIncrease }}
          disabled={!canIncrease}
          onPress={() => onChange(1)}
          style={({ pressed }) => [
            styles.stepButton,
            { borderColor: theme.backgroundSelected },
            !canIncrease && styles.stepButtonDisabled,
            pressed && canIncrease && styles.pressed,
          ]}>
          <ThemedText style={styles.stepButtonLabel}>+</ThemedText>
        </Pressable>
      </View>
    </View>
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
    gap: Spacing.four,
  },
  // The standing notice about blocked notifications, set apart from the
  // switches it is about so it does not read as one more row of them.
  blockedPanel: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  field: {
    gap: Spacing.half,
  },
  note: {
    marginTop: Spacing.half,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  stepButton: {
    minWidth: 56,
    minHeight: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    opacity: 0.35,
  },
  stepButtonLabel: {
    fontSize: 26,
    lineHeight: 30,
  },
  valueBlock: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  value: {
    fontSize: 56,
    lineHeight: 62,
    fontWeight: '600',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 56,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  reminderLabel: {
    flexShrink: 1,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
