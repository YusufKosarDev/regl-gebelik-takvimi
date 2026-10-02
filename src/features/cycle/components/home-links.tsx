import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useMessages } from '@/i18n';

import { homeMessages } from '../presentation/home-messages';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { PregnancyDashboard } from '@/features/pregnancy/application/get-pregnancy-dashboard';

/**
 * The four ways out of the cycle home screen.
 *
 * The same links in the same order with the same labels, and the same two
 * things that vary - the avatar link, which reads differently once there is an
 * avatar, and the pregnancy link, which is only there while there is no
 * pregnancy to track.
 *
 * The condition that hides the lot in the pregnancy view stayed on the screen,
 * where the rest of that split lives.
 *
 * ## Why these are rows now
 *
 * They were the flattest thing in the app: five centred labels with no ground
 * under them, each a direct child of a container with a 32-point gap, so they
 * drifted down the end of the screen with nothing saying they belonged
 * together. They are one list, so they are drawn as one - in a single
 * container, separated by hairlines, left aligned like every other list in the
 * app.
 *
 * ## Where the padding goes, and why it had to move
 *
 * The hairline comes from `Surface`, which is never pressable, so a row is a
 * surface with a button inside it rather than a surface that is a button.
 *
 * That settles the padding. `lined` pads itself vertically, and here that
 * padding would sit *outside* the touch target: a row 80 points tall with a
 * 48-point tappable strip floating in the middle of it, and two pressable
 * halves on either side. So the surface gives its vertical padding up and the
 * `Pressable` keeps its own `minHeight`, which puts the whole row inside the
 * target.
 *
 * ## The avatar
 *
 * Its preview used to be drawn inside the avatar link. It is in the header
 * now, beside the date, where it is the one thing on the screen that belongs
 * to the person rather than to the cycle. The link keeps its wording and its
 * job: it is still the way to the editor.
 */
export function HomeLinks({
  avatar,
  pregnancy,
}: {
  readonly avatar: AvatarConfig | null;
  readonly pregnancy: PregnancyDashboard | null;
}) {
  const router = useRouter();
  const home = useMessages(homeMessages);

  return (
    // One container, so the five rows are one child of a layout with a
    // 32-point gap between its children rather than five - which is what had
    // them drifting apart down the end of the screen. No gap of its own: the
    // hairlines separate these, and a gap as well would leave each line
    // floating between two rows instead of sitting under one.
    <View>
      <LinkRow
        label={home.historyLinkLabel}
        text={home.historyLinkText}
        onPress={() => router.push('/(app)/history')}
      />

      {/* Next to the period records rather than anywhere else, because the two
          are the same errand from the person's side: looking back at what was
          written down. One holds periods, the other holds days. */}
      <LinkRow
        label={home.logHistoryLinkLabel}
        text={home.logHistoryLinkText}
        onPress={() => router.push('/(app)/daily-log-history')}
      />

      {/* The label says which of the two errands the link is on. */}
      <LinkRow
        label={avatar === null ? home.avatarCreateLabel : home.avatarEditLabel}
        text={avatar === null ? home.avatarLinkText : home.avatarEditLabel}
        onPress={() => router.push('/(app)/avatar')}
      />

      <LinkRow
        label={home.settingsLinkLabel}
        text={home.settingsLinkText}
        onPress={() => router.push('/(app)/settings')}
      />

      {/* The way in to pregnancy tracking, and the only way to enable
          the view that shows it. */}
      {pregnancy === null && (
        <LinkRow
          label={home.pregnancyStartLinkLabel}
          text={home.pregnancyStartLinkLabel}
          onPress={() => router.push('/(app)/pregnancy-start')}
        />
      )}
    </View>
  );
}

/**
 * One row of the list.
 *
 * Five near-identical blocks were five chances for one of them to drift, which
 * is how the avatar link ended up with its own padding and its own alignment
 * while the other four shared theirs.
 */
function LinkRow({
  label,
  text,
  onPress,
}: {
  readonly label: string;
  readonly text: string;
  readonly onPress: () => void;
}) {
  return (
    <Surface level="lined" style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary">
          {text}
        </ThemedText>
      </Pressable>
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: {
    // See the note above: the padding belongs to the touch target, not to the
    // surface around it.
    paddingVertical: 0,
  },
  link: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
