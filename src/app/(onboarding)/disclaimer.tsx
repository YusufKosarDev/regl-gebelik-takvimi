import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  DISCLAIMER_INTRO,
  DISCLAIMER_POINTS,
  DISCLAIMER_TITLE,
} from '@/features/disclaimer/presentation/disclaimer-messages';
import { useTheme } from '@/hooks/use-theme';

/**
 * What the app is not, said once, before anything is asked for.
 *
 * Its own screen rather than a section on the welcome screen. That screen opens
 * with a 34px headline and a paragraph and is already bottom-aligned against
 * the button; adding a title, an intro and three bullets pushes it into
 * scrolling on a small phone, and further at larger font scales — which is
 * exactly the wrong thing to do to the text that says this is not contraception.
 *
 * No checkbox and no second button. An acceptance step would turn a thing to
 * read into a thing to dismiss, and the fastest way past a checkbox is to stop
 * reading. Continuing is the existing button, doing what it already did.
 */
export default function OnboardingDisclaimerScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
              {DISCLAIMER_TITLE}
            </ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.body}>
              {DISCLAIMER_INTRO}
            </ThemedText>

            {/* A bullet per point, drawn rather than typed: a literal "-" in the
                string would be read out by a screen reader as a hyphen. */}
            <View style={styles.points}>
              {DISCLAIMER_POINTS.map((point) => (
                <View key={point} style={styles.point}>
                  <ThemedText themeColor="textSecondary" style={styles.bullet}>
                    •
                  </ThemedText>

                  <ThemedText themeColor="textSecondary" style={styles.pointText}>
                    {point}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Devam et"
            accessibilityHint="Döngü ayarlarını girmeye geçer"
            onPress={() => router.push('/(onboarding)/cycle-settings')}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}>
            <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.onPrimary }]}>
              Devam et
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
  // Top-aligned, unlike the welcome screen: this is text to read from the
  // beginning, and it has to survive growing at larger font scales.
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  points: {
    gap: Spacing.two,
  },
  point: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bullet: {
    fontSize: 16,
    lineHeight: 24,
  },
  // Takes the rest of the row so a long point wraps under itself rather than
  // pushing the bullet off the line.
  pointText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
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
