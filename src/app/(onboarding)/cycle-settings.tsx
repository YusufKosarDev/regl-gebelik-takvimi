import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { MAX_CYCLE_LENGTH_DAYS, MIN_CYCLE_LENGTH_DAYS } from '@/features/cycle/domain/limits';
import {
  CONTINUE_LABEL,
  CYCLE_LENGTH_DECREASE_LABEL,
  CYCLE_LENGTH_DESCRIPTION,
  CYCLE_LENGTH_INCREASE_LABEL,
  CYCLE_LENGTH_TITLE,
  DAYS_UNIT,
  cycleLengthValueLabel,
} from '@/features/onboarding/presentation/onboarding-messages';
import { useTheme } from '@/hooks/use-theme';

/**
 * First onboarding input: average cycle length.
 *
 * The bounds come straight from the domain, which stays the authority — the
 * stepper simply cannot produce a value `validateCycleSettings` would reject.
 */
const DEFAULT_CYCLE_LENGTH_DAYS = 28;

export default function CycleSettingsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [cycleLength, setCycleLength] = useState(DEFAULT_CYCLE_LENGTH_DAYS);

  const canDecrease = cycleLength > MIN_CYCLE_LENGTH_DAYS;
  const canIncrease = cycleLength < MAX_CYCLE_LENGTH_DAYS;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.intro}>
              <ThemedText type="subtitle" style={styles.title}>
                {CYCLE_LENGTH_TITLE}
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                {CYCLE_LENGTH_DESCRIPTION}
              </ThemedText>
            </View>

            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={CYCLE_LENGTH_DECREASE_LABEL}
                accessibilityState={{ disabled: !canDecrease }}
                disabled={!canDecrease}
                onPress={() => setCycleLength((current) => current - 1)}
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
                accessibilityLabel={cycleLengthValueLabel(cycleLength)}
                accessibilityValue={{
                  min: MIN_CYCLE_LENGTH_DAYS,
                  max: MAX_CYCLE_LENGTH_DAYS,
                  now: cycleLength,
                }}
                style={styles.valueBlock}>
                <ThemedText style={styles.value}>{cycleLength}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {DAYS_UNIT}
                </ThemedText>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={CYCLE_LENGTH_INCREASE_LABEL}
                accessibilityState={{ disabled: !canIncrease }}
                disabled={!canIncrease}
                onPress={() => setCycleLength((current) => current + 1)}
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
                pathname: '/(onboarding)/period-length',
                params: { cycleLength: String(cycleLength) },
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
