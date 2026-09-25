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

/**
 * How an avatar reads aloud.
 *
 * Built from the Turkish labels the person chose from, never from the ids: they
 * picked "Topuz", not `bun`, and an id in a spoken label would be the app
 * talking to itself out loud.
 *
 * A choice this build no longer has is left out of the sentence rather than
 * announced. There is nothing useful to say about it — the label is gone with
 * the option — and "bilinmiyor" in the middle of a description reads as an error
 * where a person only sees their avatar drawn a little plainer.
 */

export const NO_ACCESSORY_LABEL = 'Yok';

function labelOf(options: readonly AvatarOption[], id: string): string | null {
  return getAvatarOption(options, id)?.label ?? null;
}

/**
 * One sentence describing the whole avatar.
 *
 * One sentence rather than five, because the avatar is one thing on screen and
 * should be one thing to a screen reader too.
 *
 * Pure: nothing is mutated and no catalogue is consulted for anything but words.
 */
export function describeAvatar(config: AvatarConfig): string {
  const skin = labelOf(AVATAR_SKIN_TONES, config.skinToneId);
  const hairStyle = labelOf(AVATAR_HAIR_STYLES, config.hairStyleId);
  const hairColor = labelOf(AVATAR_HAIR_COLORS, config.hairColorId);
  const outfit = labelOf(AVATAR_OUTFITS, config.outfitId);
  const accessory =
    config.accessoryId === undefined
      ? NO_ACCESSORY_LABEL
      : labelOf(AVATAR_ACCESSORIES, config.accessoryId);

  const hair =
    hairStyle !== null && hairColor !== null
      ? `${hairStyle} ${hairColor} saç`
      : hairStyle !== null
        ? `${hairStyle} saç`
        : hairColor !== null
          ? `${hairColor} saç`
          : null;

  const parts = [
    skin === null ? null : `${skin} ten`,
    hair,
    outfit,
    accessory === null ? null : `aksesuar ${accessory}`,
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? 'Avatar' : `Avatar: ${parts.join(', ')}`;
}

/* ------------------------------------------------ the avatar screen -- */

/**
 * What the avatar screen says, in Turkish.
 *
 * Moved out of `app/(app)/avatar.tsx` verbatim. `NO_ACCESSORY_LABEL` above was
 * written out a second time in the screen; it is one constant now.
 */

export const AVATAR_SCREEN_TITLE = 'Avatarım';

export const AVATAR_DESCRIPTION =
  'Seçtiklerin hemen önizlemede görünür. Kaydedene kadar hiçbir şey yazılmaz.';

export const AVATAR_SKIN_SECTION_TITLE = 'Ten tonu';
export const AVATAR_HAIR_STYLE_SECTION_TITLE = 'Saç stili';
export const AVATAR_HAIR_COLOR_SECTION_TITLE = 'Saç rengi';
export const AVATAR_OUTFIT_SECTION_TITLE = 'Kıyafet';
export const AVATAR_ACCESSORY_SECTION_TITLE = 'Aksesuar';

export const AVATAR_SAVE_BUTTON_LABEL = 'Avatarı kaydet';

export const AVATAR_LOAD_FAILED_MESSAGE = 'Avatar yüklenemedi.';
export const AVATAR_SAVE_FAILED_MESSAGE = 'Avatar kaydedilemedi.';

/** One option inside its section, so a reader knows which question it answers. */
export function avatarChoiceLabel(section: string, label: string): string {
  return `${section}: ${label}`;
}
