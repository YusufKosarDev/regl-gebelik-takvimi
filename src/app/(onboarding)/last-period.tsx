import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ButtonLabel, ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { parseCycleLengthParam } from '@/features/onboarding/parse-cycle-length-param';
import { parsePeriodLengthParam } from '@/features/onboarding/parse-period-length-param';
import { onboardingMessages } from '@/features/onboarding/presentation/onboarding-messages';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useMessages } from '@/i18n';
import type { ISODate } from '@/types/iso-date';
import { addDays, addMonths, daysBetween } from '@/utils/date';
import { formatDisplayDate } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';
import {
  DEFAULT_CYCLE_LENGTH_DAYS,
  DEFAULT_PERIOD_LENGTH_DAYS,
} from '@/features/cycle/domain/limits';

/**
 * Third onboarding input: when the last period started.
 *
 * A pair of day buttons rather than a native picker - no extra dependency,
 * and a period start is almost always within a few days of today. A second
 * pair steps by whole months, for everybody else: "almost always" left
 * anybody further back with ninety taps or "Bilmiyorum", which records
 * nothing at all. Still no dependency, and still the same control.
 *
 * Future dates are refused: a cycle cannot have started after today, and letting
 * one through would produce a negative cycle day everywhere downstream.
 */
export default function LastPeriodScreen() {
  const router = useRouter();
  const theme = useTheme();
  const onboarding = useMessages(onboardingMessages);
  const language = useLanguage();
  /**
   * The two lengths are no longer asked for, so they arrive as the defaults.
   *
   * The flow used to spend a screen on each, both pre-filled with the figure
   * most people would give, before it got to the one question the app cannot
   * guess. Those screens are gone and the figures live in the domain; the
   * settings tab is where somebody changes them, and the last screen of this
   * flow says so.
   */
  const cycleLength = DEFAULT_CYCLE_LENGTH_DAYS;
  const periodLength = DEFAULT_PERIOD_LENGTH_DAYS;

  // Read once on mount so the "is today" comparison cannot shift mid-session.
  const [today] = useState<ISODate>(() => getTodayLocalISODate());
  const [selectedDate, setSelectedDate] = useState<ISODate>(today);

  const readableDate = formatDisplayDate(selectedDate, language);
  const canGoToNextDay = daysBetween(selectedDate, today) > 0;
  // Refused rather than clamped: a step that quietly landed somewhere other
  // than a month on would be a control that answers a different question.
  const canGoToNextMonth = daysBetween(addMonths(selectedDate, 1), today) >= 0;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.intro}>
              <ThemedText type="subtitle" style={styles.title}>
                {onboarding.lastPeriodTitle}
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                {onboarding.lastPeriodDescription}
              </ThemedText>
            </View>

            <View style={styles.picker}>
              <View accessible accessibilityLabel={onboarding.selectedDateLabel(readableDate)}>
                <ThemedText style={styles.date}>{readableDate}</ThemedText>
              </View>

              <View style={styles.dayButtons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={onboarding.lastPeriodPreviousDayLabel}
                  accessibilityState={{ disabled: false }}
                  onPress={() => setSelectedDate((current) => addDays(current, -1))}
                  style={({ pressed }) => [
                    styles.dayButton,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="small">{onboarding.lastPeriodPreviousDayText}</ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={onboarding.lastPeriodNextDayLabel}
                  accessibilityState={{ disabled: !canGoToNextDay }}
                  disabled={!canGoToNextDay}
                  onPress={() => setSelectedDate((current) => addDays(current, 1))}
                  style={({ pressed }) => [
                    styles.dayButton,
                    { borderColor: theme.backgroundSelected },
                    !canGoToNextDay && styles.dayButtonDisabled,
                    pressed && canGoToNextDay && styles.pressed,
                  ]}>
                  <ThemedText type="small">{onboarding.lastPeriodNextDayText}</ThemedText>
                </Pressable>
              </View>

              {/* The same control at a coarser step.

                  The note at the top of this file chose a pair of day buttons
                  over a native picker, for no extra dependency and because a
                  period start is almost always within a few days of today.
                  Both still hold - this adds no dependency and the day
                  buttons are still the ones most people will use - but "almost
                  always" left everybody else with ninety taps to reach three
                  months back, or "Bilmiyorum", which records nothing.

                  Bounded on the forward side exactly as the day button is: a
                  month that would land after today is refused rather than
                  clamped, so the control never offers a date saving would
                  reject and never silently gives a different answer from the
                  one pressed. */}
              <View style={styles.dayButtons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={onboarding.lastPeriodPreviousMonthLabel}
                  accessibilityState={{ disabled: false }}
                  onPress={() => setSelectedDate((current) => addMonths(current, -1))}
                  style={({ pressed }) => [
                    styles.dayButton,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="small">{onboarding.lastPeriodPreviousMonthText}</ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={onboarding.lastPeriodNextMonthLabel}
                  accessibilityState={{ disabled: !canGoToNextMonth }}
                  disabled={!canGoToNextMonth}
                  onPress={() => setSelectedDate((current) => addMonths(current, 1))}
                  style={({ pressed }) => [
                    styles.dayButton,
                    { borderColor: theme.backgroundSelected },
                    !canGoToNextMonth && styles.dayButtonDisabled,
                    pressed && canGoToNextMonth && styles.pressed,
                  ]}>
                  <ThemedText type="small">{onboarding.lastPeriodNextMonthText}</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={onboarding.continueLabel}
            onPress={() =>
              router.push({
                pathname: '/(onboarding)/finish',
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
            <ThemedText type="smallBold" style={[ButtonLabel, styles.primaryLabel, { color: theme.onPrimary }]}>
              {onboarding.continueLabel}
            </ThemedText>
          </Pressable>

          {/* The way past the one question this flow asks.

              Somebody may not know, and both other answers were bad: invent a
              date, which puts a cycle day on the home screen that nobody
              supplied, or refuse to finish, which leaves them with no app.
              This saves the settings with nothing recorded, and the home
              screen catches that with the way back to this question. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={onboarding.lastPeriodSkipLabel}
            onPress={() =>
              // The lengths go with it. The finish screen reads them from the
              // route, so a skip that sent nothing landed on "that cycle
              // information is not valid" - found on a device, because the
              // finish screen's own test helper supplies them by default.
              router.push({
                pathname: '/(onboarding)/finish',
                params: {
                  cycleLength: String(cycleLength),
                  periodLength: String(periodLength),
                },
              })
            }
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold">{onboarding.lastPeriodSkipLabel}</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  skipButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
