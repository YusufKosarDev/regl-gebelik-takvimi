import type { AvatarOption } from '../domain/avatar-option';

import type { Messages } from '@/i18n';

/**
 * The avatar options this build ships.
 *
 * Ids are stable English kebab-case and are what gets stored; the labels are
 * what the person reads. Changing a label is safe, changing an id is not — it
 * would orphan every avatar already saved with it.
 *
 * `validateAvatarConfig` deliberately does not check against these lists. An
 * avatar naming an option this build has dropped is still a readable avatar, and
 * refusing to load it would lose a person's choice over a catalogue edit.
 * Membership is a lookup's question, answered by `getAvatarOption` and its
 * `null`.
 *
 * There is no "yok" accessory. Wearing nothing is the absence of a choice rather
 * than a thing to pick, so it is `accessoryId: undefined` on the config, and the
 * screen offering the list is what puts a "Yok" next to it.
 *
 * ## Why the names stayed here rather than moving to presentation
 *
 * `avatar-option.ts` states the catalogue rule, and the rule is about the id
 * and the name together: retire an entry by hiding it, "and leave it in the
 * catalogue so that what was already chosen still has a name." Splitting the
 * name away from the id would put the two halves of that rule in two files, and
 * the half that matters - that a dropped option still has a word - would be the
 * half that moved.
 *
 * So the catalogue is bilingual instead. Both halves carry the same ids in the
 * same order; only the words differ, and a test holds them to that.
 */

const avatarCatalogueTr = {
  /**
   * Six skin tones, numbered rather than named.
   *
   * Every shorthand for a skin tone carries something with it, and a catalogue
   * is the wrong place to decide what a person's skin should be called. A
   * number names a swatch and nothing else, so the picker shows the colour and
   * the label stays out of the way. That reasoning is not Turkish - the English
   * half numbers them too.
   */
  skinTones: [
    { id: 'skin-tone-1', label: '1. ton' },
    { id: 'skin-tone-2', label: '2. ton' },
    { id: 'skin-tone-3', label: '3. ton' },
    { id: 'skin-tone-4', label: '4. ton' },
    { id: 'skin-tone-5', label: '5. ton' },
    { id: 'skin-tone-6', label: '6. ton' },
  ] as readonly AvatarOption[],

  hairStyles: [
    { id: 'short', label: 'Kısa' },
    { id: 'medium', label: 'Orta' },
    { id: 'long', label: 'Uzun' },
    { id: 'curly', label: 'Kıvırcık' },
    { id: 'bun', label: 'Topuz' },
    { id: 'wavy', label: 'Dalgalı' },
  ] as readonly AvatarOption[],

  hairColors: [
    { id: 'black', label: 'Siyah' },
    { id: 'dark-brown', label: 'Koyu kahve' },
    { id: 'brown', label: 'Kahve' },
    { id: 'light-brown', label: 'Açık kahve' },
    { id: 'blonde', label: 'Sarı' },
    { id: 'red', label: 'Kızıl' },
  ] as readonly AvatarOption[],

  outfits: [
    { id: 't-shirt', label: 'Tişört' },
    { id: 'sweatshirt', label: 'Sweatshirt' },
    { id: 'shirt', label: 'Gömlek' },
    { id: 'dress', label: 'Elbise' },
  ] as readonly AvatarOption[],

  accessories: [
    { id: 'glasses', label: 'Gözlük' },
    { id: 'hair-clip', label: 'Toka' },
    { id: 'earrings', label: 'Küpe' },
  ] as readonly AvatarOption[],
};

export type AvatarCatalogue = typeof avatarCatalogueTr;

const avatarCatalogueEn: AvatarCatalogue = {
  skinTones: [
    { id: 'skin-tone-1', label: 'Tone 1' },
    { id: 'skin-tone-2', label: 'Tone 2' },
    { id: 'skin-tone-3', label: 'Tone 3' },
    { id: 'skin-tone-4', label: 'Tone 4' },
    { id: 'skin-tone-5', label: 'Tone 5' },
    { id: 'skin-tone-6', label: 'Tone 6' },
  ],

  hairStyles: [
    { id: 'short', label: 'Short' },
    { id: 'medium', label: 'Medium' },
    { id: 'long', label: 'Long' },
    { id: 'curly', label: 'Curly' },
    { id: 'bun', label: 'Bun' },
    { id: 'wavy', label: 'Wavy' },
  ],

  hairColors: [
    { id: 'black', label: 'Black' },
    { id: 'dark-brown', label: 'Dark brown' },
    { id: 'brown', label: 'Brown' },
    { id: 'light-brown', label: 'Light brown' },
    { id: 'blonde', label: 'Blonde' },
    { id: 'red', label: 'Red' },
  ],

  outfits: [
    { id: 't-shirt', label: 'T-shirt' },
    { id: 'sweatshirt', label: 'Sweatshirt' },
    { id: 'shirt', label: 'Shirt' },
    { id: 'dress', label: 'Dress' },
  ],

  accessories: [
    { id: 'glasses', label: 'Glasses' },
    { id: 'hair-clip', label: 'Hair clip' },
    { id: 'earrings', label: 'Earrings' },
  ],
};

export const avatarCatalogue: Messages<AvatarCatalogue> = {
  tr: avatarCatalogueTr,
  en: avatarCatalogueEn,
};

/* ------------------------------------------------------------------------- */
/* The Turkish lists under their original names, for the assertions and the   */
/* drawing layer that already name them. Screens read the half they show.     */
/* ------------------------------------------------------------------------- */

export const AVATAR_SKIN_TONES = avatarCatalogueTr.skinTones;
export const AVATAR_HAIR_STYLES = avatarCatalogueTr.hairStyles;
export const AVATAR_HAIR_COLORS = avatarCatalogueTr.hairColors;
export const AVATAR_OUTFITS = avatarCatalogueTr.outfits;
export const AVATAR_ACCESSORIES = avatarCatalogueTr.accessories;
