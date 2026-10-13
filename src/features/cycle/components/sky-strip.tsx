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
 * ## And upwards, when the caller asks
 *
 * `bleedTop` is the same trick on the vertical: a negative margin of that many
 * points with the same amount added back as padding, so the words inside stay
 * where they were and nothing around it has to know.
 *
 * It exists because the two sky screens disagreed about where the sky starts.
 * The home screen's `SkyField` wraps everything, so it paints behind the
 * status bar; this strip sat four levels inside a `SafeAreaView`, so the band
 * above it was the page - measured on a device, pure white against the strip's
 * 196, a seam of 59 levels in light mode.
 *
 * Measured again after, across the same boundary at 1080x2400: 186 against
 * 185 in light, 26 against 26 in dark. The Cycle tab, whose field has always
 * wrapped the whole screen, reads 226 against 226 and 41 against 41 at the
 * same place - so the calendar now joins it rather than approaching it.
 *
 * That was never a decision about the strip. The contrast reasoning above
 * keeps the field off the *grid*, because the grid is data; the status bar
 * band carries less than the header does, so nothing in that argument reaches
 * it.
 *
 * The caller passes its own top inset and stops taking that edge itself,
 * because a strip cannot know whether it is the first thing on its screen.
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
  bleedTop = 0,
}: {
  readonly field: SkyField;
  readonly children: React.ReactNode;
  readonly testID?: string;
  /** Points of inset above this strip to reach back through. */
  readonly bleedTop?: number;
}) {
  return (
    <OnSkyProvider value>
      <View
        style={[
          styles.strip,
          bleedTop === 0
            ? null
            : { marginTop: -bleedTop, paddingTop: bleedTop + Spacing.three },
        ]}
        testID={testID}>
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
