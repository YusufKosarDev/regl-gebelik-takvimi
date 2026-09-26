import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { removeAppLock } from '@/features/app-lock/application/remove-app-lock';
import { setAppLock } from '@/features/app-lock/application/set-app-lock';
import { PinDots } from '@/features/app-lock/components/pin-dots';
import { PinPad } from '@/features/app-lock/components/pin-pad';
import { PIN_LENGTH } from '@/features/app-lock/domain/pin';
import { canUseBiometrics } from '@/features/app-lock/infrastructure/biometrics';
import {
  BIOMETRIC_TOGGLE_LABEL,
  BIOMETRIC_TOGGLE_NOTE,
  BIOMETRIC_UNAVAILABLE_NOTE,
  CHANGE_PIN_LABEL,
  NO_ACCOUNT_BODY,
  NO_ACCOUNT_CONTINUE_LABEL,
  NO_ACCOUNT_CREATE_LABEL,
  NO_ACCOUNT_SUGGESTION,
  NO_ACCOUNT_TITLE,
  REMOVE_LOCK_CONFIRM_LABEL,
  REMOVE_LOCK_CONSEQUENCE,
  REMOVE_LOCK_LABEL,
  REMOVE_LOCK_QUESTION,
  SETUP_CHOOSE_PIN,
  SETUP_CONFIRM_PIN,
  SETUP_DESCRIPTION,
  SETUP_DIFFERENT_PIN_HINT,
  SETUP_HONESTY_NOTE,
  SETUP_MISMATCH_MESSAGE,
  SETUP_SAVE_FAILED_MESSAGE,
  SETUP_SCREENSHOT_NOTE,
  SETUP_TITLE,
  SETUP_WIDGET_NOTE,
  SETUP_WRITE_IT_DOWN_NOTE,
} from '@/features/app-lock/presentation/app-lock-messages';
import { currentUidOrNull } from '@/features/sync/application/use-automatic-sync';
import { useTheme } from '@/hooks/use-theme';
import { logEvent } from '@/shared/logging';
import { BACK_LABEL } from '@/shared/presentation/app-messages';
import { useAppLockStore } from '@/store/app-lock-store';

/**
 * Setting, changing and removing the lock.
 *
 * Its own screen rather than a row in settings: it is a flow with a warning, a
 * confirmation step and a consequence to read, and settings is already a long
 * screen.
 *
 * ## The order of the steps is the design
 *
 * The account warning comes **before** the PIN is chosen, not after. Somebody
 * who has already picked and confirmed six digits has invested in the decision,
 * and a warning at that point is something to get past rather than something to
 * weigh.
 */

type Step = 'warning' | 'choose' | 'confirm' | 'remove';

/** Blanking the task switcher costs screenshots below Android 13. */
const BLOCKS_SCREENSHOTS = Platform.OS === 'android' && Number(Platform.Version) < 33;

