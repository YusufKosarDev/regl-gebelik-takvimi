import { Pressable, StyleSheet, View, type PressableProps, type ViewProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useOnSky } from '@/features/cycle/components/on-sky';
import { useSky, useTheme } from '@/hooks/use-theme';

/**
 * How much of the screen the bar covers.
 *
 * The bar floats over the content rather than sitting under it, because that
 * is the only way glass can have a field behind it to show through - a bar in
 * the flow has the layout's own background there instead, which on a sky
 * screen is the hole in it that `surface.tsx` warns about.
 *
 * Floating means the last row of a screen would otherwise end up underneath
 * the bar, so the screens pad their scroll content by this. It is asserted
 * against the real style in `__tests__/tab-bar.test.tsx`: a constant that
 * drifts from the height hides a row rather than clearing it, and it would do
 * it silently.
 *
 * The bottom safe area is not in here. The bar takes that itself, and every
 * screen already takes its own, so each stops above the gesture bar and this
 * is the whole of what is left to clear.
 */
export const TAB_BAR_HEIGHT = 48;

/**
 * The bar the four words sit in.
 *
 * ## It is made of whatever is behind it
 *
 * On a field it is glass, by the same reasoning `Surface` is: a page colour
 * laid on a sky reads as a hole punched in it, and this is the widest thing on
 * the screen that could punch one. Off a field it is the card colour, because
 * glass is the ink at six percent and six percent of anything over white is a
 * grey smear with no edge to it.
 *
 * That second case is temporary in intent and real in practice: three of the
 * four tabs open screens that are still white pages until the later stages
 * rework them, and a bar that is only correct on one of the four is a bar that
 * is wrong three times as often as it is right.
 *
 * ## One lit edge along the top
 *
 * The same edge a glass block gets, for the same reason: without it the bar
 * has no thickness and the content scrolls into it rather than under it.
 */
export function TabBar({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  const sky = useSky();
  const onSky = useOnSky();

  return (
    <View
      // The role is for the platform; the `testID` is how a test reaches it,
      // because a container cannot be made an accessibility element without
      // swallowing the four tabs inside it into one stop.
      accessibilityRole="tablist"
      testID="tab-bar"
      style={[
        styles.bar,
        onSky
          ? { backgroundColor: sky.glass, borderTopColor: sky.glassEdge }
          : { backgroundColor: theme.backgroundElement, borderTopColor: theme.backgroundSelected },
        style,
      ]}
      {...rest}
    />
  );
}

/**
 * One word in the bar at the bottom.
 *
 * ## No icon
 *
 * The app this follows structurally draws an icon above every tab label. This
 * one does not, and that is a departure rather than an oversight: `icon.tsx`
 * says the set is only for the jobs a word is bad at, and names pointing as
 * the whole of it. Four nouns in a row need no pictures of themselves - a cog
 * beside "Profil" is the example that file already uses for what not to do.
 *
 * The cost is honest: an icon is faster to find in the corner of the eye than
 * a word. What buys it back is that there are four of them, in a fixed order,
 * in the same place on every screen.
 *
 * ## The selected tab is marked by a rule, not by a colour
 *
 * `sky.ts` wrote the rule under the selected tab into `inkLine` before this
 * bar existed, which is also the answer to why the active tab is not tinted:
 * a bar on a field has one ink, and an accent-coloured control on a field
 * reads as something pasted on from another app.
 *
 * So the word does not change colour at all between the two states. That is
 * stricter than it has to be - a weight change would be legible too - and it
 * is the version a test can hold, because "the label is the same colour
 * either way" cannot be satisfied by tinting.
 */
export function TabBarButton({
  label,
  isFocused = false,
  ...rest
}: PressableProps & {
  readonly label: string;
  /**
   * Injected by `TabTrigger` through `asChild`, which is why it is optional
   * here: the layout writes `<TabBarButton label={...} />` and the trigger
   * clones it with this set.
   */
  readonly isFocused?: boolean;
}) {
  const sky = useSky();

  return (
    // `rest` is spread first on purpose. It carries what `TabTrigger` injects,
    // including a style of its own, and spread last that style replaced this
    // one - which cost the four tabs their `flex: 1` and left the first word
    // holding a quarter of the bar while the other three crowded into the
    // middle. Everything below the spread is this component's own say.
    <Pressable
      {...rest}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
      <ThemedText type="small">{label}</ThemedText>

      {/* Only when selected. A transparent rule the rest of the time would
          keep the layout from shifting, and it would also be a colour drawn
          for every tab - the test that says a colour is never the only
          channel is easier to trust when the unselected tab draws nothing. */}
      {isFocused && <View style={[styles.rule, { backgroundColor: sky.inkLine }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    // The one control on every screen does not get to be the one under the
    // touch target.
    minHeight: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  rule: {
    height: Spacing.half,
    width: Spacing.five,
    borderRadius: Spacing.half,
  },
});
