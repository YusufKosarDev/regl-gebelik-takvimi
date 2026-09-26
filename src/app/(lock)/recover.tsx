import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { recoverWithAccountPassword } from '@/features/app-lock/application/recover-with-account-password';
import {
  RECOVERY_DESCRIPTION,
  RECOVERY_NEEDS_INTERNET_NOTE,
  RECOVERY_SUBMIT_LABEL,
  RECOVERY_TITLE,
  RECOVERY_WRONG_ACCOUNT_MESSAGE,
} from '@/features/app-lock/presentation/app-lock-messages';
import {
  EMAIL_LABEL,
  EMAIL_PLACEHOLDER,
  EMPTY_EMAIL_MESSAGE,
  EMPTY_PASSWORD_MESSAGE,
  PASSWORD_LABEL,
  authErrorMessage,
} from '@/features/auth/presentation/auth-messages';
import { useTheme } from '@/hooks/use-theme';
import { BACK_LABEL, SAVING_LABEL } from '@/shared/presentation/app-messages';
import { useAppLockStore } from '@/store/app-lock-store';

/**
 * The way back in for somebody who has forgotten the PIN.
 *
 * Reached only from the lock screen, and only when the lock is bound to an
 * account — the button is not shown otherwise, because offering a route and
 * then refusing it is worse than not offering one.
 *
 * The password passes through to `signInWithEmail` and is not kept, exactly as
 * on the account screen. The error wording is the account screen's too: these
 * are the same failures, and inventing a second vocabulary for them would mean
 * two sets of sentences about one thing.
 */
export default function RecoverScreen() {
  const router = useRouter();
  const theme = useTheme();

  const markDisabled = useAppLockStore((state) => state.markDisabled);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const submit = useCallback(async () => {
    if (email.trim() === '') {
      setMessage(EMPTY_EMAIL_MESSAGE);

      return;
    }

    if (password === '') {
      setMessage(EMPTY_PASSWORD_MESSAGE);

      return;
    }

    setIsBusy(true);
    setMessage(null);

    try {
      const outcome = await recoverWithAccountPassword(email, password);

      if (outcome.kind === 'recovered') {
        // Off, not reset. The screen the person lands on offers a new PIN;
        // silently choosing one for them would be choosing one they do not
        // know.
        markDisabled();

        return;
      }

      if (outcome.kind === 'wrong-account') {
        setMessage(RECOVERY_WRONG_ACCOUNT_MESSAGE);

        return;
      }

      if (outcome.kind === 'not-recoverable') {
        router.back();

        return;
      }

      setMessage(authErrorMessage(outcome.code));
    } finally {
      // Cleared whatever happened. A password does not sit in state waiting
      // for the next render.
      setPassword('');
      setIsBusy(false);
    }
  }, [email, markDisabled, password, router]);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={BACK_LABEL}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="textSecondary">
                {BACK_LABEL}
              </ThemedText>
            </Pressable>

            <ThemedText accessibilityRole="header" type="subtitle">
              {RECOVERY_TITLE}
            </ThemedText>

            <ThemedText type="small" themeColor="textSecondary">
              {RECOVERY_DESCRIPTION}
            </ThemedText>

            {/* Said up front rather than as a failure afterwards: there is no
                way to do this offline, and finding that out after typing a
                password is a worse way to learn it. */}
            <ThemedText type="small" themeColor="textSecondary">
              {RECOVERY_NEEDS_INTERNET_NOTE}
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">
                {EMAIL_LABEL}
              </ThemedText>

              <TextInput
                accessibilityLabel={EMAIL_LABEL}
                placeholder={EMAIL_PLACEHOLDER}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!isBusy}
                value={email}
                onChangeText={setEmail}
                style={[
                  styles.input,
                  { borderColor: theme.backgroundSelected, color: theme.text },
                ]}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">
                {PASSWORD_LABEL}
              </ThemedText>

              <TextInput
                accessibilityLabel={PASSWORD_LABEL}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                textContentType="password"
                editable={!isBusy}
                value={password}
                onChangeText={setPassword}
                style={[
                  styles.input,
                  { borderColor: theme.backgroundSelected, color: theme.text },
                ]}
              />
            </View>

            {message !== null && (
              <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                {message}
              </ThemedText>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={RECOVERY_SUBMIT_LABEL}
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={() => {
                void submit();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {isBusy ? SAVING_LABEL : RECOVERY_SUBMIT_LABEL}
              </ThemedText>
            </Pressable>
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
    gap: Spacing.three,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  primaryButton: {
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
