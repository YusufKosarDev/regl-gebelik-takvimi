import { StyleSheet, View, type ViewProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useOnSky } from '@/features/cycle/components/on-sky';
import { useSky, useTheme } from '@/hooks/use-theme';

/**
 * How much weight a block of content carries on the page.
 *
 * ## Why this exists
 *
 * One card treatment was repeated in seventeen files - sixteen-radius, 24/16
 * padding, filled with `backgroundElement` - and four of those copies were
 * byte-identical. Everything on a screen looked the same, which meant nothing
 * looked important: the home screen opened on four identical grey rectangles
 * and a person had to read all four to find out which one they came for.
 *
 * Three levels, and the level says what kind of thing the block is rather than
 * how it should look:
 *
 * - **`bare`** - the content carries itself and sits directly on the page. For
 *   the thing a screen exists to show.
 * - **`lined`** - information, separated from its neighbours by a hairline.
 *   Reads as a list rather than as a stack of objects.
 * - **`filled`** - a block that holds something to do. The fill is what makes a
 *   card feel like an object you can act on, so it is spent only where there is
 *   an action inside.
 *
 * ## It is never pressable, and that is load-bearing
 *
 * `Surface` renders a plain `View` and takes no press handler. Five separate
 * tests pin the exact ordered list of every control on a screen - home,
 * settings, history, pregnancy-settings and pregnancy-start - by mapping
 * `queryAllByRole('button')`. A surface that gained a role would enter all five
 * lists at once. The button goes *inside* the surface; the surface is the box.
 *
 * `accessible` and `accessibilityLabel` pass through, because several callers
 * compose one spoken sentence for a whole row rather than letting a screen
 * reader read a label and a value as two stops.
 *
 * ## On a sky field it is made of the field
 *
 * `backgroundElement` is a page colour. Laid on a coloured field it reads as
 * a hole punched in the sky rather than a layer on top of it - a grey
 * rectangle on a pink dawn in the light scheme, and a near-black one on a
 * violet night in the dark, which is worse because the card ends up further
 * from the field than anything else on the screen.
 *
 * On a field, `filled` becomes glass: the ink at a few percent, so the sky
 * shows through and the block drifts when the field drifts, with one lit
 * edge along the top so it has a thickness. The glass always *deepens* the
 * field in both schemes - lightening a dark sky is what walks into the
 * contrast ceiling described in `constants/sky.ts`.
 *
 * `lined` takes its hairline from the same place, because a rule in a page
 * colour is a rule borrowed from another surface.
 *
 * Nothing at a call site changes. `useOnSky` answers from the tree, so a
 * screen cannot forget to say where it is.
 */
export type SurfaceLevel = 'bare' | 'lined' | 'filled';

export function Surface({
  level,
  style,
  ...rest
}: ViewProps & {
  readonly level: SurfaceLevel;
}) {
  const theme = useTheme();
  const sky = useSky();
  const onSky = useOnSky();

  return (
    <View
      style={[
        styles.surface,
        level === 'lined' && [
          styles.lined,
          { borderTopColor: onSky ? sky.glass : theme.backgroundSelected },
        ],
        level === 'filled' && [
          styles.filled,
          onSky
            ? {
                backgroundColor: sky.glass,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: sky.glassEdge,
              }
            : { backgroundColor: theme.backgroundElement },
        ],
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  surface: {
    gap: Spacing.half,
  },
  lined: {
    // A rule above rather than below, so the last row in a group does not leave
    // a line hanging under it with nothing beneath.
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
  },
  filled: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
});
