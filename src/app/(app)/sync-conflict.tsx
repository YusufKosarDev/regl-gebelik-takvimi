import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ButtonLabel, ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuthState } from '@/features/auth/application/use-auth-state';
import { syncPeriodReminderQuietly } from '@/features/notifications/application/sync-period-reminder';
import { syncPregnancyWeeklyReminderQuietly } from '@/features/notifications/application/sync-pregnancy-weekly-reminder';
import type { SyncConflictPreview } from '@/features/sync/application/build-conflict-preview';
import { buildConflictPreview } from '@/features/sync/application/build-conflict-preview';
import { keepLocalData, keepRemoteData } from '@/features/sync/application/resolve-sync-conflict';
import { getDeviceId } from '@/features/sync/infrastructure/device-id';
import { clearUnresolvedConflict } from '@/features/sync/infrastructure/unresolved-conflict';
import {
  comparisonRowLabelIn,
  conflictDeviceLabelIn,
  conflictFailureMessageIn,
  conflictLabels,
  conflictLastChangeLabelIn,
  conflictPresenceLabelIn,
  conflictRecordCountLabelIn,
} from '@/features/sync/presentation/conflict-labels';
import { syncFailureMessageIn, syncMessages } from '@/features/sync/presentation/sync-messages';
import { syncWidgetSnapshotQuietly } from '@/features/widget/application/sync-widget-snapshot';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useMessages } from '@/i18n';
import { logEvent } from '@/shared/logging';
import { openAppDatabase } from '@/storage/db';
import { getTodayLocalISODate } from '@/utils/today';

/**
 * Choosing which side of a conflict survives.
 *
 * One screen, two buttons and no per-record picking. That is a deliberate
 * limit: the three-way merge already settled everything that could be settled
 * without a person, and what is left is the part where both sides changed the
 * same thing. Offering a field-by-field choice there would mean asking somebody
 * to adjudicate their own period history one row at a time, in a screen they
 * opened because something already went wrong.
 *
 * What it shows is counts and presence — how many records each side has,
 * whether each has a pregnancy, whether each has an avatar. Never a date, never
 * a value, never a record. The same line the restore preview holds, and for the
 * same reason: this is a screen somebody may be holding in front of another
 * person.
 *
 * Nothing is written until the second press. Each choice destroys one side, so
 * each gets a confirmation that says which side that is.
 */

type Choice = 'local' | 'remote';

/**
 * What the notice line is about, translated at render.
 *
 * A finished sentence in state stayed in the language it was written in after
 * everything around it switched — and baking the catalogue into `load` to
 * write one made a language change re-read the database and the network for
 * words that were already on the screen.
 */
type Notice =
  | { readonly kind: 'no-remote' }
  | { readonly kind: 'load-failed' }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'failure'; readonly reason: string }
  | { readonly kind: 'resolved'; readonly choice: Choice };

