import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appMessages } from '@/shared/presentation/app-messages';
import { useLanguage, useMessages } from '@/i18n';
import type { ISODate } from '@/types/iso-date';
import { addDays, daysBetween } from '@/utils/date';
import { formatDisplayDate } from '@/utils/format-date';

import {
  maxSelectableStartDate,
  minSelectableStartDate,
} from '../domain/record-bounds';
import type { PeriodRecord } from '../domain/types';
import {
  historyMessages,
  recordEndLabelIn,
} from '../presentation/history-messages';


/**
 * Corrects one record's start date.
 *
 * The end date is shown but not editable: this panel answers only "it began on a
 * different day". Moving both ends at once would make it impossible to say which
 * correction was meant, and correcting the end has its own panel.
 *
 * The same day steppers as the end editor, bounded so the control cannot offer a
 * date that saving would refuse.
 */
export function StartDateEditor({
  record,
  today,
  selectedStartDate,
  onSelectStartDate,
  isUpdating,
  hasError,
  onCancel,
  onSave,
}: {
  record: PeriodRecord;
  today: ISODate;
  selectedStartDate: ISODate;
  onSelectStartDate: (date: ISODate) => void;
  isUpdating: boolean;
  hasError: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const theme = useTheme();
  const history = useMessages(historyMessages);
  const common = useMessages(appMessages);
  const language = useLanguage();

  const maxDate = maxSelectableStartDate(record, today);
  const minDate = minSelectableStartDate(record);

  // With no recorded end there is no maximum duration to measure against, so
  // nothing bounds how far back the person may reach.
  const canGoBack = minDate === null || daysBetween(minDate, selectedStartDate) > 0;
  const canGoForward = daysBetween(selectedStartDate, maxDate) > 0;

  return (
    <View style={styles.confirmation}>
      <ThemedText type="smallBold">{history.editStartPanelTitle}</ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {history.endDateLine(recordEndLabelIn(history, record, language))}
      </ThemedText>

      <View style={styles.dateBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={history.previousDayLabel}
          accessibilityState={{ disabled: !canGoBack }}
          disabled={!canGoBack}
          onPress={() => onSelectStartDate(addDays(selectedStartDate, -1))}
          style={({ pressed }) => [
            styles.dayButton,
            !canGoBack && styles.disabled,
            pressed && canGoBack && styles.pressed,
          ]}>
          <ThemedText style={styles.dayButtonLabel}>‹</ThemedText>
        </Pressable>

        <ThemedText
          accessibilityLabel={history.selectedStartDateLabel(formatDisplayDate(selectedStartDate, language))}
          type="smallBold"
          style={styles.selectedDate}>
          {formatDisplayDate(selectedStartDate, language)}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={history.nextDayLabel}
          accessibilityState={{ disabled: !canGoForward }}
          disabled={!canGoForward}
          onPress={() => onSelectStartDate(addDays(selectedStartDate, 1))}
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
          accessibilityLabel={history.saveStartLabel}
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
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
