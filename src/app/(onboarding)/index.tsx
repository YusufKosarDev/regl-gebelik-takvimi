import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  WELCOME_DESCRIPTION,
  WELCOME_NOTE,
  WELCOME_START_HINT,
  WELCOME_START_LABEL,
  WELCOME_TITLE,
} from '@/features/onboarding/presentation/onboarding-messages';
import { useTheme } from '@/hooks/use-theme';

/**
 * First screen of onboarding.
 *
 * Text is left aligned rather than centred: the Turkish copy runs long, and a
 * ragged-right column is easier to read and reads calmer than centred blocks.
 *
 * The action uses the theme's own text/background pair rather than a new accent
 * colour — the product has no brand palette yet, and borrowing the existing
 * contrast pair keeps the button legible in both schemes without inventing one.
 */
export default function OnboardingWelcomeScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <ThemedText type="subtitle" style={styles.title}>
              {WELCOME_TITLE}
            </ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.description}>
              {WELCOME_DESCRIPTION}
            </ThemedText>

            <View style={[styles.note, { borderLeftColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {WELCOME_NOTE}
              </ThemedText>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={WELCOME_START_LABEL}
            accessibilityHint={WELCOME_START_HINT}
            onPress={() => router.push('/(onboarding)/disclaimer')}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}>
            <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.onPrimary }]}>
              {WELCOME_START_LABEL}
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
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  note: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    marginTop: Spacing.two,
  },
  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  button: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    fontSize: 16,
  },
});
