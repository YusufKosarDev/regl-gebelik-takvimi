import { StyleSheet, View, type ViewProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

  return (
    <View
      style={[
        styles.surface,
        level === 'lined' && [styles.lined, { borderTopColor: theme.backgroundSelected }],
        level === 'filled' && [styles.filled, { backgroundColor: theme.backgroundElement }],
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
