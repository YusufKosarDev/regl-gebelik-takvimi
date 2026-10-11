import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useMessages } from '@/i18n';

import { homeMessages } from '../presentation/home-messages';

import { Icon } from '@/components/icon';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { PregnancyDashboard } from '@/features/pregnancy/application/get-pregnancy-dashboard';

/**
 * What is left of the ways out of the cycle home screen.
 *
 * ## Three of them left for the bar
 *
 * The calendar, the period history and the settings are tabs now. A tab is the
 * same destination offered from every screen in the app, so a row on this one
 * saying the same thing is the second way to the same place - and the one that
 * is only on the home screen is the one worth losing.
 *
 * What stays is what has no tab: the daily log history, which lives under the
 * history tab's question but not yet under its screen; the avatar, which is
 * only here until there is one; and the way into pregnancy tracking.
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
      {/* The calendar and the period history used to head this list. They are
          tabs now, which is the same destination reached from every screen
          instead of from this one - so a row here as well would be the same
          errand twice, and the row is the copy that loses. */}
      <LinkRow
        label={home.logHistoryLinkLabel}
        text={home.logHistoryLinkText}
        onPress={() => router.push('/(app)/daily-log-history')}
      />

      {/* The avatar row has gone to the profile tab, which opens with the
          person: the face when there is one and the way to make one when
          there is not. A row here was the second way to the same editor from
          the one screen that already shows the face. */}

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
  // No rule above it any more. A hairline between every row is the
  // settings-list idiom, and five of them stacked under a sky were the
  // strongest flat-page signal left on the screen: a column of boxes drawn on
  // something that has no boxes in it.
  //
  // What separates the rows now is space, which the field was already
  // providing for free. The chevron still says each one goes somewhere.
  return (
    <Surface level="bare" style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary">
          {text}
        </ThemedText>

        {/* The one thing the list could not say about itself: that a row goes
            somewhere. A word would not have said it any better. */}
        <Icon name="chevron-right" />
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
    flexDirection: 'row',
    alignItems: 'center',
    // The chevron to the far edge, the label at the near one, which is what
    // makes the five rows scan as a column rather than as five sentences.
    justifyContent: 'space-between',
    gap: Spacing.three,
    // Wider than it was, because the rule that used to hold the rows apart has
    // gone and space is what replaces it. Below this the five rows run
    // together into one block of words.
    paddingVertical: Spacing.four,
  },
  pressed: {
    opacity: 0.6,
  },
});
