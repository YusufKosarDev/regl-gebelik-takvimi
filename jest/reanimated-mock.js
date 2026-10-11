/**
 * Reanimated, as much of it as the sky uses, standing in under Jest.
 *
 * ## Why not the library's own mock
 *
 * `react-native-reanimated/mock` is the obvious answer and it does not work
 * here. It `require`s the real `react-native-reanimated`, which reaches
 * `react-native-worklets`, which calls into a native module that does not
 * exist in Node - so importing the mock throws
 * `Cannot read properties of undefined (reading 'loadUnpackers')` before a
 * single test runs. Verified by trying it.
 *
 * So this is a hand-written stand-in for the seven things the sky actually
 * touches. It is deliberately not a general-purpose fake: anything else
 * imported from reanimated will be `undefined` and fail loudly, which is the
 * behaviour to want from a mock whose job is to stay honest about its scope.
 *
 * ## Animations resolve instantly, on purpose
 *
 * `withTiming` returns its target rather than animating towards it. A test
 * should see where a thing ends up, not wait twenty seconds for a drift loop,
 * and a test that asserted a half-finished animation would be asserting a
 * frame rate.
 *
 * The consequence worth knowing: these tests prove the sky renders, that it
 * renders the right field for a phase, and that a drag reports the right day.
 * They prove nothing about whether the motion looks right. That is what the
 * emulator screenshots are for.
 */

const React = require('react');
const { View } = require('react-native');

/** A timing/sequence/repeat call just resolves to its destination. */
const toValue = (value) => value;

const Easing = {
  linear: (t) => t,
  ease: (t) => t,
  quad: (t) => t,
  sin: (t) => t,
  in: (fn) => fn,
  out: (fn) => fn,
  inOut: (fn) => fn,
  bezier: () => (t) => t,
};

function useSharedValue(initial) {
  // A ref rather than state: the real one mutates without re-rendering, and a
  // state-backed fake would make every assignment a render and change what the
  // components under test do.
  return React.useRef({ value: initial }).current;
}

function useAnimatedStyle(factory) {
  // Called on every render rather than memoised. The real one re-evaluates its
  // worklet whenever a shared value changes, and the shared values here are
  // refs that mutate without a render - so a memo keyed on a dependency list
  // would hand back a style built from an earlier value, which is the kind of
  // mistake a test is here to catch. There is nothing expensive to save.
  return factory();
}

function useAnimatedReaction() {
  /* nothing to react to when nothing animates */
}

const Animated = {
  View,
  Text: require('react-native').Text,
  ScrollView: require('react-native').ScrollView,
  createAnimatedComponent: (Component) => Component,
};

// The two that say whether anything is moving are spies as well as stubs.
// Reduce-motion is the one behaviour here with no visible consequence under
// Jest - the mock never animates, so a field that forgot to stop looks
// exactly like one that stopped. These let a test see the difference.
const withRepeat = jest.fn(toValue);
const cancelAnimation = jest.fn(() => undefined);

module.exports = {
  __esModule: true,
  default: Animated,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming: toValue,
  withSpring: toValue,
  withRepeat,
  withDelay: (_delay, value) => value,
  withSequence: (...values) => values[values.length - 1],
  cancelAnimation,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  interpolate: (value) => value,
  interpolateColor: (_value, _input, output) => output[0],
};
