import type { AvatarCatalogue } from '../data/avatar-catalog';
import { avatarCatalogue } from '../data/avatar-catalog';
import type { AvatarConfig } from '../domain/avatar-config';
import type { AvatarOption } from '../domain/avatar-option';
import { getAvatarOption } from '../domain/avatar-option';

import type { Messages } from '@/i18n';

/**
 * What the avatar screen says, and how an avatar reads aloud.
 *
 * The description is built from the labels the person chose from, never from
 * the ids: they picked "Topuz", not `bun`, and an id in a spoken label would be
 * the app talking to itself out loud.
 *
 * A choice this build no longer has is left out of the sentence rather than
 * announced. There is nothing useful to say about it — the label is gone with
 * the option — and "bilinmiyor" in the middle of a description reads as an
 * error where a person only sees their avatar drawn a little plainer.
 *
 * ## The description is a different sentence in each language
 *
 * Turkish puts the noun last and needs no article: "Kısa Siyah saç", "1. ton
 * ten", "aksesuar Gözlük". English puts them the other way round and reads as a
 * list: "short black hair", "tone 1 skin", "glasses". So the two halves build
 * the sentence themselves rather than filling in the same template - which is
 * the case the catalogue pair exists for.
 */

const avatarLabelsTr = {
  noAccessoryLabel: 'Yok',

  /** The parts of the description, each already in its language's word order. */
  skinPart: (skin: string) => `${skin} ten`,
  hairPart: (style: string | null, color: string | null) => {
    if (style !== null && color !== null) return `${style} ${color} saç`;
    if (style !== null) return `${style} saç`;
    if (color !== null) return `${color} saç`;

    return null;
  },
  accessoryPart: (accessory: string) => `aksesuar ${accessory}`,

  /** When nothing about the avatar can be named at all. */
  avatarOnly: 'Avatar',
  avatarDescription: (parts: string) => `Avatar: ${parts}`,

  /* -------------------------------------------------- the avatar screen -- */

  avatarScreenTitle: 'Avatarım',

  avatarDescriptionNote:
    'Seçtiklerin hemen önizlemede görünür. Kaydedene kadar hiçbir şey yazılmaz.',

  avatarSkinSectionTitle: 'Ten tonu',
  avatarHairStyleSectionTitle: 'Saç stili',
  avatarHairColorSectionTitle: 'Saç rengi',
  avatarOutfitSectionTitle: 'Kıyafet',
  avatarAccessorySectionTitle: 'Aksesuar',

  avatarSaveButtonLabel: 'Avatarı kaydet',

  avatarLoadFailedMessage: 'Avatar yüklenemedi.',
  avatarSaveFailedMessage: 'Avatar kaydedilemedi.',

  /** One option inside its section, so a reader knows which question it answers. */
  avatarChoiceLabel: (section: string, label: string) => `${section}: ${label}`,
};

export type AvatarLabels = typeof avatarLabelsTr;

const avatarLabelsEn: AvatarLabels = {
  noAccessoryLabel: 'None',

  skinPart: (skin: string) => `${skin.toLowerCase()} skin`,
  hairPart: (style: string | null, color: string | null) => {
    if (style !== null && color !== null) return `${style.toLowerCase()} ${color.toLowerCase()} hair`;
    if (style !== null) return `${style.toLowerCase()} hair`;
    if (color !== null) return `${color.toLowerCase()} hair`;

    return null;
  },
  accessoryPart: (accessory: string) => accessory.toLowerCase(),

  avatarOnly: 'Avatar',
  avatarDescription: (parts: string) => `Avatar: ${parts}`,

  avatarScreenTitle: 'My avatar',

  avatarDescriptionNote:
    'What you pick shows in the preview straight away. Nothing is written down until you save.',

  avatarSkinSectionTitle: 'Skin tone',
  avatarHairStyleSectionTitle: 'Hair style',
  avatarHairColorSectionTitle: 'Hair colour',
  avatarOutfitSectionTitle: 'Outfit',
  avatarAccessorySectionTitle: 'Accessory',

  avatarSaveButtonLabel: 'Save your avatar',

  avatarLoadFailedMessage: 'That avatar could not be loaded.',
  avatarSaveFailedMessage: 'That avatar could not be saved.',

  avatarChoiceLabel: (section: string, label: string) => `${section}: ${label}`,
};

export const avatarLabels: Messages<AvatarLabels> = { tr: avatarLabelsTr, en: avatarLabelsEn };

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
export function describeAvatarIn(
  labels: AvatarLabels,
  catalogue: AvatarCatalogue,
  config: AvatarConfig
): string {
  const skin = labelOf(catalogue.skinTones, config.skinToneId);
  const hairStyle = labelOf(catalogue.hairStyles, config.hairStyleId);
  const hairColor = labelOf(catalogue.hairColors, config.hairColorId);
  const outfit = labelOf(catalogue.outfits, config.outfitId);
  const accessory =
    config.accessoryId === undefined
      ? labels.noAccessoryLabel
      : labelOf(catalogue.accessories, config.accessoryId);

  const parts = [
    skin === null ? null : labels.skinPart(skin),
    labels.hairPart(hairStyle, hairColor),
    outfit,
    accessory === null ? null : labels.accessoryPart(accessory),
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? labels.avatarOnly : labels.avatarDescription(parts.join(', '));
}

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const NO_ACCESSORY_LABEL = avatarLabelsTr.noAccessoryLabel;
export const AVATAR_SCREEN_TITLE = avatarLabelsTr.avatarScreenTitle;
export const AVATAR_DESCRIPTION = avatarLabelsTr.avatarDescriptionNote;
export const AVATAR_SKIN_SECTION_TITLE = avatarLabelsTr.avatarSkinSectionTitle;
export const AVATAR_HAIR_STYLE_SECTION_TITLE = avatarLabelsTr.avatarHairStyleSectionTitle;
export const AVATAR_HAIR_COLOR_SECTION_TITLE = avatarLabelsTr.avatarHairColorSectionTitle;
export const AVATAR_OUTFIT_SECTION_TITLE = avatarLabelsTr.avatarOutfitSectionTitle;
export const AVATAR_ACCESSORY_SECTION_TITLE = avatarLabelsTr.avatarAccessorySectionTitle;
export const AVATAR_SAVE_BUTTON_LABEL = avatarLabelsTr.avatarSaveButtonLabel;
export const AVATAR_LOAD_FAILED_MESSAGE = avatarLabelsTr.avatarLoadFailedMessage;
export const AVATAR_SAVE_FAILED_MESSAGE = avatarLabelsTr.avatarSaveFailedMessage;

export const avatarChoiceLabel = avatarLabelsTr.avatarChoiceLabel;

export function describeAvatar(config: AvatarConfig): string {
  return describeAvatarIn(avatarLabelsTr, avatarCatalogue.tr, config);
}
