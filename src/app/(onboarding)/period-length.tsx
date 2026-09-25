import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { MAX_PERIOD_LENGTH_DAYS, MIN_PERIOD_LENGTH_DAYS } from '@/features/cycle/domain/limits';
import { parseCycleLengthParam } from '@/features/onboarding/parse-cycle-length-param';
import {
  CONTINUE_LABEL,
  DAYS_UNIT,
  INVALID_CYCLE_INFO_MESSAGE,
  PERIOD_LENGTH_DECREASE_LABEL,
  PERIOD_LENGTH_DESCRIPTION,
  PERIOD_LENGTH_INCREASE_LABEL,
  PERIOD_LENGTH_TITLE,
  periodLengthValueLabel,
} from '@/features/onboarding/presentation/onboarding-messages';
import { useTheme } from '@/hooks/use-theme';

/**
 * Second onboarding input: average period length.
 *
 * The bounds come straight from the domain — its period range, and never longer
 * than the cycle — so the stepper cannot produce a pair `validateCycleSettings`
 * would reject.
 */
const DEFAULT_PERIOD_LENGTH_DAYS = 5;

export default function PeriodLengthScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ cycleLength?: string | string[] }>();

  const cycleLength = parseCycleLengthParam(params.cycleLength);
  const [periodLength, setPeriodLength] = useState(DEFAULT_PERIOD_LENGTH_DAYS);

  // The previous step cannot be reconstructed here, so stop rather than guess.
  if (cycleLength === null) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.errorArea}>
          <ThemedText type="subtitle" style={styles.errorText}>
            {INVALID_CYCLE_INFO_MESSAGE}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const maxPeriodLength = Math.min(MAX_PERIOD_LENGTH_DAYS, cycleLength);
  const canDecrease = periodLength > MIN_PERIOD_LENGTH_DAYS;
  const canIncrease = periodLength < maxPeriodLength;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.intro}>
              <ThemedText type="subtitle" style={styles.title}>
                {PERIOD_LENGTH_TITLE}
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                {PERIOD_LENGTH_DESCRIPTION}
              </ThemedText>
            </View>

            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={PERIOD_LENGTH_DECREASE_LABEL}
                accessibilityState={{ disabled: !canDecrease }}
                disabled={!canDecrease}
                onPress={() => setPeriodLength((current) => current - 1)}
                style={({ pressed }) => [
                  styles.stepButton,
                  { borderColor: theme.backgroundSelected },
                  !canDecrease && styles.stepButtonDisabled,
                  pressed && canDecrease && styles.pressed,
                ]}>
                <ThemedText style={styles.stepButtonLabel}>−</ThemedText>
              </Pressable>

              <View
                accessible
                accessibilityLabel={periodLengthValueLabel(periodLength)}
                accessibilityValue={{
                  min: MIN_PERIOD_LENGTH_DAYS,
                  max: maxPeriodLength,
                  now: periodLength,
                }}
                style={styles.valueBlock}>
                <ThemedText style={styles.value}>{periodLength}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {DAYS_UNIT}
                </ThemedText>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={PERIOD_LENGTH_INCREASE_LABEL}
                accessibilityState={{ disabled: !canIncrease }}
                disabled={!canIncrease}
                onPress={() => setPeriodLength((current) => current + 1)}
                style={({ pressed }) => [
                  styles.stepButton,
                  { borderColor: theme.backgroundSelected },
                  !canIncrease && styles.stepButtonDisabled,
                  pressed && canIncrease && styles.pressed,
                ]}>
                <ThemedText style={styles.stepButtonLabel}>+</ThemedText>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CONTINUE_LABEL}
            onPress={() =>
              router.push({
                pathname: '/(onboarding)/last-period',
                params: {
                  cycleLength: String(cycleLength),
                  periodLength: String(periodLength),
                },
              })
            }
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={[styles.primaryLabel, { color: theme.onPrimary }]}>
              {CONTINUE_LABEL}
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.four,
  },
  stepButton: {
    minWidth: 56,
    minHeight: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    opacity: 0.35,
  },
  stepButtonLabel: {
    fontSize: 26,
    lineHeight: 30,
  },
  valueBlock: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  value: {
    fontSize: 56,
    lineHeight: 62,
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
