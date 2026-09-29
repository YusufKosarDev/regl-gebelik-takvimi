import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import { avatarCatalogue } from '../../data/avatar-catalog';
import type { AvatarConfig } from '../../domain/avatar-config';
import { avatarLabels, describeAvatarIn } from '../avatar-labels';

/**
 * The avatar's words, in both languages.
 *
 * Two pairs are checked here: the screen's own strings, and the option names
 * that stayed in the catalogue beside their ids.
 */

describe('parity of the screen strings', () => {
  describeCatalogueParity(avatarLabels, {
    functions: [
      ['skinPart', ['Tone 1']],
      ['hairPart', ['Short', 'Black'], ['Short', null], [null, 'Black'], [null, null]],
      ['accessoryPart', ['Glasses']],
      ['avatarDescription', ['tone 1 skin, short black hair']],
      ['avatarChoiceLabel', ['Hair style', 'Short']],
    ],
    // Both languages call the thing an avatar, and the ": " join is the same
    // punctuation around two values that have already been translated.
    identical: ['avatarOnly', 'avatarDescription', 'avatarChoiceLabel'],
  });
});

describe('parity of the option names', () => {
  describeCatalogueParity(avatarCatalogue);

  it.each<['skinTones' | 'hairStyles' | 'hairColors' | 'outfits' | 'accessories']>([
    ['skinTones'],
    ['hairStyles'],
    ['hairColors'],
    ['outfits'],
    ['accessories'],
  ])('%s carries the same ids in the same order in both languages', (group) => {
    // The id is what gets stored. A language that reordered or renamed one
    // would make a saved avatar draw differently depending on which language
    // happened to be showing when it was picked.
    expect(avatarCatalogue.en[group].map((option) => option.id)).toEqual(
      avatarCatalogue.tr[group].map((option) => option.id)
    );
  });

  it('gives every option a word in both languages', () => {
    for (const catalogue of [avatarCatalogue.tr, avatarCatalogue.en]) {
      for (const options of Object.values(catalogue)) {
        for (const option of options) {
          expect([option.id, option.label.trim()]).not.toEqual([option.id, '']);
        }
      }
    }
  });

  it('numbers the skin tones in both languages rather than naming them', () => {
    // A catalogue is the wrong place to decide what a person's skin should be
    // called. That reasoning is not Turkish, so the English numbers them too.
    for (const catalogue of [avatarCatalogue.tr, avatarCatalogue.en]) {
      for (const option of catalogue.skinTones) {
        expect(option.label).toMatch(/\d/);
      }
    }
  });

  it('has no "none" accessory in either language', () => {
    // Wearing nothing is the absence of a choice, not a thing to pick. The
    // screen puts the word beside the list.
    for (const catalogue of [avatarCatalogue.tr, avatarCatalogue.en]) {
      const labels = catalogue.accessories.map((option) => option.label);

      expect(labels).not.toContain('Yok');
      expect(labels).not.toContain('None');
    }
  });
});

describe('how an avatar reads aloud', () => {
  const config = (overrides: Partial<AvatarConfig> = {}): AvatarConfig => ({
    skinToneId: 'skin-tone-1',
    hairStyleId: 'short',
    hairColorId: 'black',
    outfitId: 't-shirt',
    ...overrides,
  });

  it('reads as one sentence in each language', () => {
    expect(describeAvatarIn(avatarLabels.en, avatarCatalogue.en, config())).toBe(
      'Avatar: tone 1 skin, short black hair, T-shirt, none'
    );
    expect(describeAvatarIn(avatarLabels.tr, avatarCatalogue.tr, config())).toBe(
      'Avatar: 1. ton ten, Kısa Siyah saç, Tişört, aksesuar Yok'
    );
  });

  it('puts the words in each language’s own order', () => {
    // Turkish puts the noun last - "Kısa Siyah saç" - and English the other way
    // round. Neither is the other with the words swapped, which is why both
    // halves build the sentence themselves.
    expect(avatarLabels.tr.hairPart('Kısa', 'Siyah')).toBe('Kısa Siyah saç');
    expect(avatarLabels.en.hairPart('Short', 'Black')).toBe('short black hair');
  });

  it('names an accessory when there is one', () => {
    expect(
      describeAvatarIn(avatarLabels.en, avatarCatalogue.en, config({ accessoryId: 'glasses' }))
    ).toContain('glasses');
  });

  it('leaves out a choice this build no longer has rather than announcing it', () => {
    // "Not known" in the middle of a description reads as an error where a
    // person only sees their avatar drawn a little plainer.
    const described = describeAvatarIn(
      avatarLabels.en,
      avatarCatalogue.en,
      config({ hairStyleId: 'a-style-that-was-dropped' })
    );

    expect(described).toContain('black hair');
    expect(described).not.toMatch(/not known|unknown/i);
  });

  it('says only "Avatar" when nothing can be named at all', () => {
    const described = describeAvatarIn(
      avatarLabels.en,
      avatarCatalogue.en,
      config({
        skinToneId: 'gone',
        hairStyleId: 'gone',
        hairColorId: 'gone',
        outfitId: 'gone',
        accessoryId: 'gone',
      })
    );

    expect(described).toBe('Avatar');
  });
});
