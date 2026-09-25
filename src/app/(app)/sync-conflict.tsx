import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
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
  CONFLICT_BODY_NO_BASE,
  CONFLICT_BODY_UNRESOLVED,
  CONFLICT_BUSY_LABEL,
  CONFLICT_CANCEL_LABEL,
  CONFLICT_COLUMN_LOCAL,
  CONFLICT_COLUMN_REMOTE,
  comparisonRowLabel,
  CONFLICT_KEEP_LOCAL_CONFIRM,
  CONFLICT_KEEP_LOCAL_DONE,
  CONFLICT_KEEP_LOCAL_LABEL,
  CONFLICT_KEEP_LOCAL_WARNING,
  CONFLICT_KEEP_REMOTE_CONFIRM,
  CONFLICT_KEEP_REMOTE_DONE,
  CONFLICT_KEEP_REMOTE_LABEL,
  CONFLICT_KEEP_REMOTE_WARNING,
  CONFLICT_LOAD_FAILED_MESSAGE,
  CONFLICT_NO_REMOTE_MESSAGE,
  CONFLICT_ROW_AVATAR,
  CONFLICT_ROW_DEVICE,
  CONFLICT_ROW_LAST_CHANGE,
  CONFLICT_ROW_PREGNANCY,
  CONFLICT_ROW_RECORDS,
  CONFLICT_ROW_SETTINGS,
  CONFLICT_SCREEN_TITLE,
  conflictDeviceLabel,
  conflictFailureMessage,
  conflictLastChangeLabel,
  conflictPresenceLabel,
  conflictRecordCountLabel,
} from '@/features/sync/presentation/conflict-labels';
import { syncWidgetSnapshotQuietly } from '@/features/widget/application/sync-widget-snapshot';
import { BACK_LABEL } from '@/shared/presentation/app-messages';
import { useTheme } from '@/hooks/use-theme';
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

export default function SyncConflictScreen() {
  const router = useRouter();
  const theme = useTheme();
  const auth = useAuthState();

  const [isLoading, setIsLoading] = useState(true);
  const [preview, setPreview] = useState<SyncConflictPreview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Choice | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const inFlight = useRef(false);

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

    // Deliberately not setting `isLoading` here. It starts true, and the only
    // other caller is an event handler that sets it before asking — doing it in
    // this function would make the mount effect update state synchronously.
    try {
      const db = await openAppDatabase();
      const result = await buildConflictPreview({ db, uid, deviceId: await getDeviceId() });

      if (result.kind === 'ready') {
        setPreview(result.preview);
      } else if (result.kind === 'no-remote') {
        // Nothing to choose between any more. Clear the note so automatic sync
        // is not held up by a conflict that no longer exists.
        setPreview(null);
        setNotice(CONFLICT_NO_REMOTE_MESSAGE);
        setIsDone(true);

        await clearUnresolvedConflict().catch(() => undefined);
      } else {
        setPreview(null);
        setNotice(CONFLICT_LOAD_FAILED_MESSAGE);
      }
    } catch (error: unknown) {
      logEvent('sync conflict resolve failed', error);
      setPreview(null);
      setNotice(CONFLICT_LOAD_FAILED_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    // Reading both sides of the conflict is exactly what an effect is for: it
    // needs a database and the network, so it cannot happen during render, and
    // there is nothing to derive it from. `load` awaits before it touches
    // state; the rule cannot see that through an async function it can inline.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

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
        setNotice(conflictFailureMessage(outcome.reason));
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
      setNotice(
        outcome.kind === 'local-kept' ? CONFLICT_KEEP_LOCAL_DONE : CONFLICT_KEEP_REMOTE_DONE
      );

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
      setNotice(conflictFailureMessage('unknown'));
      setConfirming(null);
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  const body = preview === null ? null : (
    <View style={styles.fields}>
      <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
        <ComparisonRow
          label=""
          local={CONFLICT_COLUMN_LOCAL}
          remote={CONFLICT_COLUMN_REMOTE}
          heading
        />
        <ComparisonRow
          label={CONFLICT_ROW_RECORDS}
          local={conflictRecordCountLabel(preview.local)}
          remote={conflictRecordCountLabel(preview.remote)}
        />
        <ComparisonRow
          label={CONFLICT_ROW_PREGNANCY}
          local={conflictPresenceLabel(preview.local.hasPregnancy)}
          remote={conflictPresenceLabel(preview.remote.hasPregnancy)}
        />
        <ComparisonRow
          label={CONFLICT_ROW_AVATAR}
          local={conflictPresenceLabel(preview.local.hasAvatar)}
          remote={conflictPresenceLabel(preview.remote.hasAvatar)}
        />
        <ComparisonRow
          label={CONFLICT_ROW_SETTINGS}
          local={conflictPresenceLabel(preview.local.hasCycleSettings)}
          remote={conflictPresenceLabel(preview.remote.hasCycleSettings)}
        />
        {/* The phone keeps no "last edited" stamp of its own — nothing needs
            one — so the local side has nothing honest to put here. */}
        <ComparisonRow
          label={CONFLICT_ROW_LAST_CHANGE}
          local="—"
          remote={conflictLastChangeLabel(preview.remoteUpdatedAt)}
        />
        <ComparisonRow
          label={CONFLICT_ROW_DEVICE}
          local={CONFLICT_COLUMN_LOCAL}
          remote={conflictDeviceLabel(preview.remoteWrittenByThisDevice)}
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
              <ThemedText accessibilityRole="header" type="subtitle">
                {CONFLICT_SCREEN_TITLE}
              </ThemedText>

              {!isDone && (
                <ThemedText type="small" themeColor="textSecondary">
                  {preview === null ? CONFLICT_BODY_NO_BASE : CONFLICT_BODY_UNRESOLVED}
                </ThemedText>
              )}
            </View>

            {notice !== null && (
              <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                {notice}
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
                  accessibilityLabel={CONFLICT_KEEP_LOCAL_LABEL}
                  onPress={() => setConfirming('local')}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold">{CONFLICT_KEEP_LOCAL_LABEL}</ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={CONFLICT_KEEP_REMOTE_LABEL}
                  onPress={() => setConfirming('remote')}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold">{CONFLICT_KEEP_REMOTE_LABEL}</ThemedText>
                </Pressable>
              </View>
            )}

            {!isLoading && !isDone && confirming !== null && (
              <View style={styles.fields}>
                <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                  {confirming === 'local'
                    ? CONFLICT_KEEP_LOCAL_WARNING
                    : CONFLICT_KEEP_REMOTE_WARNING}
                </ThemedText>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    confirming === 'local'
                      ? CONFLICT_KEEP_LOCAL_CONFIRM
                      : CONFLICT_KEEP_REMOTE_CONFIRM
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
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                    {isBusy
                      ? CONFLICT_BUSY_LABEL
                      : confirming === 'local'
                        ? CONFLICT_KEEP_LOCAL_CONFIRM
                        : CONFLICT_KEEP_REMOTE_CONFIRM}
                  </ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={CONFLICT_CANCEL_LABEL}
                  accessibilityState={{ disabled: isBusy }}
                  disabled={isBusy}
                  onPress={() => setConfirming(null)}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.backgroundSelected },
                    isBusy && styles.disabled,
                    pressed && !isBusy && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold">{CONFLICT_CANCEL_LABEL}</ThemedText>
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
  return (
    <View
      accessibilityLabel={label === '' ? undefined : comparisonRowLabel(label, local, remote)}
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
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
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
