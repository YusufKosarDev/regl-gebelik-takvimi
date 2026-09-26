import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  isAppLockRecoverable,
  remainingLockWaitMs,
} from '@/features/app-lock/application/remove-app-lock';
import { unlockWithBiometrics } from '@/features/app-lock/application/unlock-with-biometrics';
import { unlockWithPin } from '@/features/app-lock/application/unlock-with-pin';
import { PinDots } from '@/features/app-lock/components/pin-dots';
import { PinPad } from '@/features/app-lock/components/pin-pad';
import { attemptsBeforeWait } from '@/features/app-lock/domain/attempt-policy';
import { PIN_LENGTH } from '@/features/app-lock/domain/pin';
import {
  BIOMETRIC_FAILED_MESSAGE,
  LOCK_BIOMETRIC_RETRY_LABEL,
  LOCK_FORGOT_LABEL,
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
  const router = useRouter();
  const theme = useTheme();
  const unlock = useAppLockStore((state) => state.unlock);

  const [entered, setEntered] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [remainingWaitMs, setRemainingWaitMs] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [canRetryBiometrics, setCanRetryBiometrics] = useState(false);

  /**
   * Whether this lock can be reset with an account password.
   *
   * `null` until the record has been read, so the link is not drawn and then
   * withdrawn. It is never shown for a lock set without an account: offering a
   * route and then refusing it is worse than not offering one.
   */
  const [recoverable, setRecoverable] = useState<boolean | null>(null);

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

  /**
   * Tries a fingerprint.
   *
   * `unlockWithBiometrics` owns the guard that stops the prompt's own
   * background transition re-locking the screen underneath it.
   */
  const tryBiometrics = useCallback(async () => {
    const outcome = await unlockWithBiometrics();

    if (outcome.kind === 'unlocked') {
      unlock();

      return;
    }

    if (outcome.kind === 'waiting') {
      setRemainingWaitMs(outcome.remainingMs);
      setMessage(waitMessage(outcome.remainingMs));

      return;
    }

    // Tapping "PIN'i kullan" is a decision, not a failure. The retry button
    // comes back, and nothing is said: "Tanınamadı" after somebody chose the
    // pad would be the app reporting an event that did not happen.
    if (outcome.kind === 'cancelled') {
      setCanRetryBiometrics(true);

      return;
    }

    if (outcome.kind === 'failed') {
      // A wet thumb is not a wrong PIN and does not cost an attempt. The
      // button stays so somebody can try again without leaving the screen.
      setCanRetryBiometrics(true);
      setMessage(BIOMETRIC_FAILED_MESSAGE);
    }
  }, [unlock]);

  /**
   * Once, on arrival.
   *
   * Somebody who dismisses it gets the pad and a button; the prompt is not
   * reopened on its own, which would be a sheet that will not go away.
   *
   * The work is an async closure rather than a call in the effect body, which
   * is the shape the rest of this app already uses for an effect that reaches
   * a platform and then reports back: nothing is set synchronously, and a
   * screen that has gone away by the time the sheet is answered sets nothing
   * at all.
   */
  useEffect(() => {
    let active = true;

    void isAppLockRecoverable().then((value) => {
      if (active) {
        setRecoverable(value);
      }
    });

    // A wait that survived a restart is shown on arrival rather than after six
    // digits. The counters were already refusing; this is so nobody has to
    // spend a PIN to find that out.
    void remainingLockWaitMs().then((remaining) => {
      if (active && remaining > 0) {
        setRemainingWaitMs(remaining);
        setMessage(waitMessage(remaining));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      const outcome = await unlockWithBiometrics();

      if (!active) {
        return;
      }

      if (outcome.kind === 'unlocked') {
        unlock();

        return;
      }

      if (outcome.kind === 'waiting') {
        setRemainingWaitMs(outcome.remainingMs);
        setMessage(waitMessage(outcome.remainingMs));

        return;
      }

      // Same as above: dismissing the sheet on arrival is how somebody says
      // they would rather type it. That deserves the button back and no words.
      if (outcome.kind === 'cancelled') {
        setCanRetryBiometrics(true);

        return;
      }

      if (outcome.kind === 'failed') {
        setCanRetryBiometrics(true);
        setMessage(BIOMETRIC_FAILED_MESSAGE);
      }
    })();

    return () => {
      active = false;
    };
  }, [unlock]);

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

          <View style={styles.bottom}>
            <PinPad
              onDigit={handleDigit}
              onDelete={handleDelete}
              disabled={isWaiting || isChecking}
            />

            {canRetryBiometrics && !isWaiting && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={LOCK_BIOMETRIC_RETRY_LABEL}
                onPress={() => {
                  void tryBiometrics();
                }}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  {LOCK_BIOMETRIC_RETRY_LABEL}
                </ThemedText>
              </Pressable>
            )}

            {/* Available at every stage, including partway through a wait: a
                delay must never trap somebody out of their own records. */}
            {recoverable === true && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={LOCK_FORGOT_LABEL}
                onPress={() => router.push('/(lock)/recover')}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {LOCK_FORGOT_LABEL}
                </ThemedText>
              </Pressable>
            )}
          </View>
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
  bottom: {
    gap: Spacing.four,
  },
  retryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
