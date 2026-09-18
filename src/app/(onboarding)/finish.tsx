import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { completeCycleOnboarding } from '@/features/cycle/application/complete-cycle-onboarding';
import { parseCycleLengthParam } from '@/features/onboarding/parse-cycle-length-param';
import { parseLastPeriodStartDateParam } from '@/features/onboarding/parse-last-period-start-date-param';
import { parsePeriodLengthParam } from '@/features/onboarding/parse-period-length-param';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { syncPeriodReminderQuietly } from '@/features/notifications/application/sync-period-reminder';
import { syncWidgetSnapshotQuietly } from '@/features/widget/application/sync-widget-snapshot';
import { getTodayLocalISODate } from '@/utils/today';
import { logEvent } from '@/shared/logging';

const SAVE_ERROR_MESSAGE = 'Bilgiler kaydedilemedi. Lütfen tekrar dene.';

/**
 * Last onboarding step: write the answers down.
 *
 * Order matters. The profile is stored first and the "onboarding finished" flag
 * only after it succeeds, so a half-finished run leaves the user back at
 * onboarding rather than in an app with no cycle data behind it.
 *
 * On success this screen does not navigate. Flipping the flag is what moves the
 * app on: the root gate watches it and swaps route groups, which keeps
 * navigation ownership in exactly one place.
 */
export default function FinishScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    cycleLength?: string | string[];
    periodLength?: string | string[];
    lastPeriodStartDate?: string | string[];
  }>();

  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  const [today] = useState<ISODate>(() => getTodayLocalISODate());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // A ref as well as the disabled prop: state updates are async, so two quick
  // taps could both read `isSubmitting` as false before the re-render lands.
  const submitInFlight = useRef(false);

  const cycleLength = parseCycleLengthParam(params.cycleLength);
  const periodLength =
    cycleLength === null ? null : parsePeriodLengthParam(params.periodLength, cycleLength);
  const lastPeriodStartDate = parseLastPeriodStartDateParam(params.lastPeriodStartDate, today);

  if (cycleLength === null || periodLength === null || lastPeriodStartDate === null) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.errorArea}>
          <ThemedText type="subtitle" style={styles.errorTitle}>
            Geçersiz döngü bilgisi.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const handleSubmit = async () => {
    if (submitInFlight.current) {
      return;
    }

    submitInFlight.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const db = await openAppDatabase();

      await completeCycleOnboarding(db, {
        averageCycleLengthDays: cycleLength,
        averagePeriodLengthDays: periodLength,
        lastPeriodStartDate,
      });

      // The write is already durable, and the widget only holds a copy of it,
      // so a failed update here must not undo what was just saved.
      await syncWidgetSnapshotQuietly(db, today);
      await syncPeriodReminderQuietly(db, today);

      // Only now is the run considered finished. The root gate reacts to this.
      await completeOnboarding();

      // No navigation and no state update here: the gate unmounts this screen.
    } catch (error) {
      logEvent('onboarding completion failed', error);

      submitInFlight.current = false;
      setIsSubmitting(false);
      setErrorMessage(SAVE_ERROR_MESSAGE);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <ThemedText type="subtitle" style={styles.title}>
              Her şey hazır
            </ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.description}>
              Bilgilerini kaydedip döngü takibine başlayabilirsin.
            </ThemedText>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {errorMessage !== null && (
            <ThemedText
              accessibilityRole="alert"
              type="small"
              themeColor="textSecondary"
              style={styles.errorMessage}>
              {errorMessage}
            </ThemedText>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Takibe başla"
            accessibilityState={{ disabled: isSubmitting }}
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.text },
              isSubmitting && styles.primaryButtonDisabled,
              pressed && !isSubmitting && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={[styles.primaryLabel, { color: theme.background }]}>
              {isSubmitting ? 'Kaydediliyor...' : 'Takibe başla'}
            </ThemedText>
          </Pressable>
        </View>
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
  errorArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  errorTitle: {
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  title: {
    fontSize: 34,
    lineHeight: 42,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  errorMessage: {
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryLabel: {
    fontSize: 16,
  },
  pressed: {
    opacity: 0.85,
  },
});
