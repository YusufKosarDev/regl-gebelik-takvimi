import type { AvatarConfig } from '../domain/avatar-config';

/**
 * What each catalogue id looks like.
 *
 * Presentation only. The catalogue names the options and the domain checks that
 * one was chosen; neither knows a colour or a silhouette, and nothing here is
 * validation. An id with no entry is drawn in neutral rather than refused, so a
 * catalogue edit can never leave someone unable to see their own avatar.
 *
 * The maps are keyed by id rather than by position, so reordering a catalogue
 * list cannot quietly recolour everyone's avatar.
 */

export type AvatarSkinPalette = {
  /** The face. */
  readonly base: string;
  /** Ears and neck, one step down, so they read as behind the face. */
  readonly shade: string;
  /** Eyes and mouth, dark enough to show on this skin and no darker. */
  readonly feature: string;
};

export type AvatarHairPalette = {
  readonly base: string;
  /** The length behind the head, a shade back from the fringe. */
  readonly shade: string;
};

export type AvatarOutfitPalette = {
  readonly base: string;
  /** Collar, placket or straps. */
  readonly trim: string;
};

/**
 * A hair style as a silhouette, in fractions rather than pixels.
 *
 * `length` is how far it falls past the jaw, `volume` how far it spreads past
 * the head, `fringe` how rounded the top edge is, `knot` a gathered bun above
 * the head and `scallop` the softened side edges that read as a wave.
 */
export type AvatarHairShape = {
  readonly length: number;
  readonly volume: number;
  readonly fringe: number;
  readonly knot: boolean;
  readonly scallop: boolean;
};

/** A garment as a shape: how wide the shoulders sit, and what the neckline does. */
export type AvatarOutfitShape = {
  readonly width: number;
  readonly neckline: 'round' | 'placket' | 'strap';
  readonly corner: number;
};

export type AvatarAccessoryKind = 'glasses' | 'hair-clip' | 'earrings';

const SKIN_PALETTES: Readonly<Record<string, AvatarSkinPalette>> = {
  'skin-tone-1': { base: '#F7DFCE', shade: '#E8C9B3', feature: '#5C4033' },
  'skin-tone-2': { base: '#EFC9A9', shade: '#DDB08C', feature: '#563A28' },
  'skin-tone-3': { base: '#D9A277', shade: '#C2885E', feature: '#4A3022' },
  'skin-tone-4': { base: '#B77C52', shade: '#9E653F', feature: '#3B2617' },
  'skin-tone-5': { base: '#8A5736', shade: '#734527', feature: '#2C1B10' },
  'skin-tone-6': { base: '#58361F', shade: '#452817', feature: '#F0DCCB' },
};

const HAIR_PALETTES: Readonly<Record<string, AvatarHairPalette>> = {
  black: { base: '#1E1C1B', shade: '#100F0E' },
  'dark-brown': { base: '#3C2415', shade: '#2A1810' },
  brown: { base: '#6A4322', shade: '#4E3018' },
  'light-brown': { base: '#A8754A', shade: '#8A5C36' },
  blonde: { base: '#D9B268', shade: '#BC9348' },
  red: { base: '#A7381E', shade: '#822915' },
};

const OUTFIT_PALETTES: Readonly<Record<string, AvatarOutfitPalette>> = {
  't-shirt': { base: '#7C8CA1', trim: '#5E6C80' },
  sweatshirt: { base: '#8F7C9C', trim: '#6F5E7C' },
  shirt: { base: '#6F9080', trim: '#547063' },
  dress: { base: '#A8798A', trim: '#875B6B' },
};

/**
 * Six silhouettes that have to be told apart at a glance.
 *
 * Every style differs from every other in at least two of the five numbers, so
 * none of them is a near-copy of its neighbour at the small size.
 */
