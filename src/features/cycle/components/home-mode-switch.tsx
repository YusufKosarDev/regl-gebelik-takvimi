import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { PregnancyDashboard } from '@/features/pregnancy/application/get-pregnancy-dashboard';
import { useTheme } from '@/hooks/use-theme';

/**
 * The two views over the same day: Döngü and Gebelik.
 *
 * Lifted out of `index.tsx` unchanged - the same two tabs, the same labels,
 * and the same selected and disabled states announced the same way. Gebelik is
 * still unreachable until there is a pregnancy to show, which is what its
 * disabled state says.
 *
 * Choosing a mode stays with the screen. Which view is on is stored, and the
 * screen reconciles it against whether there is still a pregnancy to show, so
 * this is a control that reports a press, not one that decides anything.
 */
export function HomeModeSwitch({
  isPregnancyView,
  pregnancy,
  chooseMode,
}: {
  readonly isPregnancyView: boolean;
  readonly pregnancy: PregnancyDashboard | null;
  readonly chooseMode: (mode: 'cycle' | 'pregnancy') => void;
}) {
  const theme = useTheme();

  return (
    <View accessibilityRole="tablist" style={styles.modeSwitch}>
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Döngü"
        accessibilityState={{ selected: !isPregnancyView }}
        onPress={() => chooseMode('cycle')}
        style={({ pressed }) => [
          styles.modeOption,
          !isPregnancyView && { backgroundColor: theme.primary },
          pressed && styles.pressed,
        ]}>
        <ThemedText
          type={isPregnancyView ? 'small' : 'smallBold'}
          themeColor={isPregnancyView ? 'text' : 'onPrimary'}>
          Döngü
        </ThemedText>
      </Pressable>

      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Gebelik"
        accessibilityState={{ selected: isPregnancyView, disabled: pregnancy === null }}
        disabled={pregnancy === null}
        onPress={() => chooseMode('pregnancy')}
        style={({ pressed }) => [
          styles.modeOption,
          isPregnancyView && { backgroundColor: theme.primary },
          pregnancy === null && styles.disabled,
          pressed && pregnancy !== null && styles.pressed,
        ]}>
        <ThemedText
          type={isPregnancyView ? 'smallBold' : 'small'}
          themeColor={isPregnancyView ? 'onPrimary' : 'text'}>
          Gebelik
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  modeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  modeOption: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
