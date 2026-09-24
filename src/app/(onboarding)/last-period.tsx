import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { parseCycleLengthParam } from '@/features/onboarding/parse-cycle-length-param';
import { parsePeriodLengthParam } from '@/features/onboarding/parse-period-length-param';
import { useTheme } from '@/hooks/use-theme';
import type { ISODate } from '@/types/iso-date';
import { addDays, daysBetween } from '@/utils/date';
import { formatDisplayDate } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';

/**
 * Third onboarding input: when the last period started.
 *
 * A pair of day buttons rather than a native picker — no extra dependency, and a
 * period start is almost always within a few days of today.
 *
 * Future dates are refused: a cycle cannot have started after today, and letting
 * one through would produce a negative cycle day everywhere downstream.
 */
export default function LastPeriodScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{
    cycleLength?: string | string[];
    periodLength?: string | string[];
  }>();

  const cycleLength = parseCycleLengthParam(params.cycleLength);
  const periodLength =
    cycleLength === null ? null : parsePeriodLengthParam(params.periodLength, cycleLength);

  // Read once on mount so the "is today" comparison cannot shift mid-session.
  const [today] = useState<ISODate>(() => getTodayLocalISODate());
  const [selectedDate, setSelectedDate] = useState<ISODate>(today);

  if (cycleLength === null || periodLength === null) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.errorArea}>
          <ThemedText type="subtitle" style={styles.errorText}>
            Geçersiz döngü bilgisi.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const readableDate = formatDisplayDate(selectedDate);
  const canGoToNextDay = daysBetween(selectedDate, today) > 0;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.intro}>
              <ThemedText type="subtitle" style={styles.title}>
                Son regl dönemin ne zaman başladı?
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                Kanamanın başladığı ilk günü seç.
              </ThemedText>
            </View>

            <View style={styles.picker}>
              <View accessible accessibilityLabel={`Seçili tarih: ${readableDate}`}>
                <ThemedText style={styles.date}>{readableDate}</ThemedText>
              </View>

              <View style={styles.dayButtons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Önceki günü seç"
                  accessibilityState={{ disabled: false }}
                  onPress={() => setSelectedDate((current) => addDays(current, -1))}
                  style={({ pressed }) => [
                    styles.dayButton,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="small">Önceki gün</ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sonraki günü seç"
                  accessibilityState={{ disabled: !canGoToNextDay }}
                  disabled={!canGoToNextDay}
                  onPress={() => setSelectedDate((current) => addDays(current, 1))}
                  style={({ pressed }) => [
                    styles.dayButton,
                    { borderColor: theme.backgroundSelected },
                    !canGoToNextDay && styles.dayButtonDisabled,
                    pressed && canGoToNextDay && styles.pressed,
                  ]}>
                  <ThemedText type="small">Sonraki gün</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Devam"
            onPress={() =>
              router.push({
                pathname: '/(onboarding)/review',
                params: {
                  cycleLength: String(cycleLength),
                  periodLength: String(periodLength),
                  lastPeriodStartDate: selectedDate,
                },
              })
            }
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={[styles.primaryLabel, { color: theme.onPrimary }]}>
              Devam
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
  errorText: {
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.five,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: Spacing.five,
  },
  intro: {
    gap: Spacing.three,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  picker: {
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.four,
  },
  date: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '600',
    textAlign: 'center',
  },
  dayButtons: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  dayButton: {
    minHeight: 56,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  dayButtonDisabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.85,
  },
  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  primaryLabel: {
    fontSize: 16,
  },
});
