import { Pressable, StyleSheet, View } from 'react-native';

import type { AuthState } from '../application/use-auth-state';
import { authMessages } from '../presentation/auth-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AvatarPreview } from '@/features/avatar/components/AvatarPreview';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import { settingsMessages } from '@/features/cycle/presentation/settings-messages';
import { useMessages } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';

/**
 * Who this is, at the top of the tab that answers that question.
 *
 * ## This one is ours
 *
 * The app this app follows structurally has a tab for the person, and that is
 * the whole of what its store screenshots show about it - four words along the
 * bottom and nothing of what any of them opens. There was no layout to follow
 * here, and none has been invented to look like one. What follows is reasoning
 * about this app.
 *
 * ## What it replaces
 *
 * The tab opened with the cycle-length steppers. Those are a setting, and the
 * question a profile tab answers is not "how long is your cycle" - it is who
 * this is and where the records are. Meanwhile the account, the one genuinely
 * identifying thing on the screen, was a button: somebody had to press it and
 * wait for a screen to load to find out whether they were signed in.
 *
 * So the answer moves up here and the controls stay where they were. The
 * account screen is a large one about sync, backup and sign-out, and nothing
 * about it wants to be inlined into a settings list.
 *
 * ## It says nothing while it is finding out
 *
 * `loading` gets its own line rather than falling back to the local-only one.
 * Telling somebody who is signed in that their records are on this phone only
 * is a false statement about where their data is, and half a second of it is
 * still half a second of it. The same reasoning the rest of this app applies
 * to a blank panel: say what is true, including "not known yet".
 *
 * ## The labels arrive from outside
 *
 * `avatarLabel` reads differently once there is an avatar to edit, and the
 * words for both already belong to screens that have them. Injected rather
 * than looked up, the same way `ChoiceGrid` takes its catalogue labels, so
 * this component owns no copy of a string another screen also writes.
 */
export function ProfileIdentity({
  auth,
  avatar,
  avatarLabel,
  accountLabel,
  onOpenAvatar,
  onOpenAccount,
}: {
  readonly auth: AuthState;
  readonly avatar: AvatarConfig | null;
  readonly avatarLabel: string;
  readonly accountLabel: string;
  readonly onOpenAvatar: () => void;
  readonly onOpenAccount: () => void;
}) {
  const theme = useTheme();
  const settings = useMessages(settingsMessages);
  const strings = useMessages(authMessages);

  const line =
    auth.status === 'loading'
      ? settings.identityChecking
      : auth.status === 'signed-in'
        ? (auth.user.email ?? strings.noEmailText)
        : settings.identityLocalOnly;

  return (
    <View style={styles.identity}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={avatarLabel}
        onPress={onOpenAvatar}
        style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
        {/* Before there is one, an empty disc rather than a stand-in face.
            A placeholder portrait would be somebody else's, and the button's
            own label already says what pressing it does. */}
        {avatar === null ? (
          <View style={[styles.emptyAvatar, { borderColor: theme.backgroundSelected }]} />
        ) : (
          <AvatarPreview config={avatar} size="small" />
        )}
      </Pressable>

      <View style={styles.lines}>
        <ThemedText type="small" themeColor="textSecondary">
          {line}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accountLabel}
          onPress={onOpenAccount}
          style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
          <ThemedText type="smallBold">{accountLabel}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  emptyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatar: {
    // The same disc the home screen crops its bust to - head up, shoulders
    // running off the bottom. Without it the illustration ends on a hard
    // rectangular edge, which is what it did on the device the first time
    // this was drawn.
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  lines: {
    flexShrink: 1,
    gap: Spacing.one,
  },
  account: {
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
