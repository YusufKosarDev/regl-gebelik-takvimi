import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  LOCK_BOUND_TO_ACCOUNT_WARNING,
  REMOVE_LOCK_FIRST_LABEL,
} from '@/features/app-lock/presentation/app-lock-messages';

import {
  ACCOUNT_DELETE_BUSY_LABEL,
  ACCOUNT_DELETE_CANCEL_LABEL,
  ACCOUNT_DELETE_CONFIRM_LABEL,
  ACCOUNT_DELETE_OPEN_LABEL,
  ACCOUNT_DELETE_PANEL_BODY,
  ACCOUNT_DELETE_PANEL_TITLE,
  ACCOUNT_DELETE_PASSWORD_LABEL,
  ACCOUNT_DELETE_SECTION_DESCRIPTION,
  ACCOUNT_DELETE_SECTION_TITLE,
  ACCOUNT_DELETE_WIPE_CHECKBOX_LABEL,
  ACCOUNT_DELETE_WIPE_OFF_NOTE,
  ACCOUNT_DELETE_WIPE_ON_NOTE,
} from '../presentation/deletion-messages';

/**
 * Deleting the account, and the one question that comes with it.
 *
 * Lifted out of the account screen unchanged - the two-step open-then-confirm,
 * the password field, the switch that decides whether the phone is wiped too,
 * and the warning shown when the app lock is bound to this account.
 *
 * That warning is why an app-lock string is imported here rather than restated.
 * Deleting the account that a forgotten PIN is recovered through would close
 * the only door back in, so the panel says so and offers the lock screen. The
 * words belong to the lock; only the decision to show them belongs here.
 *
 * Nothing is confirmed twice. The panel reports that the button was pressed and
 * the screen decides what that costs: it holds the password, the in-flight
 * guard shared with signing in, backing up and syncing, and the signed-in user
 * this deletion is actually for.
 */
export function AccountDeletionPanel({
  isConfirming,
  isBusy,
  deletePassword,
  wipeLocalToo,
  deleteNotice,
  lockBoundToThisAccount,
  onOpen,
  onCancel,
  onConfirm,
  onPasswordChange,
  onWipeLocalTooChange,
  onOpenAppLock,
}: {
  readonly isConfirming: boolean;
  readonly isBusy: boolean;
  readonly deletePassword: string;
  readonly wipeLocalToo: boolean;
  readonly deleteNotice: string | null;
  readonly lockBoundToThisAccount: boolean;
  readonly onOpen: () => void;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly onPasswordChange: (next: string) => void;
  readonly onWipeLocalTooChange: (next: boolean) => void;
  readonly onOpenAppLock: () => void;
}) {
  const theme = useTheme();

  return (
      <View style={styles.fields}>
        <ThemedText accessibilityRole="header" type="smallBold">
          {ACCOUNT_DELETE_SECTION_TITLE}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {ACCOUNT_DELETE_SECTION_DESCRIPTION}
        </ThemedText>

        {!isConfirming && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ACCOUNT_DELETE_OPEN_LABEL}
            accessibilityState={{ disabled: isBusy }}
            disabled={isBusy}
            onPress={() => {
              onOpen();
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.backgroundSelected },
              isBusy && styles.disabled,
              pressed && !isBusy && styles.pressed,
            ]}>
            <ThemedText type="smallBold">{ACCOUNT_DELETE_OPEN_LABEL}</ThemedText>
          </Pressable>
        )}

        {isConfirming && (
          <View style={styles.fields}>
            <ThemedText accessibilityRole="header" type="smallBold">
              {ACCOUNT_DELETE_PANEL_TITLE}
            </ThemedText>

            <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
              {ACCOUNT_DELETE_PANEL_BODY}
            </ThemedText>

            {/* Deleting the account makes the lock unrecoverable: the
                uid it is bound to stops existing, so signing in as it
                stops being possible. Said here, where the decision is
                made, rather than found weeks later at a lock screen. */}
            {lockBoundToThisAccount && (
              <View style={styles.fields}>
                <ThemedText
                  accessibilityRole="alert"
                  type="small"
                  themeColor="textSecondary">
                  {LOCK_BOUND_TO_ACCOUNT_WARNING}
                </ThemedText>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={REMOVE_LOCK_FIRST_LABEL}
                  onPress={onOpenAppLock}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold">{REMOVE_LOCK_FIRST_LABEL}</ThemedText>
                </Pressable>
              </View>
            )}

            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">
                {ACCOUNT_DELETE_PASSWORD_LABEL}
              </ThemedText>

              <TextInput
                accessibilityLabel={ACCOUNT_DELETE_PASSWORD_LABEL}
                value={deletePassword}
                onChangeText={onPasswordChange}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isBusy}
                style={[
                  styles.input,
                  { borderColor: theme.backgroundSelected, color: theme.text },
                ]}
              />
            </View>

            <View style={styles.syncRow}>
              <ThemedText type="small" style={styles.syncLabel}>
                {ACCOUNT_DELETE_WIPE_CHECKBOX_LABEL}
              </ThemedText>

              <Switch
                trackColor={{ false: theme.backgroundSelected, true: theme.switchTrackOn }}
                thumbColor={wipeLocalToo ? theme.switchThumbOn : undefined}
                accessibilityLabel={ACCOUNT_DELETE_WIPE_CHECKBOX_LABEL}
                value={wipeLocalToo}
                onValueChange={onWipeLocalTooChange}
                disabled={isBusy}
              />
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              {wipeLocalToo ? ACCOUNT_DELETE_WIPE_ON_NOTE : ACCOUNT_DELETE_WIPE_OFF_NOTE}
            </ThemedText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ACCOUNT_DELETE_CONFIRM_LABEL}
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={() => {
                onConfirm();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {isBusy ? ACCOUNT_DELETE_BUSY_LABEL : ACCOUNT_DELETE_CONFIRM_LABEL}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ACCOUNT_DELETE_CANCEL_LABEL}
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.backgroundSelected },
                isBusy && styles.disabled,
                pressed && !isBusy && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{ACCOUNT_DELETE_CANCEL_LABEL}</ThemedText>
            </Pressable>
          </View>
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
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 44,
  },
  syncLabel: {
    flexShrink: 1,
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
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
