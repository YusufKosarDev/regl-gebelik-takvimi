import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuthState } from '@/features/auth/application/use-auth-state';
import {
  sendPasswordReset,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from '@/features/auth/data/auth-repository';
import { deleteAccount } from '@/features/deletion/application/delete-account';
import {
  ACCOUNT_DELETE_BUSY_LABEL,
  ACCOUNT_DELETE_CANCEL_LABEL,
  ACCOUNT_DELETE_CONFIRM_LABEL,
  ACCOUNT_DELETE_EMPTY_PASSWORD_MESSAGE,
  ACCOUNT_DELETE_OPEN_LABEL,
  ACCOUNT_DELETE_PANEL_BODY,
  ACCOUNT_DELETE_PANEL_TITLE,
  ACCOUNT_DELETE_PASSWORD_LABEL,
  ACCOUNT_DELETE_SECTION_DESCRIPTION,
  ACCOUNT_DELETE_SECTION_TITLE,
  ACCOUNT_DELETE_WIPE_CHECKBOX_LABEL,
  ACCOUNT_DELETE_WIPE_OFF_NOTE,
  ACCOUNT_DELETE_WIPE_ON_NOTE,
  accountDeletionMessage,
  shouldRetryWithPassword,
} from '@/features/deletion/presentation/deletion-messages';
import { clearPendingAccountDeletion } from '@/features/deletion/infrastructure/pending-account-deletion';
import { useAppStore } from '@/store/app-store';
import { isAppLockBoundTo } from '@/features/app-lock/application/remove-app-lock';
import {
  LOCK_BOUND_TO_ACCOUNT_WARNING,
  REMOVE_LOCK_FIRST_LABEL,
} from '@/features/app-lock/presentation/app-lock-messages';
import { toAuthError } from '@/features/auth/domain/auth-error';
import { isPasswordLongEnough } from '@/features/auth/domain/password-policy';
import {
  ACCOUNT_DESCRIPTION,
  ACCOUNT_LOADING_MESSAGE,
  ACCOUNT_NOT_CONFIGURED_MESSAGE,
  ACCOUNT_NOT_CONFIGURED_NOTE,
  ACCOUNT_TITLE,
  BACKUP_CHECK_LABEL,
  BACKUP_CREATE_LABEL,
  BACKUP_DELETION_PENDING_MESSAGE,
  BACKUP_FOUND_MESSAGE,
  BACKUP_MISSING_MESSAGE,
  BACKUP_OUTDATED_APP_MESSAGE,
  BACKUP_SAVED_MESSAGE,
  BACKUP_SECTION_DESCRIPTION,
  BACKUP_SECTION_TITLE,
  EMAIL_LABEL,
  EMAIL_PLACEHOLDER,
  EMPTY_EMAIL_MESSAGE,
  EMPTY_PASSWORD_MESSAGE,
  FORGOT_PASSWORD_LABEL,
  NO_EMAIL_TEXT,
  PASSWORD_HINT,
  PASSWORD_LABEL,
  PASSWORD_RESET_DESCRIPTION,
  PASSWORD_RESET_SEND_LABEL,
  PASSWORD_RESET_SENT_MESSAGE,
  RESTORE_CANCEL_LABEL,
  RESTORE_CONFIRM_LABEL,
  RESTORE_DONE_MESSAGE,
  RESTORE_FAILED_MESSAGE,
  RESTORE_OPEN_LABEL,
  RESTORE_PREVIEW_TITLE,
  RESTORE_ROW_AVATAR,
  RESTORE_ROW_CYCLE_SETTINGS,
  RESTORE_ROW_DAILY_ENTRIES,
  RESTORE_ROW_PERIOD_RECORDS,
  RESTORE_ROW_PREGNANCY,
  RESTORE_ROW_REMINDERS,
  RESTORE_WARNING,
  RESTORING_LABEL,
  SENDING_LABEL,
  SHORT_PASSWORD_MESSAGE,
  SIGNED_IN_LABEL,
  SIGNING_OUT_LABEL,
  SIGN_IN_LABEL,
  SIGN_OUT_LABEL,
  SIGN_UP_LABEL,
  SYNC_PREFERENCE_FAILED_MESSAGE,
  authErrorMessage,
  passwordResetErrorMessage,
  previewRowLabel,
  signedInAccountLabel,
} from '@/features/auth/presentation/auth-messages';
import { restoreCloudBackup } from '@/features/backup/application/restore-cloud-backup';
import { createCloudBackup } from '@/features/backup/application/create-cloud-backup';
import type { CreateCloudBackupOutcome } from '@/features/backup/application/create-cloud-backup';
import { loadCloudBackup } from '@/features/backup/data/cloud-backup-repository';
import type { CloudRestorePreviewV1 } from '@/features/backup/domain/cloud-restore-preview-v1';
import { buildCloudRestorePreviewV1 } from '@/features/backup/domain/cloud-restore-preview-v1';
import {
  restorePeriodRecordsLabel,
  restoreStatusLabel,
} from '@/features/backup/presentation/restore-labels';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { syncPeriodReminderQuietly } from '@/features/notifications/application/sync-period-reminder';
import { syncPregnancyWeeklyReminderQuietly } from '@/features/notifications/application/sync-pregnancy-weekly-reminder';
import {
  onAutomaticSyncOutcome,
  requestAutomaticSync,
} from '@/features/sync/application/automatic-sync-scheduler';
import { runCloudSync } from '@/features/sync/application/run-cloud-sync';
import { loadLastSyncAt } from '@/features/sync/infrastructure/last-sync-at';
import { isConflictUnresolved } from '@/features/sync/infrastructure/unresolved-conflict';
import {
  loadSyncPreferences,
  setAutomaticSyncEnabled,
} from '@/features/sync/infrastructure/sync-preferences';
import {
  AUTOMATIC_SYNC_DISABLED_MESSAGE,
  AUTOMATIC_SYNC_ENABLED_MESSAGE,
  AUTOMATIC_SYNC_FAILED_MESSAGE,
  AUTOMATIC_SYNC_LABEL,
  PHONE_TRANSFER_NOTE,
  AUTOMATIC_SYNC_NOTE,
  BACKUP_DISABLED_BY_SYNC_MESSAGE,
  CONFLICT_NOTICE_MESSAGE,
  CONFLICT_OPEN_LABEL,
  SYNC_BUSY_LABEL,
  SYNC_BUTTON_LABEL,
  didSyncChangeThisPhone,
  lastSyncMessage,
  syncConflictCountMessage,
  syncOutcomeMessage,
} from '@/features/sync/presentation/sync-messages';
import { syncWidgetSnapshotQuietly } from '@/features/widget/application/sync-widget-snapshot';
import { getTodayLocalISODate } from '@/utils/today';
import { buildCloudSyncPayloadV1 } from '@/features/privacy/application/build-cloud-sync-payload-v1';
import type { AuthUser } from '@/features/auth/domain/auth-user';
import { useTheme } from '@/hooks/use-theme';
import {
  BACK_LABEL,
  CANCEL_LABEL,
} from '@/shared/presentation/app-messages';
import { openAppDatabase } from '@/storage/db';
import { logEvent } from '@/shared/logging';

/** What to say about a backup that was saved, or refused for one of two reasons. */
function backupOutcomeMessage(outcome: CreateCloudBackupOutcome): string {
  if (outcome.kind === 'saved') {
    return BACKUP_SAVED_MESSAGE;
  }

  return outcome.kind === 'refused-deletion-pending'
    ? BACKUP_DELETION_PENDING_MESSAGE
    : BACKUP_OUTDATED_APP_MESSAGE;
}

/**
 * The account screen.
 *
 * An account is optional and does nothing yet. Nothing about a cycle, a
 * pregnancy or an avatar is sent anywhere, signed in or not, and every other
 * screen works exactly the same either way — which is why this is a link in the
 * settings rather than a gate in front of the app.
 *
 * The password is held in state while it is being typed and cleared the moment
 * it has been used. It is never written down: not to a log, not into an error,
 * and not into the message a failure shows.
 */
export default function AccountScreen() {
  const router = useRouter();
  const theme = useTheme();
  const auth = useAuthState();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // The reset form is a mode of the signed-out state rather than a screen of
  // its own: it asks for the address that is already typed in, and going back
  // to signing in should not be a navigation.
  const [isResetting, setIsResetting] = useState(false);

  // What the backup buttons last said. Kept apart from `notice`, which belongs
  // to signing in, so a stale sign-in message cannot appear under a backup.
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  // What a restore would change, and what it would write. Both are held only
  // while the confirmation is on screen: pressing "Vazgeç" drops them, and
  // nothing is written until the second press.
  const [preview, setPreview] = useState<CloudRestorePreviewV1 | null>(null);
  const [pending, setPending] = useState<CloudSyncPayloadV1 | null>(null);

  // Whether this phone may sync on its own. Read once, off until it is read,
  // and off again if it cannot be: a switch that renders as on before anybody
  // knows what is stored is a promise made on a guess.
  const [automaticSync, setAutomaticSync] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncDetail, setSyncDetail] = useState<string | null>(null);

  // The status line, and whether a conflict is waiting. Both are read from
  // storage rather than remembered from this screen's own runs: the sync that
  // set them most likely happened while somebody was on another screen.
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);

  // A ref as well as the disabled prop: two quick taps could both read `isBusy`
  // as false before the re-render lands, and the second would be a second
  // attempt with the same credentials.
  const inFlight = useRef(false);

  // Deleting the account. Its own password field: the one above belongs to the
  // sign-in form, which is not on screen while somebody is signed in.
  const resetAppState = useAppStore((state) => state.resetAppState);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  /**
   * Whether an app lock is bound to the signed-in account.
   *
   * Read rather than assumed: a lock set before signing in is bound to nothing
   * and deleting the account costs it nothing, so warning about it would be
   * telling somebody about a consequence they do not have.
   */
  const [lockBoundToThisAccount, setLockBoundToThisAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [wipeLocalToo, setWipeLocalToo] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  /**
   * Reads the stored sync preference once.
   *
   * Nothing is written here, including when there is nothing stored: reading an
   * answer is not how an answer should come to exist. A read that fails leaves
   * the switch off and says so, rather than leaving someone looking at a switch
   * whose position means nothing.
   */
  /**
   * Whether the lock on this phone would be orphaned by deleting this account.
   *
   * Re-read when the session changes, because the answer is about the uid that
   * is signed in now, not the one that was when the screen mounted.
   */
  useEffect(() => {
    const uid = auth.status === 'signed-in' ? auth.user.uid : null;

    let isActive = true;

    // One async closure for both branches rather than an early return that
    // sets state synchronously: the React Compiler forbids the latter, and no
    // session is an answer like any other.
    void (async () => {
      const bound = uid === null ? false : await isAppLockBoundTo(uid);

      if (isActive) {
        setLockBoundToThisAccount(bound);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [auth]);

  useEffect(() => {
    let isActive = true;

    void loadSyncPreferences().then(
      (preferences) => {
        if (isActive) {
          setAutomaticSync(preferences.automaticSyncEnabled);
        }
      },
      () => {
        if (isActive) {
          setSyncNotice(SYNC_PREFERENCE_FAILED_MESSAGE);
        }
      }
    );

    return () => {
      isActive = false;
    };
  }, []);

  // Who the status line is about. Read here rather than inside the effect so
  // the effect re-runs when the session changes: a conflict is one account's,
  // and showing another one a notice about it would be a lie about their data.
  const uid = auth.status === 'signed-in' ? auth.user.uid : null;

  /**
   * Keeps the status line and the conflict notice honest.
   *
   * Read on mount, and read again on every finished automatic sync rather than
   * being derived from the outcome: a sync that failed to write its own
   * timestamp should not make this screen claim it succeeded. Storage is the
   * only thing that knows, so storage is what is asked.
   */
  useEffect(() => {
    let isActive = true;

    // Signing out reads as "nothing synced, no conflict" rather than skipping
    // the read: leaving one account's status line up while another is signing
    // in would be showing somebody a fact about someone else's data.
    const refresh = () => {
      void Promise.all([
        uid === null ? Promise.resolve(null) : loadLastSyncAt(),
        uid === null ? Promise.resolve(false) : isConflictUnresolved(uid),
      ]).then(
        ([storedLastSyncAt, conflictWaiting]) => {
          if (!isActive) {
            return;
          }

          setLastSyncAt(storedLastSyncAt);
          setHasConflict(conflictWaiting);
        },
        () => {
          // Nothing to say. A status line that cannot be read stays as it was,
          // which is better than replacing it with a worry about storage.
        }
      );
    };

    refresh();

    const unsubscribe = onAutomaticSyncOutcome(refresh);

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [uid]);

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setIsResetting(false);
  };

  /**
   * Runs one attempt, whichever button was pressed.
   *
   * The address is trimmed, because a keyboard that capitalises and a paste
   * that brings a space are not the person getting their own address wrong. The
   * password is not: a space in a password is a character in a password.
   */
  const attempt = async (
    action: (email: string, password: string) => Promise<unknown>,
    { isNewPassword = false }: { isNewPassword?: boolean } = {}
  ) => {
    if (inFlight.current) {
      return;
    }

    const trimmedEmail = email.trim();

    if (trimmedEmail === '') {
      setNotice(EMPTY_EMAIL_MESSAGE);

      return;
    }

    if (password === '') {
      setNotice(EMPTY_PASSWORD_MESSAGE);

      return;
    }

    // Only when one is being chosen. An account made before this rule has a
    // shorter password, and its owner still has to be able to sign in.
    if (isNewPassword && !isPasswordLongEnough(password)) {
      setNotice(SHORT_PASSWORD_MESSAGE);

      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setNotice(null);

    try {
      await action(trimmedEmail, password);

      // The state comes from the session rather than from here: the observer
      // reports the new user, and this screen re-renders as signed in.
      clearForm();
    } catch (error) {
      // Only the code crosses. Whatever the SDK wrote is not shown, not kept
      // and not logged.
      setNotice(authErrorMessage(toAuthError(error).code));
      setPassword('');
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  /**
   * Asks for a reset link.
   *
   * The answer is the same sentence whichever way it went, because the
   * repository does not say whether the address had an account and this screen
   * must not appear to know either.
   */
  const handleSendReset = async () => {
    if (inFlight.current) {
      return;
    }

    const trimmedEmail = email.trim();

    if (trimmedEmail === '') {
      setNotice(EMPTY_EMAIL_MESSAGE);

      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setNotice(null);

    try {
      await sendPasswordReset(trimmedEmail);

      // Back to signing in, with the answer above it: the next thing to do is
      // read the mail and come back.
      setIsResetting(false);
      setNotice(PASSWORD_RESET_SENT_MESSAGE);
    } catch (error) {
      setNotice(passwordResetErrorMessage(toAuthError(error).code));
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  /**
   * Copies what is on the phone into the person's own backup.
   *
   * Nothing happens until this is pressed. The payload is the one the privacy
   * boundary defines — the five things somebody entered, and nothing worked out
   * from them — and it is built here, sent, and not kept.
   */
  const handleCreateBackup = async (user: AuthUser) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setBackupNotice(null);

    try {
      const db = await openAppDatabase();
      const outcome = await createCloudBackup({ db, user });

      // Two of the three are refusals rather than failures: a deletion is
      // part-way through, or the account holds something this build cannot
      // write back. Neither is worth retrying and neither changed anything.
      setBackupNotice(backupOutcomeMessage(outcome));
    } catch (error) {
      // The database's own failures and Firestore's arrive here the same way,
      // and neither message is shown.
      setBackupNotice(authErrorMessage(toAuthError(error).code));
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  /**
   * Says whether there is a backup, and nothing else about it.
   *
   * Not what is in it, not when it was made, not how big it is: this is a
   * screen someone may be holding in front of another person, and "there is a
   * backup" is the whole question being asked.
   */
  const handleCheckBackup = async (user: AuthUser) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setBackupNotice(null);

    try {
      const backup = await loadCloudBackup(user);

      setBackupNotice(backup === null ? BACKUP_MISSING_MESSAGE : BACKUP_FOUND_MESSAGE);
    } catch (error) {
      setBackupNotice(authErrorMessage(toAuthError(error).code));
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  /**
   * Fetches the backup and works out what restoring it would change.
   *
   * Nothing is written. Both sides are read — the stored backup and what is on
   * the phone — and what comes back is counts and verdicts, which is what the
   * person is being asked to agree to.
   */
  const handlePreviewRestore = async (user: AuthUser) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setBackupNotice(null);
    setPreview(null);
    setPending(null);

    try {
      const backup = await loadCloudBackup(user);

      if (backup === null) {
        setBackupNotice(BACKUP_MISSING_MESSAGE);

        return;
      }

      const db = await openAppDatabase();
      const local = await buildCloudSyncPayloadV1(db);

      setPreview(buildCloudRestorePreviewV1(local, backup.payload));
      setPending(backup.payload);
    } catch (error) {
      setBackupNotice(authErrorMessage(toAuthError(error).code));
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  /** Drops the preview, having written nothing. */
  const handleCancelRestore = () => {
    setPreview(null);
    setPending(null);
    setBackupNotice(null);
  };

  /**
   * Writes the backup over what is on the phone, after the second press.
   *
   * The widget and the reminders are brought up to date afterwards, best
   * effort: they are copies of what was just written, and a copy that could not
   * be refreshed is not a reason to put someone's data back the way it was.
   */
  const handleConfirmRestore = async (payload: CloudSyncPayloadV1) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setBackupNotice(null);

    try {
      const db = await openAppDatabase();

      await restoreCloudBackup(db, payload);

      setPreview(null);
      setPending(null);
      setBackupNotice(RESTORE_DONE_MESSAGE);

      // After the write, and never instead of it. Each is quiet by contract and
      // caught as well, so a refusal cannot reach this screen.
      const today = getTodayLocalISODate();

      await syncWidgetSnapshotQuietly(db, today).catch(() => undefined);
      await syncPeriodReminderQuietly(db, today).catch(() => undefined);
      await syncPregnancyWeeklyReminderQuietly(db).catch(() => undefined);
    } catch {
      // The transaction rolled back, so what is on the phone is what was there
      // before. Nothing about the failure is shown or written down.
      setBackupNotice(RESTORE_FAILED_MESSAGE);
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  /**
   * Records whether this phone may sync on its own.
   *
   * Switching it on records the choice and then syncs once, straight away, so
   * the answer to "is it working?" is on screen rather than up to thirty
   * seconds away. Switching it off records the choice and stops there: there is
   * nothing to undo, because nothing was ever scheduled for later.
   *
   * The switch follows what was stored rather than what was tapped: a write
   * that failed leaves it where it was, so it cannot show "açık" for something
   * that is not.
   */
  const handleAutomaticSyncChange = async (enabled: boolean) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setSyncNotice(null);
    setSyncDetail(null);

    try {
      const preferences = await setAutomaticSyncEnabled(enabled);

      setAutomaticSync(preferences.automaticSyncEnabled);

      if (!preferences.automaticSyncEnabled) {
        setSyncNotice(AUTOMATIC_SYNC_DISABLED_MESSAGE);

        return;
      }

      setSyncNotice(AUTOMATIC_SYNC_ENABLED_MESSAGE);

      // The scheduler owns the rules, including the ones that say no. A null
      // means one of them applied — a pending deletion, an unresolved conflict
      // — and each of those already has its own notice on this screen.
      const outcome = await requestAutomaticSync('enabled');

      if (outcome === null) {
        return;
      }

      if (outcome.kind === 'error') {
        setSyncNotice(AUTOMATIC_SYNC_FAILED_MESSAGE);

        return;
      }

      setSyncNotice(syncOutcomeMessage(outcome));
      setSyncDetail(syncConflictCountMessage(outcome));
    } catch {
      // Storage's own message is not read. Nothing about it would help, and the
      // switch staying where it was is the answer.
      setSyncNotice(SYNC_PREFERENCE_FAILED_MESSAGE);
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  /**
   * Syncs this phone with the account, once, because it was asked for.
   *
   * Every outcome — including the ones where nothing was written — comes back
   * as a result rather than an exception, and each gets its own sentence. What
   * this screen must never do is say "tamamlandı" for a conflict: the point of
   * those messages is that somebody can tell whether their data moved.
   *
   * The widget and the reminders are refreshed only when the phone's own data
   * actually changed, and best effort afterwards, exactly as a restore does
   * them: a copy that could not be refreshed is not a reason to undo a sync.
   */
  const handleSyncNow = async (user: AuthUser) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setSyncNotice(null);
    setSyncDetail(null);
    setBackupNotice(null);

    try {
      const db = await openAppDatabase();
      const outcome = await runCloudSync({ db, uid: user.uid });

      setSyncNotice(syncOutcomeMessage(outcome));
      setSyncDetail(syncConflictCountMessage(outcome));

      if (didSyncChangeThisPhone(outcome)) {
        const today = getTodayLocalISODate();

        await syncWidgetSnapshotQuietly(db, today).catch(() => undefined);
        await syncPeriodReminderQuietly(db, today).catch(() => undefined);
        await syncPregnancyWeeklyReminderQuietly(db).catch(() => undefined);
      }
    } catch {
      // `runCloudSync` reports its failures rather than throwing them, so this
      // is only for whatever is left — opening the database, most likely. The
      // same rule applies: no message of its own is shown.
      setSyncNotice(syncOutcomeMessage({ kind: 'error', failure: 'unknown' }));
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setNotice(null);

    try {
      await signOut();
      clearForm();
    } catch (error) {
      setNotice(authErrorMessage(toAuthError(error).code));
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  /**
   * Deletes the account, and — if the box is ticked — this phone with it.
   *
   * The use case owns the order and every failure; this only turns an outcome
   * into a sentence. Two of those outcomes mean "type the password again", and
   * for those the field is cleared and the panel stays open rather than closing
   * on somebody mid-attempt.
   *
   * Nothing navigates on success. With the box unticked the person stays here,
   * signed out, and `useAuthState` swaps the form in on its own; with it ticked
   * the onboarding flag flips and `RootLayout` takes the screen away.
   */
  const handleConfirmDelete = async (user: AuthUser) => {
    if (inFlight.current) {
      return;
    }

    if (deletePassword === '') {
      setDeleteNotice(ACCOUNT_DELETE_EMPTY_PASSWORD_MESSAGE);

      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setDeleteNotice(null);

    try {
      const db = await openAppDatabase();
      const outcome = await deleteAccount({
        db,
        user,
        password: deletePassword,
        wipeLocalDataToo: wipeLocalToo,
        resetAppState,
      });

      if (shouldRetryWithPassword(outcome)) {
        setDeletePassword('');
        setDeleteNotice(accountDeletionMessage(outcome));

        return;
      }

      if (outcome.kind === 'failed') {
        setDeleteNotice(accountDeletionMessage(outcome));

        return;
      }

      // The account is gone. The password is no longer anything, and the panel
      // has nothing left to confirm.
      setDeletePassword('');
      setIsConfirmingDelete(false);

      // `deleted-and-wiped` unmounts this screen, so its message would never be
      // read; the other two leave the person here and need one.
      setDeleteNotice(outcome.kind === 'deleted-and-wiped' ? null : accountDeletionMessage(outcome));
    } catch (error: unknown) {
      logEvent('account delete failed', error);
      setDeleteNotice(accountDeletionMessage({ kind: 'failed', reason: 'unknown' }));
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  /**
   * Backs out of deleting.
   *
   * This also lifts the block on syncing. A deletion that got as far as
   * removing the cloud backup leaves a note behind that stops a new one being
   * written, and saying "vazgeç" is the person telling us they are not going to
   * finish — so the note goes with the panel.
   */
  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
    setDeletePassword('');
    setDeleteNotice(null);

    void clearPendingAccountDeletion().catch((error: unknown) => {
      logEvent('account delete failed', error);
    });
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* The stack hides its header, so back has to be offered here. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={BACK_LABEL}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="textSecondary">
                {BACK_LABEL}
              </ThemedText>
            </Pressable>

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
                {ACCOUNT_TITLE}
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                {ACCOUNT_DESCRIPTION}
              </ThemedText>
            </View>

            {auth.status === 'loading' && (
              <View style={styles.loading}>
                <ActivityIndicator testID="account-loading" />
                <ThemedText type="small" themeColor="textSecondary">
                  {ACCOUNT_LOADING_MESSAGE}
                </ThemedText>
              </View>
            )}

            {auth.status === 'not-configured' && (
              <View style={styles.fields}>
                <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                  {ACCOUNT_NOT_CONFIGURED_MESSAGE}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  {ACCOUNT_NOT_CONFIGURED_NOTE}
                </ThemedText>
              </View>
            )}

            {/* Outside every branch on purpose.
                Deleting an account ends its session, so `auth.status` flips to
                signed-out the moment it succeeds. Anything rendered inside the
                signed-in branch — which is where this used to live — is
                unmounted before the person can read it, and the one thing they
                need to be told is exactly what just happened to their records.
                Here it outlives the change and the sign-in form appears under
                it. */}
            {deleteNotice !== null && (
              <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                {deleteNotice}
              </ThemedText>
            )}

            {auth.status === 'signed-in' && (
              <View style={styles.fields}>
                <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {SIGNED_IN_LABEL}
                  </ThemedText>

                  <ThemedText
                    accessibilityLabel={signedInAccountLabel(auth.user.email ?? null)}
                    type="smallBold"
                    style={styles.email}>
                    {auth.user.email ?? NO_EMAIL_TEXT}
                  </ThemedText>
                </View>

                {notice !== null && (
                  <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                    {notice}
                  </ThemedText>
                )}

                {/* Only here, and only on a press: an account exists to hold a
                    backup, and a backup happens when someone asks for one. */}
                <View style={styles.fields}>
                  <ThemedText accessibilityRole="header" type="smallBold">
                    {BACKUP_SECTION_TITLE}
                  </ThemedText>

                  <ThemedText type="small" themeColor="textSecondary">
                    {BACKUP_SECTION_DESCRIPTION}
                  </ThemedText>

                  <ThemedText type="small" themeColor="textSecondary">
                    {PHONE_TRANSFER_NOTE}
                  </ThemedText>

                  {/* The switch records a choice. Nothing runs on it yet, and
                      the note under it says exactly that. */}
                  <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                    <View style={styles.syncRow}>
                      <ThemedText type="smallBold" style={styles.syncLabel}>
                        {AUTOMATIC_SYNC_LABEL}
                      </ThemedText>

                      <Switch
                        trackColor={{ false: theme.backgroundSelected, true: theme.switchTrackOn }}
                        thumbColor={automaticSync ? theme.switchThumbOn : undefined}
                        accessibilityLabel={AUTOMATIC_SYNC_LABEL}
                        accessibilityState={{ checked: automaticSync, disabled: isBusy }}
                        value={automaticSync}
                        disabled={isBusy}
                        onValueChange={(next) => {
                          void handleAutomaticSyncChange(next);
                        }}
                      />
                    </View>

                    <ThemedText type="small" themeColor="textSecondary">
                      {AUTOMATIC_SYNC_NOTE}
                    </ThemedText>

                    {/* Coarse on purpose. "Bugün 14:20" answers the question
                        somebody actually has; a precise timestamp for every
                        sync going back weeks is a log of when they open a
                        period tracker, and nothing here needs one. */}
                    <ThemedText type="small" themeColor="textSecondary">
                      {lastSyncMessage(lastSyncAt)}
                    </ThemedText>

                    {/* A conflict stops every automatic sync for this account
                        until somebody settles it, so it cannot be a line that
                        scrolls past: it comes with the way out of it. */}
                    {hasConflict && (
                      <>
                        <ThemedText
                          accessibilityRole="alert"
                          type="small"
                          themeColor="textSecondary">
                          {CONFLICT_NOTICE_MESSAGE}
                        </ThemedText>

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={CONFLICT_OPEN_LABEL}
                          onPress={() => router.push('/(app)/sync-conflict')}
                          style={({ pressed }) => [
                            styles.secondaryButton,
                            { borderColor: theme.backgroundSelected },
                            pressed && styles.pressed,
                          ]}>
                          <ThemedText type="smallBold">{CONFLICT_OPEN_LABEL}</ThemedText>
                        </Pressable>
                      </>
                    )}

                    {syncNotice !== null && (
                      <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                        {syncNotice}
                      </ThemedText>
                    )}

                    {syncDetail !== null && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {syncDetail}
                      </ThemedText>
                    )}

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={SYNC_BUTTON_LABEL}
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => handleSyncNow(auth.user)}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: theme.backgroundSelected },
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold">
                        {isBusy ? SYNC_BUSY_LABEL : SYNC_BUTTON_LABEL}
                      </ThemedText>
                    </Pressable>
                  </View>

                  {backupNotice !== null && (
                    <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                      {backupNotice}
                    </ThemedText>
                  )}

                  {/* Manual backup replaces the stored document outright, which
                      would strip the revision the sync counts on. One of the two
                      at a time, and the reason is on screen rather than implied
                      by a greyed-out button. */}
                  {automaticSync && (
                    <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                      {BACKUP_DISABLED_BY_SYNC_MESSAGE}
                    </ThemedText>
                  )}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={BACKUP_CREATE_LABEL}
                    accessibilityState={{ disabled: isBusy || automaticSync }}
                    disabled={isBusy || automaticSync}
                    onPress={() => handleCreateBackup(auth.user)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      { borderColor: theme.backgroundSelected },
                      (isBusy || automaticSync) && styles.disabled,
                      pressed && !isBusy && !automaticSync && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">{BACKUP_CREATE_LABEL}</ThemedText>
                  </Pressable>

                  {preview === null ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={RESTORE_OPEN_LABEL}
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => handlePreviewRestore(auth.user)}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: theme.backgroundSelected },
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold">{RESTORE_OPEN_LABEL}</ThemedText>
                    </Pressable>
                  ) : (
                    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText accessibilityRole="header" type="smallBold">
                        {RESTORE_PREVIEW_TITLE}
                      </ThemedText>

                      <PreviewRow
                        label={RESTORE_ROW_CYCLE_SETTINGS}
                        value={restoreStatusLabel(preview.cycleSettings)}
                      />
                      <PreviewRow
                        label={RESTORE_ROW_PERIOD_RECORDS}
                        value={restorePeriodRecordsLabel(preview.periodRecords)}
                      />
                      <PreviewRow
                        label={RESTORE_ROW_PREGNANCY}
                        value={restoreStatusLabel(preview.pregnancyProfile)}
                      />
                      <PreviewRow label={RESTORE_ROW_AVATAR} value={restoreStatusLabel(preview.avatarConfig)} />
                      <PreviewRow
                        label={RESTORE_ROW_REMINDERS}
                        value={restoreStatusLabel(preview.notificationPreferences)}
                      />
                      <PreviewRow
                        label={RESTORE_ROW_DAILY_ENTRIES}
                        value={restorePeriodRecordsLabel(preview.dailyEntries)}
                      />

                      <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                        {RESTORE_WARNING}
                      </ThemedText>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={RESTORE_CONFIRM_LABEL}
                        accessibilityState={{ disabled: isBusy || pending === null }}
                        disabled={isBusy || pending === null}
                        onPress={() => {
                          if (pending !== null) {
                            void handleConfirmRestore(pending);
                          }
                        }}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          { backgroundColor: theme.primary },
                          isBusy && styles.disabled,
                          pressed && !isBusy && styles.pressed,
                        ]}>
                        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                          {isBusy ? RESTORING_LABEL : RESTORE_CONFIRM_LABEL}
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={RESTORE_CANCEL_LABEL}
                        accessibilityState={{ disabled: isBusy }}
                        disabled={isBusy}
                        onPress={handleCancelRestore}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          { borderColor: theme.backgroundSelected },
                          isBusy && styles.disabled,
                          pressed && !isBusy && styles.pressed,
                        ]}>
                        <ThemedText type="smallBold">{CANCEL_LABEL}</ThemedText>
                      </Pressable>
                    </View>
                  )}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={BACKUP_CHECK_LABEL}
                    accessibilityState={{ disabled: isBusy }}
                    disabled={isBusy}
                    onPress={() => handleCheckBackup(auth.user)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      { borderColor: theme.backgroundSelected },
                      isBusy && styles.disabled,
                      pressed && !isBusy && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">{BACKUP_CHECK_LABEL}</ThemedText>
                  </Pressable>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={SIGN_OUT_LABEL}
                  accessibilityState={{ disabled: isBusy }}
                  disabled={isBusy}
                  onPress={handleSignOut}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.backgroundSelected },
                    isBusy && styles.disabled,
                    pressed && !isBusy && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold">
                    {isBusy ? SIGNING_OUT_LABEL : SIGN_OUT_LABEL}
                  </ThemedText>
                </Pressable>

                {/* Last, and set apart: everything above this is reversible. */}
                <View style={styles.fields}>
                  <ThemedText accessibilityRole="header" type="smallBold">
                    {ACCOUNT_DELETE_SECTION_TITLE}
                  </ThemedText>

                  <ThemedText type="small" themeColor="textSecondary">
                    {ACCOUNT_DELETE_SECTION_DESCRIPTION}
                  </ThemedText>

                  {!isConfirmingDelete && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={ACCOUNT_DELETE_OPEN_LABEL}
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => {
                        setDeleteNotice(null);
                        setIsConfirmingDelete(true);
                      }}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: theme.backgroundSelected },
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold">{ACCOUNT_DELETE_OPEN_LABEL}</ThemedText>
                    </Pressable>
                  )}

                  {isConfirmingDelete && (
                    <View style={styles.fields}>
                      <ThemedText accessibilityRole="header" type="smallBold">
                        {ACCOUNT_DELETE_PANEL_TITLE}
                      </ThemedText>

                      <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                        {ACCOUNT_DELETE_PANEL_BODY}
                      </ThemedText>

                      {/* Deleting the account makes the lock unrecoverable: the
                          uid it is bound to stops existing, so signing in as it
                          stops being possible. Said here, where the decision is
                          made, rather than found weeks later at a lock screen. */}
                      {lockBoundToThisAccount && (
                        <View style={styles.fields}>
                          <ThemedText
                            accessibilityRole="alert"
                            type="small"
                            themeColor="textSecondary">
                            {LOCK_BOUND_TO_ACCOUNT_WARNING}
                          </ThemedText>

                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={REMOVE_LOCK_FIRST_LABEL}
                            onPress={() => router.push('/(app)/app-lock')}
                            style={({ pressed }) => [
                              styles.secondaryButton,
                              { borderColor: theme.backgroundSelected },
                              pressed && styles.pressed,
                            ]}>
                            <ThemedText type="smallBold">{REMOVE_LOCK_FIRST_LABEL}</ThemedText>
                          </Pressable>
                        </View>
                      )}

                      <View style={styles.field}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {ACCOUNT_DELETE_PASSWORD_LABEL}
                        </ThemedText>

                        <TextInput
                          accessibilityLabel={ACCOUNT_DELETE_PASSWORD_LABEL}
                          value={deletePassword}
                          onChangeText={setDeletePassword}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!isBusy}
                          style={[
                            styles.input,
                            { borderColor: theme.backgroundSelected, color: theme.text },
                          ]}
                        />
                      </View>

                      <View style={styles.syncRow}>
                        <ThemedText type="small" style={styles.syncLabel}>
                          {ACCOUNT_DELETE_WIPE_CHECKBOX_LABEL}
                        </ThemedText>

                        <Switch
                          trackColor={{ false: theme.backgroundSelected, true: theme.switchTrackOn }}
                          thumbColor={wipeLocalToo ? theme.switchThumbOn : undefined}
                          accessibilityLabel={ACCOUNT_DELETE_WIPE_CHECKBOX_LABEL}
                          value={wipeLocalToo}
                          onValueChange={setWipeLocalToo}
                          disabled={isBusy}
                        />
                      </View>

                      <ThemedText type="small" themeColor="textSecondary">
                        {wipeLocalToo ? ACCOUNT_DELETE_WIPE_ON_NOTE : ACCOUNT_DELETE_WIPE_OFF_NOTE}
                      </ThemedText>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={ACCOUNT_DELETE_CONFIRM_LABEL}
                        accessibilityState={{ disabled: isBusy }}
                        disabled={isBusy}
                        onPress={() => {
                          void handleConfirmDelete(auth.user);
                        }}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          { backgroundColor: theme.primary },
                          isBusy && styles.disabled,
                          pressed && !isBusy && styles.pressed,
                        ]}>
                        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                          {isBusy ? ACCOUNT_DELETE_BUSY_LABEL : ACCOUNT_DELETE_CONFIRM_LABEL}
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={ACCOUNT_DELETE_CANCEL_LABEL}
                        accessibilityState={{ disabled: isBusy }}
                        disabled={isBusy}
                        onPress={handleCancelDelete}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          { borderColor: theme.backgroundSelected },
                          isBusy && styles.disabled,
                          pressed && !isBusy && styles.pressed,
                        ]}>
                        <ThemedText type="smallBold">{ACCOUNT_DELETE_CANCEL_LABEL}</ThemedText>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            )}

            {auth.status === 'signed-out' && (
              <View style={styles.fields}>
                <View style={styles.field}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {EMAIL_LABEL}
                  </ThemedText>

                  <TextInput
                    accessibilityLabel={EMAIL_LABEL}
                    value={email}
                    onChangeText={(next) => {
                      setEmail(next);
                      setNotice(null);
                      setDeleteNotice(null);
                    }}
                    editable={!isBusy}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    placeholder={EMAIL_PLACEHOLDER}
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.input,
                      { borderColor: theme.backgroundSelected, color: theme.text },
                    ]}
                  />
                </View>

                {!isResetting && (
                  <View style={styles.field}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {PASSWORD_LABEL}
                    </ThemedText>

                    <TextInput
                      accessibilityLabel={PASSWORD_LABEL}
                      value={password}
                      onChangeText={(next) => {
                        setPassword(next);
                        setNotice(null);
                        setDeleteNotice(null);
                      }}
                      editable={!isBusy}
                      autoCapitalize="none"
                      autoCorrect={false}
                      // The field is masked and kept out of the keyboard's own
                      // learning, which is where a typed password otherwise
                      // ends up being remembered.
                      secureTextEntry
                      textContentType="password"
                      placeholder={PASSWORD_HINT}
                      placeholderTextColor={theme.textSecondary}
                      style={[
                        styles.input,
                        { borderColor: theme.backgroundSelected, color: theme.text },
                      ]}
                    />
                  </View>
                )}

                {isResetting && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {PASSWORD_RESET_DESCRIPTION}
                  </ThemedText>
                )}

                {notice !== null && (
                  <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                    {notice}
                  </ThemedText>
                )}

                {isResetting ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={PASSWORD_RESET_SEND_LABEL}
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={handleSendReset}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        { backgroundColor: theme.primary },
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                        {isBusy ? SENDING_LABEL : PASSWORD_RESET_SEND_LABEL}
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={CANCEL_LABEL}
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => {
                        setIsResetting(false);
                        setNotice(null);
                      }}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: theme.backgroundSelected },
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold">{CANCEL_LABEL}</ThemedText>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={SIGN_IN_LABEL}
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => attempt(signInWithEmail)}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        { backgroundColor: theme.primary },
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                        {isBusy ? SENDING_LABEL : SIGN_IN_LABEL}
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={SIGN_UP_LABEL}
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => attempt(signUpWithEmail, { isNewPassword: true })}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: theme.backgroundSelected },
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold">{SIGN_UP_LABEL}</ThemedText>
                    </Pressable>

                    {/* Last, and quiet: it is the way out of a form that did
                        not work, not one of the two things to do here. */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={FORGOT_PASSWORD_LABEL}
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      onPress={() => {
                        setIsResetting(true);
                        setNotice(null);
                      }}
                      style={({ pressed }) => [
                        styles.linkButton,
                        isBusy && styles.disabled,
                        pressed && !isBusy && styles.pressed,
                      ]}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {FORGOT_PASSWORD_LABEL}
                      </ThemedText>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * One line of the preview: what would happen, to what.
 *
 * The label and the verdict are one accessibility label, so a screen reader
 * reads "Regl kayıtları: 3 eklenecek" rather than two unrelated fragments.
 */
function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View accessibilityLabel={previewRowLabel(label, value)} style={styles.previewRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>

      <ThemedText type="smallBold">{value}</ThemedText>
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
  loading: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  fields: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.half,
  },
  input: {
    minHeight: 52,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  email: {
    fontSize: 18,
    lineHeight: 26,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 32,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 44,
  },
  syncLabel: {
    flexShrink: 1,
  },
  linkButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
