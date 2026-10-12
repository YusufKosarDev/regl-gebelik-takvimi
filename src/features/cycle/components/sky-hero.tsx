import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamilyFor } from '@/constants/fonts';
import { Spacing } from '@/constants/theme';
import { AvatarPreview } from '@/features/avatar/components/AvatarPreview';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import { useFontScale } from '@/hooks/use-font-scale';

/**
 * What a person sees before they scroll: the day and the phase.
 *
 * ## It carried a sentence, and no longer does
 *
 * This said "the day, the phase, one sentence", and the sentence was the
 * phase's support message. It is gone from here and unchanged where it
 * already was: `DailySupportSection`, below the fold, under a heading that
 * introduces it. The same words were on this screen twice, which
 * `home-screen.test.tsx` had already called a known loose end.
 *
 * Carrying it here made the front door unreadable at large font settings.
 * Measured on a device, Turkish, bar top at 2161px: the sentence crossed the
 * tab bar at a scale of 1.7 for the shortest message and 1.6 for the longest,
 * and English runs longer still. A threshold would therefore have had to
 * depend on the phase as well as the scale - which is more machinery than any
 * layout here has, to solve a case that existed only because the sentence was
 * on screen twice.
 *
 * What is lost at the default size is a sentence a person reads one scroll
 * further down, introduced rather than asserted. What is gained is a hero that
 * fits at every setting Android offers.
 *
 * ## Why it is this short
 *
 * The screen this replaces carried the ring, four more rows, a suggestion card,
 * a log card, a support section, a period card and a whole month calendar -
 * forty pressable controls, most of them calendar cells drawing a second
 * picture of the cycle the ring was already drawing.
 *
 * None of it is deleted. It is below the fold, which is where something you
 * read sometimes belongs, and the calendar has its own screen now. What is left
 * here is what the app is opened to find out.
 *
 * ## Fraunces leads
 *
 * The serif was bought and then rationed to a few headings. The day number is
 * the one piece of type in this app anybody will remember, so it is set in
 * Fraunces at a size nothing else comes near.
 *
 * ## The avatar is pressable now
 *
 * It used to be a small thumbnail beside the date and deliberately not
 * pressable, because the home screen's list of controls was pinned at nine by
 * two tests and an avatar that opened the editor would have made it ten. It
 * opens the editor.
 *
 * ## Colour comes from the sky, not the theme
 *
 * Every word here is drawn in one ink that belongs to the field underneath, so
 * `ThemedText` is the wrong tool - its colours are chosen for a page, and there
 * is no page here. The contrast of this ink against every field is asserted in
 * `sky-contrast.test.ts`.
 */
