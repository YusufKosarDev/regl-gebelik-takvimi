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
 * the head, `scallop` the softened side edges that read as a wave, and `wrap`
 * how much of a covering this is rather than hair.
 */
export type AvatarHairShape = {
  readonly length: number;
  readonly volume: number;
  readonly fringe: number;
  readonly knot: boolean;
  readonly scallop: boolean;
  /**
   * How far the shape comes round the face: 0 for hair, 1 for a headscarf.
   *
   * It widens the piece behind the head so it frames the face and squares the
   * band across the forehead, which is the difference between hair and a
   * covering at any size. Between the two is allowed by the type and is not
   * used: a half-covering is not a thing anybody picked.
   */
  readonly wrap: number;
};

/** A garment as a shape: how wide the shoulders sit, and what the neckline does. */
export type AvatarOutfitShape = {
  readonly width: number;
  readonly neckline: 'round' | 'placket' | 'strap';
  readonly corner: number;
};

export type AvatarAccessoryKind = 'glasses' | 'hair-clip' | 'earrings';

/**
 * The metal the earrings and the hair clip are drawn in.
 *
 * Here with the other tones rather than in the component, for the reason every
 * colour in this file is here: an avatar colour is data about an illustration,
 * not a theme token, and the one thing a literal in a component does reliably
 * is get edited in one place and not the other. This one was written twice in
 * `AvatarPreview`, once for each accessory that uses it.
 *
 * Not part of a palette record, because it does not vary with any choice the
 * person makes - the earrings are this colour whatever the skin and hair are.
 */
export const AVATAR_ACCESSORY_GOLD = '#E2B84B';

const SKIN_PALETTES: Readonly<Record<string, AvatarSkinPalette>> = {
  'skin-tone-1': { base: '#F7DFCE', shade: '#E8C9B3', feature: '#5C4033' },
  'skin-tone-2': { base: '#EFC9A9', shade: '#DDB08C', feature: '#563A28' },
  'skin-tone-3': { base: '#D9A277', shade: '#C2885E', feature: '#4A3022' },
  'skin-tone-4': { base: '#B77C52', shade: '#9E653F', feature: '#3B2617' },
  'skin-tone-5': { base: '#8A5736', shade: '#734527', feature: '#2C1B10' },
  'skin-tone-6': { base: '#58361F', shade: '#452817', feature: '#F0DCCB' },

  /**
   * Two olive undertones, which is the gap the first six left.
   *
   * The shipped ramp runs light to deep along one warm, red-leaning hue, and
   * what it had none of was an olive cast. So these are not a seventh and
   * eighth step on the same ramp — adding those would have meant pairs closer
   * together than any two already there — they are the same range in a
   * different undertone, and every pair in the eight stays at least as far
   * apart as tones 1 and 2, which are the closest of the original six.
   *
   * Nothing deeper than tone 6 was possible. The ear is drawn a step darker
   * than the face, and below tone 6 there is no room left to be darker in:
   * a ninth, deeper tone measured a shade step of 0.0066 against the 0.01967
   * that tone 6 manages, so its ear would have disappeared into its cheek.
   */
  'skin-tone-7': { base: '#A49674', shade: '#867B5F', feature: '#241A14' },
  'skin-tone-8': { base: '#867656', shade: '#6E6147', feature: '#241A14' },
};

const HAIR_PALETTES: Readonly<Record<string, AvatarHairPalette>> = {
  black: { base: '#1E1C1B', shade: '#100F0E' },
  'dark-brown': { base: '#3C2415', shade: '#2A1810' },
  brown: { base: '#6A4322', shade: '#4E3018' },
  'light-brown': { base: '#A8754A', shade: '#8A5C36' },
  blonde: { base: '#D9B268', shade: '#BC9348' },
  red: { base: '#A7381E', shade: '#822915' },

  /**
   * Three more, and they have to work as cloth as well as as hair.
   *
   * A covering takes its colour from this same list — it is a hair style, so
   * there is one thing on the head and it has one colour. That rules out the
   * obviously scarf-only colours a fabric list would have, and these three are
   * chosen because each is a real hair colour *and* a plausible cloth:
   * chestnut, grey, and the dark red that is dyed hair and ordinary fabric
   * alike.
   */
  auburn: { base: '#8E4A2B', shade: '#6E3820' },
  grey: { base: '#9C9690', shade: '#7E7872' },
  burgundy: { base: '#5B2334', shade: '#431A26' },
};

const OUTFIT_PALETTES: Readonly<Record<string, AvatarOutfitPalette>> = {
  't-shirt': { base: '#7C8CA1', trim: '#5E6C80' },
  sweatshirt: { base: '#8F7C9C', trim: '#6F5E7C' },
  shirt: { base: '#6F9080', trim: '#547063' },
  dress: { base: '#A8798A', trim: '#875B6B' },
};