export default function AppLockScreen() {
  const router = useRouter();
  const theme = useTheme();

  const enabled = useAppLockStore((state) => state.enabled);
  const markEnabled = useAppLockStore((state) => state.markEnabled);
  const markDisabled = useAppLockStore((state) => state.markDisabled);

  /**
   * Read once, at the first render.
   *
   * Not in an effect: the React Compiler forbids a synchronous `setState`
   * there, and there is nothing to wait for — `currentUidOrNull` is a getter
   * over the session already in memory. The warning is about the state
   * somebody is in when they decide, and the only way to change it is to leave
   * this screen.
   */
  const [uid] = useState<string | null>(() => currentUidOrNull());
  const [step, setStep] = useState<Step>(() =>
    enabled ? 'remove' : currentUidOrNull() === null ? 'warning' : 'choose'
  );
  const [first, setFirst] = useState('');
  const [entered, setEntered] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Whether this phone has a fingerprint or face enrolled.
   *
   * `null` while it is still being asked, so the row is not drawn as
   * unavailable for the moment before the answer lands and then flipped.
   */
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean | null>(null);

  /**
   * Defaulted on, because that is what somebody setting a lock on a phone with
   * a fingerprint expects - and it is a switch they can see, not a decision
   * made behind their back. The PIN always works regardless.
   */
  const [useBiometrics, setUseBiometrics] = useState(true);

  useEffect(() => {
    let active = true;

    void canUseBiometrics().then((available) => {
      if (active) {
        setBiometricsAvailable(available);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const finish = useCallback(
    async (pin: string) => {
      setIsSaving(true);

      try {
        await setAppLock({
          pin,
          boundUid: uid,
          biometricsEnabled: biometricsAvailable === true && useBiometrics,
        });

        markEnabled();
        router.back();
      } catch (error: unknown) {
        logEvent('app lock save failed', error);

        setMessage(SETUP_SAVE_FAILED_MESSAGE);
        setStep('choose');
        setFirst('');
      } finally {
        setEntered('');
        setIsSaving(false);
      }
    },
    [biometricsAvailable, markEnabled, router, uid, useBiometrics]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      setMessage(null);

      setEntered((current) => {
        if (current.length >= PIN_LENGTH) {
          return current;
        }

        const next = current + digit;

        if (next.length < PIN_LENGTH) {
          return next;
        }

        if (step === 'choose') {
          setFirst(next);
          setStep('confirm');

          return '';
        }

        if (next === first) {
          void finish(next);

          return next;
        }

        // Back to the start rather than asking again: somebody who mistyped
        // the second one does not know which of the two was wrong.
        setMessage(SETUP_MISMATCH_MESSAGE);
        setFirst('');
        setStep('choose');

        return '';
      });
    },
    [finish, first, step]
  );

  const handleDelete = useCallback(() => {
    setMessage(null);
    setEntered((current) => current.slice(0, -1));
  }, []);

  const handleRemove = useCallback(async () => {
    setIsSaving(true);

    try {
      await removeAppLock();
      markDisabled();
      router.back();
    } catch (error: unknown) {
      logEvent('app lock save failed', error);
      setMessage(SETUP_SAVE_FAILED_MESSAGE);
    } finally {
      setIsSaving(false);
    }
  }, [markDisabled, router]);

  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={BACK_LABEL}
      onPress={() => router.back()}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <ThemedText type="small" themeColor="textSecondary">
        {BACK_LABEL}
      </ThemedText>
    </Pressable>
  );

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {backButton}

            <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
              {SETUP_TITLE}
            </ThemedText>

            {step === 'warning' && (
              <View style={styles.section}>
                <ThemedText accessibilityRole="header" type="smallBold">
                  {NO_ACCOUNT_TITLE}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  {NO_ACCOUNT_BODY}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  {NO_ACCOUNT_SUGGESTION}
                </ThemedText>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={NO_ACCOUNT_CREATE_LABEL}
                  onPress={() => router.push('/(app)/account')}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.primary },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                    {NO_ACCOUNT_CREATE_LABEL}
                  </ThemedText>
                </Pressable>

                {/* Plain, not warning-coloured. Going without an account is a
                    legitimate choice, and styling it as a mistake is
                    condescending to somebody who has just read why. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={NO_ACCOUNT_CONTINUE_LABEL}
                  onPress={() => setStep('choose')}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {NO_ACCOUNT_CONTINUE_LABEL}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {(step === 'choose' || step === 'confirm') && (
              <View style={styles.section}>
                <ThemedText type="small" themeColor="textSecondary">
                  {SETUP_DESCRIPTION}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                  {SETUP_HONESTY_NOTE}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                  {SETUP_WIDGET_NOTE}
                </ThemedText>

                {BLOCKS_SCREENSHOTS && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                    {SETUP_SCREENSHOT_NOTE}
                  </ThemedText>
                )}

                {uid === null && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                    {SETUP_WRITE_IT_DOWN_NOTE}
                  </ThemedText>
                )}

                <ThemedText type="small" themeColor="textSecondary">
                  {SETUP_DIFFERENT_PIN_HINT}
                </ThemedText>

                {/* Shown only once the answer is in, so the row does not
                    appear as unavailable and then flip. */}
                {biometricsAvailable === true && (
                  <View style={styles.toggleBlock}>
                    <View style={[styles.toggleRow, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText style={styles.toggleLabel}>{BIOMETRIC_TOGGLE_LABEL}</ThemedText>

                      <Switch
                        trackColor={{
                          false: theme.backgroundSelected,
                          true: theme.switchTrackOn,
                        }}
                        thumbColor={useBiometrics ? theme.switchThumbOn : undefined}
                        accessibilityLabel={BIOMETRIC_TOGGLE_LABEL}
                        accessibilityState={{ checked: useBiometrics }}
                        value={useBiometrics}
                        onValueChange={setUseBiometrics}
                      />
                    </View>

                    <ThemedText type="small" themeColor="textSecondary">
                      {BIOMETRIC_TOGGLE_NOTE}
                    </ThemedText>
                  </View>
                )}

                {biometricsAvailable === false && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {BIOMETRIC_UNAVAILABLE_NOTE}
                  </ThemedText>
                )}

                <ThemedText accessibilityRole="header" type="smallBold" style={styles.stepTitle}>
                  {step === 'choose' ? SETUP_CHOOSE_PIN : SETUP_CONFIRM_PIN}
                </ThemedText>

                <PinDots entered={entered.length} />

                {message !== null && (
                  <ThemedText
                    accessibilityRole="alert"
                    type="small"
                    themeColor="textSecondary"
                    style={styles.stepTitle}>
                    {message}
                  </ThemedText>
                )}

                <PinPad onDigit={handleDigit} onDelete={handleDelete} disabled={isSaving} />
              </View>
            )}

            {step === 'remove' && (
              <View style={styles.section}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={CHANGE_PIN_LABEL}
                  onPress={() => {
                    setFirst('');
                    setEntered('');
                    setStep('choose');
                  }}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">{CHANGE_PIN_LABEL}</ThemedText>
                </Pressable>

                <ThemedText accessibilityRole="header" type="smallBold">
                  {REMOVE_LOCK_QUESTION}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  {REMOVE_LOCK_CONSEQUENCE}
                </ThemedText>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={REMOVE_LOCK_LABEL}
                  accessibilityState={{ disabled: isSaving }}
                  disabled={isSaving}
                  onPress={() => {
                    void handleRemove();
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.primary },
                    isSaving && styles.disabled,
                    pressed && !isSaving && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                    {REMOVE_LOCK_CONFIRM_LABEL}
                  </ThemedText>
                </Pressable>

                {message !== null && (
                  <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                    {message}
                  </ThemedText>
                )}
              </View>
            )}
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingVertical: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  title: {
    marginBottom: Spacing.one,
  },
  section: {
    gap: Spacing.three,
  },
  note: {
    lineHeight: 20,
  },
  toggleBlock: {
    gap: Spacing.two,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 56,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  toggleLabel: {
    flexShrink: 1,
  },
  stepTitle: {
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
