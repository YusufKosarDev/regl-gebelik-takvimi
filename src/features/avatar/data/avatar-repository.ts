import type { SQLiteDatabase } from 'expo-sqlite';

import type { AvatarConfig } from '../domain/avatar-config';
import { validateAvatarConfig } from '../domain/avatar-config';

/**
 * Persistence for `AvatarConfig`.
 *
 * The only avatar layer that knows SQL. It speaks domain types on both sides and
 * never lets a row shape escape upwards.
 *
 * Every value crossing into SQL goes through parameter binding; no stored value
 * is ever interpolated into a statement string.
 *
 * The catalogue is not consulted here. An avatar naming an option this build no
 * longer ships still round-trips: losing someone's choice because a list was
 * edited would be worse than handing back an id the drawing layer has to cope
 * with.
 */

/** `avatar_config` holds a single row, pinned by a CHECK constraint. */
const AVATAR_ROW_ID = 1;

type AvatarRow = {
  readonly skin_tone_id: unknown;
  readonly hair_style_id: unknown;
  readonly hair_color_id: unknown;
  readonly outfit_id: unknown;
  readonly accessory_id: unknown;
};

const UPSERT_AVATAR = `
  INSERT INTO avatar_config (
    id,
    skin_tone_id,
    hair_style_id,
    hair_color_id,
    outfit_id,
    accessory_id
  )
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    skin_tone_id = excluded.skin_tone_id,
    hair_style_id = excluded.hair_style_id,
    hair_color_id = excluded.hair_color_id,
    outfit_id = excluded.outfit_id,
    accessory_id = excluded.accessory_id
`;

const SELECT_AVATAR = `
  SELECT skin_tone_id, hair_style_id, hair_color_id, outfit_id, accessory_id
  FROM avatar_config
  WHERE id = ?
`;

/** The column stores text; anything else means the row is not what it claims. */
function toStoredId(column: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(`Stored avatar has a non-text ${column}: ${JSON.stringify(value)}.`);
  }

  return value;
}

/**
 * The accessory column, which is allowed to be empty of a choice.
 *
 * NULL is "no accessory" and becomes `undefined`. Anything else has to be text,
 * because a number or an object in that column is corruption rather than a
 * person who picked nothing.
 */
function toStoredAccessory(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return toStoredId('accessory_id', value);
}

/**
 * Writes the avatar.
 *
 * Validated before anything is bound, so a config the domain would refuse never
 * reaches the database.
 *
 * A single upsert on the pinned row: there is one avatar, so saving replaces it
 * rather than adding to a list. An absent accessory is bound as NULL, which is
 * how "chose none" is stored.
 */
export async function saveAvatarConfig(
  db: SQLiteDatabase,
  config: AvatarConfig
): Promise<void> {
  validateAvatarConfig(config);

  await db.runAsync(
    UPSERT_AVATAR,
    AVATAR_ROW_ID,
    config.skinToneId,
    config.hairStyleId,
    config.hairColorId,
    config.outfitId,
    config.accessoryId ?? null
  );
}

/**
 * Reads the stored avatar, or `null` when none has been saved.
 *
 * A corrupt row raises rather than being repaired or skipped: quietly
 * substituting a default would replace someone's choice with one nobody made,
 * and hide that the row is broken.
 *
 * A row with no accessory comes back without the key at all rather than with an
 * explicit `undefined`, so what was saved and what is loaded compare equal.
 */
export async function loadAvatarConfig(db: SQLiteDatabase): Promise<AvatarConfig | null> {
  const row = await db.getFirstAsync<AvatarRow>(SELECT_AVATAR, AVATAR_ROW_ID);

  if (!row) {
    return null;
  }

  const accessoryId = toStoredAccessory(row.accessory_id);

  const config: AvatarConfig = {
    skinToneId: toStoredId('skin_tone_id', row.skin_tone_id),
    hairStyleId: toStoredId('hair_style_id', row.hair_style_id),
    hairColorId: toStoredId('hair_color_id', row.hair_color_id),
    outfitId: toStoredId('outfit_id', row.outfit_id),
    ...(accessoryId === undefined ? {} : { accessoryId }),
  };

  validateAvatarConfig(config);

  return config;
}
