import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';
import { appMessages } from '@/shared/presentation/app-messages';


import type { CloudRestorePreviewV1 } from '../domain/cloud-restore-preview-v1';
import { authMessages } from '@/features/auth/presentation/auth-messages';
import {
  restoreLabels,
  restorePeriodRecordsLabelIn,
  restoreStatusLabelIn,
} from '../presentation/restore-labels';

/**
 * What a restore would do, before it does any of it.
 *
 * Lifted out of the account screen unchanged: the button that asks for the
 * preview, the six rows the preview comes back as, the warning, and the
 * confirm and cancel pair.
 *
 * The two states are one component rather than two because they are one
 * question asked twice - "show me" and then "do it" - and splitting them would
 * put the warning somewhere that the button it qualifies is not.
 *
 * `preview` being null is what decides which is shown. That is the screen's
 * value: it is cleared when the person cancels and when a restore finishes, and
 * both of those are things the screen knows and this does not.
 */
export function RestorePreviewPanel({
  preview,
  isBusy,
  canConfirm,
  onPreview,
  onConfirm,
  onCancel,
}: {
  readonly preview: CloudRestorePreviewV1 | null;
  readonly isBusy: boolean;
  /** Whether the previewed payload is still in hand. */
  readonly canConfirm: boolean;
  readonly onPreview: () => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const theme = useTheme();
  const authStrings = useMessages(authMessages);
  const labels = useMessages(restoreLabels);
  const common = useMessages(appMessages);

  return preview === null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={authStrings.restoreOpenLabel}
            accessibilityState={{ disabled: isBusy }}
            disabled={isBusy}
            onPress={onPreview}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.backgroundSelected },
              isBusy && styles.disabled,
              pressed && !isBusy && styles.pressed,
            ]}>
            <ThemedText type="smallBold">{authStrings.restoreOpenLabel}</ThemedText>
          </Pressable>
        ) : (
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText accessibilityRole="header" type="smallBold">
              {authStrings.restorePreviewTitle}
            </ThemedText>

            <PreviewRow
              label={authStrings.restoreRowCycleSettings}
              value={restoreStatusLabelIn(labels, preview.cycleSettings)}
            />
            <PreviewRow
              label={authStrings.restoreRowPeriodRecords}
              value={restorePeriodRecordsLabelIn(labels, preview.periodRecords)}
            />
            <PreviewRow
              label={authStrings.restoreRowPregnancy}
              value={restoreStatusLabelIn(labels, preview.pregnancyProfile)}
            />
            <PreviewRow label={authStrings.restoreRowAvatar} value={restoreStatusLabelIn(labels, preview.avatarConfig)} />
            <PreviewRow
              label={authStrings.restoreRowReminders}
              value={restoreStatusLabelIn(labels, preview.notificationPreferences)}
            />
            <PreviewRow
              label={authStrings.restoreRowDailyEntries}
              value={restorePeriodRecordsLabelIn(labels, preview.dailyEntries)}
            />

            <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
              {authStrings.restoreWarning}
            </ThemedText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={authStrings.restoreConfirmLabel}
              accessibilityState={{ disabled: isBusy || !canConfirm }}
              disabled={isBusy || !canConfirm}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {isBusy ? authStrings.restoringLabel : authStrings.restoreConfirmLabel}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={authStrings.restoreCancelLabel}
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.backgroundSelected },
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{common.cancelLabel}</ThemedText>
            </Pressable>
          </View>
  );
}

/**
 * One line of the preview: what would happen, to what.
 *
 * The label and the verdict are one accessibility label, so a screen reader
 * reads "Regl kayitlari: 3 eklenecek" rather than two unrelated fragments.
 */
function PreviewRow({ label, value }: { label: string; value: string }) {
  const authStrings = useMessages(authMessages);

  return (
    <View accessibilityLabel={authStrings.previewRowLabel(label, value)} style={styles.previewRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>

      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 32,
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
