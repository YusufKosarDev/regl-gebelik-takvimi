import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getCycleSettings } from '@/features/cycle/application/get-cycle-settings';
import { updateCycleSettings } from '@/features/cycle/application/update-cycle-settings';
import {
  MAX_CYCLE_LENGTH_DAYS,
  MAX_PERIOD_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
  MIN_PERIOD_LENGTH_DAYS,
} from '@/features/cycle/domain/limits';
import type { CycleSettings } from '@/features/cycle/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { openAppDatabase } from '@/storage/db';

const LOAD_ERROR_MESSAGE = 'Ayarlar yüklenemedi.';
const SAVE_ERROR_MESSAGE = 'Ayarlar kaydedilemedi.';
const EMPTY_MESSAGE = 'Döngü bilgisi bulunamadı.';

/**
 * The longest period length that makes sense alongside a given cycle length.
 *
 * A period cannot outlast the cycle it sits in, so the cycle length caps it as
 * well as the domain's own maximum. Both bounds are imported rather than
 * restated, so the stepper cannot offer a pair `validateCycleSettings` would
 * reject.
 */
function maxPeriodLengthFor(cycleLength: number): number {
  return Math.min(MAX_PERIOD_LENGTH_DAYS, cycleLength);
}

/**
 * The two averages the predictions are built from.
 *
 * Steppers rather than text entry: every value between the domain's bounds is
 * one tap away, and there is no way to type something that would have to be
 * rejected. Nothing here recalculates the averages from the recorded periods —
 * these are what the person says their cycle is like.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<CycleSettings | null>(null);
  const [hasError, setHasError] = useState(false);

  const [cycleLength, setCycleLength] = useState(MIN_CYCLE_LENGTH_DAYS);
  const [periodLength, setPeriodLength] = useState(MIN_PERIOD_LENGTH_DAYS);

  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  // A ref as well as the disabled prop: state updates are async, so two quick
  // taps could both read `isSaving` as false before the re-render lands.
  const saveInFlight = useRef(false);

  /** Stable, so the mount effect can depend on it. */
  const readSettings = useCallback(async () => {
    const db = await openAppDatabase();

    return getCycleSettings(db);
  }, []);

  useEffect(() => {
    // Guards against setting state after the screen is gone, e.g. when the
    // person navigates back while the read is still in flight.
    let isActive = true;

    const load = async () => {
      try {
        const stored = await readSettings();

        if (!isActive) {
          return;
        }

        setSettings(stored);

        if (stored !== null) {
          setCycleLength(stored.averageCycleLengthDays);
          setPeriodLength(stored.averagePeriodLengthDays);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[settings] could not load the cycle settings', error);
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
  }, [readSettings]);

  const maxPeriodLength = maxPeriodLengthFor(cycleLength);

  const changeCycleLength = (delta: number) => {
    const next = cycleLength + delta;

    setCycleLength(next);
    setHasSaveError(false);

    // Shortening the cycle can leave the period longer than the cycle it sits
    // in. Rather than let the person save a pair the domain would reject, the
    // period follows the cycle down.
    if (periodLength > maxPeriodLengthFor(next)) {
      setPeriodLength(maxPeriodLengthFor(next));
    }
  };

  const changePeriodLength = (delta: number) => {
    setPeriodLength(periodLength + delta);
    setHasSaveError(false);
  };

  const handleSave = async () => {
    if (saveInFlight.current) {
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    setHasSaveError(false);

    try {
      const db = await openAppDatabase();

      await updateCycleSettings(db, {
        averageCycleLengthDays: cycleLength,
        averagePeriodLengthDays: periodLength,
      });

      // Home reads again when it regains focus, so going back is enough to show
      // the predictions the new settings produce.
      router.back();
    } catch (error) {
      if (__DEV__) {
        console.error('[settings] could not save the cycle settings', error);
      }

      // The screen stays as it is with the error, so the values that were
      // rejected are still there to correct or try again.
      setHasSaveError(true);
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
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
          <ActivityIndicator testID="cycle-settings-loading" color={theme.text} />
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
                Döngü ayarları
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.description}>
                Döngü ve regl süresi tahminlerini buradan güncelleyebilirsin.
              </ThemedText>
            </View>

            {hasError ? (
              <ThemedText accessibilityRole="alert" themeColor="textSecondary">
                {LOAD_ERROR_MESSAGE}
              </ThemedText>
            ) : settings === null ? (
              <ThemedText themeColor="textSecondary">{EMPTY_MESSAGE}</ThemedText>
            ) : (
              <View style={styles.fields}>
                <LengthStepper
                  label="Ortalama döngü süresi"
                  note="Bir regl döneminin ilk gününden, sonraki regl döneminin ilk gününe kadar geçen süre."
                  value={cycleLength}
                  min={MIN_CYCLE_LENGTH_DAYS}
                  max={MAX_CYCLE_LENGTH_DAYS}
                  decreaseLabel="Ortalama döngü süresini azalt"
                  increaseLabel="Ortalama döngü süresini artır"
                  onChange={changeCycleLength}
                  disabled={isSaving}
                  theme={theme}
                />

                <LengthStepper
                  label="Ortalama regl süresi"
                  note="Kanamanın başladığı ilk günden tamamen bittiği güne kadar geçen ortalama süre."
                  value={periodLength}
                  min={MIN_PERIOD_LENGTH_DAYS}
                  max={maxPeriodLength}
                  decreaseLabel="Ortalama regl süresini azalt"
                  increaseLabel="Ortalama regl süresini artır"
                  onChange={changePeriodLength}
                  disabled={isSaving}
                  theme={theme}
                />

                {hasSaveError && (
                  <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                    {SAVE_ERROR_MESSAGE}
                  </ThemedText>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Döngü ayarlarını kaydet"
                  accessibilityState={{ disabled: isSaving }}
                  disabled={isSaving}
                  onPress={handleSave}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.text },
                    isSaving && styles.disabled,
                    pressed && !isSaving && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.background }}>
                    {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * One whole-number setting, in days.
 *
 * The bounds are passed in rather than read here, because the period length's
 * maximum depends on the cycle length as well as on the domain's own limit.
 */
function LengthStepper({
  label,
  note,
  value,
  min,
  max,
  decreaseLabel,
  increaseLabel,
  onChange,
  disabled,
  theme,
}: {
  label: string;
  note: string;
  value: number;
  min: number;
  max: number;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (delta: number) => void;
  disabled: boolean;
  theme: { text: string; backgroundSelected: string };
}) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {note}
      </ThemedText>

      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={decreaseLabel}
          accessibilityState={{ disabled: !canDecrease }}
          disabled={!canDecrease}
          onPress={() => onChange(-1)}
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
          accessibilityLabel={`${label}: ${value} gün`}
          accessibilityValue={{ min, max, now: value }}
          style={styles.valueBlock}>
          <ThemedText style={styles.value}>{value}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            gün
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}
          accessibilityState={{ disabled: !canIncrease }}
          disabled={!canIncrease}
          onPress={() => onChange(1)}
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
  fields: {
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.half,
  },
  note: {
    marginTop: Spacing.half,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
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