const HAIR_SHAPES: Readonly<Record<string, AvatarHairShape>> = {
  short: { length: 0, volume: 0.06, fringe: 0.5, knot: false, scallop: false },
  medium: { length: 0.42, volume: 0.1, fringe: 0.42, knot: false, scallop: false },
  long: { length: 1, volume: 0.14, fringe: 0.34, knot: false, scallop: false },
  curly: { length: 0.3, volume: 0.42, fringe: 0.9, knot: false, scallop: true },
  bun: { length: 0, volume: 0.02, fringe: 0.26, knot: true, scallop: false },
  wavy: { length: 0.72, volume: 0.22, fringe: 0.46, knot: false, scallop: true },
};

const OUTFIT_SHAPES: Readonly<Record<string, AvatarOutfitShape>> = {
  't-shirt': { width: 0.82, neckline: 'round', corner: 0.16 },
  sweatshirt: { width: 0.95, neckline: 'round', corner: 0.3 },
  shirt: { width: 0.84, neckline: 'placket', corner: 0.1 },
  dress: { width: 0.7, neckline: 'strap', corner: 0.24 },
};

const ACCESSORY_KINDS: Readonly<Record<string, AvatarAccessoryKind>> = {
  glasses: 'glasses',
  'hair-clip': 'hair-clip',
  earrings: 'earrings',
};

/**
 * What an id the app does not recognise is drawn as.
 *
 * Grey rather than a guess, and a silhouette with no distinguishing feature: an
 * avatar saved before a catalogue changed still draws as a person, and nothing
 * on screen claims it is a style that was never picked.
 */
const NEUTRAL_SKIN: AvatarSkinPalette = { base: '#CBC3BC', shade: '#B3ABA4', feature: '#4F4A46' };
const NEUTRAL_HAIR: AvatarHairPalette = { base: '#8E8A86', shade: '#74706C' };
const NEUTRAL_OUTFIT: AvatarOutfitPalette = { base: '#9A9A9A', trim: '#7E7E7E' };
const NEUTRAL_HAIR_SHAPE: AvatarHairShape = {
  length: 0.2,
  volume: 0.08,
  fringe: 0.5,
  knot: false,
  scallop: false,
};
const NEUTRAL_OUTFIT_SHAPE: AvatarOutfitShape = { width: 0.82, neckline: 'round', corner: 0.2 };

/** Everything the renderer needs, with every gap already filled. */
export type AvatarVisuals = {
  readonly skin: AvatarSkinPalette;
  readonly hair: AvatarHairPalette;
  readonly hairShape: AvatarHairShape;
  readonly outfit: AvatarOutfitPalette;
  readonly outfitShape: AvatarOutfitShape;
  /** `null` for no accessory, and also for one this build cannot draw. */
  readonly accessory: AvatarAccessoryKind | null;
};

/**
 * Turns a saved avatar into the shapes and colours that draw it.
 *
 * Total: every id resolves to something, so the renderer has no absent case to
 * handle and no reason to throw. An accessory it cannot draw becomes none —
 * there is no honest stand-in for a thing whose shape is unknown, and drawing
 * the wrong one would be worse than drawing nothing.
 *
 * Pure: the config is read, never mutated.
 */
export function resolveAvatarVisuals(config: AvatarConfig): AvatarVisuals {
  return {
    skin: SKIN_PALETTES[config.skinToneId] ?? NEUTRAL_SKIN,
    hair: HAIR_PALETTES[config.hairColorId] ?? NEUTRAL_HAIR,
    hairShape: HAIR_SHAPES[config.hairStyleId] ?? NEUTRAL_HAIR_SHAPE,
    outfit: OUTFIT_PALETTES[config.outfitId] ?? NEUTRAL_OUTFIT,
    outfitShape: OUTFIT_SHAPES[config.outfitId] ?? NEUTRAL_OUTFIT_SHAPE,
    accessory:
      config.accessoryId === undefined ? null : (ACCESSORY_KINDS[config.accessoryId] ?? null),
  };
}
