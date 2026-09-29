import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';
import { appMessages } from '@/shared/presentation/app-messages';


import { authMessages } from '../presentation/auth-messages';

/**
 * The form somebody signs in, signs up or asks for a reset link with.
 *
 * Lifted out of the account screen unchanged, including the order of the
 * three buttons and the fact that the password field disappears while a reset
 * is being asked for - a reset link is sent to an address, and asking for a
 * password to request one would be asking for the thing that was forgotten.
 *
 * It holds neither the field values nor the busy flag. Both belong to the
 * screen, which is also where the single in-flight guard lives that keeps
 * signing in, backing up, syncing and deleting from overlapping.
 *
 * The two change handlers are one callback each rather than a setter plus two
 * notice-clearers. Typing in either field clears both the auth notice and the
 * deletion notice, and which notices exist is the screen's business, not this
 * form's.
 *
 * Nothing here imports the auth repository. The screen passes what to do; this
 * decides only when to say it was asked for.
 */
export function SignedOutForm({
  email,
  password,
  notice,
  isBusy,
  isResetting,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onSignUp,
  onSendReset,
  onStartReset,
  onCancelReset,
}: {
  readonly email: string;
  readonly password: string;
  readonly notice: string | null;
  readonly isBusy: boolean;
  readonly isResetting: boolean;
  readonly onEmailChange: (next: string) => void;
  readonly onPasswordChange: (next: string) => void;
  readonly onSignIn: () => void;
  readonly onSignUp: () => void;
  readonly onSendReset: () => void;
  readonly onStartReset: () => void;
  readonly onCancelReset: () => void;
}) {
  const theme = useTheme();
  const authStrings = useMessages(authMessages);
  const common = useMessages(appMessages);

  return (
      <View style={styles.fields}>
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            {authStrings.emailLabel}
          </ThemedText>

          <TextInput
            accessibilityLabel={authStrings.emailLabel}
            value={email}
            onChangeText={(next) => {
              onEmailChange(next);
            }}
            editable={!isBusy}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder={authStrings.emailPlaceholder}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { borderColor: theme.backgroundSelected, color: theme.text },
            ]}
          />
        </View>

        {!isResetting && (
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              {authStrings.passwordLabel}
            </ThemedText>

            <TextInput
              accessibilityLabel={authStrings.passwordLabel}
              value={password}
              onChangeText={(next) => {
                onPasswordChange(next);
              }}
              editable={!isBusy}
              autoCapitalize="none"
              autoCorrect={false}
              // The field is masked and kept out of the keyboard's own
              // learning, which is where a typed password otherwise
              // ends up being remembered.
              secureTextEntry
              textContentType="password"
              placeholder={authStrings.passwordHint}
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { borderColor: theme.backgroundSelected, color: theme.text },
              ]}
            />
          </View>
        )}

        {isResetting && (
          <ThemedText type="small" themeColor="textSecondary">
            {authStrings.passwordResetDescription}
          </ThemedText>
        )}

        {notice !== null && (
          <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
            {notice}
          </ThemedText>
        )}

        {isResetting ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={authStrings.passwordResetSendLabel}
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={onSendReset}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {isBusy ? authStrings.sendingLabel : authStrings.passwordResetSendLabel}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={common.cancelLabel}
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={onCancelReset}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.backgroundSelected },
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{common.cancelLabel}</ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={authStrings.signInLabel}
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={onSignIn}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {isBusy ? authStrings.sendingLabel : authStrings.signInLabel}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={authStrings.signUpLabel}
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={onSignUp}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.backgroundSelected },
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{authStrings.signUpLabel}</ThemedText>
            </Pressable>

            {/* Last, and quiet: it is the way out of a form that did
                not work, not one of the two things to do here. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={authStrings.forgotPasswordLabel}
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={onStartReset}
              style={({ pressed }) => [
                styles.linkButton,
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="small" themeColor="textSecondary">
                {authStrings.forgotPasswordLabel}
              </ThemedText>
            </Pressable>
          </>
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.half,
  },
  input: {
    minHeight: 52,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
