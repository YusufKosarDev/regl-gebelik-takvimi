import type { AvatarOption } from '../domain/avatar-option';

/**
 * The avatar options this build ships.
 *
 * Ids are stable English kebab-case and are what gets stored; the labels are the
 * Turkish shown on screen. Changing a label is safe, changing an id is not — it
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
 */

/**
 * Six skin tones, numbered rather than named.
 *
 * Every shorthand for a skin tone carries something with it, and a catalogue is
 * the wrong place to decide what a person's skin should be called. A number
 * names a swatch and nothing else, so the picker shows the colour and the label
 * stays out of the way.
 */
export const AVATAR_SKIN_TONES: readonly AvatarOption[] = [
  { id: 'skin-tone-1', label: '1. ton' },
  { id: 'skin-tone-2', label: '2. ton' },
  { id: 'skin-tone-3', label: '3. ton' },
  { id: 'skin-tone-4', label: '4. ton' },
  { id: 'skin-tone-5', label: '5. ton' },
  { id: 'skin-tone-6', label: '6. ton' },
] as const;

export const AVATAR_HAIR_STYLES: readonly AvatarOption[] = [
  { id: 'short', label: 'Kısa' },
  { id: 'medium', label: 'Orta' },
  { id: 'long', label: 'Uzun' },
  { id: 'curly', label: 'Kıvırcık' },
  { id: 'bun', label: 'Topuz' },
  { id: 'wavy', label: 'Dalgalı' },
] as const;

export const AVATAR_HAIR_COLORS: readonly AvatarOption[] = [
  { id: 'black', label: 'Siyah' },
  { id: 'dark-brown', label: 'Koyu kahve' },
  { id: 'brown', label: 'Kahve' },
  { id: 'light-brown', label: 'Açık kahve' },
  { id: 'blonde', label: 'Sarı' },
  { id: 'red', label: 'Kızıl' },
] as const;

export const AVATAR_OUTFITS: readonly AvatarOption[] = [
  { id: 't-shirt', label: 'Tişört' },
  { id: 'sweatshirt', label: 'Sweatshirt' },
  { id: 'shirt', label: 'Gömlek' },
  { id: 'dress', label: 'Elbise' },
] as const;

export const AVATAR_ACCESSORIES: readonly AvatarOption[] = [
  { id: 'glasses', label: 'Gözlük' },
  { id: 'hair-clip', label: 'Toka' },
  { id: 'earrings', label: 'Küpe' },
] as const;
