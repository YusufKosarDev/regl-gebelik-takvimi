import { Pressable, StyleSheet, View } from 'react-native';

import { homeMessages } from '../presentation/home-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { PregnancyDashboard } from '@/features/pregnancy/application/get-pregnancy-dashboard';
import { useSky, useTheme } from '@/hooks/use-theme';

import { useOnSky } from './on-sky';
import { useMessages } from '@/i18n';

/**
 * The two views over the same day: Döngü and Gebelik.
 *
 * Lifted out of `index.tsx` unchanged - the same two tabs, the same labels,
 * and the same selected and disabled states announced the same way. Gebelik is
 * still unreachable until there is a pregnancy to show, which is what its
 * disabled state says.
 *
 * ## Why it stopped being a filled capsule
 *
 * It was a violet pill with white text beside a plain grey word - a
 * segmented control, which is a page idiom. On a full-bleed field the fill
 * was the loudest thing above the day number and the second loudest on the
 * screen, which is a strange amount of noise for a switch most people will
 * never touch: one of the two tabs is unreachable until there is a pregnancy
 * to show.
 *
 * Both labels are the ink now. The selected one is heavier and carries a
 * short rule beneath it; the other is lighter and nothing else. Weight and a
 * line are enough to say which of two words is on, and they leave the day
 * number as the thing the eye lands on.
 *
 * The `accessibilityState` is untouched: a screen reader was never reading
 * the fill, and nothing about what it announces has changed.
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
  const sky = useSky();
  const onSky = useOnSky();
  const home = useMessages(homeMessages);

  return (
    <View accessibilityRole="tablist" style={styles.modeSwitch}>
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={home.cycleTabLabel}
        accessibilityState={{ selected: !isPregnancyView }}
        onPress={() => chooseMode('cycle')}
        style={({ pressed }) => [
          styles.modeOption,
          !isPregnancyView &&
            (onSky
              ? { borderBottomWidth: 2, borderBottomColor: sky.ink }
              : { backgroundColor: theme.primary }),
          pressed && styles.pressed,
        ]}>
        {/* Off a field this is still a filled capsule, and a label on a fill
            has to name its own colour - on a sky `ThemedText` draws in the
            ink, which over the violet would be dark on dark. */}
        <ThemedText
          type={isPregnancyView ? 'small' : 'smallBold'}
          style={!isPregnancyView && !onSky ? { color: theme.onPrimary } : undefined}>
          {home.cycleTabLabel}
        </ThemedText>
      </Pressable>

      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={home.pregnancyTabLabel}
        accessibilityState={{ selected: isPregnancyView, disabled: pregnancy === null }}
        disabled={pregnancy === null}
        onPress={() => chooseMode('pregnancy')}
        style={({ pressed }) => [
          styles.modeOption,
          isPregnancyView &&
            (onSky
              ? { borderBottomWidth: 2, borderBottomColor: sky.ink }
              : { backgroundColor: theme.primary }),
          pregnancy === null && styles.disabled,
          pressed && pregnancy !== null && styles.pressed,
        ]}>
        <ThemedText
          type={isPregnancyView ? 'smallBold' : 'small'}
          style={isPregnancyView && !onSky ? { color: theme.onPrimary } : undefined}>
          {home.pregnancyTabLabel}
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
