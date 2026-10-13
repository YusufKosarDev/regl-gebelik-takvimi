import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

/**
 * The safe area the app has, for a test that renders a screen on its own.
 *
 * `useSafeAreaInsets` throws without a `SafeAreaProvider`. In the app there is
 * always one: `ExpoRoot` wraps the whole tree in a provider seeded with
 * `initialMetrics`, which is why a screen can read its own insets on a device.
 * A test that renders one screen starts below that, so it has to supply the
 * same thing.
 *
 * It is the real provider rather than a mocked hook, seeded the same way
 * `ExpoRoot` seeds it, so the hook under test is the hook that ships.
 *
 * ## The numbers
 *
 * A 24 point status bar and nothing anywhere else. Android's gesture bar is
 * usually another 24 at the bottom, and leaving it at zero is deliberate: a
 * screen that only looks right when something is subtracted from the bottom
 * should fail here rather than pass on a borrowed inset. Anything a test
 * asserts about the top edge is asserted against `SAFE_AREA_TEST_INSETS.top`
 * rather than a literal.
 */
export const SAFE_AREA_TEST_INSETS = { top: 24, left: 0, right: 0, bottom: 0 } as const;

export function SafeAreaTestProvider({ children }: { readonly children: ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: SAFE_AREA_TEST_INSETS,
      }}>
      {children}
    </SafeAreaProvider>
  );
}
