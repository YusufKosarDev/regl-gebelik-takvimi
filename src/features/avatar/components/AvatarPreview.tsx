import { StyleSheet, View } from 'react-native';

import {
  AVATAR_ACCESSORIES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_OUTFITS,
  AVATAR_SKIN_TONES,
} from '../data/avatar-catalog';
import type { AvatarConfig } from '../domain/avatar-config';
import type { AvatarOption } from '../domain/avatar-option';
import { getAvatarOption } from '../domain/avatar-option';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A stand-in picture of the chosen avatar.
 *
 * No artwork yet: this draws coloured blocks from the choices, so the editor has
 * something that visibly answers a tap while the real drawing is still to come.
 * Everything it shows is derived from the config alone, so the same config
 * always produces the same preview.
 *
 * It is meant to be replaced rather than grown. The swatches below are the only
 * thing tying blocks to options, and a real renderer swaps this component out
 * without anything that uses it having to change: the props are the config and a
 * size, which is what a renderer would want anyway.
 *
 * Catalogue ids never reach the screen. A person picked "Topuz", not `bun`, and
 * an id leaking into a label would be the app talking to itself out loud. Where
 * an id has no option — an avatar saved before a catalogue edit — the row says
 * so in words instead.
 */

const UNKNOWN_LABEL = 'Bilinmiyor';
const NO_ACCESSORY_LABEL = 'Yok';

/**
 * Placeholder swatches, in catalogue order.
 *
 * Index-matched to the lists rather than keyed by id: these are stand-ins for
 * artwork, not a second catalogue to keep in step. An option with no swatch
 * falls back to the theme, which is also what an id from a dropped option gets.
 */
const SKIN_SWATCHES = ['#F6DFCE', '#EDC7A9', '#D8A379', '#B57C53', '#8A5739', '#593723'];
const HAIR_SWATCHES = ['#1B1B1B', '#3A2314', '#6A4322', '#A87449', '#D7B067', '#A7381E'];
const OUTFIT_SWATCHES = ['#7C8CA1', '#8F7C9C', '#6F9080', '#A8798A'];

/** How tall the hair band sits, per style, so the styles look unalike. */
const HAIR_SHAPES = [
  { height: 14, radius: 8 },
  { height: 20, radius: 10 },
  { height: 30, radius: 12 },
  { height: 24, radius: 18 },
  { height: 16, radius: 20 },
  { height: 26, radius: 14 },
];

type Resolved = {
  readonly label: string;
  readonly index: number;
};

/** The label for an id, and where it sits in the list, or -1 when it is gone. */
function resolve(options: readonly AvatarOption[], id: string): Resolved {
  const index = options.findIndex((option) => option.id === id);
  const option = getAvatarOption(options, id);

  return { label: option?.label ?? UNKNOWN_LABEL, index };
}

function swatch(palette: readonly string[], index: number, fallback: string): string {
  return index < 0 ? fallback : (palette[index % palette.length] ?? fallback);
}

export type AvatarPreviewProps = {
  readonly config: AvatarConfig;
  /** `small` is the version Home shows next to a link; `large` is the editor's. */
  readonly size?: 'small' | 'large';
  readonly testID?: string;
};

export function AvatarPreview({ config, size = 'large', testID }: AvatarPreviewProps) {
  const theme = useTheme();

  const skin = resolve(AVATAR_SKIN_TONES, config.skinToneId);
  const hairStyle = resolve(AVATAR_HAIR_STYLES, config.hairStyleId);
  const hairColor = resolve(AVATAR_HAIR_COLORS, config.hairColorId);
  const outfit = resolve(AVATAR_OUTFITS, config.outfitId);
  const accessory =
    config.accessoryId === undefined ? null : resolve(AVATAR_ACCESSORIES, config.accessoryId);

  const isLarge = size === 'large';
  const scale = isLarge ? 1 : 0.5;

  const face = 96 * scale;
  const hair = HAIR_SHAPES[hairStyle.index < 0 ? 0 : hairStyle.index % HAIR_SHAPES.length];

  // One sentence rather than five stacked labels, so the whole avatar is read
  // out as a single thing instead of as a pile of unrelated words.
  const spoken =
    `Avatar: ${skin.label} ten, ${hairStyle.label} ${hairColor.label} saç, ` +
    `${outfit.label}, aksesuar ${accessory?.label ?? NO_ACCESSORY_LABEL}`;

  return (
    <View
      accessible
      accessibilityLabel={spoken}
      testID={testID}
      style={[styles.container, isLarge && styles.containerLarge]}>
      <View
        style={[
          styles.portrait,
          {
            width: face + 32 * scale,
            paddingVertical: Spacing.three * scale,
            backgroundColor: theme.backgroundElement,
            borderRadius: Spacing.three,
          },
        ]}>
        <View
          style={{
            width: face,
            height: hair.height * scale,
            borderTopLeftRadius: hair.radius,
            borderTopRightRadius: hair.radius,
            backgroundColor: swatch(HAIR_SWATCHES, hairColor.index, theme.backgroundSelected),
          }}
        />

        <View
          style={{
            width: face,
            height: face,
            borderRadius: face / 2,
            backgroundColor: swatch(SKIN_SWATCHES, skin.index, theme.backgroundSelected),
          }}
        />

        <View
          style={{
            width: face + 16 * scale,
            height: 34 * scale,
            borderRadius: Spacing.two,
            backgroundColor: swatch(OUTFIT_SWATCHES, outfit.index, theme.backgroundSelected),
          }}
        />

        {/* Nothing is drawn when no accessory was chosen: an empty slot would
            read as one that failed to load. */}
        {accessory !== null && (
          <View
            style={[
              styles.accessoryChip,
              { backgroundColor: theme.backgroundSelected, paddingVertical: Spacing.half },
            ]}>
            <ThemedText type="small">{accessory.label}</ThemedText>
          </View>
        )}
      </View>

      {/* The words behind the blocks, so the preview is readable while the
          blocks are still stand-ins. Only on the large one — next to a link
          there is no room, and the spoken label already carries it. */}
      {isLarge && (
        <View style={styles.labels}>
          <ThemedText type="small" themeColor="textSecondary">
            Ten tonu: {skin.label}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Saç: {hairStyle.label}, {hairColor.label}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Kıyafet: {outfit.label}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Aksesuar: {accessory?.label ?? NO_ACCESSORY_LABEL}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  containerLarge: {
    gap: Spacing.three,
  },
  portrait: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  accessoryChip: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  labels: {
    alignItems: 'center',
    gap: Spacing.half,
  },
});
