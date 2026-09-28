import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { EndDateEditor } from '@/features/cycle/components/end-date-editor';
import { StartDateEditor } from '@/features/cycle/components/start-date-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { deletePeriodRecord } from '@/features/cycle/application/delete-period-record';
import { getPeriodHistory } from '@/features/cycle/application/get-period-history';
import { updatePeriodEndDate } from '@/features/cycle/application/update-period-end-date';
import { updatePeriodStartDate } from '@/features/cycle/application/update-period-start-date';
import type { PeriodRecord } from '@/features/cycle/domain/types';
import { useDataChangeReload } from '@/hooks/use-data-change-reload';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/i18n';
import type { LocalDataChangeOrigin } from '@/shared/data-change/local-data-change';
import { DATA_REFRESHED_NOTICE } from '@/features/sync/presentation/sync-messages';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { formatDisplayDate } from '@/utils/format-date';
import { syncPeriodReminderQuietly } from '@/features/notifications/application/sync-period-reminder';
import { syncWidgetSnapshotQuietly } from '@/features/widget/application/sync-widget-snapshot';
import { getTodayLocalISODate } from '@/utils/today';
import {
  DELETE_CONFIRM_LABEL,
  DELETE_CONSEQUENCE,
  DELETE_QUESTION,
  DELETE_TEXT,
  EDIT_END_TEXT,
  EDIT_START_TEXT,
  HISTORY_DELETE_FAILED_MESSAGE,
  HISTORY_DESCRIPTION,
  HISTORY_EMPTY_MESSAGE,
  HISTORY_LOAD_FAILED_MESSAGE,
  HISTORY_TITLE,
  RECORD_END_LABEL,
  RECORD_START_LABEL,
  deleteRecordLabel,
  editEndLabel,
  editStartLabel,
  recordAccessibilityLabel,
  recordEndLabel,
} from '@/features/cycle/presentation/history-messages';
import {
  CANCEL_LABEL,
  LOADING_MESSAGE,
} from '@/shared/presentation/app-messages';
import { logEvent } from '@/shared/logging';

/**
 * The recorded periods, and the corrections that can be made to them.
 *
 * A finished record can have either end of it moved, or be removed entirely. A
 * period that is still running can only be removed: when it began is what the
 * person is living through, and when it ends is Home's job to record.
 */
