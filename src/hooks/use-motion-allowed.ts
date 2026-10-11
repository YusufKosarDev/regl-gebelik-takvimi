import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

/**
 * Whether this screen may move.
 *
 * ## Why this is a requirement and not a preference
 *
 * The home screen's field drifts continuously. For somebody with vestibular
 * sensitivity a background that never stops moving is not a flourish they can
 * ignore - it can make the screen unusable, and the symptoms (nausea,
 * disorientation) arrive whether or not they were looking at the thing that
 * moved. Android has a system setting for exactly this, and an app that ignores
 * it is telling that person the app is not for them.
 *
 * On a period tracker that is not a small group to write off.
 *
 * So: `Settings -> Accessibility -> Remove animations` stops the drift, holds
 * the field still, and makes every transition instant. Nothing is lost except
 * the motion - the day, the phase, the colour and the words are all still
 * there, and the haptic on a logged period still fires, because that is touch
 * rather than movement.
 *
 * ## And it stops in the background
 *
 * Free, and it costs a person nothing to have an animation they cannot see
 * stop running. This is deliberately **not** "pause when nobody is touching
 * the screen": somebody can be reading a screen they are not touching, and a
 * field that froze while being looked at would be a bug rather than a saving.
 *
 * ## Why a hook and not a context
 *
 * One screen moves. A provider would be a second thing to wire into the tree
 * for a value with one reader.
 */
export function useMotionAllowed(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isForeground, setIsForeground] = useState(
    () => AppState.currentState === 'active'
  );

  useEffect(() => {
    let active = true;

    // The initial read is asynchronous, so the first frames may drift before
    // the answer arrives. Starting still instead would mean every screen that
    // may move begins frozen and then lurches, which is worse for the same
    // person this is for.
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => {
        // An unreadable setting is not a reason to stop: the field drifting is
        // the documented behaviour, and this is the fallback either way.
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (active) {
          setReduceMotion(enabled);
        }
      }
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      setIsForeground(next === 'active');
    });

    return () => subscription.remove();
  }, []);

  return !reduceMotion && isForeground;
}
