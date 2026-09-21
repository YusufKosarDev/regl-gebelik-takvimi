import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useAutomaticSync } from '@/features/sync/application/use-automatic-sync';
import { logEvent } from '@/shared/logging';
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

  const [hasHydrationError, setHasHydrationError] = useState(false);

  // Mounted here rather than on a screen: an edit made anywhere should still
  // reach the account after the person navigates away from where they made it.
  useAutomaticSync();

  // `hydrate` is a stable store action, so this runs once per app start rather
  // than on every state change.
  useEffect(() => {
    hydrate().catch((error: unknown) => {
      logEvent('app state load failed', error);
      setHasHydrationError(true);
    });
  }, [hydrate]);

  // Without this the screen would spin forever when the read fails. What went
  // wrong is not shown: the thrown text is written by whatever failed, and a
  // screen is the one place a person cannot choose not to look at it.
  if (hasHydrationError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>App state could not be loaded.</Text>
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
});
