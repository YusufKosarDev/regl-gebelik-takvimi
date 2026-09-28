import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  AUTOMATIC_SYNC_LABEL,
  CONFLICT_NOTICE_MESSAGE,
  CONFLICT_OPEN_LABEL,
  AUTOMATIC_SYNC_NOTE,
  SYNC_BUSY_LABEL,
  SYNC_BUTTON_LABEL,
  lastSyncMessage,
} from '../presentation/sync-messages';

/**
 * The automatic sync switch, what it last did, and the way to run one by hand.
 *
 * Lifted out of the account screen unchanged, including the order of the four
 * things under the switch: the note about what automatic means, the line saying
 * when the last sync was, the conflict notice with its way out, and the button.
 *
 * The conflict notice sits above the button rather than below it on purpose. An
 * unresolved conflict stops automatic syncing for that account, so somebody
 * about to run one by hand should read why it will not help before pressing the
 * button, not after.
 *
 * It decides nothing. Whether a sync may run, whether one is already running
 * and which account it would be for all belong to the screen; this reports that
 * a switch moved or a button was pressed.
 */
export function AutomaticSyncRow({
  automaticSync,
  syncNotice,
  syncDetail,
  lastSyncAt,
  hasConflict,
  isBusy,
  onAutomaticSyncChange,
  onSyncNow,
  onOpenConflict,
}: {
  readonly automaticSync: boolean;
  readonly syncNotice: string | null;
  readonly syncDetail: string | null;
  readonly lastSyncAt: string | null;
  readonly hasConflict: boolean;
  readonly isBusy: boolean;
  readonly onAutomaticSyncChange: (next: boolean) => void;
  readonly onSyncNow: () => void;
  readonly onOpenConflict: () => void;
}) {
  const theme = useTheme();

  return (
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
              onValueChange={onAutomaticSyncChange}
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
                onPress={onOpenConflict}
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
            onPress={onSyncNow}
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

  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
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
