import { StyleSheet } from 'react-native';

import { TAB_BAR_HEIGHT } from '../src/components/tab-bar';

/**
 * A tab screen has to leave room for the bar floating over it.
 *
 * The bar is positioned absolutely so that glass has the field behind it to
 * show through. The cost of that is the one every floating bar has: the last
 * row of a screen ends up underneath it, reachable only by over-scrolling and
 * on Android not at all. The screens pay it by padding their scroll content.
 *
 * This is a helper rather than four copies because it is one rule, and because
 * the failure it catches is invisible in a test that renders a screen and
 * reads its words - everything is present, correct and in the tree. It is only
 * wrong on a phone.
 */
export function expectClearsTabBar(tree: unknown): void {
  const paddings: number[] = [];

  const walk = (node: any): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);

      return;
    }

    if (node === null || typeof node !== 'object') return;

    if (typeof node.type === 'string' && node.type.includes('ScrollView')) {
      const flat = StyleSheet.flatten(node.props?.contentContainerStyle);

      if (typeof flat?.paddingBottom === 'number') paddings.push(flat.paddingBottom);
    }

    walk(node.children);
  };

  walk(tree);

  // A screen with no scroll view has nothing that can hide under the bar, so
  // it passes. A screen that scrolls has to clear it.
  for (const padding of paddings) {
    expect(padding).toBeGreaterThanOrEqual(TAB_BAR_HEIGHT);
  }
}