/**
 * Silhouettes that have to be told apart at a glance.
 *
 * Every style differs from every other in at least two of its numbers, so none
 * of them is a near-copy of its neighbour at the small size. That rule is held
 * mechanically by `avatar-visuals.test.ts`, at a threshold measured from this
 * table rather than assumed, and the drawn result is measured again at `small`
 * by `avatar-small-size-legibility.test.tsx`.
 *
 * ## Why a headscarf is a hair style and not a layer of its own
 *
 * The question will come up, because the obvious reading is that a covering
 * goes *over* hair and so belongs above it in the stack. It does not, for
 * somebody wearing one: a headscarf is what is on their head instead of hair
 * on show, so there is no hair underneath to draw and nothing to hide.
 *
 * Modelled as a layer it would need the one thing this renderer has no concept
 * of — a layer that suppresses another. `resolveAvatarVisuals` answers each
 * field independently and every part is drawn unconditionally; a covering that
 * had to blank the hair would put a condition between the two, in both this
 * renderer and the Kotlin one, for a case where the hair was never wanted.
 *
 * Modelled as a style it costs nothing structural: the same `hairStyleId`, the
 * same stored column, the same single choice on the screen. What was needed was
 * one more number — `wrap` — because the five that described hair could not say
 * "comes round the face".
 *
 * The consequence to know about is that a covering and hair share the colour
 * choice, since both are `hairColorId`. That is why the colour section renames
 * itself when a covering is picked rather than offering a second list: one
 * thing is on the head, and it has one colour.
 *
 * The three variants differ by how they are tied, never by colour — colour is
 * already the person's own choice, so three variants that differed in it would
 * be one variant offered three times.
 */
const HAIR_SHAPES: Readonly<Record<string, AvatarHairShape>> = {
  short: { length: 0, volume: 0.06, fringe: 0.5, knot: false, scallop: false, wrap: 0 },
  medium: { length: 0.42, volume: 0.1, fringe: 0.42, knot: false, scallop: false, wrap: 0 },
  long: { length: 1, volume: 0.14, fringe: 0.34, knot: false, scallop: false, wrap: 0 },
  curly: { length: 0.3, volume: 0.42, fringe: 0.9, knot: false, scallop: true, wrap: 0 },
  bun: { length: 0, volume: 0.02, fringe: 0.26, knot: true, scallop: false, wrap: 0 },
  wavy: { length: 0.72, volume: 0.22, fringe: 0.46, knot: false, scallop: true, wrap: 0 },

  /**
   * A single plait: as long as a wave falls and far narrower than any of them.
   *
   * The numbers are not the first ones that satisfied the two-difference rule.
   * `length: 0.92, volume: 0.03` did, and drew 8px from `long` at `small` —
   * under the floor. Narrowing alone could not fix it: against `long`'s own
   * `volume: 0.14` the widest possible gap is about 9px, so the length had to
   * come in too.
   */
  braid: { length: 0.72, volume: 0.01, fringe: 0.18, knot: false, scallop: false, wrap: 0 },

  /**
   * Gathered and falling behind.
   *
   * The very high `fringe` is the pulled-back top: a ponytail has no fringe to
   * speak of, and a rounded top edge is how that reads without a part line. It
   * is also what carries the difference from `medium` at `small` — the first
   * attempt sat 7px away on length and volume alone.
   */
  ponytail: { length: 0.48, volume: 0.01, fringe: 0.95, knot: false, scallop: false, wrap: 0 },

  /** Waves without the length: `wavy`'s edges on a crop, and narrower than `curly`. */
  'short-wavy': { length: 0.1, volume: 0.3, fringe: 0.56, knot: false, scallop: true, wrap: 0 },

  /** Wrapped close, no tail: the covering and the face, nothing else. */
  'headscarf-plain': {
    length: 0.1,
    volume: 0.08,
    fringe: 0.1,
    knot: false,
    scallop: false,
    wrap: 1,
  },

  /** The long end left over a shoulder, which is the length past the jaw. */
  'headscarf-draped': {
    length: 0.85,
    volume: 0.2,
    fringe: 0.1,
    knot: false,
    scallop: false,
    wrap: 1,
  },

  /** Gathered and tied at the back, which reads as the knot above the head. */
  'headscarf-knotted': {
    length: 0.06,
    volume: 0.01,
    fringe: 0.1,
    knot: true,
    scallop: false,
    wrap: 1,
  },
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
  // Hair, not a covering: an id this build cannot place is drawn as the plainer
  // of the two rather than as a guess at somebody's headscarf.
  wrap: 0,
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
