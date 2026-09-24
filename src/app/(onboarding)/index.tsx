import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
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
              Döngünü birlikte takip edelim
            </ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.description}>
              Regl döngünü anlamana, tahmini dönemlerini takip etmene ve günlük değişimleri
              daha kolay görmene yardımcı olacağız.
            </ThemedText>

            <View style={[styles.note, { borderLeftColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Tahminler geçmiş döngü bilgilerine dayanır ve tıbbi tavsiye yerine geçmez.
              </ThemedText>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Başlayalım"
            accessibilityHint="Başlamadan önce bilinmesi gerekenlere geçer"
            onPress={() => router.push('/(onboarding)/disclaimer')}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}>
            <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.onPrimary }]}>
              Başlayalım
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