export function SkyHero({
  dayNumber,
  dayCaption,
  noDayMessage,
  phaseName,
  dayAccessibilityLabel,
  phaseAccessibilityLabel,
  dateLine,
  todayHeading,
  avatar,
  onOpenAvatar,
  openAvatarLabel,
  ink,
  glass,
  glassEdge,
  isScrubbing,
  scrubHint,
}: {
  /** The number alone - "11", not "11. gün". */
  /**
   * The number alone - "17", not "17. gün" - or `null` when there is no cycle
   * day to show.
   *
   * Null is not a dash. A profile with nothing recorded has no day eleven, and
   * a 96-point "—" says the screen is broken rather than that the cycle has not
   * started. In that case the caption and the number both go and
   * `noDayMessage` carries it instead.
   */
  readonly dayNumber: string | null;
  /** The word that says what the number counts. */
  readonly dayCaption: string;
  /** What stands in for the number when there is none, e.g. "Henüz başlamadı". */
  readonly noDayMessage: string;
  readonly phaseName: string | null;
  /**
   * What assistive technology hears instead of the caption and the bare
   * number.
   *
   * The screen shows "Döngü günü" over a 96-point "17", because "17. gün" set
   * that large is absurd. The caption stays in the accessibility tree and the
   * number carries the value, so a screen reader reads "Döngü günü" and then
   * "17. gün" - which is the summary row it replaced, in the same order.
   */
  readonly dayAccessibilityLabel: string;
  /** The phase row's whole sentence, e.g. "Döngü evresi: Luteal". */
  readonly phaseAccessibilityLabel: string | null;
  readonly dateLine: string;
  /** The word over the date - "Bugün". */
  readonly todayHeading: string;
  readonly avatar: AvatarConfig | null;
  readonly onOpenAvatar: () => void;
  readonly openAvatarLabel: string;
  readonly ink: string;
  /** The glass the avatar sits on, so it is in the sky rather than on it. */
  readonly glass: string;
  readonly glassEdge: string;
  /** True while a drag is showing a day other than today. */
  readonly isScrubbing: boolean;
  /** Shown in place of the date while scrubbing, so the date cannot read as today. */
  readonly scrubHint: string;
}) {
  const scale = useFontScale();

  // Capped rather than left to scale freely: at Android's largest setting an
  // uncapped 96-point number is taller than the space it is centred in.
  const numberSize = Math.round(96 * Math.min(scale, 1.35));
  const captionSize = Math.round(15 * scale);
  // The two small labels - "Bugün", "Döngü günü". They sit back by being
  // smaller, lighter in weight and more widely spaced; they do not sit back by
  // being a paler colour, because on a field that is the one move that cannot
  // be made safe. See `constants/sky.ts`.
  const labelSize = Math.round(13 * scale);
  const phaseSize = Math.round(22 * scale);

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <View style={styles.dateBlock}>
          <Text
            style={[
              {
                color: ink,
                fontSize: labelSize,
                lineHeight: Math.round(labelSize * 1.5),
                fontFamily: fontFamilyFor('sans', '400'),
                letterSpacing: 0.4,
              },
            ]}>
            {isScrubbing ? scrubHint : todayHeading}
          </Text>

          {/* The date goes while a drag is showing some other day. Leaving it
              beside another day's number is the one lie this screen could
              tell, and it would tell it silently. */}
          {isScrubbing ? null : (
            <Text
              style={[
                {
                  color: ink,
                  fontSize: Math.round(captionSize * 1.2),
                  lineHeight: Math.round(captionSize * 1.6),
                  fontFamily: fontFamilyFor('sans', '600'),
                },
              ]}>
              {dateLine}
            </Text>
          )}
        </View>

        {avatar === null ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={openAvatarLabel}
            onPress={onOpenAvatar}
            testID="home-avatar-button"
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
            <View style={[styles.avatarDisc, { backgroundColor: glass, borderTopColor: glassEdge }]}>
              <AvatarPreview config={avatar} size="small" testID="home-avatar-preview" />
            </View>
          </Pressable>
        )}
      </View>

      <View style={styles.centre}>
      {/* The caption and the number are one thing to read and two things to
          look at, so they are grouped: a screen reader gets
          "Döngü günü: 17. gün" in one announcement, the way the summary row it
          replaced read, while the screen shows a word over a number. */}
      {dayNumber === null ? (
        <Text
          accessibilityRole="header"
          testID="sky-no-day"
          style={[
            styles.phase,
            {
              color: ink,
              fontSize: phaseSize,
              lineHeight: Math.round(phaseSize * 1.35),
              fontFamily: fontFamilyFor('serif', '600'),
            },
          ]}>
          {noDayMessage}
        </Text>
      ) : (
      <View accessible accessibilityRole="header" accessibilityLabel={dayAccessibilityLabel}>
        <Text
          style={[
            styles.caption,
            {
              color: ink,
              fontSize: labelSize,
              lineHeight: Math.round(labelSize * 1.5),
              fontFamily: fontFamilyFor('sans', '400'),
              letterSpacing: 0.4,
            },
          ]}>
          {dayCaption}
        </Text>

        <Text
          testID="sky-day-number"
          style={[
            styles.number,
            {
              color: ink,
              fontSize: numberSize,
              lineHeight: Math.round(numberSize * 1.08),
              fontFamily: fontFamilyFor('serif', '700'),
            },
          ]}>
          {dayNumber}
        </Text>
      </View>
      )}

        {phaseName === null ? null : (
          <View accessible accessibilityLabel={phaseAccessibilityLabel ?? undefined}>
            <Text
              testID="sky-phase"
              style={[
                styles.phase,
                {
                  color: ink,
                  fontSize: phaseSize,
                  lineHeight: Math.round(phaseSize * 1.35),
                  fontFamily: fontFamilyFor('serif', '600'),
                },
              ]}>
              {phaseName}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    // `flexGrow` with an `auto` basis, not `flex: 1`.
    //
    // `flex: 1` is `flexBasis: 0`, which means this never asks for the height
    // its own text needs - it takes whatever is left over and lets the rest
    // spill. Inside a hero that was exactly one viewport tall, at 200% that
    // spill painted over the floating tab bar: measured on a device, the
    // sentence was still drawing at the bottom edge of a screen whose bar
    // starts 126px above it.
    //
    // Growing when there is room is still wanted, which is what keeps the
    // hero one viewport at the default size. What changes is that the content
    // can now push instead of only being pushed.
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
    paddingHorizontal: Spacing.four,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  dateBlock: {
    flex: 1,
  },
  date: {},
  avatar: {
    marginLeft: Spacing.three,
  },
  avatarDisc: {
    // The illustration used to float with a hard edge against a field that has
    // none, which made it look like a sticker rather than like a person who
    // lives here. The disc is the same glass the blocks below are made of, so
    // it belongs to the sky, and the bust is cropped to it the way a portrait
    // is - head up, shoulders running off the bottom.
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.7,
  },
  centre: {
    // Same reasoning as `root`: fill the spare room and centre the day in it,
    // but never be squeezed below what the caption, the number, the phase and
    // the sentence actually need. This is the block that was overflowing.
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
    justifyContent: 'center',
    alignItems: 'center',
  },
  caption: {
    textAlign: 'center',
  },
  number: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  phase: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
});
