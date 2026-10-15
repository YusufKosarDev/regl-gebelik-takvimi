import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EndDateEditor } from '@/features/cycle/components/end-date-editor';
import { StartDateEditor } from '@/features/cycle/components/start-date-editor';
import { ButtonLabel, ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { deletePeriodRecord } from '@/features/cycle/application/delete-period-record';
import { getPeriodHistory } from '@/features/cycle/application/get-period-history';
import { updatePeriodEndDate } from '@/features/cycle/application/update-period-end-date';
import { updatePeriodStartDate } from '@/features/cycle/application/update-period-start-date';
import type { PeriodRecord } from '@/features/cycle/domain/types';
import { useDataChangeReload } from '@/hooks/use-data-change-reload';
import { useTheme } from '@/hooks/use-theme';
import { appMessages } from '@/shared/presentation/app-messages';
import { useLanguage, useMessages } from '@/i18n';
import type { LocalDataChangeOrigin } from '@/shared/data-change/local-data-change';
import { syncMessages } from '@/features/sync/presentation/sync-messages';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { formatDisplayDate } from '@/utils/format-date';
import { syncPeriodReminderQuietly } from '@/features/notifications/application/sync-period-reminder';
import { syncWidgetSnapshotQuietly } from '@/features/widget/application/sync-widget-snapshot';
import { getTodayLocalISODate } from '@/utils/today';
import {
  historyMessages,
  recordAccessibilityLabelIn,
  recordEndLabelIn,
} from '@/features/cycle/presentation/history-messages';

import { logEvent } from '@/shared/logging';
import { useTabBarInset } from '@/components/tab-bar';
import { useRevealInView } from '@/hooks/use-reveal-in-view';
import { getDailyLogHistory } from '@/features/daily-log/application/get-daily-log-history';
import type { DailyLogHistory } from '@/features/daily-log/application/get-daily-log-history';
import { mostLogged } from '@/features/daily-log/domain/most-logged';
import { MostLoggedList } from '@/features/daily-log/components/most-logged-list';
import { PhaseCorrelationSummary } from '@/features/daily-log/components/phase-correlation-summary';

/**
 * The recorded periods, and the corrections that can be made to them.
 *
 * A finished record can have either end of it moved, or be removed entirely. A
 * period that is still running can only be removed: when it began is what the
 * person is living through, and when it ends is Home's job to record.
 */
export default function HistoryScreen() {
  const theme = useTheme();
  const tabBarInset = useTabBarInset();
  const revealEditor = useRevealInView({ bottomInset: tabBarInset });
  const sync1 = useMessages(syncMessages);
  const history = useMessages(historyMessages);
  const common = useMessages(appMessages);
  const language = useLanguage();

  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<readonly PeriodRecord[] | null>(null);
  const [log, setLog] = useState<DailyLogHistory | null>(null);
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

  /**
   * What day the screen believes it is.
   *
   * Held rather than read per render so that the editors' calendars and the
   * use cases' "not in the future" rule measure against the same day: a picker
   * offering a date its own save would refuse is worse than either alone.
   *
   * It used to be read once and never again — `useState(() => ...)`, with a
   * comment saying every edit should measure against the same day. That is
   * right for one sitting and wrong across a night. A phone left on this tab
   * at 23:58 and picked up at 00:05 kept yesterday: the calendars stopped one
   * day short of the day it actually was, with nothing on screen saying why,
   * and `syncPeriodReminderQuietly` recomputed the next period from a
   * yesterday it had no reason to doubt.
   *
   * So it is re-read on every read of the screen — which since
   * `use-data-change-reload` grew its `AppState` listener includes coming back
   * from another app, and already included arriving, refocusing, and the
   * refresh after every write. Inside one uninterrupted sitting it is as stable
   * as the old comment wanted.
   */
  const [today, setToday] = useState<ISODate>(() => getTodayLocalISODate());

  /** Stable, so the mount effect can depend on it and the mutations can reuse it. */
  /**
   * Both halves of this screen, in one trip.
   *
   * The records are what it always showed. The log history is what the tab was
   * missing: the counts and the distribution were being computed and rendered
   * on another screen, reached from a link on the home screen, while the tab
   * somebody would open for them showed a list of periods.
   *
   * Read together rather than in two effects - one open of the database, and
   * the screen cannot end up showing an answer from before the last sync
   * beside records from after it.
   */
  const readHistory = useCallback(async () => {
    const db = await openAppDatabase();

    // The clock, on the same trip as the data. Returned rather than written
    // here so the screen takes the day and the records it describes together,
    // and so this stays stable: a dependency on `today` would rebuild the
    // reload on every rollover and re-run the focus effect with it.
    const current = getTodayLocalISODate();

    const [records, log] = await Promise.all([
      getPeriodHistory(db),
      getDailyLogHistory(db, current),
    ]);

    return { records, log, today: current };
  }, []);

  /** Re-reads both halves after a write, so neither goes stale on its own. */
  const refresh = useCallback(async () => {
    const history = await readHistory();

    setToday(history.today);
    setRecords(history.records);
    setLog(history.log);
  }, [readHistory]);

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

          setToday(history.today);
          setRecords(history.records);
          setLog(history.log);
          setHasError(false);

          if (origin === 'remote' && panelOpenRef.current) {
            setRecordPendingDelete(null);
            setRecordUnderEndEdit(null);
            setRecordUnderStartEdit(null);
            setRefreshNotice(sync1.dataRefreshedNotice);
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
    [readHistory, sync1]
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

      // Read here rather than taken from the screen. What the queue and the
      // widget are rebuilt from has to be the day it is now: everything else
      // on this screen can be a day out and be corrected by looking at it,
      // and a reminder scheduled from the wrong day is neither visible nor
      // corrected by anything.
      const now = getTodayLocalISODate();

      // The write is already durable, and the widget only holds a copy of it,
      // so a failed update here must not undo what was just saved.
      await syncWidgetSnapshotQuietly(db, now);
      await syncPeriodReminderQuietly(db, now);

      await refresh();
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

      // The clock at the moment of the write, for the same reason as above.
      // Against the picker's own bound this can only ever be the same day or a
      // later one, so it relaxes a rule the calendar has already enforced and
      // can never refuse a date the person was offered.
      const now = getTodayLocalISODate();

      await updatePeriodEndDate(db, { recordId: recordUnderEndEdit.id, endDate, today: now });

      // The write is already durable, and the widget only holds a copy of it,
      // so a failed update here must not undo what was just saved.
      await syncWidgetSnapshotQuietly(db, now);
      await syncPeriodReminderQuietly(db, now);

      await refresh();
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
      const now = getTodayLocalISODate();

      await updatePeriodStartDate(db, {
        recordId: recordUnderStartEdit.id,
        startDate,
        today: now,
      });

      // The write is already durable, and the widget only holds a copy of it,
      // so a failed update here must not undo what was just saved.
      await syncWidgetSnapshotQuietly(db, now);
      await syncPeriodReminderQuietly(db, now);

      await refresh();
      closePanels();
    } catch (error) {
      logEvent('period record update failed', error);

      setHasUpdateError(true);
    } finally {
      mutationInFlight.current = false;
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ActivityIndicator testID="period-history-loading" color={theme.text} />
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
          {...revealEditor.scrollViewProps}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.five + tabBarInset }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
                {history.historyTitle}
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                {history.historyDescription}
              </ThemedText>

              {/* Only after a sync closed something that was open. */}
              {refreshNotice !== null && (
                <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                  {refreshNotice}
                </ThemedText>
              )}
            </View>

            {/* The answer first, then the working, then the records.

                These two were being computed and drawn on another screen, one
                reached from a link on the home screen, while this tab - the
                one somebody opens to find out what has been happening - showed
                a list of period dates and nothing else.

                The order is Cycles': counts, then the distribution they came
                out of. A chart first hands somebody the working and asks them
                to do the answering. */}
            {log !== null && (
              <>
                <MostLoggedList
                  // One per day, like the mood, so it takes the mood's limit
                  // rather than the symptoms' three: the row answers what it
                  // mostly was, and a day has exactly one answer.
                  flows={mostLogged(
                    log.entries,
                    (entry) => (entry.flowId === null ? [] : [entry.flowId]),
                    1
                  )}
                  symptoms={mostLogged(log.entries, (entry) => entry.symptomIds, 3)}
                  moods={mostLogged(
                    log.entries,
                    (entry) => (entry.moodId === null ? [] : [entry.moodId]),
                    1
                  )}
                />

                <PhaseCorrelationSummary
                  symptoms={log.symptomCorrelations}
                  moods={log.moodCorrelations}
                  hasPlacedDays={log.phased.some((day) => day.phase !== null)}
                />
              </>
            )}

            {hasError ? (
              <ThemedText accessibilityRole="alert" themeColor="textSecondary">
                {history.historyLoadFailedMessage}
              </ThemedText>
            ) : records === null || records.length === 0 ? (
              <ThemedText themeColor="textSecondary">{history.historyEmptyMessage}</ThemedText>
            ) : (
              <View style={styles.list}>
                {records.map((record) => (
                  <View
                    key={record.id}
                    accessible
                    accessibilityLabel={recordAccessibilityLabelIn(history, record, language)}
                    testID={`history-record-${record.id}`}
                    style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {history.recordStartLabel}
                    </ThemedText>
                    <ThemedText style={styles.rowValue}>
                      {formatDisplayDate(record.startDate, language)}
                    </ThemedText>

                    <ThemedText type="small" themeColor="textSecondary" style={styles.endLabel}>
                      {history.recordEndLabel}
                    </ThemedText>
                    <ThemedText type="small">{recordEndLabelIn(history, record, language)}</ThemedText>

                    {recordUnderStartEdit?.id === record.id ? (
                      <View {...revealEditor.targetProps}>
                      <StartDateEditor
                        record={record}
                        records={records}
                        today={today}
                        selectedStartDate={selectedStartDate ?? record.startDate}
                        onSelectStartDate={setSelectedStartDate}
                        isUpdating={isUpdating}
                        hasError={hasUpdateError}
                        onCancel={closePanels}
                        onSave={() => applyStartDate(selectedStartDate ?? record.startDate)}
                      />
                      </View>
                    ) : recordUnderEndEdit?.id === record.id ? (
                      <View {...revealEditor.targetProps}>
                      <EndDateEditor
                        record={record}
                        records={records}
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
                      </View>
                    ) : recordPendingDelete?.id === record.id ? (
                      <View {...revealEditor.targetProps} style={styles.confirmation}>
                        <ThemedText type="small">{history.deleteQuestion}</ThemedText>

                        <ThemedText type="smallBold">
                          {formatDisplayDate(record.startDate, language)}
                        </ThemedText>

                        <ThemedText type="small" themeColor="textSecondary">
                          {history.deleteConsequence}
                        </ThemedText>

                        {hasDeleteError && (
                          <ThemedText
                            accessibilityRole="alert"
                            type="small"
                            themeColor="textSecondary">
                            {history.historyDeleteFailedMessage}
                          </ThemedText>
                        )}

                        <View style={styles.confirmActions}>
                          {/* Cancel filled, the deletion outlined. The order
                              here was already the app's - cancel first - and
                              the weights were the other two panels'. See
                              `deletion-messages.ts`. */}
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={common.cancelLabel}
                            accessibilityState={{ disabled: isDeleting }}
                            disabled={isDeleting}
                            onPress={closePanels}
                            style={({ pressed }) => [
                              styles.primaryButton,
                              { backgroundColor: theme.primary },
                              isDeleting && styles.disabled,
                              pressed && !isDeleting && styles.pressed,
                            ]}>
                            <ThemedText
                              type="smallBold"
                              style={[ButtonLabel, { color: theme.onPrimary }]}>
                              {common.cancelLabel}
                            </ThemedText>
                          </Pressable>

                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={history.deleteConfirmLabel}
                            accessibilityState={{ disabled: isDeleting }}
                            disabled={isDeleting}
                            onPress={handleDelete}
                            style={({ pressed }) => [
                              styles.secondaryButton,
                              isDeleting && styles.disabled,
                              pressed && !isDeleting && styles.pressed,
                            ]}>
                            <ThemedText type="smallBold" style={ButtonLabel}>
                              {isDeleting ? history.deleteBusyLabel : history.deleteConfirmLabel}
                            </ThemedText>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.rowActions}>
                        {/* The two ends are offered differently, and the
                            difference is not an oversight.

                            Ending a period is a state change, and the Cycle
                            tab is where the period state changes - so a
                            running period has no end to correct here.

                            When it began is a fact about the past whether or
                            not it is still running, so that is offered on
                            every record. It used to be hidden on a running
                            one as well, which left a mistyped start date with
                            no remedy but Delete and re-record: throwing the
                            record away to fix one day of it. */}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={history.editStartLabel(formatDisplayDate(record.startDate, language))}
                          onPress={() => openStartEditor(record)}
                          style={({ pressed }) => [
                            styles.rowAction,
                            { borderColor: theme.primary },
                            pressed && styles.pressed,
                          ]}>
                          <ThemedText type="smallBold" themeColor="primary">
                            {history.editStartText}
                          </ThemedText>
                        </Pressable>

                        {!record.isOngoing && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={history.editEndLabel(formatDisplayDate(record.startDate, language))}
                            onPress={() => openEndEditor(record)}
                            style={({ pressed }) => [
                            styles.rowAction,
                            { borderColor: theme.primary },
                            pressed && styles.pressed,
                          ]}>
                            <ThemedText type="smallBold" themeColor="primary">
                              {history.editEndText}
                            </ThemedText>
                          </Pressable>
                        )}

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={history.deleteRecordLabel(formatDisplayDate(record.startDate, language))}
                          onPress={() => askToDelete(record)}
                          style={({ pressed }) => [
                            styles.rowAction,
                            { borderColor: theme.primary },
                            pressed && styles.pressed,
                          ]}>
                          <ThemedText type="smallBold" themeColor="primary">
                            {history.deleteText}
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
  /**
   * A row action looks like a control, because it is one.
   *
   * All three were `small` text in `textSecondary` with no border and no
   * glyph - the same treatment as the "Başlangıç" and "Bitiş" labels two lines
   * above them. The hit area was always right; nothing said they were
   * pressable, so three controls read as a caption. Assistive technology was
   * told - they carry `accessibilityRole="button"` - and a sighted person was
   * not.
   *
   * The treatment is the app's existing one rather than a new idea. Every
   * pressable here that is not a filled button carries a second channel
   * besides being text: a border in the accent with accent text, as the
   * calendar's "Bu güne ekle" does on its own record card, or a chevron with
   * grey text, as the home screen's link rows do. These take the first,
   * because that is what an inline action on a record already looks like one
   * screen away; a chevron says "goes somewhere" and these open a panel in
   * place.
   *
   * All three get it, including Delete. Which of them is destructive is the
   * confirmation step's job - see `deletion-messages.ts` - and this step only
   * opens a panel that explains itself.
   */
  rowAction: {
    minHeight: 44,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
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
