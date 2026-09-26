import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { unlockWithPin } from '@/features/app-lock/application/unlock-with-pin';
import { PinDots } from '@/features/app-lock/components/pin-dots';
import { PinPad } from '@/features/app-lock/components/pin-pad';
import { attemptsBeforeWait } from '@/features/app-lock/domain/attempt-policy';
import { PIN_LENGTH } from '@/features/app-lock/domain/pin';
import {
  LOCK_PROMPT,
  LOCK_WRONG_PIN_MESSAGE,
  remainingAttemptsMessage,
} from '@/features/app-lock/presentation/app-lock-messages';
import { waitMessage } from '@/features/app-lock/presentation/wait-message';
import { useAppLockStore } from '@/store/app-lock-store';

/**
 * The way in.
 *
 * Shows the app's name, a prompt, six dots and a pad. Nothing else — no date,
 * no cycle day, no avatar. A lock screen that told you which day of the cycle
 * it was would be answering the question it exists to refuse.
 *
 * The PIN lives in this component's state for as long as it takes to check it
 * and is cleared immediately afterwards, on the wrong answer as well as the
 * right one. It is never put in the store, never logged and never passed to
 * anything but `unlockWithPin`.
 */
export default function LockScreen() {
  const unlock = useAppLockStore((state) => state.unlock);

  const [entered, setEntered] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [remainingWaitMs, setRemainingWaitMs] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  // Guards the window between the sixth digit and the answer coming back, so a
  // fast tap cannot start a second check against the same counters.
  const checking = useRef(false);

  const isWaiting = remainingWaitMs > 0;

  /**
   * Counts the wait down.
   *
   * A second at a time rather than by recomputing on render: the screen is
   * otherwise static, and a person watching a wait wants to see it move.
   */
  useEffect(() => {
    if (remainingWaitMs <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setRemainingWaitMs((current) => {
        const next = Math.max(0, current - 1000);

        // The one place that knows the wait just ended, so the one place that
        // can take the sentence about it off the screen.
        if (next === 0) {
          setMessage(null);
        }

        return next;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [remainingWaitMs]);

  const submit = useCallback(
    async (pin: string) => {
      if (checking.current) {
        return;
      }

      checking.current = true;
      setIsChecking(true);

      try {
        const outcome = await unlockWithPin(pin);

        if (outcome.kind === 'unlocked' || outcome.kind === 'no-lock') {
          // `no-lock` reaches here when the record went while this screen was
          // up — a wipe from another surface, or a failed read. There is
          // nothing left to ask for, so it opens.
          unlock();

          return;
        }

        if (outcome.kind === 'unreadable') {
          unlock();

          return;
        }

        if (outcome.kind === 'waiting') {
          setRemainingWaitMs(outcome.remainingMs);
          setMessage(waitMessage(outcome.remainingMs));

          return;
        }

        const left = attemptsBeforeWait(outcome.attempts);

        // Only as they run out. Five left before any are used is noise.
        setMessage(
          left !== null && left <= 2
            ? `${LOCK_WRONG_PIN_MESSAGE} ${remainingAttemptsMessage(left)}`
            : LOCK_WRONG_PIN_MESSAGE
        );

        if (outcome.attempts.lockedUntil !== null) {
          const remaining = Math.max(0, outcome.attempts.lockedUntil - Date.now());

          setRemainingWaitMs(remaining);
          setMessage(waitMessage(remaining));
        }
      } finally {
        // Cleared on every path. What somebody typed does not sit in memory
        // waiting for the next render.
        setEntered('');
        checking.current = false;
        setIsChecking(false);
      }
    },
    [unlock]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      setMessage(null);

      setEntered((current) => {
        if (current.length >= PIN_LENGTH) {
          return current;
        }

        const next = current + digit;

        if (next.length === PIN_LENGTH) {
          void submit(next);
        }

        return next;
      });
    },
    [submit]
  );

  const handleDelete = useCallback(() => {
    setMessage(null);
    setEntered((current) => current.slice(0, -1));
  }, []);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.top}>
            <ThemedText accessibilityRole="header" type="subtitle" style={styles.prompt}>
              {LOCK_PROMPT}
            </ThemedText>

            <PinDots entered={entered.length} />

            {message !== null && (
              <ThemedText
                accessibilityRole="alert"
                type="small"
                themeColor="textSecondary"
                style={styles.message}>
                {message}
              </ThemedText>
            )}
          </View>

          <PinPad
            onDigit={handleDigit}
            onDelete={handleDelete}
            disabled={isWaiting || isChecking}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.five,
  },
  top: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  prompt: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
});