export default function SyncConflictScreen() {
  const theme = useTheme();
  const conflict1 = useMessages(conflictLabels);
  const sync1 = useMessages(syncMessages);
  const language = useLanguage();
  const auth = useAuthState();

  const [isLoading, setIsLoading] = useState(true);
  const [preview, setPreview] = useState<SyncConflictPreview | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState<Choice | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const inFlight = useRef(false);

  /**
   * Which load is the current one. Bumped by every new read and by the
   * effect's cleanup, so a read that outlives its session — or the screen —
   * finds itself superseded and touches nothing: a preview built for one
   * account must not appear over a screen that no longer has it.
   */
  const loadEpoch = useRef(0);

  const uid = auth.status === 'signed-in' ? auth.user.uid : null;

  /**
   * Reads both sides.
   *
   * Run again after a `revision-moved` refusal, which is the whole point of
   * keeping it in one place: the answer to "the cloud changed" is to show the
   * cloud as it now is, not to argue with the person about it.
   */
  const load = useCallback(async () => {
    if (uid === null) {
      return;
    }

    const epoch = ++loadEpoch.current;

    // Deliberately not setting `isLoading` here. It starts true, and the only
    // other caller is an event handler that sets it before asking — doing it in
    // this function would make the mount effect update state synchronously.
    try {
      const db = await openAppDatabase();
      const result = await buildConflictPreview({ db, uid, deviceId: await getDeviceId() });

      if (epoch !== loadEpoch.current) {
        return;
      }

      if (result.kind === 'ready') {
        setPreview(result.preview);
      } else if (result.kind === 'no-remote') {
        // Nothing to choose between any more. Clear the note so automatic sync
        // is not held up by a conflict that no longer exists.
        setPreview(null);
        setNotice({ kind: 'no-remote' });
        setIsDone(true);

        await clearUnresolvedConflict(uid).catch(() => undefined);
      } else {
        setPreview(null);
        setNotice({ kind: 'load-failed' });
      }
    } catch (error: unknown) {
      logEvent('sync conflict resolve failed', error);

      if (epoch !== loadEpoch.current) {
        return;
      }

      setPreview(null);
      setNotice({ kind: 'load-failed' });
    } finally {
      if (epoch === loadEpoch.current) {
        setIsLoading(false);
      }
    }
  }, [uid]);

  useEffect(() => {
    // Reading both sides of the conflict is exactly what an effect is for: it
    // needs a database and the network, so it cannot happen during render, and
    // there is nothing to derive it from. `load` awaits before it touches
    // state; the rule cannot see that through an async function it can inline.
    if (uid === null) {
      // Nothing will start a read without an account, and the spinner used to
      // wait forever for the one that never came. The sentence is the account
      // screen's own for a sync without a session.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice({ kind: 'signed-out' });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);

      return;
    }

    void load();

    return () => {
      // A read still in the air is for a screen or a session that is gone.
      loadEpoch.current += 1;
    };
  }, [load, uid]);

  /**
   * Applies one side, after the second press.
   *
   * The revision the person was shown is carried into the call, so a third
   * device writing while this screen sat open cannot have its work overwritten
   * by a decision made about an older version.
   */
  const apply = async (choice: Choice) => {
    if (inFlight.current || uid === null || preview === null) {
      return;
    }

    inFlight.current = true;
    setIsBusy(true);
    setNotice(null);

    try {
      const db = await openAppDatabase();
      const input = { db, uid, expectedRevision: preview.revision };

      const outcome = choice === 'local' ? await keepLocalData(input) : await keepRemoteData(input);

      if (outcome.kind === 'failed') {
        setNotice({ kind: 'failure', reason: outcome.reason });
        setConfirming(null);

        // The cloud moved: show what it holds now rather than the stale view.
        if (outcome.reason === 'revision-moved') {
          setIsLoading(true);

          await load();
        }

        return;
      }

      setConfirming(null);
      setIsDone(true);
      setNotice({ kind: 'resolved', choice: outcome.kind === 'local-kept' ? 'local' : 'remote' });

      // Only the cloud-wins path rewrote this phone. The widget and the
      // reminders are copies of what was just written, and best effort by
      // contract: a copy that would not refresh is not a reason to undo it.
      if (outcome.kind === 'remote-kept') {
        const today = getTodayLocalISODate();

        await syncWidgetSnapshotQuietly(db, today).catch(() => undefined);
        await syncPeriodReminderQuietly(db, today).catch(() => undefined);
        await syncPregnancyWeeklyReminderQuietly(db).catch(() => undefined);
      }
    } catch (error: unknown) {
      logEvent('sync conflict resolve failed', error);
      setNotice({ kind: 'failure', reason: 'unknown' });
      setConfirming(null);
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  // Translated here, every render, so the line follows a language change
  // instead of staying in the language it was first written in.
  const noticeText =
    notice === null
      ? null
      : notice.kind === 'no-remote'
        ? conflict1.conflictNoRemoteMessage
        : notice.kind === 'load-failed'
          ? conflict1.conflictLoadFailedMessage
          : notice.kind === 'signed-out'
            ? syncFailureMessageIn(sync1, 'signed-out')
            : notice.kind === 'failure'
              ? conflictFailureMessageIn(conflict1, notice.reason)
              : notice.choice === 'local'
                ? conflict1.conflictKeepLocalDone
                : conflict1.conflictKeepRemoteDone;

  const body = preview === null ? null : (
    <View style={styles.fields}>
      <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
        <ComparisonRow
          label=""
          local={conflict1.conflictColumnLocal}
          remote={conflict1.conflictColumnRemote}
          heading
        />
        <ComparisonRow
          label={conflict1.conflictRowRecords}
          local={conflictRecordCountLabelIn(conflict1, preview.local)}
          remote={conflictRecordCountLabelIn(conflict1, preview.remote)}
        />
        <ComparisonRow
          label={conflict1.conflictRowPregnancy}
          local={conflictPresenceLabelIn(conflict1, preview.local.hasPregnancy)}
          remote={conflictPresenceLabelIn(conflict1, preview.remote.hasPregnancy)}
        />
        <ComparisonRow
          label={conflict1.conflictRowAvatar}
          local={conflictPresenceLabelIn(conflict1, preview.local.hasAvatar)}
          remote={conflictPresenceLabelIn(conflict1, preview.remote.hasAvatar)}
        />
        <ComparisonRow
          label={conflict1.conflictRowSettings}
          local={conflictPresenceLabelIn(conflict1, preview.local.hasCycleSettings)}
          remote={conflictPresenceLabelIn(conflict1, preview.remote.hasCycleSettings)}
        />
        {/* The phone keeps no "last edited" stamp of its own — nothing needs
            one — so the local side has nothing honest to put here. */}
        <ComparisonRow
          label={conflict1.conflictRowLastChange}
          local="—"
          remote={conflictLastChangeLabelIn(conflict1, language, preview.remoteUpdatedAt)}
        />
        <ComparisonRow
          label={conflict1.conflictRowDevice}
          local={conflict1.conflictColumnLocal}
          remote={conflictDeviceLabelIn(conflict1, preview.remoteWrittenByThisDevice)}
        />
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <BackButton />

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle">
                {conflict1.conflictScreenTitle}
              </ThemedText>

              {!isDone && (
                <ThemedText type="small" themeColor="textSecondary">
                  {preview === null ? conflict1.conflictBodyNoBase : conflict1.conflictBodyUnresolved}
                </ThemedText>
              )}
            </View>

            {noticeText !== null && (
              <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                {noticeText}
              </ThemedText>
            )}

            {isLoading && (
              <View style={styles.loading}>
                <ActivityIndicator testID="sync-conflict-loading" />
              </View>
            )}

            {!isLoading && !isDone && body}

            {!isLoading && !isDone && preview !== null && confirming === null && (
              <View style={styles.fields}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={conflict1.conflictKeepLocalLabel}
                  onPress={() => setConfirming('local')}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={ButtonLabel}>{conflict1.conflictKeepLocalLabel}</ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={conflict1.conflictKeepRemoteLabel}
                  onPress={() => setConfirming('remote')}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={ButtonLabel}>{conflict1.conflictKeepRemoteLabel}</ThemedText>
                </Pressable>
              </View>
            )}

            {!isLoading && !isDone && confirming !== null && (
              <View style={styles.fields}>
                <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                  {confirming === 'local'
                    ? conflict1.conflictKeepLocalWarning
                    : conflict1.conflictKeepRemoteWarning}
                </ThemedText>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    confirming === 'local'
                      ? conflict1.conflictKeepLocalConfirm
                      : conflict1.conflictKeepRemoteConfirm
                  }
                  accessibilityState={{ disabled: isBusy }}
                  disabled={isBusy}
                  onPress={() => {
                    void apply(confirming);
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.primary },
                    isBusy && styles.disabled,
                    pressed && !isBusy && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={[ButtonLabel, { color: theme.onPrimary }]}>
                    {isBusy
                      ? conflict1.conflictBusyLabel
                      : confirming === 'local'
                        ? conflict1.conflictKeepLocalConfirm
                        : conflict1.conflictKeepRemoteConfirm}
                  </ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={conflict1.conflictCancelLabel}
                  accessibilityState={{ disabled: isBusy }}
                  disabled={isBusy}
                  onPress={() => setConfirming(null)}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.backgroundSelected },
                    isBusy && styles.disabled,
                    pressed && !isBusy && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={ButtonLabel}>{conflict1.conflictCancelLabel}</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** One line of the comparison. Labels and counts; never a value. */
function ComparisonRow({
  label,
  local,
  remote,
  heading = false,
}: {
  label: string;
  local: string;
  remote: string;
  heading?: boolean;
}) {
  const conflict1 = useMessages(conflictLabels);

  return (
    <View
      accessibilityLabel={label === '' ? undefined : comparisonRowLabelIn(conflict1, label, local, remote)}
      style={styles.comparisonRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.comparisonLabel}>
        {label}
      </ThemedText>

      <ThemedText type={heading ? 'smallBold' : 'small'} style={styles.comparisonValue}>
        {local}
      </ThemedText>

      <ThemedText type={heading ? 'smallBold' : 'small'} style={styles.comparisonValue}>
        {remote}
      </ThemedText>
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
  header: {
    gap: Spacing.two,
  },
  loading: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  fields: {
    gap: Spacing.three,
  },
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 32,
  },
  comparisonLabel: {
    flex: 2,
  },
  comparisonValue: {
    flex: 1,
    textAlign: 'right',
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
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
