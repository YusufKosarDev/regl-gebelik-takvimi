import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectedLanguagePicker } from '@/components/language-picker';
import { LengthStepper } from '@/features/cycle/components/length-stepper';
import { NotificationsSection } from '@/features/notifications/components/notifications-section';
import { ButtonLabel, ThemedText } from '@/components/themed-text';
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
import { settingsMessages } from '@/features/cycle/presentation/settings-messages';
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
import type { BlockedReminderChannels } from '@/features/notifications/infrastructure/blocked-reminder-channels';
import {
  NO_BLOCKED_REMINDER_CHANNELS,
  loadBlockedReminderChannels,
} from '@/features/notifications/infrastructure/blocked-reminder-channels';
import type { NotificationSettingsTarget } from '@/features/notifications/domain/notification-settings-target';
import { openNotificationSettings } from '@/features/notifications/infrastructure/open-notification-settings';
import {
  ensureNotificationPermission,
  getNotificationPermissionStatus,
} from '@/features/notifications/infrastructure/notification-permission';
import { reminderMessages } from '@/features/notifications/presentation/reminder-messages';
import { wipeLocalData } from '@/features/deletion/application/wipe-local-data';
import {
  deletionMessages,
  localWipeMessageIn,
} from '@/features/deletion/presentation/deletion-messages';
import { appLockMessages } from '@/features/app-lock/presentation/app-lock-messages';
import { waitMessageIn } from '@/features/app-lock/presentation/wait-message';
import { unlockWithPin } from '@/features/app-lock/application/unlock-with-pin';
import { PinDots } from '@/features/app-lock/components/pin-dots';
import { PinPad } from '@/features/app-lock/components/pin-pad';
import { PIN_LENGTH } from '@/features/app-lock/domain/pin';
import { useAuthState } from '@/features/auth/application/use-auth-state';
import { reauthenticateWithPassword } from '@/features/auth/data/auth-repository';
import { toAuthError } from '@/features/auth/domain/auth-error';
import { authErrorMessageIn, authMessages } from '@/features/auth/presentation/auth-messages';
import { disclaimerMessages } from '@/features/disclaimer/presentation/disclaimer-messages';
import { useDataChangeReload } from '@/hooks/use-data-change-reload';
import { exportMessages } from '@/features/export/presentation/export-messages';
import { useTheme } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';
import { appMessages } from '@/shared/presentation/app-messages';
import type { LocalDataChangeOrigin } from '@/shared/data-change/local-data-change';
import { syncMessages } from '@/features/sync/presentation/sync-messages';

