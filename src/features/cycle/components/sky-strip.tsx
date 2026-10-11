import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { OnSkyProvider } from './on-sky';

import { Spacing } from '@/constants/theme';
import type { SkyField } from '@/constants/sky';

/**
 * A band of sky across the top of a screen that is otherwise a page.
 *
 * ## Why a strip rather than a field
 *
 * `SkyBackdrop` and `SkyField` fill a screen, which is right where everything
 * on the screen is atmosphere or ink. The calendar is neither: the grid's
 * colours are data, and they were measured against the page - every phase
 * accent comes out under 3:1 on every sky, the worst of them at 1.19:1, so a
 * grid on a field is a grid nobody can read.
 *
 * The header has no data in it. A month's name and two arrows can sit on a
 * field at no cost, and that is enough for the screen to say which phase today
 * is in without the grid paying for it.
 *
 * ## It bleeds
 *
 * Past whatever padding its parent has, on both sides. A coloured band with a
 * margin either side is a card, and the screen this was built for had just
 * stopped having cards. The bleed is a negative margin rather than a change of
 * layout, so nothing above or below it has to know.
 *
 * ## Everything inside is on the sky
 *
 * `OnSkyProvider`, exactly as the full-screen ones do it, so `ThemedText` and
 * `Icon` take the ink without the caller saying so. A word drawn in
 * `textSecondary` here would measure 1.97:1 on the light fields - that is the
 * mistake `constants/sky.ts` was written about, and the provider is what makes
 * it impossible rather than merely discouraged.
 */
export function SkyStrip({
  field,
  children,
  testID,
}: {
  readonly field: SkyField;
  readonly children: React.ReactNode;
  readonly testID?: string;
}) {
  return (
    <OnSkyProvider value>
      <View style={styles.strip} testID={testID}>
        <LinearGradient colors={[...field]} style={StyleSheet.absoluteFill} />

        {children}
      </View>
    </OnSkyProvider>
  );
}

const styles = StyleSheet.create({
  strip: {
    // Out past the parent's padding on both sides, and the same amount back as
    // padding so the words inside stay where they were.
    marginHorizontal: -Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
});
