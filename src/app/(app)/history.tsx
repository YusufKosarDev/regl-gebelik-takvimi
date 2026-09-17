import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { deletePeriodRecord } from '@/features/cycle/application/delete-period-record';
import { getPeriodHistory } from '@/features/cycle/application/get-period-history';
import { updatePeriodEndDate } from '@/features/cycle/application/update-period-end-date';
import { MAX_PERIOD_DURATION_DAYS } from '@/features/cycle/domain/limits';
import type { PeriodRecord } from '@/features/cycle/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { addDays, daysBetween } from '@/utils/date';
import { formatDisplayDate } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';

const LOAD_ERROR_MESSAGE = 'Kayıtlar yüklenemedi.';
const DELETE_ERROR_MESSAGE = 'Kayıt silinemedi.';
const UPDATE_ERROR_MESSAGE = 'Kayıt güncellenemedi.';
const EMPTY_MESSAGE = 'Henüz kayıt bulunamadı.';
const ONGOING_LABEL = 'Devam ediyor';
const UNKNOWN_END_LABEL = 'Bitiş tarihi bilinmiyor';

/**
 * How a record's end reads.
 *
 * A period with no end date is not the same as one still running, so the two get
 * different words. Nothing is estimated from the average period length: what was
 * never recorded stays unrecorded.
 */
function endLabel(record: PeriodRecord): string {
  if (record.isOngoing) {
    return ONGOING_LABEL;
  }

  return record.endDate === undefined ? UNKNOWN_END_LABEL : formatDisplayDate(record.endDate);
}

/**
 * The latest day a period could have finished.
 *
 * Whichever comes first: today, or the domain's limit on how long one record may
 * span. The limit is imported rather than restated, so the picker and validation
 * cannot drift apart.
 */
function maxSelectableEndDate(startDate: ISODate, today: ISODate): ISODate {
  const durationLimit = addDays(startDate, MAX_PERIOD_DURATION_DAYS - 1);

  return daysBetween(durationLimit, today) < 0 ? today : durationLimit;
}

function accessibilityLabelFor(record: PeriodRecord): string {
  const start = `Başlangıç: ${formatDisplayDate(record.startDate)}`;

  if (record.isOngoing) {
    return `${start}, devam ediyor`;
  }

  return record.endDate === undefined
    ? `${start}, bitiş tarihi bilinmiyor`
    : `${start}, bitiş: ${formatDisplayDate(record.endDate)}`;
}

/**
 * The recorded periods, read only.
 *
 * Nothing here writes, and no row offers an action: this step is about being
 * able to look at what was saved. The list is already ordered by the use case.
 */
