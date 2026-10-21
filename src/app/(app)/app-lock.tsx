import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ButtonLabel, ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { removeAppLock } from '@/features/app-lock/application/remove-app-lock';
import { setAppLock } from '@/features/app-lock/application/set-app-lock';
import { unlockWithPin } from '@/features/app-lock/application/unlock-with-pin';
import { PinDots } from '@/features/app-lock/components/pin-dots';
import { PinPad } from '@/features/app-lock/components/pin-pad';
import { PIN_LENGTH, isEasilyGuessedPin } from '@/features/app-lock/domain/pin';
import { canUseBiometrics } from '@/features/app-lock/infrastructure/biometrics';
import { blocksScreenshots } from '@/features/app-lock/infrastructure/screen-privacy';
import { appLockMessages } from '@/features/app-lock/presentation/app-lock-messages';
import { waitMessageIn } from '@/features/app-lock/presentation/wait-message';
import { setDiscreetNotifications } from '@/features/notifications/application/set-discreet-notifications';
import { currentUidOrNull } from '@/features/sync/application/use-automatic-sync';
import { openAppDatabase } from '@/storage/db';
import { getTodayLocalISODate } from '@/utils/today';
import { useTheme } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';
import { logEvent } from '@/shared/logging';
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
 *
 * ## Removing or changing the lock proves the current PIN first
 *
 * The lock's whole point is that holding the phone is not enough, and a
 * management step that removed it on one tap said otherwise. The check goes
 * through `unlockWithPin` on purpose: the same counters and the same waits as
 * the lock screen, so guessing here is no cheaper than guessing there.
 */

type Step = 'warning' | 'verify' | 'choose' | 'confirm' | 'remove';

/** What the verify step was opened for. */
type VerifiedAction = 'change' | 'remove';

/** Blanking the task switcher costs screenshots below Android 13. */
/** Asked of the native side rather than inferred from Platform.Version. */
const BLOCKS_SCREENSHOTS = blocksScreenshots();