export default function HistoryScreen() {
  const theme = useTheme();
  const language = useLanguage();

  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<readonly PeriodRecord[] | null>(null);
  const [hasError, setHasError] = useState(false);

  // Set only when a sync closed a panel that was open, so the panel does not
  // simply vanish with no explanation.
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  // The record the person asked to remove, held only while they confirm it.
  const [recordPendingDelete, setRecordPendingDelete] = useState<PeriodRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasDeleteError, setHasDeleteError] = useState(false);

  // The record whose end date is being corrected, the date currently picked for
  // it, and whether the person has asked to clear the end date instead.
  const [recordUnderEndEdit, setRecordUnderEndEdit] = useState<PeriodRecord | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<ISODate | null>(null);
  const [isRemovingEndDate, setIsRemovingEndDate] = useState(false);

  // The record whose start date is being corrected. The record is held rather
  // than just its id, because correcting the start date can rename the record
  // and the mutation has to be sent with the id it had when the edit began.
  const [recordUnderStartEdit, setRecordUnderStartEdit] = useState<PeriodRecord | null>(null);

  // Whether anything is open that a pull could invalidate. A ref, so the
  // reload callback stays stable while panels open and close.
  const panelOpenRef = useRef(false);

  // Kept in an effect rather than written during render: the compiler
  // forbids the latter, and a reload only reads these after an await, by which
  // time the effect has run.
  useEffect(() => {
    panelOpenRef.current =
      recordPendingDelete !== null ||
      recordUnderEndEdit !== null ||
      recordUnderStartEdit !== null;
  }, [recordPendingDelete, recordUnderEndEdit, recordUnderStartEdit]);
  const [selectedStartDate, setSelectedStartDate] = useState<ISODate | null>(null);

  const [isUpdating, setIsUpdating] = useState(false);
  const [hasUpdateError, setHasUpdateError] = useState(false);

  // One lock for the whole screen rather than one per action: state updates are
  // async, so two quick taps could both read the disabled flag as false before
  // the re-render lands, and a delete racing an edit would write a profile built
  // from what the other one had already replaced.
  const mutationInFlight = useRef(false);

  // Read once for the screen, so every edit measures "not in the future"
  // against the same day.
  const [today] = useState<ISODate>(() => getTodayLocalISODate());

  /** Stable, so the mount effect can depend on it and the mutations can reuse it. */
  const readHistory = useCallback(async () => {
    const db = await openAppDatabase();

    return getPeriodHistory(db);
  }, []);

  /**
   * Re-reads the history, and closes any panel a sync has invalidated.
   *
   * The panels edit one particular record by id. After a pull that record may
   * hold different dates, or may not exist at all, so a panel left open would
   * be about to write a date the person chose for a record that has changed
   * underneath them. They are closed rather than rewritten: the record list is
   * right there, and reopening the one they meant costs one tap.
   */
  const load = useCallback(
    (origin: LocalDataChangeOrigin | null) => {
      let cancelled = false;

      void (async () => {
        try {
          const history = await readHistory();

          if (cancelled) {
            return;
          }

          setRecords(history);
          setHasError(false);

          if (origin === 'remote' && panelOpenRef.current) {
            setRecordPendingDelete(null);
            setRecordUnderEndEdit(null);
            setRecordUnderStartEdit(null);
            setRefreshNotice(DATA_REFRESHED_NOTICE);
          }
        } catch (error) {
          logEvent('period history load failed', error);

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
    [readHistory]
  );

  useDataChangeReload(load);

  /**
   * Closes whichever panel is open and forgets what it was editing.
   *
   * Only one is ever shown, so every action that opens one starts by closing the
   * rest: two open panels on the same card would ask two questions at once, and
   * a panel left holding a record that a save has since renamed would be editing
   * something that no longer exists.
   */
  const closePanels = () => {
    setRecordPendingDelete(null);
    setHasDeleteError(false);

    setRecordUnderEndEdit(null);
    setSelectedEndDate(null);
    setIsRemovingEndDate(false);

    setRecordUnderStartEdit(null);
    setSelectedStartDate(null);

    setHasUpdateError(false);
  };

  const openStartEditor = (record: PeriodRecord) => {
    closePanels();

    setRecordUnderStartEdit(record);
    setSelectedStartDate(record.startDate);
  };

  const openEndEditor = (record: PeriodRecord) => {
    closePanels();

    setRecordUnderEndEdit(record);
    // A record with no recorded end starts at its own start date: the earliest
    // day it could possibly have finished.
    setSelectedEndDate(record.endDate ?? record.startDate);
  };

  const askToDelete = (record: PeriodRecord) => {
    closePanels();

    setRecordPendingDelete(record);
  };

  const handleDelete = async () => {
    if (mutationInFlight.current || recordPendingDelete === null) {
      return;
    }

    mutationInFlight.current = true;
    setIsDeleting(true);
    setHasDeleteError(false);

    try {
      const db = await openAppDatabase();

      await deletePeriodRecord(db, { recordId: recordPendingDelete.id });

      // The write is already durable, and the widget only holds a copy of it,
      // so a failed update here must not undo what was just saved.
      await syncWidgetSnapshotQuietly(db, today);
      await syncPeriodReminderQuietly(db, today);

      setRecords(await readHistory());
      setRecordPendingDelete(null);
    } catch (error) {
      logEvent('period record delete failed', error);

      // The confirmation stays open with the error, so a rejected delete is
      // visible next to the record it was for and can be tried again.
      setHasDeleteError(true);
    } finally {
      mutationInFlight.current = false;
      setIsDeleting(false);
    }
  };

  const applyEndDate = async (endDate: ISODate | undefined) => {
    if (mutationInFlight.current || recordUnderEndEdit === null) {
      return;
    }

    mutationInFlight.current = true;
    setIsUpdating(true);
    setHasUpdateError(false);

    try {
      const db = await openAppDatabase();

      await updatePeriodEndDate(db, { recordId: recordUnderEndEdit.id, endDate, today });

      // The write is already durable, and the widget only holds a copy of it,
      // so a failed update here must not undo what was just saved.
      await syncWidgetSnapshotQuietly(db, today);
      await syncPeriodReminderQuietly(db, today);

      setRecords(await readHistory());
      closePanels();
    } catch (error) {
      logEvent('period record update failed', error);

      // The editor stays open with the error, so a rejected change is visible
      // next to the record it was for and can be tried again.
      setHasUpdateError(true);
    } finally {
      mutationInFlight.current = false;
      setIsUpdating(false);
    }
  };

  const applyStartDate = async (startDate: ISODate) => {
    if (mutationInFlight.current || recordUnderStartEdit === null) {
      return;
    }

    mutationInFlight.current = true;
    setIsUpdating(true);
    setHasUpdateError(false);

    try {
      const db = await openAppDatabase();

      // Sent with the id the record had when the edit began. The use case may
      // give it a new one, which is why nothing here keeps hold of it after the
      // save: the reloaded list is the only thing that knows the record now.
      await updatePeriodStartDate(db, {
        recordId: recordUnderStartEdit.id,
        startDate,
        today,
      });

      // The write is already durable, and the widget only holds a copy of it,
      // so a failed update here must not undo what was just saved.
      await syncWidgetSnapshotQuietly(db, today);
      await syncPeriodReminderQuietly(db, today);

      setRecords(await readHistory());
      closePanels();
    } catch (error) {
      logEvent('period record update failed', error);

      setHasUpdateError(true);
    } finally {
      mutationInFlight.current = false;
      setIsUpdating(false);
    }
  };

  // The stack hides its header, so back has to be offered here.
  const backButton = (
    <BackButton />
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ActivityIndicator testID="period-history-loading" color={theme.text} />
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
                {HISTORY_TITLE}
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                {HISTORY_DESCRIPTION}
              </ThemedText>

              {/* Only after a sync closed something that was open. */}
              {refreshNotice !== null && (
                <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                  {refreshNotice}
                </ThemedText>
              )}
            </View>

            {hasError ? (
              <ThemedText accessibilityRole="alert" themeColor="textSecondary">
                {HISTORY_LOAD_FAILED_MESSAGE}
              </ThemedText>
            ) : records === null || records.length === 0 ? (
              <ThemedText themeColor="textSecondary">{HISTORY_EMPTY_MESSAGE}</ThemedText>
            ) : (
              <View style={styles.list}>
                {records.map((record) => (
                  <View
                    key={record.id}
                    accessible
                    accessibilityLabel={recordAccessibilityLabel(record, language)}
                    testID={`history-record-${record.id}`}
                    style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {RECORD_START_LABEL}
                    </ThemedText>
                    <ThemedText style={styles.rowValue}>
                      {formatDisplayDate(record.startDate, language)}
                    </ThemedText>

                    <ThemedText type="small" themeColor="textSecondary" style={styles.endLabel}>
                      {RECORD_END_LABEL}
                    </ThemedText>
                    <ThemedText type="small">{recordEndLabel(record, language)}</ThemedText>

                    {recordUnderStartEdit?.id === record.id ? (
                      <StartDateEditor
                        record={record}
                        today={today}
                        selectedStartDate={selectedStartDate ?? record.startDate}
                        onSelectStartDate={setSelectedStartDate}
                        isUpdating={isUpdating}
                        hasError={hasUpdateError}
                        onCancel={closePanels}
                        onSave={() => applyStartDate(selectedStartDate ?? record.startDate)}
                      />
                    ) : recordUnderEndEdit?.id === record.id ? (
                      <EndDateEditor
                        record={record}
                        today={today}
                        selectedEndDate={selectedEndDate ?? record.startDate}
                        onSelectEndDate={setSelectedEndDate}
                        isRemoving={isRemovingEndDate}
                        onAskToRemove={() => {
                          setIsRemovingEndDate(true);
                          setHasUpdateError(false);
                        }}
                        onCancelRemove={() => {
                          setIsRemovingEndDate(false);
                          setHasUpdateError(false);
                        }}
                        isUpdating={isUpdating}
                        hasError={hasUpdateError}
                        onCancel={closePanels}
                        onSave={() => applyEndDate(selectedEndDate ?? record.startDate)}
                        onRemove={() => applyEndDate(undefined)}
                      />
                    ) : recordPendingDelete?.id === record.id ? (
                      <View style={styles.confirmation}>
                        <ThemedText type="small">{DELETE_QUESTION}</ThemedText>

                        <ThemedText type="smallBold">
                          {formatDisplayDate(record.startDate, language)}
                        </ThemedText>

                        <ThemedText type="small" themeColor="textSecondary">
                          {DELETE_CONSEQUENCE}
                        </ThemedText>

                        {hasDeleteError && (
                          <ThemedText
                            accessibilityRole="alert"
                            type="small"
                            themeColor="textSecondary">
                            {HISTORY_DELETE_FAILED_MESSAGE}
                          </ThemedText>
                        )}

                        <View style={styles.confirmActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={CANCEL_LABEL}
                            accessibilityState={{ disabled: isDeleting }}
                            disabled={isDeleting}
                            onPress={closePanels}
                            style={({ pressed }) => [
                              styles.secondaryButton,
                              isDeleting && styles.disabled,
                              pressed && !isDeleting && styles.pressed,
                            ]}>
                            <ThemedText type="small" themeColor="textSecondary">
                              {CANCEL_LABEL}
                            </ThemedText>
                          </Pressable>

                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={DELETE_CONFIRM_LABEL}
                            accessibilityState={{ disabled: isDeleting }}
                            disabled={isDeleting}
                            onPress={handleDelete}
                            style={({ pressed }) => [
                              styles.primaryButton,
                              { backgroundColor: theme.primary },
                              isDeleting && styles.disabled,
                              pressed && !isDeleting && styles.pressed,
                            ]}>
                            <ThemedText
                              type="smallBold"
                              style={{ color: theme.onPrimary }}>
                              {isDeleting ? 'Siliniyor...' : 'Sil'}
                            </ThemedText>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.rowActions}>
                        {/* A period that is still running is finished from Home,
                            and began on the day the person said it did: neither
                            end of it is corrected here. */}
                        {!record.isOngoing && (
                          <>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={editStartLabel(formatDisplayDate(record.startDate, language))}
                              onPress={() => openStartEditor(record)}
                              style={({ pressed }) => [
                                styles.rowAction,
                                pressed && styles.pressed,
                              ]}>
                              <ThemedText type="small" themeColor="textSecondary">
                                {EDIT_START_TEXT}
                              </ThemedText>
                            </Pressable>

                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={editEndLabel(formatDisplayDate(record.startDate, language))}
                              onPress={() => openEndEditor(record)}
                              style={({ pressed }) => [
                                styles.rowAction,
                                pressed && styles.pressed,
                              ]}>
                              <ThemedText type="small" themeColor="textSecondary">
                                {EDIT_END_TEXT}
                              </ThemedText>
                            </Pressable>
                          </>
                        )}

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={deleteRecordLabel(formatDisplayDate(record.startDate, language))}
                          onPress={() => askToDelete(record)}
                          style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}>
                          <ThemedText type="small" themeColor="textSecondary">
                            {DELETE_TEXT}
                          </ThemedText>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
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
  list: {
    gap: Spacing.two,
  },
  row: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  rowValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  endLabel: {
    marginTop: Spacing.two,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.four,
    marginTop: Spacing.two,
  },
  rowAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: Spacing.two,
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
  removeButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
  },
  confirmation: {
    marginTop: Spacing.three,
    gap: Spacing.one,
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
