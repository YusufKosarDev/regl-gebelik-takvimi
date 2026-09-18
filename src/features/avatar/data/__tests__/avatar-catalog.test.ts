import { validateAvatarConfig } from '../../domain/avatar-config';
import type { AvatarOption } from '../../domain/avatar-option';
import { getAvatarOption } from '../../domain/avatar-option';
import {
  AVATAR_ACCESSORIES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_OUTFITS,
  AVATAR_SKIN_TONES,
} from '../avatar-catalog';

const CATEGORIES: readonly [string, readonly AvatarOption[], number][] = [
  ['skin tones', AVATAR_SKIN_TONES, 6],
  ['hair styles', AVATAR_HAIR_STYLES, 6],
  ['hair colors', AVATAR_HAIR_COLORS, 6],
  ['outfits', AVATAR_OUTFITS, 4],
  ['accessories', AVATAR_ACCESSORIES, 3],
];

describe('the avatar catalogue offers every category', () => {
  it.each(CATEGORIES)('%s has %s options', (_name, options, count) => {
    expect(options).toHaveLength(count);
  });

  it('names the hair styles that were asked for', () => {
    expect(AVATAR_HAIR_STYLES.map((option) => option.label)).toEqual([
      'Kısa',
      'Orta',
      'Uzun',
      'Kıvırcık',
      'Topuz',
      'Dalgalı',
    ]);
  });

  it('names the hair colors that were asked for', () => {
    expect(AVATAR_HAIR_COLORS.map((option) => option.label)).toEqual([
      'Siyah',
      'Koyu kahve',
      'Kahve',
      'Açık kahve',
      'Sarı',
      'Kızıl',
    ]);
  });

  it('names the accessories that were asked for', () => {
    expect(AVATAR_ACCESSORIES.map((option) => option.label)).toEqual([
      'Gözlük',
      'Toka',
      'Küpe',
    ]);
  });

  it('offers no "none" accessory', () => {
    // Wearing nothing is `accessoryId: undefined`, not an option to pick.
    const ids = AVATAR_ACCESSORIES.map((option) => option.id);

    expect(ids).not.toContain('none');
    expect(AVATAR_ACCESSORIES.map((option) => option.label)).not.toContain('Yok');
  });
});

describe('avatar catalogue ids', () => {
  it.each(CATEGORIES)('%s has no duplicate id', (_name, options) => {
    const ids = options.map((option) => option.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate id across every category together', () => {
    const ids = CATEGORIES.flatMap(([, options]) => options.map((option) => option.id));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CATEGORIES)('%s uses English kebab-case ids', (_name, options) => {
    options.forEach((option) => {
      expect(option.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    });
  });

  it.each(CATEGORIES)('%s has a non-blank label for every option', (_name, options) => {
    options.forEach((option) => {
      expect(option.label.trim()).not.toBe('');
    });
  });

  it.each(CATEGORIES)('%s has no duplicate label', (_name, options) => {
    const labels = options.map((option) => option.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it.each(CATEGORIES)('%s carries only an id and a label', (_name, options) => {
    options.forEach((option) => {
      expect(Object.keys(option).sort()).toEqual(['id', 'label']);
    });
  });
});

describe('looking options up in the catalogue', () => {
  it.each(CATEGORIES)('finds every %s by its id', (_name, options) => {
    options.forEach((option) => {
      expect(getAvatarOption(options, option.id)).toBe(option);
    });
  });

  it('returns null for an id from another category', () => {
    expect(getAvatarOption(AVATAR_HAIR_STYLES, 'black')).toBeNull();
    expect(getAvatarOption(AVATAR_OUTFITS, 'glasses')).toBeNull();
  });

  it('returns null for an id no category has', () => {
    expect(getAvatarOption(AVATAR_SKIN_TONES, 'skin-tone-7')).toBeNull();
  });

  it('never throws over a duplicate, because the catalogue has none', () => {
    CATEGORIES.forEach(([, options]) => {
      options.forEach((option) => {
        expect(() => getAvatarOption(options, option.id)).not.toThrow();
      });
    });
  });
});

describe('the catalogue and the domain stay separate', () => {
  it('builds a config the domain accepts', () => {
    expect(() =>
      validateAvatarConfig({
        skinToneId: AVATAR_SKIN_TONES[0].id,
        hairStyleId: AVATAR_HAIR_STYLES[0].id,
        hairColorId: AVATAR_HAIR_COLORS[0].id,
        outfitId: AVATAR_OUTFITS[0].id,
        accessoryId: AVATAR_ACCESSORIES[0].id,
      })
    ).not.toThrow();
  });

  it('accepts an avatar whose ids are in no category', () => {
    // Validation is not membership: an option a later build drops must still
    // load rather than lock someone out of the avatar they chose.
    expect(() =>
      validateAvatarConfig({
        skinToneId: 'skin-tone-99',
        hairStyleId: 'mohawk',
        hairColorId: 'teal',
        outfitId: 'spacesuit',
        accessoryId: 'monocle',
      })
    ).not.toThrow();
  });
});

describe('avatar catalogue purity', () => {
  it.each(CATEGORIES)('is unchanged by looking every %s up', (_name, options) => {
    const before = JSON.stringify(options);

    options.forEach((option) => getAvatarOption(options, option.id));

    expect(JSON.stringify(options)).toBe(before);
  });

  it('is the same list on every read', () => {
    expect(AVATAR_OUTFITS).toBe(AVATAR_OUTFITS);
    expect(AVATAR_OUTFITS[0]).toBe(AVATAR_OUTFITS[0]);
  });
});
