/**
 * A stand-in for the parts of `expo-router` the screens use.
 *
 * Every screen that reads synced data now re-reads it on focus, so every screen
 * test needs a `useFocusEffect` that behaves like the real one: run on mount,
 * run again on each return, and run the cleanup in between. Four copies of that
 * in four test files would be four chances for them to drift apart.
 *
 * `focusAgain()` acts out leaving the screen and coming back. The listeners live
 * on `globalThis` because a `jest.mock` factory is hoisted and cannot close over
 * anything declared beside it.
 */
const react = require('react');

const listeners = [];

globalThis.__focusListeners = listeners;

/** Re-runs every mounted focus effect, cleanup first, as a real refocus does. */
function focusAgain() {
  for (const listener of [...listeners]) {
    listener();
  }
}

function useFocusEffect(effect) {
  const [focusCount, setFocusCount] = react.useState(0);

  react.useEffect(() => {
    const listener = () => setFocusCount((current) => current + 1);

    listeners.push(listener);

    return () => {
      listeners.splice(listeners.indexOf(listener), 1);
    };
  }, []);

  // `focusCount` in the deps is what makes a refocus tear the previous effect
  // down and set it up again, rather than leaving two subscriptions alive.
  react.useEffect(effect, [effect, focusCount]);
}

module.exports = {
  focusAgain,
  useFocusEffect,
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
};
