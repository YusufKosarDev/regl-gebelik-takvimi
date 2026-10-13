import { StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';

/**
 * The shape every destructive confirmation in this app has to keep.
 *
 * Two rules, and both of them are about which control a thumb lands on by
 * accident rather than about what the words say:
 *
 *   - Cancel carries the one emphatic treatment the app has, a filled button
 *     in the accent. The destructive action is the outline beside it. All
 *     three panels used to have this the other way round, which put the
 *     loudest control on the screen on the one action that cannot be undone.
 *   - Cancel comes first. Six panels already did; three did not, and nothing
 *     written down said which was right.
 *
 * Asserted here rather than in each file so a fourth panel has somewhere to
 * look, and so the rule cannot drift apart between the three. The reasoning
 * lives in `deletion-messages.ts`.
 *
 * It reads the rendered buttons rather than the source: what matters is which
 * one is filled on the screen, and a panel could satisfy the rule with any
 * arrangement of styles that produces it.
 */
export function expectDestructiveConfirmation(
  buttons: readonly { label: string; style: unknown }[],
  labels: { readonly cancel: string; readonly destructive: string },
  accent: string
): void {
  const cancelIndex = buttons.findIndex((button) => button.label === labels.cancel);
  const destructiveIndex = buttons.findIndex((button) => button.label === labels.destructive);

  if (cancelIndex < 0) throw new Error(`no button labelled "${labels.cancel}"`);
  if (destructiveIndex < 0) throw new Error(`no button labelled "${labels.destructive}"`);

  const fill = (index: number): unknown =>
    (StyleSheet.flatten(buttons[index].style as ViewStyle) as ViewStyle | undefined)
      ?.backgroundColor;

  // The safe choice is the filled one.
  expect(fill(cancelIndex)).toBe(accent);
  // And the destructive one is not: an outline, whatever colour its border is.
  expect(fill(destructiveIndex)).not.toBe(accent);
  // Cancel is reached first.
  expect(cancelIndex).toBeLessThan(destructiveIndex);
}
