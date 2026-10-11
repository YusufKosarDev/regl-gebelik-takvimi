import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { OnSkyProvider } from './on-sky';

import type { SkyField } from '@/constants/sky';

/**
 * The sky, standing still, for the screens that have nothing to say yet.
 *
 * ## What this is for
 *
 * The launch sequence read lilac splash, **white page**, sky. The white page
 * is the frame where the home screen says it is loading, and it is the frame
 * somebody is looking at while deciding what this app is. A sky app that
 * flashes a blank page on the way to the sky looks unfinished for exactly as
 * long as that takes.
 *
 * ## Why it does not drift
 *
 * `SkyField` would, and that would be worse rather than better: it is a
 * different component from the one the loaded screen mounts, so the drift
 * would start, be thrown away a second later, and start again from nothing.
 * Two seconds of movement that resets is a stutter, not a welcome.
 *
 * The field it carries claims no phase, because nothing has been read yet, and
 * its middle stop is the splash background exactly - so the splash resolves
 * into this rather than cutting to it.
 */
export function SkyBackdrop({
  colors,
  children,
  testID,
}: {
  readonly colors: SkyField;
  readonly children: React.ReactNode;
  readonly testID?: string;
}) {
  return (
    <OnSkyProvider value>
      <View style={styles.root} testID={testID}>
      <LinearGradient colors={[...colors]} style={StyleSheet.absoluteFill} />
        {children}
      </View>
    </OnSkyProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
