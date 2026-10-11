import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { SkyField as SkyFieldColors } from '@/constants/sky';
import { BLOOM_MS, DRIFT_MS, FIELD_FADE_MS } from '@/constants/sky';

/**
 * The sky the whole home screen sits on.
 *
 * ## The light moves, and nothing has an edge
 *
 * The first version drifted two large translucent circles across the field. On
 * a phone they read as exactly that - two discs with visible rims sliding about
 * behind the text - because a `View` with a `borderRadius` has a hard edge and
 * there is no blur to soften it. It looked like a rendering fault.
 *
 * What moves now is light rather than a shape. Each drifting layer is a
 * gradient from transparent, through a little light, back to transparent, and
 * each is drawn far larger than the screen and translated slowly across it. A
 * gradient has no rim to catch, and because the sheet is half as wide again as
 * the screen on every side, its own boundary never comes into view however far
 * it travels.
 *
 * Two sheets at different angles, speeds and directions. Where they cross, the
 * field brightens; where they part, it settles. The pattern never repeats at a
 * rhythm anybody can catch, and nothing in it has a shape.
 *
 * This needed no new dependency. `expo-blur` would have been the other way to
 * soften a disc and it is not needed: there is no disc to soften.
 *
 * ## It can be turned off, and that is not a preference
 *
 * `useMotionAllowed` is false when the system's reduce-motion setting is on, or
 * when the app is in the background. Then the drift is cancelled where it
 * stands, the field changes without a fade, and a logged period gives its
 * haptic without a flare. The reasoning is in that hook; the short version is
 * that a background which never stops moving can make a screen unusable, and
 * Android has a setting that says so.
 */
/**
 * How much bigger than the screen each drifting sheet is.
 *
 * The one number that decides whether the drift can be seen at all, so it is
 * here rather than inline: raise it and the screen slides towards the flat
 * peak of the gradient, where movement stops reading.
 */
const SHEET = 1.5;

/** How far each sheet travels, as a fraction of the screen, in each direction. */
const DRIFT_A_X = 0.2;
const DRIFT_A_Y = 0.04;
const DRIFT_B_X = 0.18;
const DRIFT_B_Y = 0.05;

