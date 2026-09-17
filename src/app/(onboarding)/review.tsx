import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { parseCycleLengthParam } from '@/features/onboarding/parse-cycle-length-param';
import { parseLastPeriodStartDateParam } from '@/features/onboarding/parse-last-period-start-date-param';
import { parsePeriodLengthParam } from '@/features/onboarding/parse-period-length-param';
import { useTheme } from '@/hooks/use-theme';
import type { ISODate } from '@/types/iso-date';
import { formatDisplayDate } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';

/**
 * Last look at the answers before anything is written.
 *
 * Every value is re-validated here rather than trusted from the previous screen:
 * route params are strings that can be edited, replayed or arrive from a deep
 * link, so this screen treats them as untrusted input like any other.
 */
export default function ReviewScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{
    cycleLength?: string | string[];
    periodLength?: string | string[];
    lastPeriodStartDate?: string | string[];
  }>();

  // Read once on mount so the "not in the future" rule cannot shift mid-session.
  const [today] = useState<ISODate>(() => getTodayLocalISODate());

  const cycleLength = parseCycleLengthParam(params.cycleLength);
  const periodLength =
    cycleLength === null ? null : parsePeriodLengthParam(params.periodLength, cycleLength);
  const lastPeriodStartDate = parseLastPeriodStartDateParam(params.lastPeriodStartDate, today);

  if (cycleLength === null || periodLength === null || lastPeriodStartDate === null) {
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

  const rows: { label: string; value: string }[] = [
    { label: 'Döngü uzunluğu', value: `${cycleLength} gün` },
    { label: 'Regl süresi', value: `${periodLength} gün` },
    { label: 'Son regl başlangıcı', value: formatDisplayDate(lastPeriodStartDate) },
  ];

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.intro}>
              <ThemedText type="subtitle" style={styles.title}>
                Bilgilerini kontrol et
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                Devam etmeden önce döngü bilgilerini gözden geçir.
              </ThemedText>
            </View>

            <View style={styles.summary}>
              {rows.map((row) => (
                <View
                  key={row.label}
                  accessible
                  accessibilityLabel={`${row.label}: ${row.value}`}
                  style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {row.label}
                  </ThemedText>
                  <ThemedText style={styles.rowValue}>{row.value}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bilgiler doğru"
            onPress={() =>
              router.push({
                pathname: '/(onboarding)/finish',
                params: {
                  cycleLength: String(cycleLength),
                  periodLength: String(periodLength),
                  lastPeriodStartDate,
                },
              })
            }
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.text },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={[styles.primaryLabel, { color: theme.background }]}>
              Bilgiler doğru
            </ThemedText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bilgileri düzenle"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="textSecondary">
              Bilgileri düzenle
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
  summary: {
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
    gap: Spacing.two,
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
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
});