export default function HistoryScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<readonly PeriodRecord[] | null>(null);
  const [hasError, setHasError] = useState(false);

  // The record the person asked to remove, held only while they confirm it.
  const [recordPendingDelete, setRecordPendingDelete] = useState<PeriodRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasDeleteError, setHasDeleteError] = useState(false);

  // A ref as well as the disabled prop: state updates are async, so two quick
  // taps could both read `isDeleting` as false before the re-render lands.
  const deleteInFlight = useRef(false);

  // The record being edited, the date currently picked for it, and whether the
  // person has asked to clear the end date instead of moving it.
  const [recordUnderEdit, setRecordUnderEdit] = useState<PeriodRecord | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<ISODate | null>(null);
  const [isRemovingEndDate, setIsRemovingEndDate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasUpdateError, setHasUpdateError] = useState(false);

  const updateInFlight = useRef(false);

  // Read once for the screen, so every edit measures "not in the future"
  // against the same day.
  const [today] = useState<ISODate>(() => getTodayLocalISODate());

  /** Stable, so the mount effect can depend on it and the delete can reuse it. */
  const readHistory = useCallback(async () => {
    const db = await openAppDatabase();

    return getPeriodHistory(db);
  }, []);

  useEffect(() => {
    // Guards against setting state after the screen is gone, e.g. when the
    // person navigates back while the read is still in flight.
    let isActive = true;

    const load = async () => {
      try {
        const history = await readHistory();

        if (!isActive) {
          return;
        }

        setRecords(history);
      } catch (error) {
        if (__DEV__) {
          console.error('[history] could not load the period records', error);
        }

        if (!isActive) {
          return;
        }

        setHasError(true);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [readHistory]);

  const handleDelete = async () => {
    if (deleteInFlight.current || recordPendingDelete === null) {
      return;
    }

    deleteInFlight.current = true;
    setIsDeleting(true);
    setHasDeleteError(false);

    try {
      const db = await openAppDatabase();

      await deletePeriodRecord(db, { recordId: recordPendingDelete.id });

      setRecords(await readHistory());
      setRecordPendingDelete(null);
    } catch (error) {
      if (__DEV__) {
        console.error('[history] could not delete the period record', error);
      }

      // The confirmation stays open with the error, so a rejected delete is
      // visible next to the record it was for and can be tried again.
      setHasDeleteError(true);
    } finally {
      deleteInFlight.current = false;
      setIsDeleting(false);
    }
  };

  const dismissConfirmation = () => {
    setRecordPendingDelete(null);
    setHasDeleteError(false);
  };

  const closeEditor = () => {
    setRecordUnderEdit(null);
    setSelectedEndDate(null);
    setIsRemovingEndDate(false);
    setHasUpdateError(false);
  };

  const openEditor = (record: PeriodRecord) => {
    // Only one panel at a time, so a pending delete gives way rather than both
    // being open on the same card.
    setRecordPendingDelete(null);
    setHasDeleteError(false);

    setRecordUnderEdit(record);
    // A record with no recorded end starts at its own start date: the earliest
    // day it could possibly have finished.
    setSelectedEndDate(record.endDate ?? record.startDate);
    setIsRemovingEndDate(false);
    setHasUpdateError(false);
  };

  const applyEndDate = async (endDate: ISODate | undefined) => {
    if (updateInFlight.current || recordUnderEdit === null) {
      return;
    }

    updateInFlight.current = true;
    setIsUpdating(true);
    setHasUpdateError(false);

    try {
      const db = await openAppDatabase();

      await updatePeriodEndDate(db, { recordId: recordUnderEdit.id, endDate, today });

      setRecords(await readHistory());
      closeEditor();
    } catch (error) {
      if (__DEV__) {
        console.error('[history] could not update the period end date', error);
      }

      // The editor stays open with the error, so a rejected change is visible
      // next to the record it was for and can be tried again.
      setHasUpdateError(true);
    } finally {
      updateInFlight.current = false;
      setIsUpdating(false);
    }
  };

  // The stack hides its header, so back has to be offered here.
  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Geri"
      onPress={() => router.back()}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <ThemedText type="small" themeColor="textSecondary">
        Geri
      </ThemedText>
    </Pressable>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredArea} edges={['top', 'bottom']}>
          <ActivityIndicator testID="period-history-loading" color={theme.text} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            Veriler yükleniyor
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
                Geçmiş kayıtlar
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                Kaydettiğin regl dönemlerini burada görebilirsin.
              </ThemedText>
            </View>

            {hasError ? (
              <ThemedText accessibilityRole="alert" themeColor="textSecondary">
                {LOAD_ERROR_MESSAGE}
              </ThemedText>
            ) : records === null || records.length === 0 ? (
              <ThemedText themeColor="textSecondary">{EMPTY_MESSAGE}</ThemedText>
            ) : (
              <View style={styles.list}>
                {records.map((record) => (
                  <View
                    key={record.id}
                    accessible
                    accessibilityLabel={accessibilityLabelFor(record)}
                    testID={`history-record-${record.id}`}
                    style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Başlangıç
                    </ThemedText>
                    <ThemedText style={styles.rowValue}>
                      {formatDisplayDate(record.startDate)}
                    </ThemedText>

                    <ThemedText type="small" themeColor="textSecondary" style={styles.endLabel}>
                      Bitiş
                    </ThemedText>
                    <ThemedText type="small">{endLabel(record)}</ThemedText>

                    {recordUnderEdit?.id === record.id ? (
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
                        onCancel={closeEditor}
                        onSave={() => applyEndDate(selectedEndDate ?? record.startDate)}
                        onRemove={() => applyEndDate(undefined)}
                        theme={theme}
                      />
                    ) : recordPendingDelete?.id === record.id ? (
                      <View style={styles.confirmation}>
                        <ThemedText type="small">Bu regl kaydını silmek istiyor musun?</ThemedText>

                        <ThemedText type="smallBold">
                          {formatDisplayDate(record.startDate)}
                        </ThemedText>

                        <ThemedText type="small" themeColor="textSecondary">
                          Bu işlem geri alınamaz.
                        </ThemedText>

                        {hasDeleteError && (
                          <ThemedText
                            accessibilityRole="alert"
                            type="small"
                            themeColor="textSecondary">
                            {DELETE_ERROR_MESSAGE}
                          </ThemedText>
                        )}

                        <View style={styles.confirmActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Vazgeç"
                            accessibilityState={{ disabled: isDeleting }}
                            disabled={isDeleting}
                            onPress={dismissConfirmation}
                            style={({ pressed }) => [
                              styles.secondaryButton,
                              isDeleting && styles.disabled,
                              pressed && !isDeleting && styles.pressed,
                            ]}>
                            <ThemedText type="small" themeColor="textSecondary">
                              Vazgeç
                            </ThemedText>
                          </Pressable>

                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Sil"
                            accessibilityState={{ disabled: isDeleting }}
                            disabled={isDeleting}
                            onPress={handleDelete}
                            style={({ pressed }) => [
                              styles.primaryButton,
                              { backgroundColor: theme.text },
                              isDeleting && styles.disabled,
                              pressed && !isDeleting && styles.pressed,
                            ]}>
                            <ThemedText
                              type="smallBold"
                              style={{ color: theme.background }}>
                              {isDeleting ? 'Siliniyor...' : 'Sil'}
                            </ThemedText>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.rowActions}>
                        {/* A period that is still running is finished from Home,
                            not corrected here. */}
                        {!record.isOngoing && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${formatDisplayDate(record.startDate)} regl kaydının bitiş tarihini düzenle`}
                            onPress={() => openEditor(record)}
                            style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}>
                            <ThemedText type="small" themeColor="textSecondary">
                              Düzenle
                            </ThemedText>
                          </Pressable>
                        )}

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${formatDisplayDate(record.startDate)} regl kaydını sil`}
                          onPress={() => {
                            closeEditor();
                            setRecordPendingDelete(record);
                            setHasDeleteError(false);
                          }}
                          style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}>
                          <ThemedText type="small" themeColor="textSecondary">
                            Sil
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

/**
 * Corrects one record's end date.
 *
 * A pair of day steppers rather than a native picker: no extra dependency, and
 * the range it can reach is exactly the range the domain would accept, so the
 * control cannot offer a date that saving would refuse.
 */
function EndDateEditor({
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
  theme,
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
  theme: { text: string; background: string };
}) {
  const maxDate = maxSelectableEndDate(record.startDate, today);

  const canGoBack = daysBetween(record.startDate, selectedEndDate) > 0;
  const canGoForward = daysBetween(selectedEndDate, maxDate) > 0;

  if (isRemoving) {
    return (
      <View style={styles.confirmation}>
        <ThemedText type="small">Bitiş tarihini kaldırmak istiyor musun?</ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          Bu kayıt bitiş tarihi bilinmiyor olarak gösterilecek.
        </ThemedText>

        {hasError && (
          <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
            {UPDATE_ERROR_MESSAGE}
          </ThemedText>
        )}

        <View style={styles.confirmActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vazgeç"
            accessibilityState={{ disabled: isUpdating }}
            disabled={isUpdating}
            onPress={onCancelRemove}
            style={({ pressed }) => [
              styles.secondaryButton,
              isUpdating && styles.disabled,
              pressed && !isUpdating && styles.pressed,
            ]}>
            <ThemedText type="small" themeColor="textSecondary">
              Vazgeç
            </ThemedText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kaldır"
            accessibilityState={{ disabled: isUpdating }}
            disabled={isUpdating}
            onPress={onRemove}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.text },
              isUpdating && styles.disabled,
              pressed && !isUpdating && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {isUpdating ? 'Kaldırılıyor...' : 'Kaldır'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.confirmation}>
      <ThemedText type="smallBold">Bitiş tarihini düzenle</ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        Başlangıç: {formatDisplayDate(record.startDate)}
      </ThemedText>

      <View style={styles.dateBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Önceki gün"
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
          accessibilityLabel={`Seçilen bitiş tarihi: ${formatDisplayDate(selectedEndDate)}`}
          type="smallBold"
          style={styles.selectedDate}>
          {formatDisplayDate(selectedEndDate)}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sonraki gün"
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
          {UPDATE_ERROR_MESSAGE}
        </ThemedText>
      )}

      <View style={styles.confirmActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vazgeç"
          accessibilityState={{ disabled: isUpdating }}
          disabled={isUpdating}
          onPress={onCancel}
          style={({ pressed }) => [
            styles.secondaryButton,
            isUpdating && styles.disabled,
            pressed && !isUpdating && styles.pressed,
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            Vazgeç
          </ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bitiş tarihini kaydet"
          accessibilityState={{ disabled: isUpdating }}
          disabled={isUpdating}
          onPress={onSave}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.text },
            isUpdating && styles.disabled,
            pressed && !isUpdating && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            {isUpdating ? 'Kaydediliyor...' : 'Kaydet'}
          </ThemedText>
        </Pressable>
      </View>

      {/* Only offered when there is something to remove. */}
      {record.endDate !== undefined && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bitiş tarihini kaldır"
          accessibilityState={{ disabled: isUpdating }}
          disabled={isUpdating}
          onPress={onAskToRemove}
          style={({ pressed }) => [
            styles.removeButton,
            isUpdating && styles.disabled,
            pressed && !isUpdating && styles.pressed,
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            Bitiş tarihini kaldır
          </ThemedText>
        </Pressable>
      )}
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
