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
      `AvatarConfig has a ${field} that is not text: ${JSON.stringify(value)}.`
    );
  }

  // Whitespace counts as blank: an id of spaces names nothing, and it would
  // survive as far as a catalogue lookup that could only miss.
  if (value.trim() === '') {
    throw new Error(`AvatarConfig has a blank ${field}: ${JSON.stringify(value)}.`);
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
    throw new Error(`validateAvatarConfig received something that is not an avatar: ${
      JSON.stringify(config)
    }.`);
  }

  REQUIRED_FIELDS.forEach((field) => {
    assertId(field, config[field]);
  });

  if (config.accessoryId !== undefined) {
    assertId('accessoryId', config.accessoryId);
  }
}