export default function AppLockScreen() {
  const router = useRouter();
  const theme = useTheme();
  const lock = useMessages(appLockMessages);

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
  const [verifiedAction, setVerifiedAction] = useState<VerifiedAction>('remove');

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

  /**
   * Guards the window between the sixth digit and the answer coming back.
   *
   * The pad is drawn disabled while `isSaving`, but that only takes effect on
   * the next render — so two presses close enough together both reach a
   * handler. For `finish` that is a lock written twice; for `verify` it is a
   * wrong PIN counted twice, which halves the free attempts
   * (`unlockWithPin` writes `afterWrongPin` to the record before it answers).
   *
   * A ref rather than state, because it has to be true *now*, in the same turn
   * the second press would run in. The lock screen carries the same guard for
   * the same reason; this screen was the one without it.
   */
  const inFlight = useRef(false);

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
      if (inFlight.current) {
        return;
      }

      inFlight.current = true;
      setIsSaving(true);

      try {
        await setAppLock({
          pin,
          boundUid: uid,
          biometricsEnabled: biometricsAvailable === true && useBiometrics,
        });

        // Setting a lock is the same statement this makes: the phone can end up
        // in somebody else's hands. A reminder that then prints "regl dönemin
        // yaklaşıyor" on the lock screen would walk straight past the lock, and
        // Android does not let an app hide it — only reword it. Announced above
        // by lock.setupDiscreetNotificationsNote rather than done quietly.
        //
        // After the lock is saved, and quietly: the lock is what the person
        // asked for and it is already stored. Failing the setup because a
        // reminder queue could not be rebuilt would undo the thing that worked
        // over the thing that did not.
        //
        // Deliberately one-way. Removing the lock leaves this on, because
        // turning it back off would be the app deciding that somebody who
        // stopped using a PIN also stopped caring who reads their lock screen.
        try {
          const db = await openAppDatabase();

          await setDiscreetNotifications(db, true, getTodayLocalISODate());
        } catch (error: unknown) {
          logEvent('notification preference change failed', error);
        }

        markEnabled();
        router.back();
      } catch (error: unknown) {
        logEvent('app lock save failed', error);

        setMessage(lock.setupSaveFailedMessage);
        setStep('choose');
        setFirst('');
      } finally {
        setEntered('');
        setIsSaving(false);
        inFlight.current = false;
      }
    },
    [biometricsAvailable, lock, markEnabled, router, uid, useBiometrics]
  );

  const handleRemove = useCallback(async () => {
    setIsSaving(true);

    try {
      await removeAppLock();
      markDisabled();
      router.back();
    } catch (error: unknown) {
      logEvent('app lock save failed', error);
      setMessage(lock.setupSaveFailedMessage);
    } finally {
      setIsSaving(false);
    }
  }, [lock, markDisabled, router]);

  /**
   * The current PIN, tried against the stored record.
   *
   * `unlockWithPin` rather than a comparison here, for the reason it exists:
   * the counters are written before the answer comes back, so a wrong guess
   * on this screen costs the same wait it costs on the lock screen, and
   * killing the app does not undo it.
   */
  const verify = useCallback(
    async (pin: string) => {
      if (inFlight.current) {
        return;
      }

      inFlight.current = true;
      setIsSaving(true);

      try {
        const outcome = await unlockWithPin(pin);

        if (outcome.kind === 'unlocked') {
          if (verifiedAction === 'remove') {
            await handleRemove();

            return;
          }

          setMessage(null);
          setFirst('');
          setStep('choose');

          return;
        }

        if (outcome.kind === 'waiting') {
          setMessage(waitMessageIn(lock, outcome.remainingMs));

          return;
        }

        if (outcome.kind === 'wrong') {
          setMessage(lock.lockWrongPinMessage);

          return;
        }

        // `no-lock` or `unreadable`: the record is already gone, or has been
        // turned off by the store below. There is nothing left to prove a PIN
        // against, and nothing left to manage.
        markDisabled();
        router.back();
      } catch (error: unknown) {
        logEvent('app lock save failed', error);
        setMessage(lock.setupSaveFailedMessage);
      } finally {
        setEntered('');
        setIsSaving(false);
        inFlight.current = false;
      }
    },
    [handleRemove, lock, markDisabled, router, verifiedAction]
  );

  /**
   * One key press.
   *
   * ## Why none of this is inside the `setEntered` updater
   *
   * It used to be: the branch below ran inside `setEntered((current) => …)`,
   * calling `verify`, `finish`, `setFirst`, `setStep` and `setMessage` from
   * within it. React requires a state updater to be **pure** and is free to
   * run it again — guaranteed under StrictMode, and possible whenever a
   * concurrent render replays a pending update queue. `reactCompiler` is on
   * in `app.json` and leans on that contract too.
   *
   * Replaying this one meant two `unlockWithPin` calls for one wrong PIN,
   * which is two failed attempts counted against a schedule that gives five
   * free ones. So the next value is worked out here, `setEntered` is handed a
   * plain value, and every side effect happens in this body where it belongs.
   *
   * `entered` is therefore a dependency, and has to stay one: read from a
   * stale closure it would build the PIN out of digits from two different
   * presses. The React Compiler does not relax that — the dependency array is
   * still what governs.
   */
  const handleDigit = useCallback(
    (digit: string) => {
      if (entered.length >= PIN_LENGTH) {
        return;
      }

      setMessage(null);

      const next = entered + digit;

      if (next.length < PIN_LENGTH) {
        setEntered(next);

        return;
      }

      if (step === 'verify') {
        setEntered(next);
        void verify(next);

        return;
      }

      if (step === 'choose') {
        setEntered('');
        setFirst(next);
        setStep('confirm');

        return;
      }

      if (next === first) {
        setEntered(next);
        void finish(next);

        return;
      }

      // Back to the start rather than asking again: somebody who mistyped
      // the second one does not know which of the two was wrong.
      setEntered('');
      setMessage(lock.setupMismatchMessage);
      setFirst('');
      setStep('choose');
    },
    [entered, finish, first, lock, step, verify]
  );

  const handleDelete = useCallback(() => {
    setMessage(null);
    setEntered((current) => current.slice(0, -1));
  }, []);

  const backButton = (
    <BackButton />
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
              {lock.setupTitle}
            </ThemedText>

            {step === 'warning' && (
              <View style={styles.section}>
                <ThemedText accessibilityRole="header" type="smallBold">
                  {lock.noAccountTitle}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  {lock.noAccountBody}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  {lock.noAccountSuggestion}
                </ThemedText>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={lock.noAccountCreateLabel}
                  onPress={() => router.push('/(app)/account')}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.primary },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={[ButtonLabel, { color: theme.onPrimary }]}>
                    {lock.noAccountCreateLabel}
                  </ThemedText>
                </Pressable>

                {/* Plain, not warning-coloured. Going without an account is a
                    legitimate choice, and styling it as a mistake is
                    condescending to somebody who has just read why. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={lock.noAccountContinueLabel}
                  onPress={() => setStep('choose')}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <ThemedText type="small" themeColor="textSecondary" style={ButtonLabel}>
                    {lock.noAccountContinueLabel}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {(step === 'choose' || step === 'confirm') && (
              <View style={styles.section}>
                <ThemedText type="small" themeColor="textSecondary">
                  {lock.setupDescription}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                  {lock.setupHonestyNote}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                  {lock.setupWidgetNote}
                </ThemedText>

                {/* Beside the widget note, because it is the same kind of
                    thing: something outside this screen that the lock changes,
                    said before the PIN is chosen rather than discovered
                    afterwards. */}
                <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                  {lock.setupDiscreetNotificationsNote}
                </ThemedText>

                {BLOCKS_SCREENSHOTS && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                    {lock.setupScreenshotNote}
                  </ThemedText>
                )}

                {uid === null && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                    {lock.setupWriteItDownNote}
                  </ThemedText>
                )}

                <ThemedText type="small" themeColor="textSecondary">
                  {lock.setupDifferentPinHint}
                </ThemedText>

                {/* Shown only once the answer is in, so the row does not
                    appear as unavailable and then flip. */}
                {biometricsAvailable === true && (
                  <View style={styles.toggleBlock}>
                    <View style={[styles.toggleRow, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText style={styles.toggleLabel}>{lock.biometricToggleLabel}</ThemedText>

                      <Switch
                        trackColor={{
                          false: theme.backgroundSelected,
                          true: theme.switchTrackOn,
                        }}
                        thumbColor={useBiometrics ? theme.switchThumbOn : undefined}
                        accessibilityLabel={lock.biometricToggleLabel}
                        accessibilityState={{ checked: useBiometrics }}
                        value={useBiometrics}
                        onValueChange={setUseBiometrics}
                      />
                    </View>

                    <ThemedText type="small" themeColor="textSecondary">
                      {lock.biometricToggleNote}
                    </ThemedText>
                  </View>
                )}

                {biometricsAvailable === false && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {lock.biometricUnavailableNote}
                  </ThemedText>
                )}

                <ThemedText accessibilityRole="header" type="smallBold" style={styles.stepTitle}>
                  {step === 'choose' ? lock.setupChoosePin : lock.setupConfirmPin}
                </ThemedText>

                {/* Tied to the chosen PIN rather than the message line, which
                    every digit clears: the warning has to survive the whole
                    confirmation entry. A warning and never a refusal - the
                    choice stays the person's own. */}
                {step === 'confirm' && isEasilyGuessedPin(first) && (
                  <ThemedText
                    accessibilityRole="alert"
                    type="small"
                    themeColor="textSecondary"
                    style={styles.stepTitle}>
                    {lock.setupWeakPinWarning}
                  </ThemedText>
                )}

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

            {step === 'verify' && (
              <View style={styles.section}>
                <ThemedText accessibilityRole="header" type="smallBold" style={styles.stepTitle}>
                  {lock.verifyCurrentPinTitle}
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
                  accessibilityLabel={lock.changePinLabel}
                  onPress={() => {
                    setMessage(null);
                    setFirst('');
                    setEntered('');
                    setVerifiedAction('change');
                    setStep('verify');
                  }}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={ButtonLabel}>{lock.changePinLabel}</ThemedText>
                </Pressable>

                <ThemedText accessibilityRole="header" type="smallBold">
                  {lock.removeLockQuestion}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  {lock.removeLockConsequence}
                </ThemedText>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={lock.removeLockLabel}
                  accessibilityState={{ disabled: isSaving }}
                  disabled={isSaving}
                  onPress={() => {
                    setMessage(null);
                    setEntered('');
                    setVerifiedAction('remove');
                    setStep('verify');
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.primary },
                    isSaving && styles.disabled,
                    pressed && !isSaving && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={[ButtonLabel, { color: theme.onPrimary }]}>
                    {lock.removeLockConfirmLabel}
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
