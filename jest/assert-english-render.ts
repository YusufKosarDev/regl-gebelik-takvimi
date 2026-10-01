import type { RenderResult } from '@testing-library/react-native';

import { turkishOnlyStrings } from './turkish-vocabulary';

/** A rendered tree, as `toJSON()` describes it. */
type RenderedNode = {
  readonly children?: readonly (RenderedNode | string)[] | null;
};

/** Visits every piece of text in a rendered tree, already trimmed. */
function walk(node: unknown, visit: (text: string) => void): void {
  if (typeof node === 'string') {
    const text = node.trim();

    if (text !== '') {
      visit(text);
    }

    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      walk(child, visit);
    }

    return;
  }

  if (typeof node === 'object' && node !== null) {
    const { children } = node as RenderedNode;

    if (children != null) {
      for (const child of children) {
        walk(child, visit);
      }
    }
  }
}

/**
 * Fails when a screen rendered in English is showing Turkish catalogue text.
 *
 * ## Why an assertion about absence
 *
 * An English render test naturally asserts that the English words are there.
 * That is necessary and not sufficient: a half-translated screen shows the
 * English heading and the Turkish button, and a test that only looks for the
 * heading passes. Both bugs that reached the shipped app looked exactly like
 * that.
 *
 * Naming the Turkish strings one by one works, and `pregnancy-section-english`
 * does it for the one string it is about. This is the general form: it knows
 * every Turkish string in the app, so it catches the ones nobody thought to
 * name - including on a screen written next year.
 *
 * ## Why exact matches only
 *
 * A substring search would be a false-positive machine: "Sil" is inside
 * "Silver", "Ekle" could sit inside a longer word. The comparison is against
 * the whole trimmed text of a node, which is what a catalogue value is. The
 * cost is that interpolated text - a sentence built from a catalogue string
 * plus a number - is not matched. That is the function-valued gap described in
 * `turkish-vocabulary.ts`, and the lint rule covers the half of it that a test
 * cannot.
 */
export function expectNoTurkishCatalogueText(screen: RenderResult): void {
  const turkish = turkishOnlyStrings();
  const found: string[] = [];

  // `toJSON()` rather than the renderer's node tree: it is the documented
  // output of a render and it is a plain structure, so this helper does not
  // break when the testing library rearranges its internals.
  walk(screen.toJSON(), (text) => {
    if (turkish.has(text) && !found.includes(text)) {
      found.push(text);
    }
  });

  // Reported as a list rather than one at a time: a screen that leaked one
  // string has usually leaked the block it belongs to, and seeing all of them
  // is the difference between one fix and five test runs.
  expect(found).toEqual([]);
}
