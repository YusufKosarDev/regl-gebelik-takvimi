import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CANCEL_LABEL } from '@/shared/presentation/app-messages';

import {
  EMAIL_LABEL,
  EMAIL_PLACEHOLDER,
  FORGOT_PASSWORD_LABEL,
  PASSWORD_HINT,
  PASSWORD_LABEL,
  PASSWORD_RESET_DESCRIPTION,
  PASSWORD_RESET_SEND_LABEL,
  SENDING_LABEL,
  SIGN_IN_LABEL,
  SIGN_UP_LABEL,
} from '../presentation/auth-messages';

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

  return (
      <View style={styles.fields}>
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            {EMAIL_LABEL}
          </ThemedText>

          <TextInput
            accessibilityLabel={EMAIL_LABEL}
            value={email}
            onChangeText={(next) => {
              onEmailChange(next);
            }}
            editable={!isBusy}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder={EMAIL_PLACEHOLDER}
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
              {PASSWORD_LABEL}
            </ThemedText>

            <TextInput
              accessibilityLabel={PASSWORD_LABEL}
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
              placeholder={PASSWORD_HINT}
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
            {PASSWORD_RESET_DESCRIPTION}
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
              accessibilityLabel={PASSWORD_RESET_SEND_LABEL}
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
                {isBusy ? SENDING_LABEL : PASSWORD_RESET_SEND_LABEL}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={CANCEL_LABEL}
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={onCancelReset}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.backgroundSelected },
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{CANCEL_LABEL}</ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={SIGN_IN_LABEL}
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
                {isBusy ? SENDING_LABEL : SIGN_IN_LABEL}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={SIGN_UP_LABEL}
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={onSignUp}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.backgroundSelected },
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{SIGN_UP_LABEL}</ThemedText>
            </Pressable>

            {/* Last, and quiet: it is the way out of a form that did
                not work, not one of the two things to do here. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={FORGOT_PASSWORD_LABEL}
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={onStartReset}
              style={({ pressed }) => [
                styles.linkButton,
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="small" themeColor="textSecondary">
                {FORGOT_PASSWORD_LABEL}
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
