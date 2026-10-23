import { render } from '@testing-library/react-native';
import React from 'react';

import { AvatarPreview } from '../AvatarPreview';

import {
  AVATAR_HAIR_STYLES,
  AVATAR_OUTFITS,
} from '@/features/avatar/data/avatar-catalog';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import { resolveAvatarVisuals } from '@/features/avatar/presentation/avatar-visuals';

/**
 * Whether the choices are still different from each other once they are small.
 *
 * ## Why this is not the shape-distinctness test
 *
 * `avatar-visuals.test.ts` holds the shapes apart in their own numbers. That is
 * the design rule, and it is not the same question as this one: the numbers are
 * fractions of a head, the renderer multiplies them by a scale, and `small` is
 * scale 0.5. Two styles can differ by a comfortable 0.06 of a head and still
 * land on the same pixel when the head is half the size.
 *
 * So this measures what is actually drawn. Every hair-coloured rectangle is
 * collected at `small`, and two styles count as told apart when their rectangles
 * differ by at least `MIN_PIXELS` somewhere, or when one of them draws a
 * rectangle the other does not.
 *
 * ## The floor is measured, not chosen
 *
 * `MIN_PIXELS` is set to what the shipped catalogue actually achieves at its
 * weakest pair, so a new option cannot be added that is less legible than the
 * ones already there. Raising it would be a claim about the existing six that
 * is not true; lowering it would let a near-copy in.
 *
 * The widget is smaller still, and is not this file's to measure: it is drawn by
 * Kotlin from a five-value enum, so what matters there is which styles collapse
 * onto the same enum entry. `widget-avatar-shape-coverage.test.ts` holds that.
 */

function config(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    skinToneId: 'skin-tone-3',
    hairStyleId: 'short',
    // Fixed, so every hair rectangle is findable by its colour and no style is
    // compared against a different palette.
    hairColorId: 'black',
    outfitId: 't-shirt',
    ...overrides,
  };
}

/**
 * The smallest difference, in pixels, the shipped catalogue manages at `small`.
 *
 * Measured, not chosen: `t-shirt`/`sweatshirt` is the weakest pair in the whole
 * catalogue at 10px, and the weakest hair pair (`long`/`wavy`) manages 11. So a
 * new option has to be at least as legible as the ones already shipped, and no
 * more is claimed of the existing ones than they achieve.
 */
const MIN_PIXELS = 10;

type Box = readonly number[];

/**
 * What is measured of each rectangle.
 *
 * The corners are in here with the position and the size, because a rounded
 * edge is the whole of the difference for some styles: `scallop` changes
 * nothing but two radii, and a measurement blind to them would have rejected a
 * wave as a copy of a straight fall.
 */
const MEASURED = [
  'left',
  'top',
  'width',
  'height',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
] as const;

/** Every node in a rendered tree, flattened. */
function nodes(tree: unknown): Record<string, unknown>[] {
  if (tree === null || typeof tree !== 'object') {
    return [];
  }

  if (Array.isArray(tree)) {
    return tree.flatMap(nodes);
  }

  const node = tree as { children?: unknown };

  return [tree as Record<string, unknown>, ...nodes(node.children)];
}

/** A node's style rules, flattened out of the array the renderer passes. */
function styleOf(node: Record<string, unknown>): Record<string, unknown> {
  const props = node.props as { style?: unknown } | undefined;
  const style = props?.style;

  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter((rule) => typeof rule === 'object'));
  }

  return typeof style === 'object' && style !== null ? (style as Record<string, unknown>) : {};
}

/**
 * The rectangles drawn in one colour, as plain numbers.
 *
 * Rounded to whole pixels because that is the grain a screen has: a difference
 * of a third of a pixel is a difference nobody can see, and counting it would
 * make this test pass for reasons the eye does not share.
 */
function boxesInColour(tree: unknown, colours: readonly string[]): readonly Box[] {
  const wanted = new Set(colours);

  return nodes(tree)
    .map(styleOf)
    .filter((style) => typeof style.backgroundColor === 'string')
    .filter((style) => wanted.has(style.backgroundColor as string))
    .map((style) => MEASURED.map((key) => Math.round(Number(style[key] ?? 0))));
}

async function drawSmall(config: AvatarConfig): Promise<unknown> {
  const screen = await render(<AvatarPreview config={config} size="small" />);

  return screen.toJSON();
}

/**
 * How far apart two drawings are, in pixels.
 *
 * A different number of rectangles is an unmistakable difference — one of them
 * draws something the other does not — so it answers with the floor cleared
 * rather than with a number.
 */
function pixelDistance(left: readonly Box[], right: readonly Box[]): number {
  if (left.length !== right.length) {
    return Number.POSITIVE_INFINITY;
  }

  return left.reduce((worst, box, index) => {
    const other = right[index];
    const difference = box.reduce(
      (most, value, axis) => Math.max(most, Math.abs(value - other[axis])),
      0
    );

    return Math.max(worst, difference);
  }, 0);
}

describe('the hair styles at the small size', () => {
  it('tells every pair apart by at least the floor the catalogue already meets', async () => {
    // Both halves of the hair: the fringe is drawn in `base` and the length
    // behind the head in `shade`, and that length is most of what separates
    // `short` from `long`. Measuring one colour measured the wrong thing.
    const { hair } = resolveAvatarVisuals(config());
    const colours = [hair.base, hair.shade];
    const drawings: { id: string; boxes: readonly Box[] }[] = [];

    for (const style of AVATAR_HAIR_STYLES) {
      const tree = await drawSmall(config({ hairStyleId: style.id }));

      drawings.push({ id: style.id, boxes: boxesInColour(tree, colours) });
    }

    const tooClose = drawings.flatMap((left, index) =>
      drawings.slice(index + 1).flatMap((right) => {
        const distance = pixelDistance(left.boxes, right.boxes);

        return distance < MIN_PIXELS ? [`${left.id}/${right.id} = ${distance}px`] : [];
      })
    );

    expect(tooClose).toEqual([]);
  });

  it('draws hair for every style, so the measurement is of something', async () => {
    const { hair } = resolveAvatarVisuals(config());

    for (const style of AVATAR_HAIR_STYLES) {
      const tree = await drawSmall(config({ hairStyleId: style.id }));
      const drawn = boxesInColour(tree, [hair.base, hair.shade]).length;

      expect([style.id, drawn > 0]).toEqual([style.id, true]);
    }
  });
});

describe('the outfits at the small size', () => {
  it('tells every pair apart by at least the floor the catalogue already meets', async () => {
    const drawings: { id: string; boxes: readonly Box[] }[] = [];

    for (const outfit of AVATAR_OUTFITS) {
      // The garment and its neckline: the collar, placket and straps are drawn
      // in `trim`, and the neckline is most of what separates a shirt from a
      // t-shirt at this size.
      const { outfit: palette } = resolveAvatarVisuals(config({ outfitId: outfit.id }));
      const tree = await drawSmall(config({ outfitId: outfit.id }));

      drawings.push({
        id: outfit.id,
        boxes: boxesInColour(tree, [palette.base, palette.trim]),
      });
    }

    const tooClose = drawings.flatMap((left, index) =>
      drawings.slice(index + 1).flatMap((right) => {
        const distance = pixelDistance(left.boxes, right.boxes);

        return distance < MIN_PIXELS ? [`${left.id}/${right.id} = ${distance}px`] : [];
      })
    );

    expect(tooClose).toEqual([]);
  });
});
