import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { deletePeriodRecord } from '@/features/cycle/application/delete-period-record';
import { getPeriodHistory } from '@/features/cycle/application/get-period-history';
import type { PeriodRecord } from '@/features/cycle/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { openAppDatabase } from '@/storage/db';
import { formatDisplayDate } from '@/utils/format-date';

const LOAD_ERROR_MESSAGE = 'Kayıtlar yüklenemedi.';
const DELETE_ERROR_MESSAGE = 'Kayıt silinemedi.';
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

                    {recordPendingDelete?.id === record.id ? (
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
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${formatDisplayDate(record.startDate)} regl kaydını sil`}
                        onPress={() => {
                          setRecordPendingDelete(record);
                          setHasDeleteError(false);
                        }}
                        style={({ pressed }) => [
                          styles.deleteButton,
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Sil
                        </ThemedText>
                      </Pressable>
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
  deleteButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
    paddingRight: Spacing.three,
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
