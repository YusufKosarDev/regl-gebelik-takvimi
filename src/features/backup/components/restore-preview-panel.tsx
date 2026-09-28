import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';
import { appMessages } from '@/shared/presentation/app-messages';


import type { CloudRestorePreviewV1 } from '../domain/cloud-restore-preview-v1';
import {
  RESTORE_CANCEL_LABEL,
  RESTORE_CONFIRM_LABEL,
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
  previewRowLabel,
} from '@/features/auth/presentation/auth-messages';
import {
  restorePeriodRecordsLabel,
  restoreStatusLabel,
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
  const common = useMessages(appMessages);

  return preview === null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={RESTORE_OPEN_LABEL}
            accessibilityState={{ disabled: isBusy }}
            disabled={isBusy}
            onPress={onPreview}
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
                {isBusy ? RESTORING_LABEL : RESTORE_CONFIRM_LABEL}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={RESTORE_CANCEL_LABEL}
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
