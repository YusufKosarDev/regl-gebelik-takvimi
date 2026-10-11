/**
 * The native pieces the sky is drawn with, stood in for under Jest.
 *
 * Three libraries arrived with the home screen redesign and none of them has a
 * JavaScript implementation to run in Node:
 *
 *   - **reanimated** drives the drift, the field fade and the bloom. Its own
 *     `mock.js` turns every animation into an immediate value, which is the
 *     right behaviour for a test: an assertion should see the end state rather
 *     than wait twenty seconds for a drift to come round.
 *   - **expo-haptics** is a call into the vibrator. There is nothing to assert
 *     about the feel of it, only that it was asked for, so it is a `jest.fn`.
 *   - **expo-linear-gradient** is a native view. Rendered as a plain `View` it
 *     keeps its children in the tree, which is what every screen test needs -
 *     the hero renders *inside* the field, so a gradient that dropped its
 *     children would empty the home screen.
 *
 * In `setupFiles` rather than `setupFilesAfterEach`, because a module mock has
 * to be in place before the first import of the module under test.
 */

jest.mock('react-native-reanimated', () => require('./reanimated-mock'));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');

  return { LinearGradient: View };
});

/**
 * The gesture wrapper, rendered as a plain view.
 *
 * `GestureDetector` reaches into reanimated internals (`useEvent`, `useHandler`)
 * that the stand-in beside this file deliberately does not provide, and
 * following them would mean reimplementing half of reanimated to render a
 * `View`. A drag cannot be performed in jsdom in any case.
 *
 * So the arithmetic that turns a finger position into a cycle day was taken out
 * of the component and is tested on its own - see `arc-day-at.ts` and its test.
 * What is lost here is only "does a real drag fire", which is an emulator
 * question.
 */
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  const { View } = require('react-native');

  return {
    ...actual,
    GestureHandlerRootView: View,
    GestureDetector: ({ children }) => children,
  };
});
