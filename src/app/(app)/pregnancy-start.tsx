import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { startPregnancyTracking } from '@/features/pregnancy/application/start-pregnancy-tracking';
import { syncPregnancyWeeklyReminderQuietly } from '@/features/notifications/application/sync-pregnancy-weekly-reminder';
import { useTheme } from '@/hooks/use-theme';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { addDays, daysBetween } from '@/utils/date';
import { formatDisplayDate } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';
import { logEvent } from '@/shared/logging';

const SAVE_ERROR_MESSAGE = 'Gebelik takibi başlatılamadı.';

/**
 * Starts tracking a pregnancy from the last menstrual period.
 *
 * One date, entered with day steppers rather than a picker: no extra dependency,
 * and the range they reach is exactly the range the use case would accept, so
 * the control cannot offer a day that saving would refuse.
 *
 * Nothing is shown about the pregnancy itself here — no week count, no due date
 * — because none of it exists until this is saved.
 */
export default function PregnancyStartScreen() {
  const router = useRouter();
  const theme = useTheme();

  // Read once for the screen, so the future check and the date the person picks
  // are measured against the same day.
  const [today] = useState<ISODate>(() => getTodayLocalISODate());
  const [lmp, setLmp] = useState<ISODate>(today);

  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  // A ref as well as the disabled prop: state updates are async, so two quick
  // taps could both read `isSaving` as false before the re-render lands.
  const saveInFlight = useRef(false);

  // A period that has not happened yet cannot be the one a pregnancy started
  // from. Nothing bounds how far back it may reach.
  const canGoForward = !isSaving && daysBetween(lmp, today) > 0;

  const changeLmp = (delta: number) => {
    setLmp(addDays(lmp, delta));
    setHasSaveError(false);
  };

  const handleStart = async () => {
    if (saveInFlight.current) {
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    setHasSaveError(false);

    try {
      const db = await openAppDatabase();

      await startPregnancyTracking(db, { lmp, today });

      // The write is already durable; a reminder that could not be queued must
      // not undo what was just saved.
      await syncPregnancyWeeklyReminderQuietly(db);

      // Home reads again when it regains focus, so going back is enough for it
      // to notice that a pregnancy is now being tracked.
      router.back();
    } catch (error) {
      logEvent('pregnancy start failed', error);

      // The screen stays as it is with the error, so the date that was picked is
      // still there to correct or try again.
      setHasSaveError(true);
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* The stack hides its header, so back has to be offered here. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="textSecondary">
                Geri
              </ThemedText>
            </Pressable>

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
                Gebelik takibini başlat
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                Son regl döneminin başladığı günü seç. Gebelik haftaları ve tahmini doğum
                tarihi bu güne göre hesaplanır.
              </ThemedText>
            </View>

            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">
                Son regl başlangıcı
              </ThemedText>

              <View style={styles.dateBar}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Önceki gün"
                  accessibilityState={{ disabled: isSaving }}
                  disabled={isSaving}
                  onPress={() => changeLmp(-1)}
                  style={({ pressed }) => [
                    styles.dayButton,
                    { borderColor: theme.backgroundSelected },
                    isSaving && styles.disabled,
                    pressed && !isSaving && styles.pressed,
                  ]}>
                  <ThemedText style={styles.dayButtonLabel}>‹</ThemedText>
                </Pressable>

                <ThemedText
                  accessibilityLabel={`Seçilen son regl başlangıcı: ${formatDisplayDate(lmp)}`}
                  type="smallBold"
                  style={styles.selectedDate}>
                  {formatDisplayDate(lmp)}
                </ThemedText>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sonraki gün"
                  accessibilityState={{ disabled: !canGoForward }}
                  disabled={!canGoForward}
                  onPress={() => changeLmp(1)}
                  style={({ pressed }) => [
                    styles.dayButton,
                    { borderColor: theme.backgroundSelected },
                    !canGoForward && styles.disabled,
                    pressed && canGoForward && styles.pressed,
                  ]}>
                  <ThemedText style={styles.dayButtonLabel}>›</ThemedText>
                </Pressable>
              </View>
            </View>

            {hasSaveError && (
              <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                {SAVE_ERROR_MESSAGE}
              </ThemedText>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gebelik takibini başlat"
              accessibilityState={{ disabled: isSaving }}
              disabled={isSaving}
              onPress={handleStart}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                isSaving && styles.disabled,
                pressed && !isSaving && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {isSaving ? 'Başlatılıyor...' : 'Takibi başlat'}
              </ThemedText>
            </Pressable>
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
  field: {
    gap: Spacing.half,
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  dayButton: {
    minWidth: 56,
    minHeight: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonLabel: {
    fontSize: 24,
    lineHeight: 28,
  },
  selectedDate: {
    flexShrink: 1,
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