import { openAppDatabase } from '@/storage/db';
import { useAppLockStore } from '@/store/app-lock-store';
import { useAppStore } from '@/store/app-store';
import { getTodayLocalISODate } from '@/utils/today';
import { logEvent } from '@/shared/logging';
import { useTabBarInset } from '@/components/tab-bar';
import { useRevealInView } from '@/hooks/use-reveal-in-view';
import { ProfileIdentity } from '@/features/auth/components/profile-identity';
import { loadAvatarConfig } from '@/features/avatar/data/avatar-repository';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import { homeMessages } from '@/features/cycle/presentation/home-messages';

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
  const tabBarInset = useTabBarInset();

  // The wipe confirmation opens in place, below a button that is already near
  // the bottom of a long screen. The inset is the bar's, because it floats
  // over the content rather than sitting under it.
  const revealWipe = useRevealInView({ bottomInset: tabBarInset });
  const sync1 = useMessages(syncMessages);
  const lock = useMessages(appLockMessages);
  const deletion = useMessages(deletionMessages);
  const reminderStrings = useMessages(reminderMessages);
  const cycleSettings = useMessages(settingsMessages);
  const disclaimer = useMessages(disclaimerMessages);
  const exportStrings = useMessages(exportMessages);
  const common = useMessages(appMessages);

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
  const home = useMessages(homeMessages);

  /** Read here so the tab can show the person rather than a link to them. */
  const [avatar, setAvatar] = useState<AvatarConfig | null>(null);
  const appLockEnabled = useAppLockStore((state) => state.enabled);
  const resetAppState = useAppStore((state) => state.resetAppState);
  // The wipe deletes the lock record; this is the app's own copy of that fact.
  const forgetAppLockState = useAppLockStore((state) => state.markDisabled);

  const [isConfirmingWipe, setIsConfirmingWipe] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeNotice, setWipeNotice] = useState<string | null>(null);
  const wipeInFlight = useRef(false);

  // The identity check in front of the wipe: the PIN when a lock is set, the
  // account password when there is a session and no lock. With neither there
  // is nothing to prove a person with, and the two-step confirm stands alone.
  const authStrings = useMessages(authMessages);
  const [wipePinEntered, setWipePinEntered] = useState('');
  const [wipePassword, setWipePassword] = useState('');
  const [wipeVerifyMessage, setWipeVerifyMessage] = useState<string | null>(null);

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
      const outcome = await wipeLocalData({ db, resetAppState, forgetAppLockState });

      const message = localWipeMessageIn(deletion, outcome);

      if (message === null) {
        // Gone. `RootLayout` is already unmounting this.
        return;
      }

      setWipeNotice(message);
      setIsConfirmingWipe(false);
    } catch (error: unknown) {
      logEvent('local data wipe failed', error);
      setWipeNotice(localWipeMessageIn(deletion, { kind: 'failed', reason: 'unknown' }));
    } finally {
      wipeInFlight.current = false;
      setIsWiping(false);
    }
  };

  /**
   * The wipe behind the PIN.
   *
   * `unlockWithPin` rather than a comparison: the counters are written before
   * the answer returns, so a wrong guess here costs the same wait it costs on
   * the lock screen. A record that turns out to be gone has nothing left to
   * check a PIN against — the six digits were typed at a deliberate prompt,
   * which is no weaker a confirmation than the button it replaced.
   */
  const verifyWipePin = async (pin: string) => {
    if (wipeInFlight.current) {
      return;
    }

    try {
      const outcome = await unlockWithPin(pin);

      if (outcome.kind === 'waiting') {
        setWipeVerifyMessage(waitMessageIn(lock, outcome.remainingMs));

        return;
      }

      if (outcome.kind === 'wrong') {
        setWipeVerifyMessage(lock.lockWrongPinMessage);

        return;
      }

      await handleConfirmWipe();
    } catch (error: unknown) {
      logEvent('local data wipe failed', error);
      setWipeVerifyMessage(localWipeMessageIn(deletion, { kind: 'failed', reason: 'unknown' }));
    } finally {
      setWipePinEntered('');
    }
  };

  const handleWipePinDigit = (digit: string) => {
    setWipeVerifyMessage(null);

    setWipePinEntered((current) => {
      if (current.length >= PIN_LENGTH) {
        return current;
      }

      const next = current + digit;

      if (next.length === PIN_LENGTH) {
        void verifyWipePin(next);
      }

      return next;
    });
  };

  const handleWipePinDelete = () => {
    setWipeVerifyMessage(null);
    setWipePinEntered((current) => current.slice(0, -1));
  };

  /**
   * The wipe behind the account password.
   *
   * The same reauthentication deleting the account uses, and for the same
   * reason: these are the two actions that destroy, and a session that has
   * merely been left open must not be enough for either.
   */
  const handlePasswordWipe = async () => {
    if (wipeInFlight.current || auth.status !== 'signed-in') {
      return;
    }

    setWipeVerifyMessage(null);

    try {
      await reauthenticateWithPassword(auth.user.email ?? '', wipePassword);
    } catch (error: unknown) {
      setWipeVerifyMessage(authErrorMessageIn(authStrings, toAuthError(error).code));

      return;
    } finally {
      setWipePassword('');
    }

    await handleConfirmWipe();
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

  /**
   * Which reminders Android itself is discarding.
   *
   * Read beside the permission and for the same reason, on all three of
   * `useDataChangeReload`'s triggers: mount, gaining navigation focus, and the
   * app returning to the foreground. Silencing a channel happens in system
   * settings, so coming back from another app is the moment the answer can have
   * changed — and the third trigger is the one that covers it. Until the hook
   * grew its `AppState` listener, that return fired nothing at all, and
   * somebody could unblock a channel and come home to a screen still saying it
   * was blocked. It reads; it never prompts.
   */
  const [blockedChannels, setBlockedChannels] = useState<BlockedReminderChannels>(
    NO_BLOCKED_REMINDER_CHANNELS
  );
  const [settingsLinkNotice, setSettingsLinkNotice] = useState<string | null>(null);
  const reminderInFlight = useRef(false);

  /**
   * Whether the permission dialog is on screen.
   *
   * Its own flag rather than another value of `reminderField`: no switch moved,
   * and the thing that must not happen twice is a system dialog rather than a
   * write.
   */
  const [askingPermission, setAskingPermission] = useState(false);
  const askPermissionInFlight = useRef(false);

  /**
   * The permission the queue was last rebuilt for.
   *
   * So the rebuild below happens on the transition into 'granted' and not on
   * every focus. A rebuild is idempotent, so doing it every time would be
   * harmless and wasteful; doing it never would make the notice lie.
   */
  const syncedPermission = useRef<NotificationPermissionStatus | null>(null);

  /**
   * Stable, so the mount effect can depend on it.
   *
   * Reads the reminders too, and only reads them: asking the system for
   * permission while a screen is opening would be a dialog nobody asked for.
   */
  /**
   * Rewrites the widget's snapshot after the language changes.
   *
   * The widget renders the last snapshot the app wrote, so without this its day
   * and phase keep the old language until something unrelated happens to write
   * one — which, for somebody who changes the language and puts the phone down,
   * could be days.
   *
   * Quiet and fire-and-forget: the preference is already stored by the time
   * this runs, and failing the language change because a copy of the data could
   * not be refreshed would undo the thing that worked over the thing that did
   * not. `syncWidgetSnapshotQuietly` resolves the language itself, which by now
   * is the one that was just chosen.
   */
  const refreshWidgetLanguage = useCallback(() => {
    void (async () => {
      const db = await openAppDatabase();

      await syncWidgetSnapshotQuietly(db, getTodayLocalISODate());
    })().catch((error: unknown) => {
      logEvent('widget sync failed', error);
    });
  }, []);

  const readSettings = useCallback(async () => {
    const db = await openAppDatabase();

    // The permission is read here too, on the same three triggers, so coming
    // back from system settings shows the new answer without anybody having to
    // press a switch to find out. The panel below sends people to those
    // settings itself, which makes the trip out and back the expected route
    // rather than an unusual one. It reads; it never prompts.
    const [stored, storedReminders, storedDiscreet, storedAvatar, permission, blocked] =
      await Promise.all([
        getCycleSettings(db),
        loadNotificationPreferences(db),
        loadDiscreetNotifications(db),
        // The person, for the block at the top. Read on the same trip as the
        // rest rather than in an effect of its own.
        loadAvatarConfig(db),
        getNotificationPermissionStatus().catch(
          (): NotificationPermissionStatus => 'undetermined'
        ),
        // Nothing blocked when it cannot be read. Saying less than the app
        // knows beats telling somebody their phone is wrong when it is not.
        loadBlockedReminderChannels().catch(() => NO_BLOCKED_REMINDER_CHANNELS),
      ]);

    return {
      settings: stored,
      reminders: storedReminders,
      discreet: storedDiscreet,
      avatar: storedAvatar,
      permission,
      blocked,
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
          setAvatar(data.avatar);
          setReminders(data.reminders);
          setDiscreet(data.discreet);
          setPermission(data.permission);
          setBlockedChannels(data.blocked);

          /*
           * The moment a reminder already switched on can finally be queued.
           *
           * Nothing was scheduled while the system would not deliver - both
           * syncs cancel and return in that state - so permission arriving is
           * what turns the preference back into something in the queue. The
           * notice this screen shows promises exactly that ("izin verdiğinde
           * hatırlatıcı çalışmaya başlar"), and without this it would come
           * true only when the home screen next mounted: the same defect of
           * naming a remedy that does not happen, one screen along.
           *
           * Quiet and unawaited, like the home screen's own: the person came
           * here to read a notice, not to wait for a queue, and a sync that
           * failed is not news on this screen.
           */
          const previousPermission = syncedPermission.current;

          syncedPermission.current = data.permission;

          if (
            data.permission === 'granted' &&
            previousPermission !== 'granted' &&
            (data.reminders.periodReminderEnabled ||
              data.reminders.pregnancyWeeklyReminderEnabled)
          ) {
            void (async () => {
              try {
                const db = await openAppDatabase();

                await syncPeriodReminderQuietly(db, getTodayLocalISODate());
                await syncPregnancyWeeklyReminderQuietly(db);
              } catch (syncError) {
                logEvent('notification sync failed', syncError);
              }
            })();
          }

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
              setRefreshNotice(sync1.dataRefreshedNotice);
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
    [readSettings, sync1]
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
        setReminderNotice(reminderStrings.permissionRefusedMessage);
      }
    } catch (error) {
      logEvent('notification preference change failed', error);

      setReminderNotice(reminderStrings.reminderSaveFailedMessage);
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

      setReminderNotice(reminderStrings.reminderSaveFailedMessage);

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
   * Asks for the permission a reminder already switched on is waiting for.
   *
   * The button this belongs to only appears while somebody is waiting for a
   * reminder that cannot arrive and Android is still willing to be asked - see
   * `NotificationsSection`, which works that out from the stored switches
   * because the permission status cannot. For the person who restored their
   * account onto a new phone this is the whole repair: they are asked the
   * question they were never asked, and the queue is built from the preference
   * that came back with them.
   *
   * No write. The preference already says yes; what was missing was the
   * system's half, so nothing here touches the database except to rebuild the
   * queue once there is a point to it.
   *
   * A refusal says so and leaves the switches alone. When Android has decided
   * it will not ask again the status comes back 'denied', and the panel this
   * was pressed in rewrites itself into the settings route on the next render -
   * which is why the message below is the only thing needed for the refusal
   * Android is still prepared to reconsider.
   *
   * That message is `reminderPermissionDeclinedMessage` and not
   * `permissionRefusedMessage`: the second half of the latter says permission
   * is needed to switch a reminder on, and the reminder here is already on.
   */
  const handleAskPermission = async () => {
    if (askPermissionInFlight.current) {
      return;
    }

    askPermissionInFlight.current = true;
    setAskingPermission(true);
    setReminderNotice(null);
    setSettingsLinkNotice(null);

    try {
      const next = await ensureNotificationPermission();

      setPermission(next);

      if (next === 'granted') {
        const db = await openAppDatabase();

        syncedPermission.current = next;

        await syncPeriodReminderQuietly(db, getTodayLocalISODate());
        await syncPregnancyWeeklyReminderQuietly(db);
      } else {
        setReminderNotice(reminderStrings.reminderPermissionDeclinedMessage);
      }
    } catch (error) {
      // Logged and nothing more. The panel already says the permission is
      // missing and the press did not change that, so it is still true -
      // whereas a message about a setting that could not be saved would be
      // about something this never tried to do.
      logEvent('notification permission request failed', error);
    } finally {
      askPermissionInFlight.current = false;
      setAskingPermission(false);
    }
  };

  /**
   * Sends somebody to the one screen that can undo a refusal.
   *
   * Android shows the permission dialog once. After that the app cannot ask
   * again — `ensureNotificationPermission` says as much — so a button that
   * tried would do nothing at all, twice as confusingly. This opens the system
   * settings page that holds the switch instead.
   *
   * Which page is `openNotificationSettings`'s decision and the panel's: the
   * app's notification page when nothing is being delivered, and one
   * reminder's own page when that reminder's channel is the thing that was
   * switched off. It used to be `Linking.openSettings()` for every case, which
   * is App info — a page with Uninstall on it and the word Notifications a tap
   * further down, under a sentence that had just said "telefonun bildirim
   * ayarlarında kapatılmış, oradan tekrar açabilirsin".
   *
   * A failure is still reported rather than swallowed: somebody who pressed a
   * button and saw nothing happen would reasonably press it again.
   */
  const handleOpenSystemSettings = async (target: NotificationSettingsTarget) => {
    setSettingsLinkNotice(null);

    try {
      await openNotificationSettings(target);
    } catch (error) {
      logEvent('notification settings open failed', error);

      setSettingsLinkNotice(reminderStrings.openSystemSettingsFailedMessage);
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

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ActivityIndicator testID="cycle-settings-loading" color={theme.text} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            {common.loadingMessage}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          {...revealWipe.scrollViewProps}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.five + tabBarInset }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
                {cycleSettings.settingsTitle}
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                {cycleSettings.settingsDescription}
              </ThemedText>
            </View>

            {/* Who this is, before any setting.

                Ours: the app this follows structurally has a tab for the
                person and shows nothing of what is on it. What this replaces
                is a tab that opened with the cycle-length steppers and kept
                the account behind a button somebody had to press to find out
                their own state. */}
            <ProfileIdentity
              auth={auth}
              avatar={avatar}
              avatarLabel={avatar === null ? home.avatarCreateLabel : home.avatarEditLabel}
              // What the control does for the state the person is in. One
              // constant for both read "Hesabı aç" directly under the address
              // of the account they were signed in to.
              accountLabel={
                auth.status === 'signed-in'
                  ? cycleSettings.accountManageLabel
                  : cycleSettings.accountOpenLabel
              }
              onOpenAvatar={() => router.push('/(app)/avatar')}
              onOpenAccount={() => router.push('/(app)/account')}
            />

            {hasError ? (
              <ThemedText accessibilityRole="alert" themeColor="textSecondary">
                {cycleSettings.settingsLoadFailedMessage}
              </ThemedText>
            ) : settings === null ? (
              <ThemedText themeColor="textSecondary">{cycleSettings.settingsEmptyMessage}</ThemedText>
            ) : (
              <View style={styles.fields}>
                {/* A heading of its own, now that the screen is named for the
                    whole tab rather than for this one section. */}
                <ThemedText accessibilityRole="header" type="smallBold">
                  {cycleSettings.cycleSectionTitle}
                </ThemedText>

                <LengthStepper
                  label={cycleSettings.cycleLengthFieldLabel}
                  note={cycleSettings.cycleLengthFieldNote}
                  value={cycleLength}
                  min={MIN_CYCLE_LENGTH_DAYS}
                  max={MAX_CYCLE_LENGTH_DAYS}
                  decreaseLabel={cycleSettings.cycleLengthDecreaseLabel}
                  increaseLabel={cycleSettings.cycleLengthIncreaseLabel}
                  onChange={changeCycleLength}
                  disabled={isSaving}
                />

                <LengthStepper
                  label={cycleSettings.periodLengthFieldLabel}
                  note={cycleSettings.periodLengthFieldNote}
                  value={periodLength}
                  min={MIN_PERIOD_LENGTH_DAYS}
                  max={maxPeriodLength}
                  decreaseLabel={cycleSettings.periodLengthDecreaseLabel}
                  increaseLabel={cycleSettings.periodLengthIncreaseLabel}
                  onChange={changePeriodLength}
                  disabled={isSaving}
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
                    {cycleSettings.settingsSaveFailedMessage}
                  </ThemedText>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={cycleSettings.settingsSaveLabel}
                  accessibilityState={{ disabled: isSaving }}
                  disabled={isSaving}
                  onPress={handleSave}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.primary },
                    isSaving && styles.disabled,
                    pressed && !isSaving && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={[ButtonLabel, { color: theme.onPrimary }]}>
                    {isSaving ? common.savingLabel : common.saveLabel}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {/* Outside the cycle branch: what someone wants to be reminded
                about does not depend on what their cycle looks like. */}
            {hasError ? null : (
              <NotificationsSection
                reminders={reminders}
                reminderField={reminderField}
                reminderNotice={reminderNotice}
                discreet={discreet}
                discreetBusy={discreetBusy}
                permission={permission}
                askingPermission={askingPermission}
                blockedChannels={blockedChannels}
                settingsLinkNotice={settingsLinkNotice}
                onReminderChange={handleReminder}
                onDiscreetChange={handleDiscreet}
                onAskPermission={() => {
                  void handleAskPermission();
                }}
                onOpenSystemSettings={(target) => {
                  void handleOpenSystemSettings(target);
                }}
              />
            )}

            {/* After the account, because whether there is one decides whether a
                forgotten PIN can be recovered at all - and somebody who has
                just read "Hesap açmak isteğe bağlı" is in the right frame of
                mind for that warning. */}
            <View style={styles.fields}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {lock.appLockSectionTitle}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {lock.appLockSectionDescription}
              </ThemedText>

              {/* Above the button, not below it.

                  Underneath, "Açık" sat on its own after the control with a
                  section heading following it, so it read as a stray word
                  belonging to neither - on a device it looked like the title
                  of the next section. The order a person reads is what this
                  is, what it does, what state it is in, and then how to
                  change it. */}
              <ThemedText type="small" themeColor="textSecondary">
                {appLockEnabled ? lock.appLockStatusOn : lock.appLockStatusOff}
              </ThemedText>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={appLockEnabled ? lock.appLockManageLabel : lock.appLockSetLabel}
                onPress={() => router.push('/(app)/app-lock')}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={ButtonLabel}>
                  {appLockEnabled ? lock.appLockManageLabel : lock.appLockSetLabel}
                </ThemedText>
              </Pressable>
            </View>

            {/* Above the about link and below the lock: it belongs with the
                settings that are about the app rather than about the records,
                and somebody who has landed in a language they cannot read is
                looking for this before they look for anything else. */}
            <ConnectedLanguagePicker onChanged={refreshWidgetLanguage} />

            {/* Directly above the section that empties the phone, because the
                two are the same question from opposite ends: somebody about to
                delete everything should pass the way to take it with them
                first. */}
            <View style={styles.fields}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {exportStrings.exportTitle}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {exportStrings.exportDescription}
              </ThemedText>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={exportStrings.exportTitle}
                onPress={() => router.push('/(app)/export')}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={ButtonLabel}>{exportStrings.exportTitle}</ThemedText>
              </Pressable>
            </View>

            {/* Above the destructive section, because somebody looking for what
                this app claims about itself should find it before they find the
                button that empties their phone. */}
            <View style={styles.fields}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={disclaimer.aboutOpenLabel}
                onPress={() => router.push('/(app)/about')}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={ButtonLabel}>{disclaimer.aboutOpenLabel}</ThemedText>
              </Pressable>
            </View>

            {/* Last on the screen, and available whether or not there is an
                account: this is about the phone, not about a session. */}
            <View style={styles.fields}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {deletion.localWipeSectionTitle}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {deletion.localWipeSectionDescription}
              </ThemedText>

              {wipeNotice !== null && (
                <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                  {wipeNotice}
                </ThemedText>
              )}

              {!isConfirmingWipe && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={deletion.localWipeOpenLabel}
                  onPress={() => {
                    setWipeNotice(null);
                    setWipeVerifyMessage(null);
                    setWipePinEntered('');
                    setWipePassword('');
                    setIsConfirmingWipe(true);
                  }}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={ButtonLabel}>{deletion.localWipeOpenLabel}</ThemedText>
                </Pressable>
              )}

              {isConfirmingWipe && (
                <View {...revealWipe.targetProps} style={styles.fields}>
                  <ThemedText accessibilityRole="header" type="smallBold">
                    {deletion.localWipePanelTitle}
                  </ThemedText>

                  <ThemedText type="small" themeColor="textSecondary">
                    {deletion.localWipePanelBody}
                  </ThemedText>

                  {/* The line that keeps this apart from "Hesabı sil". */}
                  <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                    {deletion.localWipeCloudDisclaimer}
                  </ThemedText>

                  {auth.status === 'signed-in' && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {deletion.localWipeSignedInNote}
                    </ThemedText>
                  )}

                  {/* Cancel first and filled, the wipe second and outlined.
                      Same reasoning as the account panel, written out in
                      `deletion-messages.ts`: the one emphatic treatment this
                      app has must not land on the irreversible action. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={deletion.localWipeCancelLabel}
                    accessibilityState={{ disabled: isWiping }}
                    disabled={isWiping}
                    onPress={() => {
                      setIsConfirmingWipe(false);
                    }}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { backgroundColor: theme.primary },
                      isWiping && styles.disabled,
                      pressed && !isWiping && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold" style={[ButtonLabel, { color: theme.onPrimary }]}>
                      {deletion.localWipeCancelLabel}
                    </ThemedText>
                  </Pressable>

                  {appLockEnabled && (
                    <>
                      <ThemedText
                        accessibilityRole="header"
                        type="smallBold"
                        style={styles.wipeVerifyTitle}>
                        {deletion.localWipeVerifyPinTitle}
                      </ThemedText>

                      <PinDots entered={wipePinEntered.length} />

                      {wipeVerifyMessage !== null && (
                        <ThemedText
                          accessibilityRole="alert"
                          type="small"
                          themeColor="textSecondary"
                          style={styles.wipeVerifyTitle}>
                          {wipeVerifyMessage}
                        </ThemedText>
                      )}

                      <PinPad
                        onDigit={handleWipePinDigit}
                        onDelete={handleWipePinDelete}
                        disabled={isWiping}
                      />
                    </>
                  )}

                  {!appLockEnabled && auth.status === 'signed-in' && (
                    <>
                      <ThemedText accessibilityRole="header" type="smallBold">
                        {deletion.localWipeVerifyPasswordTitle}
                      </ThemedText>

                      <TextInput
                        style={[
                          styles.wipePasswordInput,
                          { borderColor: theme.backgroundSelected, color: theme.text },
                        ]}
                        placeholder={authStrings.passwordLabel}
                        placeholderTextColor={theme.textSecondary}
                        secureTextEntry
                        autoCapitalize="none"
                        autoComplete="current-password"
                        value={wipePassword}
                        onChangeText={(value) => {
                          setWipeVerifyMessage(null);
                          setWipePassword(value);
                        }}
                        editable={!isWiping}
                      />

                      {wipeVerifyMessage !== null && (
                        <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                          {wipeVerifyMessage}
                        </ThemedText>
                      )}

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={deletion.localWipeConfirmLabel}
                        accessibilityState={{ disabled: isWiping }}
                        disabled={isWiping}
                        onPress={() => {
                          void handlePasswordWipe();
                        }}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          { borderColor: theme.backgroundSelected },
                          isWiping && styles.disabled,
                          pressed && !isWiping && styles.pressed,
                        ]}>
                        <ThemedText type="smallBold" style={ButtonLabel}>
                          {isWiping ? deletion.localWipeBusyLabel : deletion.localWipeConfirmLabel}
                        </ThemedText>
                      </Pressable>
                    </>
                  )}

                  {!appLockEnabled && auth.status !== 'signed-in' && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={deletion.localWipeConfirmLabel}
                      accessibilityState={{ disabled: isWiping }}
                      disabled={isWiping}
                      onPress={() => {
                        void handleConfirmWipe();
                      }}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: theme.backgroundSelected },
                        isWiping && styles.disabled,
                        pressed && !isWiping && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold" style={ButtonLabel}>
                        {isWiping ? deletion.localWipeBusyLabel : deletion.localWipeConfirmLabel}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              )}
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
  wipeVerifyTitle: {
    textAlign: 'center',
  },
  wipePasswordInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    fontSize: 16,
  },
});
