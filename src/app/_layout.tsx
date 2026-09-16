import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useAppStore } from '@/store/app-store';

/**
 * Startup gate.
 *
 * Reads the persisted state once, holds the UI on a placeholder until it lands,
 * and then mounts exactly one route group. The decision lives here alone so no
 * screen has to repeat it.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  const hydrate = useAppStore((state) => state.hydrate);
  const hydrated = useAppStore((state) => state.hydrated);
  const onboardingCompleted = useAppStore((state) => state.onboardingCompleted);

  const [hydrationError, setHydrationError] = useState<string | null>(null);

  // `hydrate` is a stable store action, so this runs once per app start rather
  // than on every state change.
  useEffect(() => {
    hydrate().catch((error: unknown) => {
      setHydrationError(String(error));
    });
  }, [hydrate]);

  // Without this the screen would spin forever when the read fails. Developer
  // facing only — a real error surface is not part of this step.
  if (hydrationError !== null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>App state could not be loaded.</Text>
        <Text style={styles.errorDetail}>{hydrationError}</Text>
      </View>
    );
  }

  if (!hydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator testID="app-hydration-loading" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!onboardingCompleted}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>

        <Stack.Protected guard={onboardingCompleted}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 12,
    textAlign: 'center',
  },
});
