import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
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
  holdsSameAs,
  hasAnything,
} from '@/features/daily-log/domain/catalogues';
import { dailyLogCatalogueLabels } from '@/features/daily-log/presentation/daily-log-catalogues';
import { dailyLogMessages } from '@/features/daily-log/presentation/daily-log-messages';
import { useLanguage, useMessages } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { logEvent } from '@/shared/logging';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { isISODate } from '@/utils/date';
import { formatDisplayDate } from '@/utils/format-date';
import { getTodayLocalISODate } from '@/utils/today';
import { WeekStrip } from '@/features/daily-log/components/week-strip';
import { homeMessages } from '@/features/cycle/presentation/home-messages';
import { SectionHeading } from '@/features/daily-log/components/section-heading';

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
  const language = useLanguage();
  const strings = useMessages(dailyLogMessages);
  const labels = useMessages(dailyLogCatalogueLabels);

  /** Turns what happened into what to say about it, in the language showing now. */
  const noticeText = (kind: 'load-failed' | 'empty-selection' | 'save-failed' | 'cleared' | 'unsaved') =>
    ({
      'load-failed': strings.loadFailedMessage,
      'empty-selection': strings.emptySelectionMessage,
      'save-failed': strings.saveFailedMessage,
      cleared: strings.clearedMessage,
      unsaved: strings.unsavedMessage,
    })[kind];

  const home = useMessages(homeMessages);

  const params = useLocalSearchParams<{ readonly date?: string }>();

  /**
   * The day being edited.
   *
   * Read once. A parameter that is missing or not a date reads as today, which
   * is what the home screen means and the only sensible answer for a link that
   * arrived malformed.
   */
  const [date, setDate] = useState<ISODate>(() => {
    const given = typeof params.date === 'string' && isISODate(params.date) ? params.date : null;

    return (given as ISODate | null) ?? getTodayLocalISODate();
  });

  const [entry, setEntry] = useState<DailyEntry>(() => emptyDailyEntry(date));

  /**
   * The day as it was last read from the database, or last written to it.
   *
   * The week strip replaces everything on screen when it moves, so the screen
   * has to know whether what is on it is still what was stored. Held beside
   * the entry rather than derived from it: there is nothing to derive it from
   * once the first tap has happened.
   */
  const [saved, setSaved] = useState<DailyEntry>(() => emptyDailyEntry(date));
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  /**
   * What happened, not what to say about it.
   *
   * The state holds a kind and the render turns it into words. Storing the
   * sentence instead would freeze it in whichever language was showing when it
   * was set: change the language with a notice on screen and it would stay in
   * the old one. It would also make the load effect depend on the catalogue,
   * which would re-read the database every time the language changed.
   */
  const [notice, setNotice] = useState<'load-failed' | 'empty-selection' | 'save-failed' | 'cleared' | 'unsaved' | null>(
    null
  );

  /**
   * Which section has its explanation unfolded, if any.
   *
   * One at a time. Three sentences open at once is the printed version this
   * was folded up to avoid.
   */
  const [openSection, setOpenSection] = useState<'flow' | 'symptoms' | 'mood' | null>(null);

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
          setSaved(stored);
        }
      } catch (error) {
        logEvent('daily entry load failed', error);

        if (!cancelled) {
          setNotice('load-failed');
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

  /**
   * Moving to another day in the week strip.
   *
   * It refuses rather than asks. A confirmation would be the right answer if
   * there were something to weigh up, and there is not: the day on screen can
   * be saved or cleared in one tap each, both of them visible, and either
   * leaves the strip free. A dialog here would be a second decision about the
   * first one.
   *
   * Nothing is ever lost on this path, which is the whole point of it.
   */
  const handlePickDay = useCallback(
    (next: ISODate) => {
      if (next === date) {
        return;
      }

      if (!holdsSameAs(entry, saved)) {
        setNotice('unsaved');

        return;
      }

      setNotice(null);
      setIsLoading(true);
      setDate(next);
    },
    [date, entry, saved]
  );

  const handleSave = async () => {
    if (inFlight.current) {
      return;
    }

    if (!hasAnything(entry)) {
      setNotice('empty-selection');

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
      setNotice('save-failed');
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
      setSaved(emptyDailyEntry(date));
      setNotice('cleared');
    } catch (error) {
      logEvent('daily entry clear failed', error);
      setNotice('save-failed');
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
            <BackButton />

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle">
                {strings.screenTitle}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {formatDisplayDate(date, language)}
              </ThemedText>
            </View>

            {/* The week the day sits in, so logging yesterday is a tap rather
                than a trip back to the calendar. The weekday words come from
                the calendar's own catalogue - a second copy in this feature is
                how the grid ends up saying "Pzt" while the strip says "Pt". */}
            <WeekStrip
              date={date}
              onSelect={handlePickDay}
              weekdayLabels={home.weekdayLabels}
              dayLabelFor={(day) => formatDisplayDate(day, language)}
              disabled={isBusy}
            />

            {/* The refusal belongs here rather than with the others.

                Every other notice answers a press on the save or clear button
                and is drawn beside them. This one answers a press on the strip
                two screens up, and drawn down there it was off-screen: the
                strip did not move, nothing appeared to happen, and the reason
                was somewhere nobody was looking. Found on a device. */}
            {notice === 'unsaved' && (
              <ThemedText
                accessibilityRole="alert"
                testID="strip-notice"
                type="small"
                themeColor="textSecondary">
                {noticeText(notice)}
              </ThemedText>
            )}

            <View style={styles.section}>
              <SectionHeading
                title={strings.flowSectionTitle}
                explanation={strings.flowExplanation}
                toggleLabel={strings.aboutSectionLabel(strings.flowSectionTitle)}
                isOpen={openSection === 'flow'}
                onToggle={() => setOpenSection((current) => (current === 'flow' ? null : 'flow'))}
              />

              <ChoiceGrid
                section={strings.flowSectionTitle}
                catalogue={FLOW_LEVELS}
                labels={labels.flows}
                selectedIds={entry.flowId === null ? [] : [entry.flowId]}
                onToggle={(id) => chooseOne('flowId', id)}
                multiple={false}
                disabled={isLoading || isBusy}
              />
            </View>

            <View style={styles.section}>
              <SectionHeading
                title={strings.symptomsSectionTitle}
                explanation={strings.symptomsExplanation}
                toggleLabel={strings.aboutSectionLabel(strings.symptomsSectionTitle)}
                isOpen={openSection === 'symptoms'}
                onToggle={() => setOpenSection((current) => (current === 'symptoms' ? null : 'symptoms'))}
              />

              <ChoiceGrid
                section={strings.symptomsSectionTitle}
                catalogue={SYMPTOMS}
                labels={labels.symptoms}
                selectedIds={entry.symptomIds}
                onToggle={toggleSymptom}
                multiple
                disabled={isLoading || isBusy}
              />
            </View>

            <View style={styles.section}>
              <SectionHeading
                title={strings.moodSectionTitle}
                explanation={strings.moodExplanation}
                toggleLabel={strings.aboutSectionLabel(strings.moodSectionTitle)}
                isOpen={openSection === 'mood'}
                onToggle={() => setOpenSection((current) => (current === 'mood' ? null : 'mood'))}
              />

              <ChoiceGrid
                section={strings.moodSectionTitle}
                catalogue={MOODS}
                labels={labels.moods}
                selectedIds={entry.moodId === null ? [] : [entry.moodId]}
                onToggle={(id) => chooseOne('moodId', id)}
                multiple={false}
                disabled={isLoading || isBusy}
              />
            </View>

            {/* Everything except the strip's refusal, which is drawn up beside
                the strip because that is where the press was. */}
            {notice !== null && notice !== 'unsaved' && (
              <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                {noticeText(notice)}
              </ThemedText>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={strings.saveLabel}
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
                {isBusy ? strings.savingLabel : strings.saveLabel}
              </ThemedText>
            </Pressable>

            {/* Only when there is something to clear. A button that deletes
                nothing is a question nobody was asked. */}
            {hasAnything(entry) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={strings.clearLabel}
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
                <ThemedText type="smallBold">{strings.clearLabel}</ThemedText>
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
