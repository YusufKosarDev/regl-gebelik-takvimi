import { describeValue } from '@/shared/logging';

/**
 * One choice a person can make about their avatar.
 *
 * `id` is what gets stored and what the drawing layer keys off, so it never
 * changes once shipped: a renamed id turns every saved avatar that used it into
 * an unknown one. `label` is the Turkish the person reads, and it is free to
 * change — it is wording, not identity.
 */
export type AvatarOption = {
  readonly id: string;
  readonly label: string;
};

/**
 * The option with this id, or `null` when the catalogue has none.
 *
 * `null` rather than a throw, because an unknown id is an ordinary thing to
 * find: a saved avatar can name an option that a later build removed, and the
 * caller is better placed than this function to decide what to show instead.
 *
 * Two options sharing an id is the opposite — nobody could account for which one
 * was drawn, and the catalogue itself is wrong — so that throws.
 *
 * Pure: the list is read, never sorted or mutated, and ids are compared exactly
 * as stored.
 */
export function getAvatarOption(
  options: readonly AvatarOption[],
  id: string
): AvatarOption | null {
  if (typeof id !== 'string') {
    throw new Error(`getAvatarOption received an id that is not text: ${describeValue(id)}.`);
  }

  const matches = options.filter((option) => option.id === id);

  if (matches.length > 1) {
    throw new Error(
      `getAvatarOption found ${matches.length} options with the same id; ` +
        'at most 1 is valid.'
    );
  }

  return matches.length === 0 ? null : matches[0];
}