export function SkyField({
  colors,
  bloomKey,
  children,
  driftColor,
  bloomColor,
  motionAllowed,
  testID,
}: {
  readonly colors: SkyFieldColors;
  /**
   * Changes to ask for a bloom.
   *
   * A counter rather than a boolean: two periods logged in a row are two
   * blooms, and a boolean would need resetting to false in between, which is a
   * second render that can be missed.
   */
  readonly bloomKey: number;
  readonly driftColor: string;
  readonly bloomColor: string;
  /** False under reduce-motion, or when the app is not in the foreground. */
  readonly motionAllowed: boolean;
  readonly children: React.ReactNode;
  readonly testID?: string;
}) {
  const { width, height } = useWindowDimensions();

  // A quarter of a screen of spare sheet on every side. The first version used
  // a whole screen's worth, and that is what made the drift invisible - the
  // arithmetic is above `sheetA`.
  const sheet = { width: width * SHEET, height: height * SHEET };
  const inset = {
    left: (-width * (SHEET - 1)) / 2,
    top: (-height * (SHEET - 1)) / 2,
  };

  /* --------------------------------------------------------- the drift -- */

  const driftA = useSharedValue(0);
  const driftB = useSharedValue(0);

  useEffect(() => {
    if (!motionAllowed) {
      // Stopped where it stands rather than reset to a starting position: a
      // field that jumped when the setting changed would be one last movement
      // on the way to holding still.
      cancelAnimation(driftA);
      cancelAnimation(driftB);

      return;
    }

    driftA.value = withRepeat(
      withTiming(1, { duration: DRIFT_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    // Slower and the other way, so the two sheets separate and meet rather than
    // travelling together as one.
    driftB.value = withRepeat(
      withTiming(1, { duration: DRIFT_MS * 1.7, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [motionAllowed, driftA, driftB]);

  /*
   * ## Why these numbers, and what the first set got wrong
   *
   * The drift ran correctly from the start and still could not be seen:
   * measured on a device, the largest change anywhere on screen over
   * thirty-six seconds was 10/255. Two reasons, both geometry rather than
   * speed, so no value of `DRIFT_MS` would have helped.
   *
   * **The screen sat on the flat top of the ramp.** A sheet twice the size of
   * the screen puts the screen in the middle half of it, and the gradient's
   * peak is at the sheet's centre - which is exactly where its slope is zero.
   * At `SHEET = 1.5` the screen covers the middle two thirds instead, and
   * along sheet A's axis it spans t = 0.18 to t = 0.97: the whole slope.
   *
   * **The two halves of the movement cancelled.** The old sheet A travelled
   * +x while travelling -y, and its gradient axis pointed (+x, +y), so the two
   * worked against each other and the light advanced 4.9% of the ramp. Here
   * both push the same way along the axis:
   *
   *   A: axis (1, 0.55), |axis|² = 1.3025
   *      Δu = 2·0.20/1.5 = 0.2667,  Δv = 2·0.04/1.5 = 0.0533
   *      Δt = (0.2667·1 + 0.0533·0.55) / 1.3025 = 0.227
   *
   *   B: axis (-0.95, 0.75), |axis|² = 1.465
   *      Δu = -2·0.18/1.5 = -0.24,  Δv = 2·0.05/1.5 = 0.0667
   *      Δt = (-0.24·-0.95 + 0.0667·0.75) / 1.465 = 0.190
   *
   * Roughly five times the old travel, over a part of the ramp that has a
   * slope to travel along.
   *
   * ## The edge still never shows
   *
   * That is the constraint the oversized sheet existed to satisfy and it is
   * kept: the furthest either sheet travels is 0.20 of the screen, against
   * 0.25 of spare sheet on each side.
   */
  const sheetA = useAnimatedStyle(() => ({
    transform: [
      { translateX: -width * DRIFT_A_X + driftA.value * width * DRIFT_A_X * 2 },
      { translateY: -height * DRIFT_A_Y + driftA.value * height * DRIFT_A_Y * 2 },
    ],
  }));

  const sheetB = useAnimatedStyle(() => ({
    transform: [
      { translateX: width * DRIFT_B_X - driftB.value * width * DRIFT_B_X * 2 },
      { translateY: -height * DRIFT_B_Y + driftB.value * height * DRIFT_B_Y * 2 },
    ],
  }));

  /* ---------------------------------------------------------- the fade -- */

  /**
   * The field being left behind, kept rendered underneath the one arriving.
   *
   * It is never cleared. The first version removed it on a `setTimeout` after
   * the fade, which is a `setState` on a timer - a write that can land after
   * the screen has gone. The outgoing field simply stays underneath, covered by
   * an opaque gradient, until the next change replaces it.
   */
  const [under, setUnder] = useState<SkyFieldColors>(colors);
  const previous = useRef(colors);
  const over = useSharedValue(1);

  useEffect(() => {
    if (previous.current.join() === colors.join()) {
      return;
    }

    setUnder(previous.current);
    previous.current = colors;

    over.value = 0;
    over.value = motionAllowed
      ? withTiming(1, { duration: FIELD_FADE_MS, easing: Easing.out(Easing.quad) })
      : 1;
  }, [colors, over, motionAllowed]);

  const overStyle = useAnimatedStyle(() => ({ opacity: over.value }));

  /* --------------------------------------------------------- the bloom -- */

  const bloom = useSharedValue(0);
  const firstBloom = useRef(true);

  useEffect(() => {
    // The mount is not an event. Without this the screen flares every time it
    // is opened, which would make the one celebratory moment meaningless.
    if (firstBloom.current) {
      firstBloom.current = false;

      return;
    }

    if (!motionAllowed) {
      // The haptic still fires - that is touch, not movement - and the field
      // has already changed to the new day. The flare is the only part that
      // goes.
      return;
    }

    bloom.value = withSequence(
      withTiming(1, { duration: BLOOM_MS * 0.35, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: BLOOM_MS * 0.65, easing: Easing.in(Easing.quad) })
    );
  }, [bloomKey, bloom, motionAllowed]);

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloom.value,
    transform: [{ scale: 0.6 + bloom.value * 0.8 }],
  }));

  return (
    <View style={styles.root} testID={testID}>
      <LinearGradient colors={[...under]} style={StyleSheet.absoluteFill} />

      <Animated.View style={[StyleSheet.absoluteFill, overStyle]}>
        <LinearGradient colors={[...colors]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Decoration, and hidden from assistive technology outright: a screen
          reader announcing two unnamed views between the heading and the day
          number would be reading out the weather. */}
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.sheet, sheet, inset, sheetA]}>
        <LinearGradient
          colors={['transparent', driftColor, 'transparent']}
          // A band rather than the whole axis. This is the lever that actually
          // moved the measurement: widening the travel barely helped, because
          // what a point on screen sees is the *slope* of the ramp passing
          // over it, and a ramp stretched across the whole sheet has almost
          // none. Narrowing it doubles the slope and leaves the peak alpha
          // alone, so it costs nothing in contrast.
          locations={[0.26, 0.5, 0.74]}
          // Mostly across rather than corner to corner, and tilted the same
          // way this sheet travels, so the movement runs along the ramp
          // instead of partly across it.
          start={{ x: 0, y: 0.05 }}
          end={{ x: 1, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.sheet, sheet, inset, sheetB]}>
        <LinearGradient
          colors={['transparent', driftColor, 'transparent']}
          locations={[0.3, 0.5, 0.7]}
          // The other way, and steeper, so the two sheets cross rather than
          // travelling as one.
          start={{ x: 1, y: 0.1 }}
          end={{ x: 0.05, y: 0.85 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[
          styles.bloom,
          {
            width: width * 1.4,
            height: width * 1.4,
            borderRadius: width * 0.7,
            marginLeft: -width * 0.7,
            marginTop: -width * 0.7,
            backgroundColor: bloomColor,
          },
          bloomStyle,
        ]}
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
  },
  bloom: {
    position: 'absolute',
    left: '50%',
    top: '42%',
  },
});
