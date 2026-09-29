import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appMessages } from '@/shared/presentation/app-messages';
import { useLanguage, useMessages } from '@/i18n';
import type { ISODate } from '@/types/iso-date';
import { addDays, daysBetween } from '@/utils/date';
import { formatDisplayDate } from '@/utils/format-date';

import { maxSelectableEndDate } from '../domain/record-bounds';
import type { PeriodRecord } from '../domain/types';
import { historyMessages } from '../presentation/history-messages';


/**
 * Corrects one record's end date.
 *
 * A pair of day steppers rather than a native picker: no extra dependency, and
 * the range it can reach is exactly the range the domain would accept, so the
 * control cannot offer a date that saving would refuse.
 */
export function EndDateEditor({
  record,
  today,
  selectedEndDate,
  onSelectEndDate,
  isRemoving,
  onAskToRemove,
  onCancelRemove,
  isUpdating,
  hasError,
  onCancel,
  onSave,
  onRemove,
}: {
  record: PeriodRecord;
  today: ISODate;
  selectedEndDate: ISODate;
  onSelectEndDate: (date: ISODate) => void;
  isRemoving: boolean;
  onAskToRemove: () => void;
  onCancelRemove: () => void;
  isUpdating: boolean;
  hasError: boolean;
  onCancel: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const history = useMessages(historyMessages);
  const common = useMessages(appMessages);
  const language = useLanguage();

  const maxDate = maxSelectableEndDate(record.startDate, today);

  const canGoBack = daysBetween(record.startDate, selectedEndDate) > 0;
  const canGoForward = daysBetween(selectedEndDate, maxDate) > 0;

  if (isRemoving) {
    return (
      <View style={styles.confirmation}>
        <ThemedText type="small">{history.clearEndQuestion}</ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {history.clearEndConsequence}
        </ThemedText>

        {hasError && (
          <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
            {history.historyUpdateFailedMessage}
          </ThemedText>
        )}

        <View style={styles.confirmActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={common.cancelLabel}
            accessibilityState={{ disabled: isUpdating }}
            disabled={isUpdating}
            onPress={onCancelRemove}
            style={({ pressed }) => [
              styles.secondaryButton,
              isUpdating && styles.disabled,
              pressed && !isUpdating && styles.pressed,
            ]}>
            <ThemedText type="small" themeColor="textSecondary">
              {common.cancelLabel}
            </ThemedText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={history.clearEndConfirmLabel}
            accessibilityState={{ disabled: isUpdating }}
            disabled={isUpdating}
            onPress={onRemove}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary },
              isUpdating && styles.disabled,
              pressed && !isUpdating && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              {isUpdating ? history.clearEndBusyLabel : history.clearEndConfirmLabel}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.confirmation}>
      <ThemedText type="smallBold">{history.editEndPanelTitle}</ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {history.startDateLine(formatDisplayDate(record.startDate, language))}
      </ThemedText>

      <View style={styles.dateBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={history.previousDayLabel}
          accessibilityState={{ disabled: !canGoBack }}
          disabled={!canGoBack}
          onPress={() => onSelectEndDate(addDays(selectedEndDate, -1))}
          style={({ pressed }) => [
            styles.dayButton,
            !canGoBack && styles.disabled,
            pressed && canGoBack && styles.pressed,
          ]}>
          <ThemedText style={styles.dayButtonLabel}>‹</ThemedText>
        </Pressable>

        <ThemedText
          accessibilityLabel={history.selectedEndDateLabel(formatDisplayDate(selectedEndDate, language))}
          type="smallBold"
          style={styles.selectedDate}>
          {formatDisplayDate(selectedEndDate, language)}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={history.nextDayLabel}
          accessibilityState={{ disabled: !canGoForward }}
          disabled={!canGoForward}
          onPress={() => onSelectEndDate(addDays(selectedEndDate, 1))}
          style={({ pressed }) => [
            styles.dayButton,
            !canGoForward && styles.disabled,
            pressed && canGoForward && styles.pressed,
          ]}>
          <ThemedText style={styles.dayButtonLabel}>›</ThemedText>
        </Pressable>
      </View>

      {hasError && (
        <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
          {history.historyUpdateFailedMessage}
        </ThemedText>
      )}

      <View style={styles.confirmActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={common.cancelLabel}
          accessibilityState={{ disabled: isUpdating }}
          disabled={isUpdating}
          onPress={onCancel}
          style={({ pressed }) => [
            styles.secondaryButton,
            isUpdating && styles.disabled,
            pressed && !isUpdating && styles.pressed,
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            {common.cancelLabel}
          </ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={history.saveEndLabel}
          accessibilityState={{ disabled: isUpdating }}
          disabled={isUpdating}
          onPress={onSave}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.primary },
            isUpdating && styles.disabled,
            pressed && !isUpdating && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            {isUpdating ? common.savingLabel : common.saveLabel}
          </ThemedText>
        </Pressable>
      </View>

      {/* Only offered when there is something to remove. */}
      {record.endDate !== undefined && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={history.clearEndOpenLabel}
          accessibilityState={{ disabled: isUpdating }}
          disabled={isUpdating}
          onPress={onAskToRemove}
          style={({ pressed }) => [
            styles.removeButton,
            isUpdating && styles.disabled,
            pressed && !isUpdating && styles.pressed,
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            {history.clearEndOpenLabel}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  confirmation: {
    marginTop: Spacing.three,
    gap: Spacing.one,
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
    minHeight: 44,
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
  removeButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
