import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { ChoiceGrid } from '@/features/daily-log/components/choice-grid';
import { clearDailyEntry, loadDailyEntry, saveDailyEntry } from '@/features/daily-log/data/daily-log-repository';
import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import {
  FLOW_LEVELS,
  MOODS,
  SYMPTOMS,
  emptyDailyEntry,
  hasAnything,
} from '@/features/daily-log/domain/catalogues';
import {
  DAILY_CLEARED_MESSAGE,
  DAILY_CLEAR_LABEL,
  DAILY_EMPTY_SELECTION_MESSAGE,
  DAILY_LOAD_FAILED_MESSAGE,
  DAILY_SAVE_FAILED_MESSAGE,
  DAILY_SAVE_LABEL,
  DAILY_SAVING_LABEL,
  DAILY_SCREEN_TITLE,
  FLOW_SECTION_TITLE,
  MOOD_SECTION_TITLE,
  SYMPTOMS_SECTION_TITLE,
} from '@/features/daily-log/presentation/daily-log-messages';
import { useTheme } from '@/hooks/use-theme';
import { logEvent } from '@/shared/logging';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { isISODate } from '@/utils/date';
import { formatDisplayDate } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';

/**
 * One day, as the person wants to leave it.
 *
 * Reached from the card on the home screen for today, and from the calendar for
 * any other day. The date is a parameter rather than state, so the two entry
 * points do not need different screens.
 *
 * Everything is optional and nothing is required. The one rule is that saving
 * needs at least one choice — a save with nothing chosen is more likely to be a
 * slip than a decision, and there is a button that says "temizle" for the
 * decision.
 *
 * The screen says nothing back about what was chosen. No interpretation, no
 * comparison to another day, nothing about what is usual. It records and shows.
 */
export default function DailyEntryScreen() {
  const router = useRouter();
  const theme = useTheme();

  const params = useLocalSearchParams<{ readonly date?: string }>();

  /**
   * The day being edited.
   *
   * Read once. A parameter that is missing or not a date reads as today, which
   * is what the home screen means and the only sensible answer for a link that
   * arrived malformed.
   */
  const [date] = useState<ISODate>(() => {
    const given = typeof params.date === 'string' && isISODate(params.date) ? params.date : null;

    return (given as ISODate | null) ?? getTodayLocalISODate();
  });

  const [entry, setEntry] = useState<DailyEntry>(() => emptyDailyEntry(date));
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /** Guards a second press while the first is still writing. */
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      try {
        const db = await openAppDatabase();
        const stored = await loadDailyEntry(db, date);

        if (!cancelled) {
          setEntry(stored);
        }
      } catch (error) {
        logEvent('daily entry load failed', error);

        if (!cancelled) {
          setNotice(DAILY_LOAD_FAILED_MESSAGE);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void read();

    return () => {
      cancelled = true;
    };
  }, [date]);

  /** One choice, where only one may be held. A second tap on it clears it. */
  const chooseOne = useCallback((field: 'flowId' | 'moodId', id: string) => {
    setNotice(null);
    setEntry((current) => ({ ...current, [field]: current[field] === id ? null : id }));
  }, []);

  const toggleSymptom = useCallback((id: string) => {
    setNotice(null);
    setEntry((current) => ({
      ...current,
      symptomIds: current.symptomIds.includes(id)
        ? current.symptomIds.filter((symptom) => symptom !== id)
        : [...current.symptomIds, id],
    }));
  }, []);

  const handleSave = async () => {
    if (inFlight.current) {
      return;
    }

    if (!hasAnything(entry)) {
      setNotice(DAILY_EMPTY_SELECTION_MESSAGE);

      return;
    }

    inFlight.current = true;
    setIsBusy(true);

    try {
      const db = await openAppDatabase();

      await saveDailyEntry(db, entry);

      router.back();
    } catch (error) {
      logEvent('daily entry save failed', error);
      setNotice(DAILY_SAVE_FAILED_MESSAGE);
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  const handleClear = async () => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsBusy(true);

    try {
      const db = await openAppDatabase();

      await clearDailyEntry(db, date);

      setEntry(emptyDailyEntry(date));
      setNotice(DAILY_CLEARED_MESSAGE);
    } catch (error) {
      logEvent('daily entry clear failed', error);
      setNotice(DAILY_SAVE_FAILED_MESSAGE);
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
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
              <ThemedText accessibilityRole="header" type="subtitle">
                {DAILY_SCREEN_TITLE}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {formatDisplayDate(date)}
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {FLOW_SECTION_TITLE}
              </ThemedText>

              <ChoiceGrid
                section={FLOW_SECTION_TITLE}
                catalogue={FLOW_LEVELS}
                selectedIds={entry.flowId === null ? [] : [entry.flowId]}
                onToggle={(id) => chooseOne('flowId', id)}
                multiple={false}
                disabled={isLoading || isBusy}
              />
            </View>

            <View style={styles.section}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {SYMPTOMS_SECTION_TITLE}
              </ThemedText>

              <ChoiceGrid
                section={SYMPTOMS_SECTION_TITLE}
                catalogue={SYMPTOMS}
                selectedIds={entry.symptomIds}
                onToggle={toggleSymptom}
                multiple
                disabled={isLoading || isBusy}
              />
            </View>

            <View style={styles.section}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {MOOD_SECTION_TITLE}
              </ThemedText>

              <ChoiceGrid
                section={MOOD_SECTION_TITLE}
                catalogue={MOODS}
                selectedIds={entry.moodId === null ? [] : [entry.moodId]}
                onToggle={(id) => chooseOne('moodId', id)}
                multiple={false}
                disabled={isLoading || isBusy}
              />
            </View>

            {notice !== null && (
              <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                {notice}
              </ThemedText>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={DAILY_SAVE_LABEL}
              accessibilityState={{ disabled: isLoading || isBusy }}
              disabled={isLoading || isBusy}
              onPress={() => {
                void handleSave();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                (isLoading || isBusy) && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="smallBold" themeColor="onPrimary">
                {isBusy ? DAILY_SAVING_LABEL : DAILY_SAVE_LABEL}
              </ThemedText>
            </Pressable>

            {/* Only when there is something to clear. A button that deletes
                nothing is a question nobody was asked. */}
            {hasAnything(entry) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={DAILY_CLEAR_LABEL}
                accessibilityState={{ disabled: isLoading || isBusy }}
                disabled={isLoading || isBusy}
                onPress={() => {
                  void handleClear();
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  (isLoading || isBusy) && styles.disabled,
                  pressed && !isBusy && styles.pressed,
                ]}>
                <ThemedText type="smallBold">{DAILY_CLEAR_LABEL}</ThemedText>
              </Pressable>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
  },
  header: {
    gap: Spacing.half,
  },
  section: {
    gap: Spacing.three,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.6,
  },
});
