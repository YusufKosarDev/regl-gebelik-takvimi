import { describeValue } from '@/shared/logging';

/**
 * Which avatar a person chose, as ids rather than as pictures.
 *
 * Every field names a choice from a catalogue that this module deliberately does
 * not contain. Nothing here knows what a hair style looks like, what colours
 * exist or which outfits ship with the app: the ids are opaque strings, and the
 * catalogues that give them meaning belong to a later step and to whichever
 * layer draws them.
 *
 * That is also why no id is checked against a list. A validation that knew the
 * catalogue would have to be edited every time a style is added, and it would
 * reject a saved avatar the moment an id is renamed. What can be checked without
 * inventing a catalogue is that an id was actually chosen, and that is what is
 * checked.
 *
 * `accessoryId` is optional because no accessory is a real choice, not a missing
 * one. The four required fields are required for the opposite reason: an avatar
 * with no skin tone or no outfit is not a partial avatar, it is one that cannot
 * be drawn.
 *
 * The model is shared on purpose. The home screen and, later, the Android widget
 * both draw the same person, so they read the same config rather than each
 * keeping a description of their own.
 */
export type AvatarConfig = {
  readonly skinToneId: string;
  readonly hairStyleId: string;
  readonly hairColorId: string;
  readonly outfitId: string;
  readonly accessoryId?: string;
  /**
   * The face, and the disc behind the figure. Optional for the reason
   * `accessoryId` is, with one addition.
   *
   * Absent is a meaning here rather than a gap: no expression is the face the
   * avatar is already drawn with, and no backdrop is the plain figure it
   * already is. An avatar saved before either existed is therefore complete,
   * not partial, and looks the same as it did — which is why neither could be
   * required. An existing row has no value to be required of it, and choosing
   * one on somebody's behalf is what the feature exists to avoid.
   */
  readonly expressionId?: string;
  readonly backgroundId?: string;
};

/** The fields an avatar cannot be drawn without, checked in this order. */
const REQUIRED_FIELDS = [
  'skinToneId',
  'hairStyleId',
  'hairColorId',
  'outfitId',
] as const satisfies readonly (keyof AvatarConfig)[];

function assertId(field: string, value: unknown): void {
  if (typeof value !== 'string') {
    throw new Error(
      `AvatarConfig has a ${field} that is not text: ${describeValue(value)}.`
    );
  }

  // Whitespace counts as blank: an id of spaces names nothing, and it would
  // survive as far as a catalogue lookup that could only miss.
  if (value.trim() === '') {
    throw new Error(`AvatarConfig has a blank ${field}.`);
  }
}

/**
 * Checks one avatar, throwing on the first rule it breaks.
 *
 * An absent accessory is skipped rather than refused, but one that is there has
 * to name something: `accessoryId: ''` is not the same as no accessory, and
 * silently treating it as none would turn a bug into a shrug.
 *
 * Pure: nothing is mutated, no field is trimmed or defaulted, and the config is
 * read exactly as given.
 */
export function validateAvatarConfig(config: AvatarConfig): void {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error(
      `validateAvatarConfig received something that is not an avatar: ${describeValue(config)}.`
    );
  }

  REQUIRED_FIELDS.forEach((field) => {
    assertId(field, config[field]);
  });

  // The optional ones, each checked only when it is there. `''` is refused for
  // all three for the same reason: it is neither a choice nor the absence of
  // one, and treating it as none would turn a bug into a shrug.
  (['accessoryId', 'expressionId', 'backgroundId'] as const).forEach((field) => {
    if (config[field] !== undefined) {
      assertId(field, config[field]);
    }
  });
}
